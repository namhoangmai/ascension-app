import {
  DEFAULT_MACRO_GOALS,
  FOOD_LOG_STORAGE_KEY,
  NUTRITION_GOALS_STORAGE_KEY,
  getCaloriesFromMacroGoals,
  getItemCalories,
  isNutritionLogItem,
  isNutritionMacroGoals
} from "@/features/nutrition/client-store";
import {
  STRENGTH_WORKOUTS_STORAGE_KEY,
  getExercisePersonalRecords,
  getExerciseHistory,
  getSeedWorkouts,
  isStrengthWorkout
} from "@/features/strength/client-store";
import {
  BODY_CHECK_INS_STORAGE_KEY,
  BODY_JOURNAL_STORAGE_KEY,
  getBodyProgressStats,
  getSeedCheckIns,
  getSeedJournalEntries
} from "@/features/body/client-store";
import type {
  AiCoachContext,
  AiCoachProfile,
  AiInsight,
  AiMealPlan,
  AiWeeklyReport,
  AiWorkoutPlan
} from "@/types/ai-coach";
import type { BodyCheckIn, JournalEntry } from "@/types/body-progress";
import type { NutritionLogItem } from "@/types/nutrition";
import type { StrengthWorkout } from "@/types/strength";

export const AI_PROFILE_STORAGE_KEY = "aiCoach.profile.v1";
export const AI_CHAT_STORAGE_KEY = "aiCoach.chat.v1";

export const DEFAULT_AI_PROFILE: AiCoachProfile = {
  age: null,
  heightCm: null,
  sex: "",
  activityLevel: "Moderate",
  fitnessGoal: "Recomposition",
  dietaryPreferences: [],
  workoutPreferences: ["Upper Lower"],
  availableEquipment: ["Full Gym"],
  trainingFrequency: 4,
  mealFrequency: 4,
  budget: "",
  cookingTimeMinutes: 30,
  workoutDurationMinutes: 75,
  experience: "Intermediate",
  injuries: "",
  exercisePreferences: "",
  dataPermissions: {
    strength: true,
    nutrition: true,
    body: true,
    journal: true
  }
};

export const DIET_OPTIONS = ["Vegetarian", "Vegan", "Halal", "Gluten Free", "Dairy Free"];
export const WORKOUT_SPLITS = ["Upper Lower", "Push Pull Legs", "Anterior Posterior", "Full Body"];
export const EQUIPMENT_OPTIONS = [
  "Full Gym",
  "Dumbbells",
  "Resistance Bands",
  "Home Gym",
  "Bodyweight Only"
];

export function loadAiProfile(): AiCoachProfile {
  try {
    const raw = localStorage.getItem(AI_PROFILE_STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : null;

    if (!parsed || typeof parsed !== "object") {
      return DEFAULT_AI_PROFILE;
    }

    return {
      ...DEFAULT_AI_PROFILE,
      ...(parsed as Partial<AiCoachProfile>),
      dataPermissions: {
        ...DEFAULT_AI_PROFILE.dataPermissions,
        ...(parsed as Partial<AiCoachProfile>).dataPermissions
      }
    };
  } catch {
    return DEFAULT_AI_PROFILE;
  }
}

export function saveAiProfile(profile: AiCoachProfile) {
  localStorage.setItem(AI_PROFILE_STORAGE_KEY, JSON.stringify(profile));
}

export function buildAiCoachContext(profile: AiCoachProfile): AiCoachContext {
  const strengthWorkouts = profile.dataPermissions.strength ? loadStrengthWorkoutsForAi() : [];
  const nutrition = profile.dataPermissions.nutrition ? loadNutritionForAi() : null;
  const bodyCheckIns = profile.dataPermissions.body ? loadBodyCheckInsForAi() : [];
  const journals = profile.dataPermissions.journal ? loadJournalForAi() : [];
  const bodyStats = getBodyProgressStats(bodyCheckIns, [], journals);
  const sortedBody = bodyCheckIns
    .slice()
    .sort((a, b) => `${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`));
  const firstWaist = sortedBody.find((checkIn) => typeof checkIn.measurements.waist === "number")
    ?.measurements.waist;
  const latestWaist = sortedBody
    .slice()
    .reverse()
    .find((checkIn) => typeof checkIn.measurements.waist === "number")?.measurements.waist;
  const liftSummary = getStrengthSummary(strengthWorkouts);

  return {
    currentWeight: bodyStats.currentWeight,
    monthlyWeightChange: bodyStats.monthlyChange,
    proteinAverage: nutrition?.proteinAverage ?? null,
    calorieAverage: nutrition?.calorieAverage ?? null,
    calorieTarget: nutrition?.calorieTarget ?? null,
    proteinTarget: nutrition?.macroGoals.protein ?? null,
    workoutCount: strengthWorkouts.length,
    ...(liftSummary.strongestLift ? { strongestLift: liftSummary.strongestLift } : {}),
    ...(journals[0]?.content ? { latestJournal: journals[0].content } : {}),
    waistChange:
      typeof firstWaist === "number" && typeof latestWaist === "number"
        ? Number((latestWaist - firstWaist).toFixed(1))
        : null,
    strengthSummary: liftSummary.summary
  };
}

