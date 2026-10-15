import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export function App() {
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
