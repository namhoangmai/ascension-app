import Link from "next/link";
import { redirect } from "next/navigation";

import {
  ProfileSetupForm,
  type ProfileSetupData
} from "@/app/profile/_components/profile-setup-form";
import { getCurrentUserProfile } from "@/features/profile/server";
import { requireUser } from "@/lib/auth/server";

interface ProfileSetupPageProps {
  searchParams?: Promise<{
    edit?: string;
  }>;
}

export default async function ProfileSetupPage({ searchParams }: ProfileSetupPageProps) {
  const user = await requireUser();
  const profile = await getCurrentUserProfile();
  const params = await searchParams;
  const isEditing = params?.edit === "1";

  if (profile?.profileCompleted && !isEditing) {
    redirect("/dashboard");
  }

  const setupProfile: ProfileSetupData | null = profile
    ? {
        profileImageUrl: profile.profileImageUrl,
        firstName: profile.firstName,
        lastName: profile.lastName,
        username: profile.username,
        dateOfBirth: profile.dateOfBirth ? profile.dateOfBirth.toISOString().slice(0, 10) : null,
        gender: profile.gender,
        genderSelfDescribe: profile.genderSelfDescribe,
        heightCm: profile.heightCm?.toString() ?? null,
        weightKg: profile.weightKg?.toString() ?? null,
        mainFitnessGoal: profile.mainFitnessGoal,
        trainingExperience: profile.trainingExperience,
        trainingFrequency: profile.trainingFrequency,
        preferredStyle: profile.preferredStyle,
        targetWeightKg: profile.targetWeightKg?.toString() ?? null,
        bio: profile.bio,
        user: profile.user
      }
    : null;

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(156,238,58,0.10),transparent_30%),linear-gradient(180deg,#111,#050505_55%)] px-4 py-6">
      <div className="mx-auto w-full max-w-4xl">
        <header className="mb-6 flex items-center justify-between gap-4">
          <Link href="/" className="text-lg font-semibold tracking-normal">
            Ascension
          </Link>
          {profile?.profileCompleted ? (
            <Link href="/profile" className="text-sm font-medium text-primary">
              Back to profile
            </Link>
          ) : null}
        </header>
        <ProfileSetupForm
          profile={setupProfile}
          fallbackUser={{
            name: user.name,
            email: user.email,
            image: user.image
          }}
        />
      </div>
    </main>
  );
}
