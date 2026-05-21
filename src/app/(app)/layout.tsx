import type { ReactNode } from "react";

import { AppShell } from "@/components/shared/app-shell";
import { requireUser } from "@/lib/auth/server";

export default async function ProductLayout({ children }: { children: ReactNode }) {
  await requireUser();

  return <AppShell>{children}</AppShell>;
}
