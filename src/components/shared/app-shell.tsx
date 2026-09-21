import Link from "next/link";
import type { ReactNode } from "react";
import { LogOut, UserCircle } from "lucide-react";

import { ThemeToggle } from "@/components/shared/theme-toggle";
import type { ProfileWithUser } from "@/features/profile/types";
import { displayNameForProfile } from "@/features/profile/types";
import { signOutCurrentUserAction } from "@/lib/auth/actions";
import { primaryNavigation } from "@/lib/constants/navigation";
import { cn } from "@/lib/utils";

interface AppShellProps {
  children: ReactNode;
  profile: ProfileWithUser;
}

export function AppShell({ children, profile }: AppShellProps) {
  const displayName = displayNameForProfile(profile);
  const initials = displayName
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col">
        <header className="sticky top-0 z-30 border-b border-border/60 bg-background/70 px-4 py-3 backdrop-blur-xl backdrop-saturate-150 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <Link
              href="/dashboard"
              className="rounded-full text-lg font-semibold tracking-tight focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              Ascension
            </Link>
            <div className="flex items-center gap-1.5">
              <ThemeToggle />
              <Link
                href="/profile"
                className="press inline-flex min-h-10 items-center gap-2.5 rounded-full border border-border bg-muted/60 py-1 pl-1.5 pr-3 text-sm text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span className="grid size-7 place-items-center overflow-hidden rounded-full bg-foreground text-xs font-semibold text-background">
                  {profile.profileImageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={profile.profileImageUrl} alt="" className="size-full object-cover" />
                  ) : initials ? (
                    initials
                  ) : (
                    <UserCircle className="size-4" aria-hidden="true" />
                  )}
                </span>
                <span className="hidden max-w-32 truncate sm:block">{displayName}</span>
              </Link>
              <form action={signOutCurrentUserAction}>
                <button
                  type="submit"
                  className="press inline-flex size-10 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-foreground/10 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  aria-label="Sign out"
                >
                  <LogOut className="size-4" aria-hidden="true" />
                </button>
              </form>
            </div>
          </div>
        </header>
        <main className="safe-page animate-fade-in flex-1 px-4 py-6 sm:px-6 lg:px-8">
          {children}
        </main>
        <nav
          aria-label="Primary"
          className="fixed inset-x-0 bottom-0 z-40 border-t border-border/60 bg-background/75 px-2 pb-[env(safe-area-inset-bottom)] pt-2 backdrop-blur-xl backdrop-saturate-150 md:hidden"
        >
          <div className="mx-auto grid max-w-lg grid-cols-8">
            {primaryNavigation.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "press flex min-h-12 flex-col items-center justify-center gap-1 rounded-xl text-[11px] font-medium text-muted-foreground",
                  "transition-colors hover:bg-foreground/5 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                )}
              >
                <item.icon className="size-5" aria-hidden="true" />
                <span className="sr-only sm:not-sr-only">{item.label}</span>
              </Link>
            ))}
          </div>
        </nav>
      </div>
    </div>
  );
}
