import { ArrowRight, LoaderCircle } from "lucide-react";
import { lazy, Suspense } from "react";
import { LabMark } from "@/components/lab-mark";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useSession } from "@/hooks/use-session";

const Workspace = lazy(() => import("@/components/workspace"));

export function App() {
  const session = useSession();

  if (session.status === "checking") {
    return <WorkspaceLoading />;
  }

  if (session.status !== "authenticated") {
    return (
      <main className="workspace-canvas flex min-h-dvh items-center justify-center bg-background p-6 text-foreground">
        <div className="panel-frame w-full max-w-md space-y-8 border bg-card p-6 sm:p-10">
          <div className="space-y-3">
            <div className="mb-8 flex items-center gap-3">
              <LabMark className="size-10" />
              <span className="font-mono text-xs tracking-[0.16em] text-muted-foreground uppercase">
                lab / workspace
              </span>
            </div>
            <h1 className="text-4xl font-normal tracking-tight">
              Welcome to lab
            </h1>
            <p className="text-base leading-6 text-muted-foreground">
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
                <label
                  className="font-mono text-xs tracking-wider uppercase"
                  htmlFor="password"
                >
                  Password
                </label>
                <Input
                  aria-describedby={session.error ? "session-error" : undefined}
                  autoComplete="current-password"
                  className="h-11 rounded-sm bg-background/50 shadow-none"
                  disabled={session.pending}
                  id="password"
                  maxLength={1024}
                  name="password"
                  required
                  type="password"
                />
              </div>
              <Button
                className="h-11 w-full rounded-sm"
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
      className="workspace-canvas flex min-h-dvh flex-col items-center justify-center gap-4 bg-background text-muted-foreground"
      role="status"
    >
      <LabMark className="size-12" />
      <span className="font-mono text-xs tracking-wide">Opening lab…</span>
    </main>
  );
}
