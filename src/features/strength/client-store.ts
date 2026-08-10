import type {
  ExerciseHistoryEntry,
  ExercisePersonalRecords,
  ExerciseProgressPoint,
  StrengthExerciseEntry,
  StrengthRange,
  StrengthSet,
  StrengthTemplate,
  StrengthWorkout
} from "@/types/strength";

export const STRENGTH_WORKOUTS_STORAGE_KEY = "strength.workouts.v1";
export const STRENGTH_TEMPLATES_STORAGE_KEY = "strength.templates.v1";
export const STRENGTH_DRAFT_STORAGE_KEY = "strength.activeDraft.v1";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export const DEFAULT_TEMPLATE_NAMES = [
  "Default_Push",
  "Default_Pull",
  "Default_Legs",
  "Default_Upper",
  "Default_Lower",
  "Default_Anterior",
  "Default_Posterior",
  "Default_Full_Body"
] as const;

const DEFAULT_TEMPLATE_EXERCISES: Record<(typeof DEFAULT_TEMPLATE_NAMES)[number], string[]> = {
  Default_Push: ["Bench Press", "Incline DB Press", "Cable Fly", "Lateral Raise", "Tricep Pushdown"],
  Default_Pull: ["Pull-Up", "Barbell Row", "Lat Pulldown", "Face Pull", "EZ Bar Curl"],
  Default_Legs: ["Back Squat", "Romanian Deadlift", "Leg Press", "Leg Curl", "Standing Calf Raise"],
  Default_Upper: ["Bench Press", "Barbell Row", "Overhead Press", "Pull-Up", "Lateral Raise"],
  Default_Lower: ["Back Squat", "Romanian Deadlift", "Split Squat", "Leg Curl", "Calf Raise"],
  Default_Anterior: ["Bench Press", "Incline DB Press", "Cable Fly", "Lateral Raise", "Tricep Pushdown"],
  Default_Posterior: ["Deadlift", "Chest-Supported Row", "Lat Pulldown", "Rear Delt Fly", "Hamstring Curl"],
  Default_Full_Body: ["Back Squat", "Bench Press", "Barbell Row", "Romanian Deadlift", "Plank"]
};

