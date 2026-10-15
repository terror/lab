import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useSession } from "@/lib/session";

export function App() {
  const session = useSession();

  if (session.status !== "authenticated") {
    return (
      <main className="flex min-h-svh items-center justify-center bg-background p-6 text-foreground">
        <div className="w-full max-w-sm space-y-6">
          <div className="space-y-2">
            <h1 className="text-2xl font-semibold tracking-tight">
              Sign in to Lab
            </h1>
            <p className="text-sm text-muted-foreground">
              Enter your workspace password to continue.
            </p>
          </div>
          {session.status === "checking" ? (
            <p role="status" className="text-sm text-muted-foreground">
              Checking your session…
            </p>
          ) : session.status === "unavailable" ? (
            <Button
              disabled={session.pending}
              onClick={() => void session.refresh()}
              type="button"
            >
              Retry
            </Button>
          ) : (
            <form
              className="space-y-4"
              onSubmit={(event) => {
                event.preventDefault();
                const form = event.currentTarget;
                const password = new FormData(form).get("password");
                form.reset();

                if (typeof password === "string") {
                  void session.login(password);
                }
              }}
            >
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="password">
                  Password
                </label>
                <input
                  aria-describedby={session.error ? "session-error" : undefined}
                  autoComplete="current-password"
                  className="h-10 w-full rounded-md border border-input bg-transparent px-3 text-base outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-50"
                  disabled={session.pending}
                  id="password"
                  maxLength={1024}
                  name="password"
                  required
                  type="password"
                />
              </div>
              <Button
                className="w-full"
                disabled={session.pending}
                type="submit"
              >
                {session.pending ? "Signing in…" : "Sign in"}
              </Button>
            </form>
          )}
          {session.error && (
            <p
              className="text-sm text-destructive"
              id="session-error"
              role="alert"
            >
              {session.error}
            </p>
          )}
        </div>
      </main>
    );
  }

  return (
    <div className="flex min-h-svh flex-col bg-background text-foreground md:flex-row">
      <aside className="flex flex-col gap-6 border-b bg-muted/30 p-6 md:w-64 md:border-r md:border-b-0">
        <div>
          <p className="text-lg font-semibold tracking-tight">Lab</p>
          <p className="text-sm text-muted-foreground">
            Personal agent workspace
          </p>
        </div>
        <Button disabled type="button" variant="outline">
          New conversation
        </Button>
        <nav aria-label="Conversations" className="space-y-2">
          <h2 className="text-sm font-medium">Conversations</h2>
          <p className="text-sm text-muted-foreground">No conversations yet.</p>
        </nav>
        <div className="mt-auto space-y-3">
          {session.error && (
            <p className="text-sm text-destructive" role="alert">
              {session.error}
            </p>
          )}
          <Button
            disabled={session.pending}
            onClick={() => void session.logout()}
            type="button"
            variant="ghost"
          >
            Sign out
          </Button>
        </div>
      </aside>
      <main className="flex min-w-0 flex-1 flex-col">
        <header className="border-b px-6 py-4">
          <h1 className="font-medium">Conversation</h1>
        </header>
        <div className="flex flex-1 items-center justify-center px-6 py-20">
          <div className="max-w-sm space-y-2 text-center">
            <h2 className="text-2xl font-semibold tracking-tight">
              A place for your work
            </h2>
            <p className="text-sm text-muted-foreground">
              Conversations with your agents will appear here.
            </p>
          </div>
        </div>
        <div className="mx-auto w-full max-w-3xl space-y-3 p-6">
          <label className="text-sm font-medium" htmlFor="message">
            Message
          </label>
          <Textarea
            aria-describedby="composer-status"
            disabled
            id="message"
            placeholder="Write a message…"
          />
          <div className="flex items-center justify-between gap-4">
            <p className="text-xs text-muted-foreground" id="composer-status">
              Conversations are not available yet.
            </p>
            <Button disabled type="button">
              Send
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}
