import type { Route } from "next";

import { LandingPageView } from "@/app/_components/landing-page-view";
import { auth } from "@/lib/auth";

export default async function HomePage() {
  const session = await auth();
  const primaryHref = (session ? "/dashboard" : "/sign-up") as Route;
  const secondaryHref = (session ? "/dashboard" : "/sign-in") as Route;

  return (
    <LandingPageView
      primaryHref={primaryHref}
      primaryLabel={session ? "Open dashboard" : "Start tracking"}
      secondaryHref={secondaryHref}
      secondaryLabel={session ? "Review today" : "Sign in"}
      navActionLabel={session ? "Dashboard" : "Sign in"}
    />
  );
}
