import { useCallback, useEffect, useRef, useState } from "react";

export function useSession() {
  const [status, setStatus] = useState<
    "checking" | "authenticated" | "anonymous" | "unavailable"
  >("checking");
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);
  const active = useRef<AbortController | undefined>(undefined);

  const request = useCallback(
    async (method: "GET" | "POST" | "DELETE", password?: string) => {
      if (active.current !== undefined) {
        return;
      }

      const controller = new AbortController();
      active.current = controller;
      setPending(true);
      setError(undefined);

      try {
        const response = await fetch("/auth/session", {
          method,
          credentials: "same-origin",
          cache: "no-store",
          headers: {
            "X-Lab-Request": "1",
            ...(method === "POST"
              ? { "Content-Type": "application/json" }
              : {}),
          },
          body: method === "POST" ? JSON.stringify({ password }) : undefined,
          signal: AbortSignal.any([
            controller.signal,
            AbortSignal.timeout(15_000),
          ]),
        });

        if (controller.signal.aborted) {
          return;
        }

        if (response.status === 204) {
          setStatus(method === "DELETE" ? "anonymous" : "authenticated");
        } else if (response.status === 401) {
          setStatus("anonymous");

          if (method === "POST") {
            setError("Incorrect password.");
          }
        } else {
          throw new Error(
            response.status === 429
              ? "Too many sign-in attempts. Try again in a minute."
              : "Unable to reach your session. Please try again.",
          );
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          if (method === "GET") {
            setStatus((current) =>
              current === "checking" ? "unavailable" : current,
            );
          }

          setError(
            error instanceof Error
              ? error.message
              : "Unable to reach your session. Please try again.",
          );
        }
      } finally {
        if (active.current === controller) {
          active.current = undefined;
          setPending(false);
        }
      }
    },
    [],
  );

  useEffect(() => {
    const refresh = () => void request("GET");
    refresh();
    const timer = setInterval(refresh, 60_000);
    window.addEventListener("focus", refresh);

    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", refresh);
      active.current?.abort();
      active.current = undefined;
    };
  }, [request]);

  return {
    status,
    error,
    pending,
    login: (password: string) => request("POST", password),
    logout: () => request("DELETE"),
    refresh: () => request("GET"),
  };
}
