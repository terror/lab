import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { ChordError } from "@earendil-works/chord";

export type BrowserPrincipal = { kind: "browser"; sessionId: string };
export type Principal = { kind: "server" } | BrowserPrincipal;

type Session = {
  principal: BrowserPrincipal;
  tokenHash: Buffer;
  expiresAt: number;
  timer: ReturnType<typeof setTimeout>;
};

const sessionLifetime = 12 * 60 * 60 * 1000;

export class Sessions {
  private readonly sessions = new Map<string, Session>();
  private readonly cookieName: string;
  private attempts = 0;
  private retryAt = 0;
  private verifying = false;
  private closed = false;

  private constructor(
    private readonly origin: URL,
    private readonly passwordHash: string,
    private readonly onRevoke: (principal: BrowserPrincipal) => Promise<void>,
  ) {
    this.cookieName =
      origin.protocol === "https:" ? "__Host-lab-session" : "lab-session";
  }

  static async open(
    options: { origin: string; password: string },
    onRevoke: (principal: BrowserPrincipal) => Promise<void>,
  ) {
    if (options.password.length === 0 || options.password.length > 1024) {
      throw new Error(
        "LAB_PASSWORD must contain between 1 and 1024 characters",
      );
    }

    const origin = new URL(options.origin);

    if (
      origin.username !== "" ||
      origin.password !== "" ||
      origin.pathname !== "/" ||
      origin.search !== "" ||
      origin.hash !== "" ||
      (origin.protocol !== "https:" &&
        (origin.protocol !== "http:" ||
          !["127.0.0.1", "localhost", "[::1]"].includes(origin.hostname)))
    ) {
      throw new Error(
        "LAB_ORIGIN must be an HTTPS origin or an HTTP loopback origin",
      );
    }

    return new Sessions(
      origin,
      await Bun.password.hash(options.password, { algorithm: "argon2id" }),
      onRevoke,
    );
  }

  allows(request: Request, websocket = false) {
    const origin = request.headers.get("origin");
    const site = request.headers.get("sec-fetch-site");

    return (
      request.headers.get("host") === this.origin.host &&
      (origin === this.origin.origin ||
        (!websocket && request.method === "GET" && origin === null)) &&
      (site === null || site === "same-origin") &&
      (websocket || request.headers.get("x-lab-request") === "1")
    );
  }

  principal(request: Request): BrowserPrincipal | undefined {
    const cookie = new Bun.CookieMap(request.headers.get("cookie") ?? "").get(
      this.cookieName,
    );

    if (cookie === null || cookie.length > 128) {
      return undefined;
    }

    const [id, token, extra] = cookie.split(".");
    const session = id === undefined ? undefined : this.sessions.get(id);

    if (
      session === undefined ||
      token === undefined ||
      token.length !== 43 ||
      extra !== undefined ||
      !timingSafeEqual(session.tokenHash, this.hash(token)) ||
      !this.active(session.principal)
    ) {
      return undefined;
    }

    return session.principal;
  }

  active(principal: BrowserPrincipal) {
    const session = this.sessions.get(principal.sessionId);

    if (session === undefined) {
      return false;
    }

    if (session.expiresAt <= Date.now()) {
      void this.revoke(principal).catch((error) => this.report(error));
      return false;
    }

    return true;
  }

  authorize(principal: Principal) {
    if (principal.kind !== "server" && !this.active(principal)) {
      throw new ChordError("forbidden", "Session expired or revoked");
    }
  }

  async handle(request: Request) {
    if (!this.allows(request)) {
      return this.response(403);
    }

    if (request.method === "GET") {
      return this.response(this.principal(request) === undefined ? 401 : 204);
    }

    if (request.method === "DELETE") {
      const principal = this.principal(request);

      if (principal !== undefined) {
        await this.revoke(principal);
      }

      return this.response(204, { "Set-Cookie": this.cookie("", 0) });
    }

    if (request.method !== "POST") {
      return this.response(405, { Allow: "GET, POST, DELETE" });
    }

    if (
      request.headers.get("content-type")?.split(";")[0] !== "application/json"
    ) {
      return this.response(415);
    }

    const input: unknown = await request.json().catch(() => undefined);

    if (
      typeof input !== "object" ||
      input === null ||
      !("password" in input) ||
      Object.keys(input).length !== 1 ||
      typeof input.password !== "string" ||
      input.password.length === 0 ||
      input.password.length > 1024
    ) {
      return this.response(400);
    }

    const now = Date.now();

    if (now >= this.retryAt) {
      this.attempts = 0;
      this.retryAt = now + 60_000;
    }

    if (this.verifying || this.attempts >= 10) {
      return this.response(429, {
        "Retry-After": String(
          Math.max(1, Math.ceil((this.retryAt - now) / 1000)),
        ),
      });
    }

    this.attempts += 1;
    this.verifying = true;

    try {
      if (!(await Bun.password.verify(input.password, this.passwordHash))) {
        return this.response(401);
      }

      if (this.closed) {
        return this.response(503);
      }

      const previous = this.principal(request);

      if (previous !== undefined) {
        await this.revoke(previous);
      }

      const oldest = this.sessions.values().next().value;

      if (this.sessions.size >= 32 && oldest !== undefined) {
        await this.revoke(oldest.principal);
      }

      if (this.closed) {
        return this.response(503);
      }

      const principal = {
        kind: "browser" as const,
        sessionId: crypto.randomUUID(),
      };
      const token = randomBytes(32).toString("base64url");
      const timer = setTimeout(() => {
        void this.revoke(principal).catch((error) => this.report(error));
      }, sessionLifetime);
      timer.unref();

      this.sessions.set(principal.sessionId, {
        principal,
        tokenHash: this.hash(token),
        expiresAt: Date.now() + sessionLifetime,
        timer,
      });

      return this.response(204, {
        "Set-Cookie": this.cookie(
          `${principal.sessionId}.${token}`,
          sessionLifetime / 1000,
        ),
      });
    } finally {
      this.verifying = false;
    }
  }

  close() {
    this.closed = true;

    for (const session of this.sessions.values()) {
      clearTimeout(session.timer);
    }

    this.sessions.clear();
  }

  private async revoke(principal: BrowserPrincipal) {
    const session = this.sessions.get(principal.sessionId);

    if (session === undefined) {
      return;
    }

    this.sessions.delete(principal.sessionId);
    clearTimeout(session.timer);
    await this.onRevoke(principal);
  }

  private hash(token: string) {
    return createHash("sha256").update(token).digest();
  }

  private cookie(value: string, maxAge: number) {
    return new Bun.Cookie(this.cookieName, value, {
      path: "/",
      httpOnly: true,
      sameSite: "strict",
      secure: this.origin.protocol === "https:",
      maxAge,
    }).serialize();
  }

  private response(status: number, headers?: Record<string, string>) {
    return new Response(null, {
      status,
      headers: { "Cache-Control": "no-store", ...headers },
    });
  }

  private report(error: unknown) {
    console.error("Lab session revocation failed:", error);
  }
}
