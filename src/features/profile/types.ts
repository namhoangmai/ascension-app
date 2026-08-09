import type {
  FitnessGoal,
  Gender,
  TrainingExperience,
  TrainingStyle,
  UserProfile
} from "@prisma/client";

export const fitnessGoalLabels: Record<FitnessGoal, string> = {
  BUILD_MUSCLE: "Build muscle",
  LOSE_FAT: "Lose fat",
  RECOMPOSITION: "Recomposition",
  INCREASE_STRENGTH: "Increase strength",
  GENERAL_FITNESS: "General fitness"
};

export const trainingExperienceLabels: Record<TrainingExperience, string> = {
  BEGINNER: "Beginner",
  INTERMEDIATE: "Intermediate",
  ADVANCED: "Advanced"
};

export const trainingStyleLabels: Record<TrainingStyle, string> = {
  STRENGTH: "Strength",
  HYPERTROPHY: "Hypertrophy",
  BODYBUILDING: "Bodybuilding",
  POWERLIFTING: "Powerlifting",
  FUNCTIONAL: "Functional",
  GENERAL: "General fitness"
};

export const genderLabels: Record<Gender, string> = {
  MALE: "Male",
  FEMALE: "Female",
  NON_BINARY: "Non-binary",
  PREFER_NOT_TO_SAY: "Prefer not to say",
  SELF_DESCRIBE: "Self describe"
};

export interface ProfileWithUser extends UserProfile {
  user: {
    name: string | null;
    email: string;
    image: string | null;
  };
}

export function displayNameForProfile(profile: ProfileWithUser | null) {
  if (!profile) {
    return "Athlete";
  }

  const fullName = [profile.firstName, profile.lastName].filter(Boolean).join(" ").trim();

  return fullName !== "" ? fullName : (profile.username ?? profile.user.name ?? profile.user.email);
}

export function profileCompletionPercentage(profile: UserProfile | null) {
  if (!profile) {
    return 0;
  }

  const fields = [
    profile.profileImageUrl,
    profile.firstName,
    profile.lastName,
    profile.username,
    profile.dateOfBirth,
    profile.gender,
    profile.heightCm,
    profile.weightKg,
    profile.mainFitnessGoal,
    profile.trainingExperience,
    profile.trainingFrequency,
    profile.preferredStyle,
    profile.targetWeightKg,
    profile.bio
  ];

  const completed = fields.filter((value) => value !== null && value !== "").length;

  return Math.round((completed / fields.length) * 100);
}
