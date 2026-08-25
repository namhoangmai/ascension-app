import Link from "next/link";
import { CalendarDays, Dumbbell, Gauge, Ruler, Scale, Target, UserRound } from "lucide-react";

import { Button } from "@/components/ui/button";
import { getRequiredCompletedProfile } from "@/features/profile/server";
import {
  displayNameForProfile,
  fitnessGoalLabels,
  profileCompletionPercentage,
  trainingExperienceLabels,
  trainingStyleLabels
} from "@/features/profile/types";

export default async function ProfilePage() {
  const profile = await getRequiredCompletedProfile();
  const displayName = displayNameForProfile(profile);
  const completion = profileCompletionPercentage(profile);
  const completionWidth = `${String(completion)}%`;

  const stats = [
    {
      label: "Current weight",
      value: profile.weightKg ? `${profile.weightKg.toString()} kg` : "Not set",
      icon: Scale
    },
    {
      label: "Height",
      value: profile.heightCm ? `${profile.heightCm.toString()} cm` : "Not set",
      icon: Ruler
    },
    {
      label: "Main goal",
      value: profile.mainFitnessGoal ? fitnessGoalLabels[profile.mainFitnessGoal] : "Not set",
      icon: Target
    },
    {
      label: "Training",
      value: `${String(profile.trainingFrequency ?? 0)} days/week`,
      icon: CalendarDays
    },
    {
      label: "Experience",
      value: profile.trainingExperience
        ? trainingExperienceLabels[profile.trainingExperience]
        : "Not set",
      icon: Gauge
    },
    {
      label: "Target weight",
      value: profile.targetWeightKg ? `${profile.targetWeightKg.toString()} kg` : "Not set",
      icon: Dumbbell
    }
  ];

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-lg border border-white/10 bg-card/80 shadow-lg shadow-black/20">
        <div className="h-28 bg-[radial-gradient(circle_at_20%_30%,rgba(156,238,58,0.28),transparent_24%),linear-gradient(135deg,rgba(255,255,255,0.12),rgba(255,255,255,0.02))]" />
        <div className="px-4 pb-5 sm:px-6">
          <div className="-mt-12 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
              <div className="grid size-24 place-items-center overflow-hidden rounded-full border border-white/15 bg-background text-xl font-semibold text-primary shadow-xl">
                {profile.profileImageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={profile.profileImageUrl} alt="" className="size-full object-cover" />
                ) : (
                  <UserRound className="size-9" aria-hidden="true" />
                )}
              </div>
              <div className="space-y-2">
                <div>
                  <h1 className="text-3xl font-semibold tracking-normal">{displayName}</h1>
                  <p className="text-sm text-muted-foreground">@{profile.username}</p>
                </div>
                {profile.bio ? (
                  <p className="max-w-2xl text-sm leading-6 text-muted-foreground">{profile.bio}</p>
                ) : null}
              </div>
            </div>
            <Button asChild>
              <Link href="/profile/setup?edit=1">Edit profile</Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[0.7fr_1.3fr]">
        <article className="rounded-lg border border-white/10 bg-card/80 p-4 shadow-lg shadow-black/20">
          <p className="text-sm font-medium text-primary">Profile completion</p>
          <div className="mt-4 flex items-end justify-between gap-4">
            <strong className="text-4xl font-semibold tracking-normal">{completionWidth}</strong>
            <span className="text-sm text-muted-foreground">Ready for dashboard context</span>
          </div>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/10">
            <div className="h-full rounded-full bg-primary" style={{ width: completionWidth }} />
          </div>
        </article>
        <div className="grid gap-3 sm:grid-cols-2">
          {stats.map((item) => (
            <article
              key={item.label}
              className="rounded-lg border border-white/10 bg-card/80 p-4 shadow-lg shadow-black/20"
            >
              <div className="mb-3 flex size-10 items-center justify-center rounded-md bg-primary/15 text-primary">
                <item.icon className="size-5" aria-hidden="true" />
              </div>
              <p className="text-xs font-medium text-muted-foreground">{item.label}</p>
              <p className="mt-1 text-base font-semibold text-foreground">{item.value}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="rounded-lg border border-white/10 bg-card/80 p-4 shadow-lg shadow-black/20">
        <p className="text-sm font-medium text-primary">Preferred training style</p>
        <h2 className="mt-2 text-2xl font-semibold tracking-normal">
          {profile.preferredStyle ? trainingStyleLabels[profile.preferredStyle] : "Not set"}
        </h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Ascension can use this context for strength tracking, macros, body progress, and future AI
          coaching surfaces.
        </p>
      </section>
    </div>
  );
}
