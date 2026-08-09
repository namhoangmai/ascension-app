CREATE TYPE "Gender" AS ENUM ('MALE', 'FEMALE', 'NON_BINARY', 'PREFER_NOT_TO_SAY', 'SELF_DESCRIBE');

CREATE TYPE "FitnessGoal" AS ENUM ('BUILD_MUSCLE', 'LOSE_FAT', 'RECOMPOSITION', 'INCREASE_STRENGTH', 'GENERAL_FITNESS');

CREATE TYPE "TrainingExperience" AS ENUM ('BEGINNER', 'INTERMEDIATE', 'ADVANCED');

CREATE TYPE "TrainingStyle" AS ENUM ('STRENGTH', 'HYPERTROPHY', 'BODYBUILDING', 'POWERLIFTING', 'FUNCTIONAL', 'GENERAL');

CREATE TABLE "UserProfile" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "firstName" TEXT,
  "lastName" TEXT,
  "username" TEXT,
  "dateOfBirth" TIMESTAMP(3),
  "gender" "Gender",
  "genderSelfDescribe" TEXT,
  "heightCm" DECIMAL(6,2),
  "weightKg" DECIMAL(6,2),
  "mainFitnessGoal" "FitnessGoal",
  "trainingExperience" "TrainingExperience",
  "trainingFrequency" INTEGER,
  "preferredStyle" "TrainingStyle",
  "targetWeightKg" DECIMAL(6,2),
  "bio" TEXT,
  "profileImageUrl" TEXT,
  "profileCompleted" BOOLEAN NOT NULL DEFAULT false,
  "profileCompletedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "UserProfile_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "UserProfile_userId_key" ON "UserProfile"("userId");

CREATE UNIQUE INDEX "UserProfile_username_key" ON "UserProfile"("username");

CREATE INDEX "UserProfile_userId_profileCompleted_idx" ON "UserProfile"("userId", "profileCompleted");

ALTER TABLE "UserProfile" ADD CONSTRAINT "UserProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