export function createId(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

export function getTodayKey() {
  return new Date().toISOString().slice(0, 10);
}

export function createEmptySet(): StrengthSet {
  return {
    id: createId("set"),
    weight: null,
    reps: null,
    rir: null,
    restSeconds: null,
    completed: false,
    kind: "working"
  };
}

export function createExerciseEntry(name = ""): StrengthExerciseEntry {
  return {
    id: createId("exercise"),
    name,
    notes: "",
    sets: [createEmptySet()]
  };
}

export function createWorkoutDraft(template?: StrengthTemplate): StrengthWorkout {
  const now = new Date();
  const time = now.toTimeString().slice(0, 5);

  return {
    id: createId("workout"),
    date: getTodayKey(),
    startTime: time,
    notes: "",
    exercises: template
      ? template.exerciseNames.map((exerciseName) => createExerciseEntry(exerciseName))
      : [createExerciseEntry()],
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...(template ? { name: template.name, sourceTemplateId: template.id } : {})
  };
}

export function createTemplate(name: string, exerciseNames: string[]): StrengthTemplate {
  return {
    id: createId("template"),
    name,
    exerciseNames: exerciseNames.filter(Boolean),
    createdAt: Date.now(),
    updatedAt: Date.now()
  };
}

export function getSeedTemplates() {
  return DEFAULT_TEMPLATE_NAMES.map((name) =>
    createTemplate(name, DEFAULT_TEMPLATE_EXERCISES[name])
  );
}

export function getSeedWorkouts(): StrengthWorkout[] {
  const base = [
    {
      date: "2026-07-15",
      name: "Anterior Workout",
      startTime: "19:32",
      exercises: [
        ["Bench Press", [makeSet(80, 8), makeSet(80, 7), makeSet(80, 6)]],
        ["Incline Dumbbell Press", [makeSet(32, 8), makeSet(32, 7)]],
        ["Cable Fly", [makeSet(22.5, 12), makeSet(22.5, 11)]]
      ]
    },
    {
      date: "2026-07-08",
      name: "Anterior Workout",
      startTime: "18:48",
      exercises: [
        ["Bench Press", [makeSet(77.5, 8), makeSet(77.5, 8), makeSet(77.5, 7)]],
        ["Incline Dumbbell Press", [makeSet(30, 9), makeSet(30, 8)]],
        ["Cable Fly", [makeSet(20, 13), makeSet(20, 12)]]
      ]
    },
    {
      date: "2026-07-02",
      name: "Push",
      startTime: "20:05",
      exercises: [
        ["Bench Press", [makeSet(75, 8), makeSet(75, 7), makeSet(75, 6)]],
        ["Lateral Raise", [makeSet(12, 14), makeSet(12, 12)]],
        ["Tricep Pushdown", [makeSet(32.5, 10), makeSet(32.5, 9)]]
      ]
    }
  ] as const;

  return base.map((workout) => ({
    id: createId("workout"),
    date: workout.date,
    startTime: workout.startTime,
    endTime: "",
    name: workout.name,
    notes: "",
    exercises: workout.exercises.map(([name, sets]) => ({
      id: createId("exercise"),
      name,
      notes: "",
      sets: sets.map((set) => ({ ...set, id: createId("set") }))
    })),
    createdAt: new Date(`${workout.date}T${workout.startTime}`).getTime(),
    updatedAt: new Date(`${workout.date}T${workout.startTime}`).getTime()
  }));
}

function makeSet(weight: number, reps: number): Omit<StrengthSet, "id"> {
  return {
    weight,
    reps,
    rir: null,
    restSeconds: null,
    completed: true,
    kind: "working"
  };
}

export function isStrengthWorkout(value: unknown): value is StrengthWorkout {
  if (!value || typeof value !== "object") {
    return false;
  }

  const workout = value as Partial<StrengthWorkout>;

  return (
    typeof workout.id === "string" &&
    typeof workout.date === "string" &&
    typeof workout.startTime === "string" &&
    Array.isArray(workout.exercises)
  );
}

export function isStrengthTemplate(value: unknown): value is StrengthTemplate {
  if (!value || typeof value !== "object") {
    return false;
  }

  const template = value as Partial<StrengthTemplate>;

  return (
    typeof template.id === "string" &&
    typeof template.name === "string" &&
    Array.isArray(template.exerciseNames)
  );
}

export function loadStrengthWorkouts() {
  const raw = localStorage.getItem(STRENGTH_WORKOUTS_STORAGE_KEY);
  const parsed: unknown = raw ? JSON.parse(raw) : null;
  const workouts = Array.isArray(parsed) ? parsed.filter(isStrengthWorkout) : [];

  if (workouts.length > 0) {
    return workouts;
  }

  const seeded = getSeedWorkouts();
  saveStrengthWorkouts(seeded);
  return seeded;
}

export function saveStrengthWorkouts(workouts: StrengthWorkout[]) {
  localStorage.setItem(STRENGTH_WORKOUTS_STORAGE_KEY, JSON.stringify(workouts));
}

export function loadStrengthTemplates() {
  const raw = localStorage.getItem(STRENGTH_TEMPLATES_STORAGE_KEY);
  const parsed: unknown = raw ? JSON.parse(raw) : null;
  const templates = Array.isArray(parsed) ? parsed.filter(isStrengthTemplate) : [];

  if (templates.length > 0) {
    return templates;
  }

  const seeded = getSeedTemplates();
  saveStrengthTemplates(seeded);
  return seeded;
}

export function saveStrengthTemplates(templates: StrengthTemplate[]) {
  localStorage.setItem(STRENGTH_TEMPLATES_STORAGE_KEY, JSON.stringify(templates));
}

export function formatWorkoutDate(dateKey: string, includeYear = false) {
  const date = new Date(`${dateKey}T12:00:00`);

  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: includeYear ? "numeric" : undefined
  }).format(date);
}

export function getWorkoutDuration(workout: StrengthWorkout) {
  if (!workout.endTime) {
    return null;
  }

  const start = new Date(`${workout.date}T${workout.startTime}`).getTime();
  const end = new Date(`${workout.date}T${workout.endTime}`).getTime();
  const minutes = Math.max(Math.round((end - start) / 60000), 0);

  return minutes > 0 ? minutes : null;
}

export function getWorkoutTotals(workout: StrengthWorkout) {
  return workout.exercises.reduce(
    (totals, exercise) => ({
      exerciseCount: totals.exerciseCount + (exercise.name.trim() ? 1 : 0),
      setCount: totals.setCount + exercise.sets.length,
      completedSetCount:
        totals.completedSetCount + exercise.sets.filter((set) => set.completed).length
    }),
    { exerciseCount: 0, setCount: 0, completedSetCount: 0 }
  );
}

