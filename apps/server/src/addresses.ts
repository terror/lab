import { lookup } from 'node:dns/promises';
import http from 'node:http';
import https from 'node:https';
import { BlockList, isIP } from 'node:net';

const blocked = new BlockList();

for (const [network, prefix] of [
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.0.0.0', 24],
  ['192.168.0.0', 16],
  ['198.18.0.0', 15],
  ['224.0.0.0', 4],
  ['240.0.0.0', 4],
] as const) {
  blocked.addSubnet(network, prefix, 'ipv4');
}

for (const [network, prefix] of [
  ['::', 127],
  ['64:ff9b::', 96],
  ['fc00::', 7],
  ['fe80::', 10],
  ['ff00::', 8],
] as const) {
  blocked.addSubnet(network, prefix, 'ipv6');
}

const MAPPED = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i;

export const PRIVATE_ADDRESS =
  'Connectors can only reach public internet addresses';

export function isPrivateAddress(address: string) {
  const mapped = MAPPED.exec(address)?.[1];

  if (mapped) {
    return blocked.check(mapped, 'ipv4');
  }

  return blocked.check(address, isIP(address) === 6 ? 'ipv6' : 'ipv4');
}

export async function checkPublicUrl(url: URL) {
  await resolveAddress(url.hostname.replace(/^\[|\]$/g, ''), isPrivateAddress);
}

type Check = (address: string) => boolean;

async function resolveAddress(host: string, refuse: Check) {
  const addresses = isIP(host)
    ? [host]
    : (await lookup(host, { all: true }))
        .toSorted((a, b) => a.family - b.family)
        .map(({ address }) => address);

  const [first] = addresses;

  if (!first || addresses.some(refuse)) {
    throw new Error(PRIVATE_ADDRESS);
  }

  return first;
}

const NULL_BODY = new Set([204, 205, 304]);

export async function guardedFetch(
  url: string | URL,
  init: RequestInit | undefined,
  refuse: Check
) {
  const target = new URL(url);

  const host = target.hostname.replace(/^\[|\]$/g, '');

  const address = await resolveAddress(host, refuse);

  const request = new Request(target.href, init);

  const body = request.body
    ? Buffer.from(await request.arrayBuffer())
    : undefined;

  return new Promise<Response>((resolve, reject) => {
    const outgoing = (target.protocol === 'https:' ? https : http).request(
      {
        headers: { ...Object.fromEntries(request.headers), host: target.host },
        host: address,
        method: request.method,
        path: `${target.pathname}${target.search}`,
        port: target.port || (target.protocol === 'https:' ? 443 : 80),
        protocol: target.protocol,
        servername: isIP(host) ? undefined : host,
        signal: init?.signal ?? undefined,
      },
      (response) => {
        const status = response.statusCode ?? 502;

        const headers = new Headers();

        for (const [name, value] of Object.entries(response.headers)) {
          for (const item of [value ?? []].flat()) {
            headers.append(name, item);
          }
        }

        resolve(
          new Response(
            NULL_BODY.has(status)
              ? null
              : new ReadableStream<Uint8Array>({
                  cancel: () => {
                    response.destroy();
                  },
                  start: (controller) => {
                    response.on('data', (chunk: Buffer) =>
                      controller.enqueue(new Uint8Array(chunk))
                    );
                    response.on('end', () => controller.close());
                    response.on('error', (error) => controller.error(error));
                  },
                }),
            { headers, status, statusText: response.statusMessage }
          )
        );
      }
    );

    outgoing.on('error', reject);
    outgoing.end(body);
  });
}

export function publicFetch(url: string | URL, init?: RequestInit) {
  return guardedFetch(url, init, isPrivateAddress);
}
