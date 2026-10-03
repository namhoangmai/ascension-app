import { Prisma } from "@prisma/client";
import { redirect } from "next/navigation";

import { equalsIgnoreCase } from "@/lib/db/equals-ignore-case";
import { prisma } from "@/lib/db/prisma";
import { requireUser } from "@/lib/auth/server";

import { accountDetailsInputSchema, profileInputSchema } from "./validation";

export interface ProfileActionState {
  status: "idle" | "success" | "error";
  message?: string;
  fieldErrors?: Record<string, string[]>;
}

/**
 * The same DB field is labelled "Display name" in the onboarding/edit form and "Username" in
 * Settings, so the wording follows the caller. The `fieldErrors` key stays `username` for both.
 */
function usernameTakenState(noun: "display name" | "username") {
  return {
    status: "error",
    message: `That ${noun} is already taken.`,
    fieldErrors: { username: [`Choose another ${noun}.`] }
  } satisfies ProfileActionState;
}

function formValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

/**
 * Case-insensitive uniqueness check shared by `saveProfileAction` and `updateAccountDetails` so
 * both entry points enforce the same "Bob"/"bob" collision rule. The DB also has a case-
 * insensitive unique index (`UserProfile_username_lower_key`) as a race-condition backstop — the
 * P2002 catches below handle that.
 */
async function isUsernameTakenByAnotherUser(userId: string, username: string): Promise<boolean> {
  const existing = await prisma.userProfile.findFirst({
    where: {
      // Escaped: `_` is valid in usernames but is also an ILIKE wildcard (see equalsIgnoreCase).
      username: equalsIgnoreCase(username),
      userId: { not: userId }
    },
    select: { id: true }
  });

  return Boolean(existing);
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

  if (await isUsernameTakenByAnotherUser(user.id, input.username)) {
    return usernameTakenState("display name");
  }

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
    // Race-condition backstop: the pre-check above already rejects the common case; this catches
    // two concurrent requests racing past it (Prisma's own unique constraint, and the DB-level
    // case-insensitive index both map to P2002).
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return usernameTakenState("display name");
    }

    throw error;
  }

  redirect("/dashboard");
}

export async function updateAccountDetails(
  _previousState: ProfileActionState,
  formData: FormData
): Promise<ProfileActionState> {
  const user = await requireUser();
  const parsed = accountDetailsInputSchema.safeParse({
    username: formValue(formData, "username"),
    dateOfBirth: formValue(formData, "dateOfBirth")
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: "Check the highlighted fields and try again.",
      fieldErrors: parsed.error.flatten().fieldErrors
    };
  }

  const input = parsed.data;

  if (await isUsernameTakenByAnotherUser(user.id, input.username)) {
    return usernameTakenState("username");
  }

  try {
    await prisma.userProfile.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        username: input.username,
        dateOfBirth: input.dateOfBirth
      },
      update: {
        username: input.username,
        dateOfBirth: input.dateOfBirth
      }
    });
  } catch (error) {
    // Race-condition backstop — see the comment in `saveProfileAction`.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return usernameTakenState("username");
    }

    throw error;
  }

  return {
    status: "success",
    message: "Account details updated."
  };
}
