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
      <section className="animate-rise-in overflow-hidden rounded-3xl border border-border bg-card">
        <div className="h-28 bg-gradient-to-br from-muted to-background" />
        <div className="px-4 pb-5 sm:px-6">
          <div className="-mt-12 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
              <div className="grid size-24 place-items-center overflow-hidden rounded-full border border-border bg-background text-xl font-semibold text-foreground shadow-sm">
                {profile.profileImageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={profile.profileImageUrl} alt="" className="size-full object-cover" />
                ) : (
                  <UserRound className="size-9" aria-hidden="true" />
                )}
              </div>
              <div className="space-y-2">
                <div>
                  <h1 className="text-title">{displayName}</h1>
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
        <article className="hover-lift rounded-2xl border border-border bg-card p-5 sm:p-6">
          <p className="text-sm font-medium text-muted-foreground">Profile completion</p>
          <div className="mt-4 flex items-end justify-between gap-4">
            <strong className="text-headline">{completionWidth}</strong>
            <span className="text-sm text-muted-foreground">Ready for dashboard context</span>
          </div>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-foreground transition-all duration-700"
              style={{ width: completionWidth }}
            />
          </div>
        </article>
        <div className="grid gap-3 sm:grid-cols-2">
          {stats.map((item) => (
            <article
              key={item.label}
              className="hover-lift rounded-2xl border border-border bg-card p-5 sm:p-6"
            >
              <div className="mb-3 flex size-10 items-center justify-center rounded-md bg-muted text-foreground">
                <item.icon className="size-5" aria-hidden="true" />
              </div>
              <p className="text-xs font-medium text-muted-foreground">{item.label}</p>
              <p className="mt-1 text-base font-semibold text-foreground">{item.value}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card p-5 sm:p-6">
        <p className="text-sm font-medium text-muted-foreground">Preferred training style</p>
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
