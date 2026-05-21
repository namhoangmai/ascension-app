-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "UnitSystem" AS ENUM ('METRIC', 'IMPERIAL');

-- CreateEnum
CREATE TYPE "Weekday" AS ENUM ('MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY');

-- CreateEnum
CREATE TYPE "ProgramMode" AS ENUM ('FLEXIBLE', 'SCHEDULED');

-- CreateEnum
CREATE TYPE "ExerciseCategory" AS ENUM ('COMPOUND', 'ISOLATION', 'MACHINE', 'DUMBBELL', 'CABLE', 'BODYWEIGHT', 'SMITH_MACHINE', 'BARBELL');

-- CreateEnum
CREATE TYPE "MuscleGroup" AS ENUM ('CHEST', 'BACK', 'SHOULDERS', 'BICEPS', 'TRICEPS', 'FOREARMS', 'ABS', 'GLUTES', 'QUADS', 'HAMSTRINGS', 'CALVES', 'FULL_BODY');

-- CreateEnum
CREATE TYPE "Equipment" AS ENUM ('BARBELL', 'DUMBBELL', 'CABLE', 'MACHINE', 'SMITH_MACHINE', 'BODYWEIGHT', 'KETTLEBELL', 'BAND', 'OTHER');

-- CreateEnum
CREATE TYPE "Difficulty" AS ENUM ('BEGINNER', 'INTERMEDIATE', 'ADVANCED');

-- CreateEnum
CREATE TYPE "SetType" AS ENUM ('WARMUP', 'WORKING', 'DROP', 'BACKOFF');

-- CreateEnum
CREATE TYPE "SessionStatus" AS ENUM ('IN_PROGRESS', 'COMPLETED', 'CANCELED');

-- CreateEnum
CREATE TYPE "SuggestionStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DISMISSED');

-- CreateEnum
CREATE TYPE "FoodCategory" AS ENUM ('MEAT', 'VEGETABLES', 'FRUITS', 'CARB_SOURCE', 'DAIRY', 'SNACKS', 'BEVERAGES', 'SUPPLEMENTS', 'SAUCES', 'OTHER');

-- CreateEnum
CREATE TYPE "FoodSource" AS ENUM ('SEEDED', 'OPEN_FOOD_FACTS', 'CUSTOM');

-- CreateEnum
CREATE TYPE "MealType" AS ENUM ('BREAKFAST', 'LUNCH', 'DINNER', 'SNACK', 'PRE_WORKOUT', 'POST_WORKOUT');

-- CreateEnum
CREATE TYPE "PhotoView" AS ENUM ('FRONT', 'SIDE', 'BACK', 'CUSTOM');

-- CreateEnum
CREATE TYPE "MeasurementType" AS ENUM ('CHEST', 'WAIST', 'ARMS', 'THIGHS', 'SHOULDERS', 'CUSTOM');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT NOT NULL,
    "emailVerified" TIMESTAMP(3),
    "image" TEXT,
    "passwordHash" TEXT,
    "unitSystem" "UnitSystem" NOT NULL DEFAULT 'METRIC',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "Authenticator" (
    "credentialID" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "credentialPublicKey" TEXT NOT NULL,
    "counter" INTEGER NOT NULL,
    "credentialDeviceType" TEXT NOT NULL,
    "credentialBackedUp" BOOLEAN NOT NULL,
    "transports" TEXT,

    CONSTRAINT "Authenticator_pkey" PRIMARY KEY ("userId","credentialID")
);

