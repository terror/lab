import { ArrowRight, FlaskConical, LoaderCircle } from "lucide-react";
import { lazy, Suspense } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useSession } from "@/lib/session";

const Workspace = lazy(() => import("@/components/workspace"));

export function App() {
  const session = useSession();

  if (session.status === "checking") {
    return <WorkspaceLoading />;
  }

  if (session.status !== "authenticated") {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-background p-6 text-foreground">
        <div className="w-full max-w-sm space-y-8">
          <div className="space-y-3">
            <div className="mb-6 flex size-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
              <FlaskConical aria-hidden="true" className="size-6" />
            </div>
            <h1 className="text-3xl font-medium tracking-tight">
              Welcome to lab
            </h1>
            <p className="text-sm text-muted-foreground">
              Enter your workspace password to continue.
            </p>
          </div>
          {session.status === "unavailable" ? (
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
                  className="h-11 rounded-xl"
                  disabled={session.pending}
                  id="password"
                  maxLength={1024}
                  name="password"
                  required
                  type="password"
                />
              </div>
              <Button
                className="h-11 w-full rounded-xl"
                disabled={session.pending}
                type="submit"
              >
                {session.pending ? "Signing in…" : "Sign in"}
                {session.pending ? (
                  <LoaderCircle className="size-4 motion-safe:animate-spin" />
                ) : (
                  <ArrowRight className="size-4" />
                )}
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
    <Suspense fallback={<WorkspaceLoading />}>
      <Workspace session={session} />
    </Suspense>
  );
}

function WorkspaceLoading() {
  return (
    <main
      className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-background text-muted-foreground"
      role="status"
    >
      <FlaskConical className="size-7" aria-hidden="true" />
      <span className="text-sm">Opening lab…</span>
    </main>
  );
}