export function generateInsights(profile: AiCoachProfile, context: AiCoachContext): AiInsight[] {
  const insights: AiInsight[] = [];

  if (context.proteinAverage !== null && context.proteinTarget !== null) {
    const delta = context.proteinAverage - context.proteinTarget;
    insights.push({
      title: delta >= 0 ? "Protein target is covered" : "Protein is below target",
      body:
        delta >= 0
          ? "Keep distributing protein across meals to support recovery."
          : "Add a lean protein serving to one meal or snack tomorrow.",
      evidence: `Average protein is ${context.proteinAverage.toFixed(0)}g vs ${context.proteinTarget.toFixed(0)}g target.`,
      priority: delta < -15 ? "high" : "medium"
    });
  }

  if (context.monthlyWeightChange !== null) {
    const goal = profile.fitnessGoal;
    const losing = context.monthlyWeightChange < -0.5;
    const gaining = context.monthlyWeightChange > 0.5;
    insights.push({
      title: "Weight trend detected",
      body:
        goal === "Lose Fat" && !losing
          ? "Create a small calorie reduction or add a daily step target."
          : goal === "Build Muscle" && !gaining
            ? "Consider adding 150-250 kcal on training days."
            : "Your current trend matches the direction of your goal.",
      evidence: `Monthly weight change is ${formatDelta(context.monthlyWeightChange)} kg.`,
      priority: "medium"
    });
  }

  if (context.waistChange !== null) {
    insights.push({
      title: "Measurement trend",
      body:
        context.waistChange < 0
          ? "Waist is moving down. Preserve strength by keeping protein high."
          : "Waist is not decreasing yet. Check calorie consistency before changing training.",
      evidence: `Waist change across recorded check-ins is ${formatDelta(context.waistChange)} cm.`,
      priority: Math.abs(context.waistChange) >= 1 ? "medium" : "low"
    });
  }

  if (context.workoutCount > 0) {
    insights.push({
      title: "Training history is usable",
      body: "Use your recent top sets as anchors for progression instead of guessing loads.",
      evidence: context.strengthSummary,
      priority: "low"
    });
  }

  return insights;
}

