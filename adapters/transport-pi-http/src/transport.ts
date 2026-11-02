import type { Transport } from '@lab/framework';
import type { PiContext } from '@lab/harness-pi';
import type { ChatRoute } from 'durable-harness';
import { type PiChatRouteOptions, chatRoute } from 'durable-harness/pi-durable';

export type PiHttpOptions = Pick<
  PiChatRouteOptions,
  'authorize' | 'keepaliveMs' | 'allowPublicSandbox'
>;

export class PiHttpTransport implements Transport<Request, Response> {
  private readonly route: ChatRoute;

  constructor(
    harness: { readonly context: PiContext },
    options: PiHttpOptions
  ) {
    this.route = chatRoute({ ...options, ...harness.context });
  }

  send(request: Request) {
    return this.route.POST(request);
  }

  receive(request: Request) {
    return this.route.GET(request);
  }
}
