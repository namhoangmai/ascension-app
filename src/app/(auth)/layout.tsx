import Link from "next/link";
import type { ReactNode } from "react";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(156,238,58,0.12),transparent_32%),linear-gradient(180deg,#111,#050505_60%)] px-4 py-6 text-foreground">
      <div className="mx-auto flex min-h-[calc(100vh-3rem)] w-full max-w-md flex-col">
        <header className="flex items-center justify-between">
          <Link href="/" className="text-lg font-semibold">
            Ascension
          </Link>
          <Link
            href="/"
            className="rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-white/5 hover:text-foreground"
          >
            Home
          </Link>
        </header>
        <div className="flex flex-1 items-center py-10">{children}</div>
      </div>
    </main>
  );
}
