import Link from "next/link";
import type { ReactNode } from "react";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="animate-fade-in min-h-screen bg-background px-4 py-6 text-foreground">
      <div className="mx-auto flex min-h-[calc(100vh-3rem)] w-full max-w-lg flex-col">
        <header className="flex items-center justify-between">
          <Link href="/" className="text-lg font-semibold">
            Ascension
          </Link>
          <Link
            href="/"
            className="press rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            Home
          </Link>
        </header>
        <div className="flex flex-1 items-center py-10">{children}</div>
      </div>
    </main>
  );
}
