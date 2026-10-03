import type { Route } from "next";

import { LandingPageView } from "@/app/_components/landing-page-view";
import { getCurrentUser } from "@/lib/auth/server";

export default async function HomePage() {
  // The marketing page must never 500: getCurrentUser() hits the DB for signed-in users and
  // fails closed by throwing, so fall back to the signed-out view.
  const user = await getCurrentUser().catch(() => null);
  const primaryHref = (user ? "/dashboard" : "/sign-up") as Route;
  const secondaryHref = (user ? "/dashboard" : "/sign-in") as Route;

  return (
    <LandingPageView
      primaryHref={primaryHref}
      primaryLabel={user ? "Open dashboard" : "Start tracking"}
      secondaryHref={secondaryHref}
      secondaryLabel={user ? "Review today" : "Sign in"}
      navActionLabel={user ? "Dashboard" : "Sign up"}
      navProfile={
        user
          ? {
              name: user.name,
              email: user.email,
              image: user.image
            }
          : undefined
      }
    />
  );
}