export function generateMealPlan(profile: AiCoachProfile, context: AiCoachContext): AiMealPlan {
  const calories = context.calorieTarget ?? estimateCalories(profile, context.currentWeight);
  const protein = context.proteinTarget ?? Math.round((context.currentWeight ?? 75) * 2);
  const fat = Math.round((calories * 0.25) / 9);
  const carbs = Math.max(Math.round((calories - protein * 4 - fat * 9) / 4), 0);
  const halal = profile.dietaryPreferences.includes("Halal");
  const vegetarian =
    profile.dietaryPreferences.includes("Vegetarian") ||
    profile.dietaryPreferences.includes("Vegan");
  const proteinBase = vegetarian
    ? "tofu, lentils, Greek-style soy yogurt"
    : halal
      ? "halal chicken, eggs, tuna"
      : "chicken, eggs, Greek yogurt";

  return {
    calories,
    protein,
    carbs,
    fat,
    meals: [
      {
        name: "Breakfast",
        foods: vegetarian
          ? ["oats", "soy yogurt", "berries", "chia"]
          : ["oats", "Greek yogurt", "berries", "honey"],
        calories: Math.round(calories * 0.25),
        protein: Math.round(protein * 0.25),
        carbs: Math.round(carbs * 0.3),
        fat: Math.round(fat * 0.2),
        preparation: "Batch oats the night before and add protein-rich yogurt in the morning."
      },
      {
        name: "Lunch",
        foods: vegetarian
          ? ["rice", "tofu", "mixed vegetables", "olive oil"]
          : ["rice", halal ? "halal chicken" : "chicken breast", "mixed vegetables"],
        calories: Math.round(calories * 0.3),
        protein: Math.round(protein * 0.3),
        carbs: Math.round(carbs * 0.35),
        fat: Math.round(fat * 0.25),
        preparation: "Cook two portions at once so tomorrow's lunch is ready."
      },
      {
        name: "Dinner",
        foods: vegetarian
          ? ["potatoes", "lentils", "salad", "avocado"]
          : ["potatoes", "salmon or lean beef", "salad"],
        calories: Math.round(calories * 0.3),
        protein: Math.round(protein * 0.3),
        carbs: Math.round(carbs * 0.25),
        fat: Math.round(fat * 0.4),
        preparation: "Keep the plate simple: protein first, then carbs, then vegetables."
      },
      {
        name: "Snack",
        foods: vegetarian
          ? ["fruit", "protein shake"]
          : ["fruit", "cottage cheese or protein shake"],
        calories: Math.round(calories * 0.15),
        protein: Math.round(protein * 0.15),
        carbs: Math.round(carbs * 0.1),
        fat: Math.round(fat * 0.15),
        preparation: "Use this meal to close any protein gap late in the day."
      }
    ],
    shoppingList: [
      "oats",
      "rice",
      "potatoes",
      "berries",
      "mixed vegetables",
      ...proteinBase.split(", ")
    ],
    mealPrepSuggestions: [
      `Prep ${String(profile.mealFrequency)} eating moments with repeatable protein anchors.`,
      `Keep cooking blocks under ${String(profile.cookingTimeMinutes)} minutes by batch-cooking carbs.`,
      "Regenerate when body weight trend changes for two consecutive weeks."
    ],
    rationale: `Targets are based on ${context.currentWeight ? `${context.currentWeight.toFixed(1)} kg body weight` : "profile defaults"}, macro goals, and the goal: ${profile.fitnessGoal}.`
  };
}

export function generateWorkoutPlan(
  profile: AiCoachProfile,
  context: AiCoachContext
): AiWorkoutPlan {
  const split = profile.workoutPreferences[0] ?? "Upper Lower";
  const days = Math.max(Math.min(profile.trainingFrequency, 6), 3);
  const focuses = getFocuses(split, days);
  const equipment = profile.availableEquipment.join(", ");

  return {
    schedule: focuses.map((focus, index) => ({
      day: `Day ${String(index + 1)}`,
      focus,
      exercises: getExercisesForFocus(focus).map((name) => ({
        name,
        sets: profile.experience === "Advanced" ? 4 : 3,
        reps: focus.includes("Strength") ? "3-6" : "6-12",
        restSeconds: focus.includes("Strength") ? 180 : 120,
        intensity: "Stop 1-2 reps before failure on most sets."
      }))
    })),
    warmup: [
      "5 minutes easy cardio",
      "2 ramp-up sets for the first compound lift",
      "One mobility drill for the target joints"
    ],
    cooldown: ["Walk 5 minutes", "Light stretching for trained muscles", "Log top sets and notes"],
    progressionStrategy:
      "When all working sets hit the top of the rep range with clean form, add 2.5 kg next time.",
    deloadRecommendation: "Deload every 5-7 hard weeks or when performance drops for two sessions.",
    rationale: `Built around ${split}, ${String(days)} training days, ${equipment || "available equipment"}, and recent data: ${context.strengthSummary}.`
  };
}

export function generateWeeklyReport(
  profile: AiCoachProfile,
  context: AiCoachContext
): AiWeeklyReport {
  return {
    trainingConsistency:
      context.workoutCount > 0
        ? `${String(context.workoutCount)} logged workouts are available for coaching context.`
        : "No strength workouts are available yet.",
    nutritionConsistency:
      context.calorieAverage !== null
        ? `Average calories are ${context.calorieAverage.toFixed(0)} kcal vs ${context.calorieTarget?.toFixed(0) ?? "unset"} target.`
        : "Log meals for a nutrition adherence report.",
    weightChanges:
      context.monthlyWeightChange !== null
        ? `Monthly body weight change is ${formatDelta(context.monthlyWeightChange)} kg.`
        : "Add body check-ins to calculate weight changes.",
    measurementChanges:
      context.waistChange !== null
        ? `Waist has changed by ${formatDelta(context.waistChange)} cm across check-ins.`
        : "No waist trend available yet.",
    strengthImprovements: context.strengthSummary,
    personalRecords: context.strongestLift ?? "No completed lift records yet.",
    recoveryObservations: context.latestJournal
      ? `Latest journal note: ${context.latestJournal.slice(0, 140)}`
      : "Add journal reflections to improve recovery coaching.",
    suggestedAdjustments: generateInsights(profile, context).map((insight) => insight.body)
  };
}

