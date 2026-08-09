import { z } from "zod";

const maxProfileImageDataUrlLength = 7_000_000;

const optionalTrimmed = (max: number, message: string) =>
  z
    .string()
    .trim()
    .max(max, message)
    .optional()
    .or(z.literal(""))
    .transform((value) => (value === "" ? undefined : value));

const numberString = (min: number, max: number, label: string) =>
  z
    .string()
    .trim()
    .optional()
    .or(z.literal(""))
    .transform((value) => (value === "" || value === undefined ? undefined : Number(value)))
    .pipe(
      z
        .number({ invalid_type_error: `${label} must be a number.` })
        .min(min, `${label} is too low.`)
        .max(max, `${label} is too high.`)
        .optional()
    );

const requiredNumberString = (min: number, max: number, label: string) =>
  z
    .string()
    .trim()
    .min(1, `${label} is required.`)
    .transform(Number)
    .pipe(
      z
        .number({ invalid_type_error: `${label} must be a number.` })
        .min(min, `${label} is too low.`)
        .max(max, `${label} is too high.`)
    );

export const profileImageDataUrlSchema = z
  .string()
  .trim()
  .optional()
  .or(z.literal(""))
  .refine(
    (value) =>
      value === undefined ||
      value === "" ||
      value === "__REMOVE__" ||
      /^https:\/\/[^\s]+$/i.test(value) ||
      /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(value),
    "Upload a PNG, JPG, or WebP image."
  )
  .refine(
    (value) =>
      value === undefined ||
      value === "" ||
      !value.startsWith("data:") ||
      value.length <= maxProfileImageDataUrlLength,
    "Profile picture must be under 5 MB."
  )
  .transform((value) => (value === "" ? undefined : value));

export const profileInputSchema = z
  .object({
    profileImageDataUrl: profileImageDataUrlSchema,
    firstName: z
      .string()
      .trim()
      .min(1, "First name is required.")
      .max(40, "First name is too long."),
    lastName: z.string().trim().min(1, "Last name is required.").max(40, "Last name is too long."),
    username: z
      .string()
      .trim()
      .min(2, "Display name is required.")
      .max(32, "Display name is too long.")
      .regex(/^[a-zA-Z0-9_.-]+$/, "Use letters, numbers, dots, dashes, or underscores."),
    dateOfBirth: z
      .string()
      .trim()
      .optional()
      .or(z.literal(""))
      .transform((value) =>
        value === "" || value === undefined ? undefined : new Date(`${value}T00:00:00.000Z`)
      )
      .refine(
        (value) => value === undefined || !Number.isNaN(value.getTime()),
        "Enter a valid date."
      )
      .refine(
        (value) => value === undefined || value <= new Date(),
        "Date of birth cannot be in the future."
      ),
    gender: z
      .enum(["MALE", "FEMALE", "NON_BINARY", "PREFER_NOT_TO_SAY", "SELF_DESCRIBE"])
      .optional()
      .or(z.literal(""))
      .transform((value) => (value === "" ? undefined : value)),
    genderSelfDescribe: optionalTrimmed(40, "Gender description is too long."),
    heightCm: requiredNumberString(80, 260, "Height"),
    weightKg: requiredNumberString(25, 350, "Weight"),
    mainFitnessGoal: z.enum([
      "BUILD_MUSCLE",
      "LOSE_FAT",
      "RECOMPOSITION",
      "INCREASE_STRENGTH",
      "GENERAL_FITNESS"
    ]),
    trainingExperience: z.enum(["BEGINNER", "INTERMEDIATE", "ADVANCED"]),
    trainingFrequency: z
      .string()
      .trim()
      .min(1, "Training frequency is required.")
      .transform(Number)
      .pipe(z.number().int().min(1, "Choose at least 1 day.").max(14, "Choose 14 or fewer days.")),
    preferredStyle: z.enum([
      "STRENGTH",
      "HYPERTROPHY",
      "BODYBUILDING",
      "POWERLIFTING",
      "FUNCTIONAL",
      "GENERAL"
    ]),
    targetWeightKg: numberString(25, 350, "Target weight"),
    bio: optionalTrimmed(280, "Bio is too long.")
  })
  .refine((data) => data.gender !== "SELF_DESCRIBE" || Boolean(data.genderSelfDescribe), {
    message: "Add your description or choose another option.",
    path: ["genderSelfDescribe"]
  });

export type ProfileInput = z.infer<typeof profileInputSchema>;
