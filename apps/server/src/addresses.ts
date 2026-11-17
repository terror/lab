import { lookup } from 'node:dns/promises';
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
  const host = url.hostname.replace(/^\[|\]$/g, '');

  const addresses = isIP(host)
    ? [host]
    : (await lookup(host, { all: true })).map(({ address }) => address);

  if (addresses.length === 0 || addresses.some(isPrivateAddress)) {
    throw new Error(PRIVATE_ADDRESS);
  }
}

export async function publicFetch(url: string | URL, init?: RequestInit) {
  await checkPublicUrl(new URL(url));

  return fetch(url, { ...init, redirect: 'error' });
}
