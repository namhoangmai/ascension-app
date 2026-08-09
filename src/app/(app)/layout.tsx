import type { ReactNode } from "react";

import { AppShell } from "@/components/shared/app-shell";
import { getRequiredCompletedProfile } from "@/features/profile/server";

export default async function ProductLayout({ children }: { children: ReactNode }) {
  const profile = await getRequiredCompletedProfile();

  return <AppShell profile={profile}>{children}</AppShell>;
}