export function getExerciseHistory(workouts: StrengthWorkout[], exerciseName: string) {
  const normalizedName = normalizeExerciseName(exerciseName);

  return workouts
    .flatMap((workout) =>
      workout.exercises
        .filter((exercise) => normalizeExerciseName(exercise.name) === normalizedName)
        .map<ExerciseHistoryEntry>((exercise) => ({
          workoutId: workout.id,
          date: workout.date,
          startTime: workout.startTime,
          sets: exercise.sets,
          ...(workout.name ? { workoutName: workout.name } : {}),
          ...(exercise.notes ? { notes: exercise.notes } : {})
        }))
    )
    .sort((a, b) => `${a.date}T${a.startTime}`.localeCompare(`${b.date}T${b.startTime}`));
}

export function getPreviousExerciseSession(
  workouts: StrengthWorkout[],
  exerciseName: string,
  beforeWorkoutId?: string
) {
  const history = getExerciseHistory(workouts, exerciseName);
  const beforeIndex = beforeWorkoutId
    ? history.findIndex((entry) => entry.workoutId === beforeWorkoutId)
    : history.length;

  return history[Math.max(beforeIndex - 1, 0)]?.workoutId === beforeWorkoutId
    ? undefined
    : history[Math.max(beforeIndex - 1, 0)];
}

export function getExercisePersonalRecords(
  history: ExerciseHistoryEntry[]
): ExercisePersonalRecords {
  return history.reduce(
    (records, entry) => {
      const completedSets = getCompletedSets(entry.sets);
      const highestWeight = Math.max(0, ...completedSets.map((set) => set.weight ?? 0));
      const mostReps = Math.max(0, ...completedSets.map((set) => set.reps ?? 0));
      const bestEstimatedOneRepMax = Math.max(
        0,
        ...completedSets.map((set) => estimateOneRepMax(set.weight, set.reps))
      );
      const bestVolume = completedSets.reduce(
        (sum, set) => sum + (set.weight ?? 0) * (set.reps ?? 0),
        0
      );

      return {
        highestWeight: Math.max(records.highestWeight, highestWeight),
        bestEstimatedOneRepMax: Math.max(records.bestEstimatedOneRepMax, bestEstimatedOneRepMax),
        bestVolume: Math.max(records.bestVolume, bestVolume),
        mostReps: Math.max(records.mostReps, mostReps)
      };
    },
    { highestWeight: 0, bestEstimatedOneRepMax: 0, bestVolume: 0, mostReps: 0 }
  );
}

export function getExerciseProgress(history: ExerciseHistoryEntry[]): ExerciseProgressPoint[] {
  return history.map((entry) => {
    const completedSets = getCompletedSets(entry.sets);
    const reps = completedSets.map((set) => set.reps ?? 0);
    const trainingVolume = completedSets.reduce(
      (sum, set) => sum + (set.weight ?? 0) * (set.reps ?? 0),
      0
    );

    return {
      date: entry.date,
      estimatedOneRepMax: Math.max(
        0,
        ...completedSets.map((set) => estimateOneRepMax(set.weight, set.reps))
      ),
      highestWeight: Math.max(0, ...completedSets.map((set) => set.weight ?? 0)),
      trainingVolume,
      averageReps: reps.length > 0 ? reps.reduce((sum, rep) => sum + rep, 0) / reps.length : 0
    };
  });
}

export function filterProgressByRange(points: ExerciseProgressPoint[], range: StrengthRange) {
  if (range === "ALL" || points.length === 0) {
    return points;
  }

  const days = { "1M": 31, "3M": 93, "6M": 186, "1Y": 365 }[range];
  const latest = Math.max(...points.map((point) => new Date(`${point.date}T12:00:00`).getTime()));

  return points.filter(
    (point) => latest - new Date(`${point.date}T12:00:00`).getTime() <= days * MS_PER_DAY
  );
}

export function formatSet(set: StrengthSet) {
  const weight = set.weight ?? 0;
  const reps = set.reps ?? 0;

  return `${formatNumber(weight)} x ${String(reps)}`;
}

export function normalizeExerciseName(name: string) {
  return name.trim().toLowerCase();
}

export function slugifyExerciseName(name: string) {
  return encodeURIComponent(name.trim());
}

export function deslugifyExerciseName(name: string) {
  return decodeURIComponent(name);
}

function getCompletedSets(sets: StrengthSet[]) {
  return sets.filter((set) => set.completed && set.weight !== null && set.reps !== null);
}

function estimateOneRepMax(weight: number | null, reps: number | null) {
  if (!weight || !reps) {
    return 0;
  }

  return weight * (1 + reps / 30);
}

function formatNumber(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}
