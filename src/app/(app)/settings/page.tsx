import { redirect } from "next/navigation";

// `/settings`'s content has been absorbed into `/profile` (see the ProfileSettingsPanel there).
// This route is kept only so old bookmarks and the installed PWA's cached shell still land
// somewhere useful instead of a stale or broken page.
export default function SettingsPage() {
  redirect("/profile");
}
