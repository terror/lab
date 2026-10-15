import { lazy, Suspense } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useSession } from "@/lib/session";

const Workspace = lazy(() => import("@/components/workspace"));

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
                <Input
                  aria-describedby={session.error ? "session-error" : undefined}
                  autoComplete="current-password"
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
    <Suspense
      fallback={
        <main
          className="flex min-h-svh items-center justify-center p-6 text-sm text-muted-foreground"
          role="status"
        >
          Loading workspace…
        </main>
      }
    >
      <Workspace session={session} />
    </Suspense>
  );
}