export function answerCoachQuestion(
  question: string,
  profile: AiCoachProfile,
  context: AiCoachContext
) {
  const lower = question.toLowerCase();

  if (lower.includes("eat") || lower.includes("meal") || lower.includes("calorie")) {
    const plan = generateMealPlan(profile, context);
    return `Tomorrow: aim for ${String(plan.calories)} kcal, ${String(plan.protein)}g protein, ${String(plan.carbs)}g carbs, and ${String(plan.fat)}g fat. Use ${plan.meals.map((meal) => meal.name.toLowerCase()).join(", ")} with protein at each meal. Why: ${plan.rationale}`;
  }

  if (lower.includes("program") || lower.includes("workout") || lower.includes("hypertrophy")) {
    const plan = generateWorkoutPlan(profile, context);
    return `I would run a ${String(profile.trainingFrequency)}-day ${profile.workoutPreferences[0] ?? "Upper Lower"} plan. Start with ${plan.schedule[0]?.focus ?? "Upper"}: ${plan.schedule[0]?.exercises.map((exercise) => exercise.name).join(", ") ?? "compound lifts"}. Progression: ${plan.progressionStrategy}`;
  }

  if (lower.includes("weight") || lower.includes("plateau")) {
    return context.monthlyWeightChange === null
      ? "I need at least two body check-ins to judge your weight trend."
      : `Your monthly change is ${formatDelta(context.monthlyWeightChange)} kg. If this has been flat for two weeks, adjust calories by 150-250 kcal or increase steps before changing training.`;
  }

  if (lower.includes("stronger") || lower.includes("strength")) {
    return context.strengthSummary;
  }

  return generateInsights(profile, context)
    .map((insight) => `${insight.title}: ${insight.body} (${insight.evidence})`)
    .join("\n");
}

function loadStrengthWorkoutsForAi() {
  const parsed = readJson(STRENGTH_WORKOUTS_STORAGE_KEY);
  const workouts = Array.isArray(parsed) ? parsed.filter(isStrengthWorkout) : [];
  return workouts.length > 0 ? workouts : getSeedWorkouts();
}

function loadNutritionForAi() {
  const logsParsed = readJson(FOOD_LOG_STORAGE_KEY);
  const goalsParsed = readJson(NUTRITION_GOALS_STORAGE_KEY);
  const goals = isNutritionMacroGoals(goalsParsed) ? goalsParsed : DEFAULT_MACRO_GOALS;
  const logsByDate =
    logsParsed && typeof logsParsed === "object" && !Array.isArray(logsParsed)
      ? (logsParsed as Record<string, unknown>)
      : {};
  const days = Object.values(logsByDate)
    .map((value) => (Array.isArray(value) ? value.filter(isNutritionLogItem) : []))
    .filter((items) => items.length > 0);
  const totals = days.map(getNutritionDayTotals);
  const divisor = Math.max(totals.length, 1);

  return {
    macroGoals: goals,
    calorieTarget: getCaloriesFromMacroGoals(goals),
    calorieAverage: totals.reduce((sum, day) => sum + day.calories, 0) / divisor,
    proteinAverage: totals.reduce((sum, day) => sum + day.protein, 0) / divisor
  };
}

function loadBodyCheckInsForAi() {
  const parsed = readJson(BODY_CHECK_INS_STORAGE_KEY);
  const checkIns = Array.isArray(parsed) ? parsed.filter(isBodyCheckInForAi) : [];
  return checkIns.length > 0 ? checkIns : getSeedCheckIns();
}

function loadJournalForAi() {
  const parsed = readJson(BODY_JOURNAL_STORAGE_KEY);
  const entries = Array.isArray(parsed) ? parsed.filter(isJournalEntryForAi) : [];
  return (entries.length > 0 ? entries : getSeedJournalEntries()).sort((a, b) =>
    b.date.localeCompare(a.date)
  );
}

