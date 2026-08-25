import Link from "next/link";
import type { ReactNode } from "react";
import { LogOut, UserCircle } from "lucide-react";

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
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(156,238,58,0.10),transparent_30%),linear-gradient(180deg,#111,#050505_55%)]">
      <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col">
        <header className="sticky top-0 z-30 border-b border-white/10 bg-background/80 px-4 py-4 backdrop-blur-xl">
          <div className="flex items-center justify-between">
            <Link href="/dashboard" className="text-lg font-semibold tracking-normal">
              Ascension
            </Link>
            <div className="flex items-center gap-2">
              <Link
                href="/profile"
                className="inline-flex min-h-10 items-center gap-3 rounded-md border border-white/10 bg-white/5 px-2.5 py-1.5 text-sm text-foreground transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span className="grid size-7 place-items-center overflow-hidden rounded-full bg-primary/15 text-xs font-semibold text-primary">
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
                  className="inline-flex size-10 items-center justify-center rounded-md border border-white/10 bg-white/5 text-muted-foreground transition-colors hover:bg-white/10 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  aria-label="Sign out"
                >
                  <LogOut className="size-4" aria-hidden="true" />
                </button>
              </form>
            </div>
          </div>
        </header>
        <main className="safe-page flex-1 px-4 py-5 sm:px-6 lg:px-8">{children}</main>
        <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-background/90 px-2 pb-[env(safe-area-inset-bottom)] pt-2 backdrop-blur-xl md:hidden">
          <div className="mx-auto grid max-w-lg grid-cols-8">
            {primaryNavigation.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex min-h-12 flex-col items-center justify-center gap-1 rounded-md text-[11px] font-medium text-muted-foreground",
                  "transition-colors hover:bg-white/5 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
