import Link from "next/link";
import { ArrowRight, Dumbbell, Shield, Smartphone } from "lucide-react";

import { Button } from "@/components/ui/button";
import { auth } from "@/lib/auth";

export default async function HomePage() {
  const session = await auth();

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(156,238,58,0.14),transparent_34%),linear-gradient(180deg,#111,#050505_58%)] px-4 py-6 text-foreground">
      <div className="mx-auto flex min-h-[calc(100vh-3rem)] w-full max-w-5xl flex-col">
        <header className="flex items-center justify-between">
          <Link href="/" className="text-lg font-semibold">
            Ascension
          </Link>
          <Button asChild variant="ghost" size="sm">
            <Link href={session ? "/dashboard" : "/sign-in"}>
              {session ? "Dashboard" : "Sign in"}
            </Link>
          </Button>
        </header>
        <section className="grid flex-1 items-center gap-10 py-12 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="space-y-7">
            <div className="inline-flex rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-sm font-medium text-primary">
              Strength, macros, progress
            </div>
            <div className="space-y-5">
              <h1 className="max-w-3xl text-5xl font-semibold tracking-normal sm:text-6xl lg:text-7xl">
                Ascension
              </h1>
              <p className="max-w-xl text-lg leading-8 text-muted-foreground">
                Premium workout and nutrition tracking for lifters who care about fast logging,
                progressive overload, and clean body progress data.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg">
                <Link href={session ? "/dashboard" : "/sign-up"}>
                  Start tracking <ArrowRight className="size-4" aria-hidden="true" />
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg">
                <Link href="/sign-in">I already have an account</Link>
              </Button>
            </div>
          </div>
          <div className="glass-panel rounded-lg p-4">
            <div className="space-y-3 rounded-md bg-black/40 p-4">
              {[
                { icon: Dumbbell, label: "Bench Press", value: "80kg x 8 @ RIR1" },
                { icon: Smartphone, label: "Calories left", value: "620 kcal" },
                { icon: Shield, label: "Private data", value: "User-scoped by default" }
              ].map((item) => (
                <div
                  key={item.label}
                  className="flex min-h-16 items-center justify-between rounded-md border border-white/10 bg-white/[0.04] px-4"
                >
                  <div className="flex items-center gap-3">
                    <item.icon className="size-5 text-primary" aria-hidden="true" />
                    <span className="text-sm text-muted-foreground">{item.label}</span>
                  </div>
                  <span className="text-sm font-semibold">{item.value}</span>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