function getNutritionDayTotals(items: NutritionLogItem[]) {
  return items.reduce(
    (totals, item) => ({
      calories: totals.calories + getItemCalories(item),
      protein: totals.protein + (item.protein ?? 0)
    }),
    { calories: 0, protein: 0 }
  );
}

function getStrengthSummary(workouts: StrengthWorkout[]) {
  const exerciseNames = Array.from(
    new Set(workouts.flatMap((workout) => workout.exercises.map((exercise) => exercise.name)))
  ).filter(Boolean);
  const liftSummaries = exerciseNames
    .map((name) => {
      const history = getExerciseHistory(workouts, name);
      const records = getExercisePersonalRecords(history);
      return { name, records };
    })
    .sort((a, b) => b.records.bestEstimatedOneRepMax - a.records.bestEstimatedOneRepMax);
  const top = liftSummaries[0];

  return {
    strongestLift: top
      ? `${top.name}: ${top.records.highestWeight.toFixed(1)} kg top weight, ${top.records.bestEstimatedOneRepMax.toFixed(1)} kg estimated 1RM`
      : undefined,
    summary: top
      ? `${top.name} is currently the strongest tracked lift at ${top.records.highestWeight.toFixed(1)} kg for a top set.`
      : "No completed strength sets are available yet."
  };
}

function estimateCalories(profile: AiCoachProfile, currentWeight: number | null) {
  const weight = currentWeight ?? 75;
  const multiplier = {
    Sedentary: 28,
    Light: 31,
    Moderate: 34,
    "Very Active": 37,
    Athlete: 40
  }[profile.activityLevel];
  const maintenance = Math.round(weight * multiplier);

  if (profile.fitnessGoal === "Lose Fat") {
    return maintenance - 350;
  }

  if (profile.fitnessGoal === "Build Muscle") {
    return maintenance + 250;
  }

  return maintenance;
}

function getFocuses(split: string, days: number) {
  if (split === "Push Pull Legs") {
    return [
      "Push Hypertrophy",
      "Pull Hypertrophy",
      "Legs Hypertrophy",
      "Push Strength",
      "Pull Strength",
      "Legs Strength"
    ].slice(0, days);
  }

  if (split === "Full Body") {
    return Array.from({ length: days }, (_, index) => `Full Body ${String(index + 1)}`);
  }

  if (split === "Anterior Posterior") {
    return [
      "Anterior Strength",
      "Posterior Strength",
      "Anterior Hypertrophy",
      "Posterior Hypertrophy",
      "Full Body",
      "Conditioning"
    ].slice(0, days);
  }

  return [
    "Upper Strength",
    "Lower Strength",
    "Upper Hypertrophy",
    "Lower Hypertrophy",
    "Full Body",
    "Conditioning"
  ].slice(0, days);
}

function getExercisesForFocus(focus: string) {
  if (focus.includes("Push") || focus.includes("Anterior") || focus.includes("Upper")) {
    return ["Bench Press", "Incline DB Press", "Cable Row", "Lateral Raise", "Tricep Pushdown"];
  }

  if (focus.includes("Pull") || focus.includes("Posterior")) {
    return ["Deadlift", "Pull-Up", "Chest-Supported Row", "Rear Delt Fly", "EZ Bar Curl"];
  }

  if (focus.includes("Leg") || focus.includes("Lower")) {
    return ["Back Squat", "Romanian Deadlift", "Leg Press", "Leg Curl", "Calf Raise"];
  }

  return ["Back Squat", "Bench Press", "Barbell Row", "Romanian Deadlift", "Plank"];
}

function formatDelta(value: number) {
  return value > 0 ? `+${value.toFixed(1)}` : value.toFixed(1);
}

function readJson(key: string) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as unknown) : null;
  } catch {
    return null;
  }
}

function isBodyCheckInForAi(value: unknown): value is BodyCheckIn {
  return Boolean(
    value &&
    typeof value === "object" &&
    "id" in value &&
    "date" in value &&
    "measurements" in value
  );
}

function isJournalEntryForAi(value: unknown): value is JournalEntry {
  return Boolean(
    value && typeof value === "object" && "id" in value && "date" in value && "content" in value
  );
}