-- CreateTable
CREATE TABLE "UserPreference" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "defaultRestSeconds" INTEGER NOT NULL DEFAULT 120,
    "weightIncrementKg" DECIMAL(6,2) NOT NULL DEFAULT 2.5,
    "preferredMealTypes" "MealType"[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserPreference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkoutProgram" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "mode" "ProgramMode" NOT NULL DEFAULT 'FLEXIBLE',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkoutProgram_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkoutDay" (
    "id" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "notes" TEXT,
    "estimatedDuration" INTEGER,
    "orderIndex" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkoutDay_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProgramSchedule" (
    "id" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "workoutDayId" TEXT NOT NULL,
    "weekday" "Weekday" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProgramSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Exercise" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT,
    "sourceKey" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "primaryMuscleGroup" "MuscleGroup" NOT NULL,
    "equipment" "Equipment" NOT NULL,
    "category" "ExerciseCategory" NOT NULL,
    "difficulty" "Difficulty" NOT NULL DEFAULT 'BEGINNER',
    "instructions" TEXT,
    "mediaUrl" TEXT,
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Exercise_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExerciseSecondaryMuscle" (
    "id" TEXT NOT NULL,
    "exerciseId" TEXT NOT NULL,
    "muscle" "MuscleGroup" NOT NULL,

    CONSTRAINT "ExerciseSecondaryMuscle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkoutDayExercise" (
    "id" TEXT NOT NULL,
    "workoutDayId" TEXT NOT NULL,
    "exerciseId" TEXT NOT NULL,
    "orderIndex" INTEGER NOT NULL,
    "targetSets" INTEGER,
    "targetMinReps" INTEGER DEFAULT 5,
    "targetMaxReps" INTEGER DEFAULT 8,
    "notes" TEXT,

    CONSTRAINT "WorkoutDayExercise_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExerciseRestPreference" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "exerciseId" TEXT NOT NULL,
    "restSeconds" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExerciseRestPreference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkoutSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "programId" TEXT,
    "workoutDayId" TEXT,
    "name" TEXT NOT NULL,
    "notes" TEXT,
    "status" "SessionStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "durationSeconds" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkoutSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SessionExercise" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "exerciseId" TEXT NOT NULL,
    "exerciseNameSnapshot" TEXT NOT NULL,
    "muscleGroupSnapshot" "MuscleGroup" NOT NULL,
    "equipmentSnapshot" "Equipment" NOT NULL,
    "categorySnapshot" "ExerciseCategory" NOT NULL,
    "orderIndex" INTEGER NOT NULL,
    "note" TEXT,
    "restSeconds" INTEGER,
    "supersetGroupId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SessionExercise_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkoutSet" (
    "id" TEXT NOT NULL,
    "sessionExerciseId" TEXT NOT NULL,
    "type" "SetType" NOT NULL DEFAULT 'WORKING',
    "orderIndex" INTEGER NOT NULL,
    "weightKg" DECIMAL(7,2),
    "reps" INTEGER,
    "rir" INTEGER,
    "isCompleted" BOOLEAN NOT NULL DEFAULT false,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkoutSet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProgressiveOverloadSuggestion" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "workoutSessionId" TEXT NOT NULL,
    "exerciseId" TEXT NOT NULL,
    "currentWeightKg" DECIMAL(7,2) NOT NULL,
    "suggestedWeightKg" DECIMAL(7,2) NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "SuggestionStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProgressiveOverloadSuggestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NutritionGoal" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "startsOn" TIMESTAMP(3) NOT NULL,
    "caloriesTarget" INTEGER NOT NULL,
    "proteinTargetG" DECIMAL(7,2) NOT NULL,
    "carbsTargetG" DECIMAL(7,2) NOT NULL,
    "fatsTargetG" DECIMAL(7,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NutritionGoal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Food" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT,
    "source" "FoodSource" NOT NULL DEFAULT 'SEEDED',
    "sourceKey" TEXT NOT NULL,
    "externalId" TEXT,
    "name" TEXT NOT NULL,
    "brand" TEXT,
    "category" "FoodCategory" NOT NULL DEFAULT 'OTHER',
    "caloriesPer100g" DECIMAL(8,2) NOT NULL,
    "proteinPer100g" DECIMAL(7,2) NOT NULL,
    "carbsPer100g" DECIMAL(7,2) NOT NULL,
    "fatsPer100g" DECIMAL(7,2) NOT NULL,
    "barcode" TEXT,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Food_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FoodLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "foodId" TEXT NOT NULL,
    "mealType" "MealType" NOT NULL,
    "loggedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "grams" DECIMAL(8,2) NOT NULL,
    "foodNameSnapshot" TEXT NOT NULL,
    "brandSnapshot" TEXT,
    "caloriesPer100gSnapshot" DECIMAL(8,2) NOT NULL,
    "proteinPer100gSnapshot" DECIMAL(7,2) NOT NULL,
    "carbsPer100gSnapshot" DECIMAL(7,2) NOT NULL,
    "fatsPer100gSnapshot" DECIMAL(7,2) NOT NULL,
    "calories" DECIMAL(8,2) NOT NULL,
    "proteinG" DECIMAL(7,2) NOT NULL,
    "carbsG" DECIMAL(7,2) NOT NULL,
    "fatsG" DECIMAL(7,2) NOT NULL,
    "photoUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FoodLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SavedMeal" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "photoUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SavedMeal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SavedMealItem" (
    "id" TEXT NOT NULL,
    "savedMealId" TEXT NOT NULL,
    "foodId" TEXT NOT NULL,
    "grams" DECIMAL(8,2) NOT NULL,
    "orderIndex" INTEGER NOT NULL,

    CONSTRAINT "SavedMealItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BodyMetric" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "measuredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "weightKg" DECIMAL(6,2),
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BodyMetric_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BodyMeasurement" (
    "id" TEXT NOT NULL,
    "bodyMetricId" TEXT NOT NULL,
    "type" "MeasurementType" NOT NULL,
    "labelKey" TEXT NOT NULL,
    "customLabel" TEXT,
    "valueCm" DECIMAL(6,2) NOT NULL,

    CONSTRAINT "BodyMeasurement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BodyPhoto" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "contentType" TEXT,
    "byteSize" INTEGER,
    "width" INTEGER,
    "height" INTEGER,
    "view" "PhotoView" NOT NULL DEFAULT 'CUSTOM',
    "takenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BodyPhoto_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- CreateIndex
CREATE INDEX "Account_userId_idx" ON "Account"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON "VerificationToken"("identifier", "token");

-- CreateIndex
CREATE UNIQUE INDEX "Authenticator_credentialID_key" ON "Authenticator"("credentialID");

-- CreateIndex
CREATE UNIQUE INDEX "UserPreference_userId_key" ON "UserPreference"("userId");

-- CreateIndex
CREATE INDEX "WorkoutProgram_userId_isActive_idx" ON "WorkoutProgram"("userId", "isActive");

-- CreateIndex
CREATE INDEX "WorkoutDay_programId_idx" ON "WorkoutDay"("programId");

-- CreateIndex
CREATE UNIQUE INDEX "WorkoutDay_programId_orderIndex_key" ON "WorkoutDay"("programId", "orderIndex");

-- CreateIndex
CREATE INDEX "ProgramSchedule_weekday_idx" ON "ProgramSchedule"("weekday");

-- CreateIndex
CREATE UNIQUE INDEX "ProgramSchedule_programId_weekday_key" ON "ProgramSchedule"("programId", "weekday");

-- CreateIndex
CREATE UNIQUE INDEX "ProgramSchedule_workoutDayId_weekday_key" ON "ProgramSchedule"("workoutDayId", "weekday");

-- CreateIndex
CREATE UNIQUE INDEX "Exercise_sourceKey_key" ON "Exercise"("sourceKey");

-- CreateIndex
CREATE INDEX "Exercise_ownerId_name_idx" ON "Exercise"("ownerId", "name");

-- CreateIndex
CREATE INDEX "Exercise_isPublic_primaryMuscleGroup_idx" ON "Exercise"("isPublic", "primaryMuscleGroup");

-- CreateIndex
CREATE INDEX "Exercise_isPublic_slug_idx" ON "Exercise"("isPublic", "slug");

-- CreateIndex
CREATE INDEX "Exercise_name_idx" ON "Exercise"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Exercise_ownerId_slug_key" ON "Exercise"("ownerId", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "ExerciseSecondaryMuscle_exerciseId_muscle_key" ON "ExerciseSecondaryMuscle"("exerciseId", "muscle");

-- CreateIndex
CREATE INDEX "WorkoutDayExercise_exerciseId_idx" ON "WorkoutDayExercise"("exerciseId");

-- CreateIndex
CREATE UNIQUE INDEX "WorkoutDayExercise_workoutDayId_orderIndex_key" ON "WorkoutDayExercise"("workoutDayId", "orderIndex");

-- CreateIndex
CREATE INDEX "ExerciseRestPreference_exerciseId_idx" ON "ExerciseRestPreference"("exerciseId");

-- CreateIndex
CREATE UNIQUE INDEX "ExerciseRestPreference_userId_exerciseId_key" ON "ExerciseRestPreference"("userId", "exerciseId");

-- CreateIndex
CREATE INDEX "WorkoutSession_userId_startedAt_idx" ON "WorkoutSession"("userId", "startedAt");

-- CreateIndex
CREATE INDEX "WorkoutSession_userId_status_startedAt_idx" ON "WorkoutSession"("userId", "status", "startedAt");

-- CreateIndex
CREATE INDEX "WorkoutSession_programId_idx" ON "WorkoutSession"("programId");

-- CreateIndex
CREATE INDEX "WorkoutSession_workoutDayId_idx" ON "WorkoutSession"("workoutDayId");

-- CreateIndex
CREATE INDEX "SessionExercise_exerciseId_idx" ON "SessionExercise"("exerciseId");

-- CreateIndex
CREATE INDEX "SessionExercise_exerciseId_createdAt_idx" ON "SessionExercise"("exerciseId", "createdAt");

-- CreateIndex
CREATE INDEX "SessionExercise_supersetGroupId_idx" ON "SessionExercise"("supersetGroupId");

-- CreateIndex
CREATE UNIQUE INDEX "SessionExercise_sessionId_orderIndex_key" ON "SessionExercise"("sessionId", "orderIndex");

-- CreateIndex
CREATE INDEX "WorkoutSet_sessionExerciseId_isCompleted_idx" ON "WorkoutSet"("sessionExerciseId", "isCompleted");

-- CreateIndex
CREATE INDEX "WorkoutSet_isCompleted_completedAt_idx" ON "WorkoutSet"("isCompleted", "completedAt");

-- CreateIndex
CREATE UNIQUE INDEX "WorkoutSet_sessionExerciseId_orderIndex_key" ON "WorkoutSet"("sessionExerciseId", "orderIndex");

-- CreateIndex
CREATE INDEX "ProgressiveOverloadSuggestion_userId_status_idx" ON "ProgressiveOverloadSuggestion"("userId", "status");

-- CreateIndex
CREATE INDEX "ProgressiveOverloadSuggestion_userId_exerciseId_status_idx" ON "ProgressiveOverloadSuggestion"("userId", "exerciseId", "status");

-- CreateIndex
CREATE INDEX "ProgressiveOverloadSuggestion_exerciseId_idx" ON "ProgressiveOverloadSuggestion"("exerciseId");

-- CreateIndex
CREATE INDEX "NutritionGoal_userId_startsOn_idx" ON "NutritionGoal"("userId", "startsOn");

-- CreateIndex
CREATE UNIQUE INDEX "Food_sourceKey_key" ON "Food"("sourceKey");

-- CreateIndex
CREATE INDEX "Food_ownerId_idx" ON "Food"("ownerId");

-- CreateIndex
CREATE INDEX "Food_ownerId_name_idx" ON "Food"("ownerId", "name");

-- CreateIndex
CREATE INDEX "Food_source_externalId_idx" ON "Food"("source", "externalId");

-- CreateIndex
CREATE INDEX "Food_barcode_idx" ON "Food"("barcode");

-- CreateIndex
CREATE INDEX "Food_name_idx" ON "Food"("name");

-- CreateIndex
CREATE INDEX "FoodLog_userId_loggedAt_idx" ON "FoodLog"("userId", "loggedAt");

-- CreateIndex
CREATE INDEX "FoodLog_userId_mealType_loggedAt_idx" ON "FoodLog"("userId", "mealType", "loggedAt");

-- CreateIndex
CREATE INDEX "FoodLog_foodId_idx" ON "FoodLog"("foodId");

-- CreateIndex
CREATE INDEX "SavedMeal_userId_name_idx" ON "SavedMeal"("userId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "SavedMeal_userId_name_key" ON "SavedMeal"("userId", "name");

-- CreateIndex
CREATE INDEX "SavedMealItem_foodId_idx" ON "SavedMealItem"("foodId");

-- CreateIndex
CREATE UNIQUE INDEX "SavedMealItem_savedMealId_orderIndex_key" ON "SavedMealItem"("savedMealId", "orderIndex");

-- CreateIndex
CREATE INDEX "BodyMetric_userId_measuredAt_idx" ON "BodyMetric"("userId", "measuredAt");

-- CreateIndex
CREATE UNIQUE INDEX "BodyMeasurement_bodyMetricId_labelKey_key" ON "BodyMeasurement"("bodyMetricId", "labelKey");

-- CreateIndex
CREATE INDEX "BodyPhoto_userId_takenAt_idx" ON "BodyPhoto"("userId", "takenAt");

-- CreateIndex
CREATE UNIQUE INDEX "BodyPhoto_storageKey_key" ON "BodyPhoto"("storageKey");

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Authenticator" ADD CONSTRAINT "Authenticator_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserPreference" ADD CONSTRAINT "UserPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkoutProgram" ADD CONSTRAINT "WorkoutProgram_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkoutDay" ADD CONSTRAINT "WorkoutDay_programId_fkey" FOREIGN KEY ("programId") REFERENCES "WorkoutProgram"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgramSchedule" ADD CONSTRAINT "ProgramSchedule_programId_fkey" FOREIGN KEY ("programId") REFERENCES "WorkoutProgram"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgramSchedule" ADD CONSTRAINT "ProgramSchedule_workoutDayId_fkey" FOREIGN KEY ("workoutDayId") REFERENCES "WorkoutDay"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Exercise" ADD CONSTRAINT "Exercise_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExerciseSecondaryMuscle" ADD CONSTRAINT "ExerciseSecondaryMuscle_exerciseId_fkey" FOREIGN KEY ("exerciseId") REFERENCES "Exercise"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkoutDayExercise" ADD CONSTRAINT "WorkoutDayExercise_workoutDayId_fkey" FOREIGN KEY ("workoutDayId") REFERENCES "WorkoutDay"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkoutDayExercise" ADD CONSTRAINT "WorkoutDayExercise_exerciseId_fkey" FOREIGN KEY ("exerciseId") REFERENCES "Exercise"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExerciseRestPreference" ADD CONSTRAINT "ExerciseRestPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExerciseRestPreference" ADD CONSTRAINT "ExerciseRestPreference_exerciseId_fkey" FOREIGN KEY ("exerciseId") REFERENCES "Exercise"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkoutSession" ADD CONSTRAINT "WorkoutSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkoutSession" ADD CONSTRAINT "WorkoutSession_programId_fkey" FOREIGN KEY ("programId") REFERENCES "WorkoutProgram"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkoutSession" ADD CONSTRAINT "WorkoutSession_workoutDayId_fkey" FOREIGN KEY ("workoutDayId") REFERENCES "WorkoutDay"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionExercise" ADD CONSTRAINT "SessionExercise_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "WorkoutSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionExercise" ADD CONSTRAINT "SessionExercise_exerciseId_fkey" FOREIGN KEY ("exerciseId") REFERENCES "Exercise"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkoutSet" ADD CONSTRAINT "WorkoutSet_sessionExerciseId_fkey" FOREIGN KEY ("sessionExerciseId") REFERENCES "SessionExercise"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgressiveOverloadSuggestion" ADD CONSTRAINT "ProgressiveOverloadSuggestion_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgressiveOverloadSuggestion" ADD CONSTRAINT "ProgressiveOverloadSuggestion_workoutSessionId_fkey" FOREIGN KEY ("workoutSessionId") REFERENCES "WorkoutSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgressiveOverloadSuggestion" ADD CONSTRAINT "ProgressiveOverloadSuggestion_exerciseId_fkey" FOREIGN KEY ("exerciseId") REFERENCES "Exercise"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NutritionGoal" ADD CONSTRAINT "NutritionGoal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Food" ADD CONSTRAINT "Food_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FoodLog" ADD CONSTRAINT "FoodLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FoodLog" ADD CONSTRAINT "FoodLog_foodId_fkey" FOREIGN KEY ("foodId") REFERENCES "Food"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedMeal" ADD CONSTRAINT "SavedMeal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedMealItem" ADD CONSTRAINT "SavedMealItem_savedMealId_fkey" FOREIGN KEY ("savedMealId") REFERENCES "SavedMeal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedMealItem" ADD CONSTRAINT "SavedMealItem_foodId_fkey" FOREIGN KEY ("foodId") REFERENCES "Food"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BodyMetric" ADD CONSTRAINT "BodyMetric_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BodyMeasurement" ADD CONSTRAINT "BodyMeasurement_bodyMetricId_fkey" FOREIGN KEY ("bodyMetricId") REFERENCES "BodyMetric"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BodyPhoto" ADD CONSTRAINT "BodyPhoto_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

