"use client";

import { Button } from "@/components/ui/button";

export default function GlobalError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en" className="dark">
      <body>
        <main className="flex min-h-screen items-center justify-center bg-background px-4 text-foreground">
          <div className="max-w-md space-y-4 text-center">
            <p className="text-sm font-medium text-primary">Something went wrong</p>
            <h1 className="text-3xl font-semibold">Ascension hit an error.</h1>
            <p className="text-sm text-muted-foreground">{error.digest ?? error.message}</p>
            <Button type="button" onClick={reset}>
              Try again
            </Button>
          </div>
        </main>
      </body>
    </html>
  );
}
