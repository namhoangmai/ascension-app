export interface StrengthSet {
  id: string;
  weight: number | null;
  reps: number | null;
  rir?: number | null;
  restSeconds?: number | null;
  completed: boolean;
  kind?: "working" | "warmup" | "drop" | "failure";
  tempo?: string;
}

export interface StrengthExerciseEntry {
  id: string;
  name: string;
  notes?: string;
  sets: StrengthSet[];
  supersetGroupId?: string;
  muscleGroup?: string;
}

export interface StrengthWorkout {
  id: string;
  date: string;
  startTime: string;
  endTime?: string;
  name?: string;
  notes?: string;
  exercises: StrengthExerciseEntry[];
  createdAt: number;
  updatedAt: number;
  sourceTemplateId?: string;
  status?: "in_progress" | "completed";
}

export interface StrengthTemplate {
  id: string;
  name: string;
  exerciseNames: string[];
  createdAt: number;
  updatedAt: number;
}

export interface ExerciseHistoryEntry {
  workoutId: string;
  workoutName?: string;
  date: string;
  startTime: string;
  notes?: string;
  sets: StrengthSet[];
}

export interface ExercisePersonalRecords {
  highestWeight: number;
  bestEstimatedOneRepMax: number;
  bestVolume: number;
  mostReps: number;
}

export interface ExerciseProgressPoint {
  date: string;
  estimatedOneRepMax: number;
  highestWeight: number;
  trainingVolume: number;
  averageReps: number;
}

export type StrengthRange = "1M" | "3M" | "6M" | "1Y" | "ALL";
