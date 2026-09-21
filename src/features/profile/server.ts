import { Prisma } from "@prisma/client";
import { redirect } from "next/navigation";

import { prisma } from "@/lib/db/prisma";
import { requireUser } from "@/lib/auth/server";

import { profileInputSchema } from "./validation";

export interface ProfileActionState {
  status: "idle" | "success" | "error";
  message?: string;
  fieldErrors?: Record<string, string[]>;
}

function formValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

export async function getCurrentUserProfile() {
  const user = await requireUser();

  return prisma.userProfile.findUnique({
    where: { userId: user.id },
    include: {
      user: {
        select: {
          name: true,
          email: true,
          image: true
        }
      }
    }
  });
}

export async function getRequiredCompletedProfile() {
  const profile = await getCurrentUserProfile();

  if (!profile?.profileCompleted) {
    redirect("/profile/setup");
  }

  return profile;
}

export async function redirectCompletedProfile() {
  const profile = await getCurrentUserProfile();

  if (profile?.profileCompleted) {
    redirect("/dashboard");
  }

  return profile;
}

export async function saveProfileAction(
  _previousState: ProfileActionState,
  formData: FormData
): Promise<ProfileActionState> {
  const user = await requireUser();
  const parsed = profileInputSchema.safeParse({
    profileImageDataUrl: formValue(formData, "profileImageDataUrl"),
    firstName: formValue(formData, "firstName"),
    lastName: formValue(formData, "lastName"),
    username: formValue(formData, "username"),
    dateOfBirth: formValue(formData, "dateOfBirth"),
    gender: formValue(formData, "gender"),
    genderSelfDescribe: formValue(formData, "genderSelfDescribe"),
    heightCm: formValue(formData, "heightCm"),
    weightKg: formValue(formData, "weightKg"),
    mainFitnessGoal: formValue(formData, "mainFitnessGoal"),
    trainingExperience: formValue(formData, "trainingExperience"),
    trainingFrequency: formValue(formData, "trainingFrequency"),
    preferredStyle: formValue(formData, "preferredStyle"),
    targetWeightKg: formValue(formData, "targetWeightKg"),
    bio: formValue(formData, "bio")
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: "Check the highlighted fields and try again.",
      fieldErrors: parsed.error.flatten().fieldErrors
    };
  }

  const input = parsed.data;
  const existingProfile = await prisma.userProfile.findUnique({
    where: { userId: user.id },
    select: { profileImageUrl: true }
  });
  const profileImageUrl =
    input.profileImageDataUrl === "__REMOVE__"
      ? null
      : (input.profileImageDataUrl ?? existingProfile?.profileImageUrl ?? null);
  const name = `${input.firstName} ${input.lastName}`.trim();
  const completedAt = new Date();
  const profileData = {
    firstName: input.firstName,
    lastName: input.lastName,
    username: input.username,
    dateOfBirth: input.dateOfBirth ?? null,
    gender: input.gender ?? null,
    genderSelfDescribe: input.genderSelfDescribe ?? null,
    heightCm: new Prisma.Decimal(input.heightCm),
    weightKg: new Prisma.Decimal(input.weightKg),
    mainFitnessGoal: input.mainFitnessGoal,
    trainingExperience: input.trainingExperience,
    trainingFrequency: input.trainingFrequency,
    preferredStyle: input.preferredStyle,
    targetWeightKg:
      input.targetWeightKg === undefined ? null : new Prisma.Decimal(input.targetWeightKg),
    bio: input.bio ?? null,
    profileImageUrl,
    profileCompleted: true,
    profileCompletedAt: completedAt
  };

  try {
    await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        data: {
          name,
          image: profileImageUrl,
          preferences: {
            upsert: {
              create: {},
              update: {}
            }
          }
        }
      }),
      prisma.userProfile.upsert({
        where: { userId: user.id },
        create: {
          userId: user.id,
          ...profileData
        },
        update: profileData
      })
    ]);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return {
        status: "error",
        message: "That display name is already taken.",
        fieldErrors: {
          username: ["Choose another display name."]
        }
      };
    }

    throw error;
  }

  redirect("/dashboard");
}
