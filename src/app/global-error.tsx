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
          <div className="animate-rise-in max-w-md space-y-5 text-center">
            <p className="text-sm font-medium text-muted-foreground">Something went wrong</p>
            <h1 className="text-headline">Ascension hit an error.</h1>
            <p className="text-sm text-muted-foreground">{error.digest ?? error.message}</p>
            <Button type="button" size="lg" onClick={reset}>
              Try again
            </Button>
          </div>
        </main>
      </body>
    </html>
  );
}
