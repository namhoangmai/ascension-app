export type FitnessGoal =
  | "Build Muscle"
  | "Lose Fat"
  | "Maintain Weight"
  | "Recomposition"
  | "Improve Strength"
  | "Improve Endurance";

export type ActivityLevel = "Sedentary" | "Light" | "Moderate" | "Very Active" | "Athlete";

export type ExperienceLevel = "Beginner" | "Intermediate" | "Advanced";

export interface AiCoachProfile {
  age: number | null;
  heightCm: number | null;
  sex: "" | "Female" | "Male" | "Other";
  activityLevel: ActivityLevel;
  fitnessGoal: FitnessGoal;
  dietaryPreferences: string[];
  workoutPreferences: string[];
  availableEquipment: string[];
  trainingFrequency: number;
  mealFrequency: number;
  budget?: string;
  cookingTimeMinutes: number;
  workoutDurationMinutes: number;
  experience: ExperienceLevel;
  injuries: string;
  exercisePreferences: string;
  dataPermissions: {
    strength: boolean;
    nutrition: boolean;
    body: boolean;
    journal: boolean;
  };
}

export interface AiInsight {
  title: string;
  body: string;
  evidence: string;
  priority: "high" | "medium" | "low";
}

export interface AiMeal {
  name: string;
  foods: string[];
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  preparation: string;
}

export interface AiMealPlan {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  meals: AiMeal[];
  shoppingList: string[];
  mealPrepSuggestions: string[];
  rationale: string;
}

export interface AiWorkoutPlan {
  schedule: {
    day: string;
    focus: string;
    exercises: {
      name: string;
      sets: number;
      reps: string;
      restSeconds: number;
      intensity: string;
    }[];
  }[];
  warmup: string[];
  cooldown: string[];
  progressionStrategy: string;
  deloadRecommendation: string;
  rationale: string;
}

export interface AiWeeklyReport {
  trainingConsistency: string;
  nutritionConsistency: string;
  weightChanges: string;
  measurementChanges: string;
  strengthImprovements: string;
  personalRecords: string;
  recoveryObservations: string;
  suggestedAdjustments: string[];
}

export interface AiCoachContext {
  currentWeight: number | null;
  monthlyWeightChange: number | null;
  proteinAverage: number | null;
  calorieAverage: number | null;
  calorieTarget: number | null;
  proteinTarget: number | null;
  workoutCount: number;
  strongestLift?: string;
  latestJournal?: string;
  waistChange: number | null;
  strengthSummary: string;
}
