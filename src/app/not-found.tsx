import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 text-foreground">
      <div className="animate-rise-in max-w-md space-y-5 text-center">
        <p className="text-sm font-medium text-muted-foreground">404</p>
        <h1 className="text-headline">Page not found</h1>
        <p className="text-base text-muted-foreground">
          This screen is not part of the current phase.
        </p>
        <Button asChild size="lg">
          <Link href="/dashboard">Back to dashboard</Link>
        </Button>
      </div>
    </main>
  );
}
