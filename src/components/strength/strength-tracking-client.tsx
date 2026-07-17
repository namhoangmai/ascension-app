"use client";

import Link from "next/link";
import {
  CalendarDays,
  Check,
  Clock,
  Copy,
  Dumbbell,
  FileText,
  LineChart,
  MoreVertical,
  Pencil,
  Plus,
  Save,
  Trash2,
  X
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useMemo, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart as RechartsLineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";

import { Button } from "@/components/ui/button";
import {
  STRENGTH_DRAFT_STORAGE_KEY,
  createEmptySet,
  createExerciseEntry,
  createTemplate,
  createWorkoutDraft,
  filterProgressByRange,
  formatSet,
  formatWorkoutDate,
  getExerciseHistory,
  getExercisePersonalRecords,
  getExerciseProgress,
  getPreviousExerciseSession,
  getWorkoutDuration,
  getWorkoutTotals,
  loadStrengthTemplates,
  loadStrengthWorkouts,
  saveStrengthTemplates,
  saveStrengthWorkouts,
  slugifyExerciseName
} from "@/features/strength/client-store";
import { cn } from "@/lib/utils";
import type {
  ExerciseHistoryEntry,
  StrengthExerciseEntry,
  StrengthRange,
  StrengthSet,
  StrengthTemplate,
  StrengthWorkout
} from "@/types/strength";

type TabKey = "history" | "templates";
type ChartMetric = "estimatedOneRepMax" | "highestWeight" | "trainingVolume" | "averageReps";

const RANGE_OPTIONS: { value: StrengthRange; label: string }[] = [
  { value: "1M", label: "1M" },
  { value: "3M", label: "3M" },
  { value: "6M", label: "6M" },
  { value: "1Y", label: "1Y" },
  { value: "ALL", label: "All" }
];

const CHART_METRICS: { value: ChartMetric; label: string; color: string }[] = [
  { value: "estimatedOneRepMax", label: "Estimated 1RM", color: "#9cee3a" },
  { value: "highestWeight", label: "Highest Weight", color: "#38bdf8" },
  { value: "trainingVolume", label: "Training Volume", color: "#fbbf24" },
  { value: "averageReps", label: "Average Reps", color: "#f472b6" }
];

export function StrengthTrackingClient() {
  const [activeTab, setActiveTab] = useState<TabKey>("history");
  const [workouts, setWorkouts] = useState<StrengthWorkout[]>([]);
  const [templates, setTemplates] = useState<StrengthTemplate[]>([]);
  const [draft, setDraft] = useState<StrengthWorkout | null>(null);
  const [recoverableDraft, setRecoverableDraft] = useState<StrengthWorkout | null>(null);
  const [selectedWorkoutId, setSelectedWorkoutId] = useState<string | null>(null);
  const [templateDraft, setTemplateDraft] = useState<StrengthTemplate | null>(null);

  useEffect(() => {
    setWorkouts(loadStrengthWorkouts());
    setTemplates(loadStrengthTemplates());

    const rawDraft = localStorage.getItem(STRENGTH_DRAFT_STORAGE_KEY);
    if (rawDraft) {
      try {
        setRecoverableDraft(JSON.parse(rawDraft) as StrengthWorkout);
      } catch {
        localStorage.removeItem(STRENGTH_DRAFT_STORAGE_KEY);
      }
    }
  }, []);

  useEffect(() => {
    if (draft) {
      localStorage.setItem(STRENGTH_DRAFT_STORAGE_KEY, JSON.stringify(draft));
    }
  }, [draft]);

  const sortedWorkouts = useMemo(
    () =>
      workouts
        .slice()
        .sort((a, b) => `${b.date}T${b.startTime}`.localeCompare(`${a.date}T${a.startTime}`)),
    [workouts]
  );

  const selectedWorkout = workouts.find((workout) => workout.id === selectedWorkoutId);

  function persistWorkouts(nextWorkouts: StrengthWorkout[]) {
    setWorkouts(nextWorkouts);
    saveStrengthWorkouts(nextWorkouts);
  }

  function persistTemplates(nextTemplates: StrengthTemplate[]) {
    setTemplates(nextTemplates);
    saveStrengthTemplates(nextTemplates);
  }

  function saveDraft() {
    if (!draft) {
      return;
    }

    const cleanedDraft = {
      ...draft,
      exercises: draft.exercises
        .filter((exercise) => exercise.name.trim())
        .map((exercise) => ({
          ...exercise,
          name: exercise.name.trim(),
          sets: exercise.sets.length > 0 ? exercise.sets : [createEmptySet()]
        })),
      updatedAt: Date.now()
    };

    if (cleanedDraft.exercises.length === 0) {
      cleanedDraft.exercises = [createExerciseEntry("Bench Press")];
    }

    persistWorkouts([
      cleanedDraft,
      ...workouts.filter((workout) => workout.id !== cleanedDraft.id)
    ]);
    localStorage.removeItem(STRENGTH_DRAFT_STORAGE_KEY);
    setDraft(null);
    setRecoverableDraft(null);
    setSelectedWorkoutId(cleanedDraft.id);
  }

  function startTemplate(template: StrengthTemplate) {
    setActiveTab("history");
    setRecoverableDraft(null);
    setDraft(createWorkoutDraft(template));
  }

  function closeDraftEditor() {
    setRecoverableDraft(draft);
    setDraft(null);
  }

  function discardRecoverableDraft() {
    localStorage.removeItem(STRENGTH_DRAFT_STORAGE_KEY);
    setRecoverableDraft(null);
  }

  function saveTemplateDraft() {
    if (!templateDraft?.name.trim()) {
      return;
    }

    const cleaned = {
      ...templateDraft,
      name: templateDraft.name.trim(),
      exerciseNames: templateDraft.exerciseNames.map((name) => name.trim()).filter(Boolean),
      updatedAt: Date.now()
    };

    persistTemplates([cleaned, ...templates.filter((template) => template.id !== cleaned.id)]);
    setTemplateDraft(null);
  }

  return (
    <div className="mx-auto max-w-5xl space-y-5 pb-24">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium text-primary">Training</p>
          <h1 className="text-3xl font-semibold tracking-normal">Strength Tracking</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Log sessions, reuse templates, compare against your last lift, and follow exercise PRs
            over time.
          </p>
        </div>
        <div className="flex rounded-md border border-white/10 bg-white/[0.04] p-1">
          <TabButton
            active={activeTab === "history"}
            onClick={() => {
              setActiveTab("history");
            }}
          >
            Workout History
          </TabButton>
          <TabButton
            active={activeTab === "templates"}
            onClick={() => {
              setActiveTab("templates");
            }}
          >
            Workout Templates
          </TabButton>
        </div>
      </header>

      {activeTab === "history" ? (
        <WorkoutHistory
          workouts={sortedWorkouts}
          selectedWorkout={selectedWorkout}
          onOpenWorkout={setSelectedWorkoutId}
          onCloseWorkout={() => {
            setSelectedWorkoutId(null);
          }}
          onDeleteWorkout={(workoutId) => {
            persistWorkouts(workouts.filter((workout) => workout.id !== workoutId));
            setSelectedWorkoutId(null);
          }}
        />
      ) : (
        <TemplateList
          templates={templates}
          onStart={startTemplate}
          onCreate={() => {
            setTemplateDraft(createTemplate("New Template", [""]));
          }}
          onEdit={setTemplateDraft}
          onDuplicate={(template) => {
            persistTemplates([
              createTemplate(`${template.name} Copy`, template.exerciseNames),
              ...templates
            ]);
          }}
          onDelete={(templateId) => {
            persistTemplates(templates.filter((template) => template.id !== templateId));
          }}
        />
      )}

      {recoverableDraft && !draft ? (
        <section className="flex flex-col gap-3 rounded-lg border border-primary/30 bg-primary/10 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-semibold tracking-normal">In-progress workout saved</h2>
            <p className="text-sm text-muted-foreground">
              {recoverableDraft.name ?? "Untitled Workout"} from{" "}
              {formatWorkoutDate(recoverableDraft.date)} at {recoverableDraft.startTime}
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => {
                discardRecoverableDraft();
              }}
            >
              Discard
            </Button>
            <Button
              onClick={() => {
                setDraft(recoverableDraft);
                setRecoverableDraft(null);
              }}
            >
              Resume
            </Button>
          </div>
        </section>
      ) : null}

      <Button
        className="fixed bottom-24 right-5 z-30 size-16 rounded-full shadow-glow md:bottom-8 md:right-8"
        size="icon"
        aria-label="Create new workout"
        onClick={() => {
          setRecoverableDraft(null);
          setDraft(createWorkoutDraft());
        }}
      >
        <Plus className="size-8" aria-hidden="true" />
      </Button>

      <AnimatePresence>
        {draft ? (
          <WorkoutEditor
            key={draft.id}
            draft={draft}
            workouts={workouts}
            onChange={setDraft}
            onClose={() => {
              closeDraftEditor();
            }}
            onSave={saveDraft}
          />
        ) : null}

        {templateDraft ? (
          <TemplateEditor
            key={templateDraft.id}
            template={templateDraft}
            onChange={setTemplateDraft}
            onClose={() => {
              setTemplateDraft(null);
            }}
            onSave={saveTemplateDraft}
          />
        ) : null}
      </AnimatePresence>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children
}: {
  active: boolean;
  onClick: () => void;
  children: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "min-h-10 rounded-md px-3 text-sm font-medium transition-colors",
        active ? "bg-primary text-primary-foreground" : "hover:bg-white/8 text-muted-foreground"
      )}
    >
      {children}
    </button>
  );
}

function WorkoutHistory({
  workouts,
  selectedWorkout,
  onOpenWorkout,
  onCloseWorkout,
  onDeleteWorkout
}: {
  workouts: StrengthWorkout[];
  selectedWorkout: StrengthWorkout | undefined;
  onOpenWorkout: (workoutId: string) => void;
  onCloseWorkout: () => void;
  onDeleteWorkout: (workoutId: string) => void;
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
      <section className="space-y-3">
        {workouts.map((workout) => (
          <WorkoutCard
            key={workout.id}
            workout={workout}
            onOpen={() => {
              onOpenWorkout(workout.id);
            }}
          />
        ))}
      </section>

      <aside className="hidden lg:block">
        {selectedWorkout ? (
          <WorkoutDetail
            workout={selectedWorkout}
            onClose={onCloseWorkout}
            onDelete={onDeleteWorkout}
          />
        ) : (
          <div className="rounded-lg border border-dashed border-white/15 bg-card/70 p-5 text-sm text-muted-foreground">
            Select a workout to inspect the full session.
          </div>
        )}
      </aside>

      <AnimatePresence>
        {selectedWorkout ? (
          <motion.div
            className="fixed inset-0 z-40 bg-background/80 p-4 backdrop-blur-xl lg:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <WorkoutDetail
              workout={selectedWorkout}
              onClose={onCloseWorkout}
              onDelete={onDeleteWorkout}
            />
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

function WorkoutCard({ workout, onOpen }: { workout: StrengthWorkout; onOpen: () => void }) {
  const totals = getWorkoutTotals(workout);
  const duration = getWorkoutDuration(workout);

  return (
    <button
      type="button"
      onClick={onOpen}
      className="w-full rounded-lg border border-white/10 bg-card/90 p-4 text-left shadow-xl shadow-black/10 transition-colors hover:border-primary/50 hover:bg-card"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">{formatWorkoutDate(workout.date)}</p>
          <h2 className="mt-1 text-xl font-semibold tracking-normal">
            {workout.name ?? "Untitled Workout"}
          </h2>
          <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
            <StatPill icon={Clock} label={workout.startTime} />
            {duration ? <StatPill icon={CalendarDays} label={`${String(duration)} min`} /> : null}
            <StatPill icon={Dumbbell} label={`${String(totals.exerciseCount)} exercises`} />
            <StatPill icon={Check} label={`${String(totals.setCount)} sets`} />
          </div>
        </div>
        <MoreVertical className="size-5 text-muted-foreground" aria-hidden="true" />
      </div>

      <div className="mt-4 space-y-2">
        {workout.exercises.slice(0, 4).map((exercise) => (
          <div key={exercise.id} className="flex items-center justify-between gap-3 text-sm">
            <span className="font-medium">{exercise.name}</span>
            <span className="text-muted-foreground">{exercise.sets.length} sets</span>
          </div>
        ))}
      </div>

      {workout.notes ? (
        <p className="mt-4 border-t border-white/10 pt-3 text-sm text-muted-foreground">
          {workout.notes}
        </p>
      ) : null}
    </button>
  );
}

function WorkoutDetail({
  workout,
  onClose,
  onDelete
}: {
  workout: StrengthWorkout;
  onClose: () => void;
  onDelete: (workoutId: string) => void;
}) {
  const totals = getWorkoutTotals(workout);

  return (
    <div className="max-h-full overflow-y-auto rounded-lg border border-white/10 bg-card p-4 shadow-xl shadow-black/30">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">{formatWorkoutDate(workout.date, true)}</p>
          <h2 className="text-xl font-semibold tracking-normal">{workout.name ?? "Workout"}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {workout.startTime} - {totals.exerciseCount} exercises - {totals.setCount} sets
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            size="icon"
            variant="ghost"
            onClick={() => {
              onDelete(workout.id);
            }}
            aria-label="Delete workout"
          >
            <Trash2 className="size-4" aria-hidden="true" />
          </Button>
          <Button size="icon" variant="ghost" onClick={onClose} aria-label="Close workout">
            <X className="size-4" aria-hidden="true" />
          </Button>
        </div>
      </div>

      <div className="mt-5 space-y-4">
        {workout.exercises.map((exercise) => (
          <section
            key={exercise.id}
            className="rounded-md border border-white/10 bg-background/50 p-3"
          >
            <Link
              href={`/strength/exercises/${slugifyExerciseName(exercise.name)}`}
              className="inline-flex items-center gap-2 text-base font-semibold hover:text-primary"
            >
              <LineChart className="size-4" aria-hidden="true" />
              {exercise.name}
            </Link>
            {exercise.notes ? (
              <p className="mt-1 text-sm text-muted-foreground">{exercise.notes}</p>
            ) : null}
            <div className="mt-3 space-y-2">
              {exercise.sets.map((set, index) => (
                <div key={set.id} className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Set {index + 1}</span>
                  <span className="font-medium">
                    {formatSet(set)}
                    {set.rpe ? ` - RPE ${String(set.rpe)}` : ""}
                  </span>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

function TemplateList({
  templates,
  onStart,
  onCreate,
  onEdit,
  onDuplicate,
  onDelete
}: {
  templates: StrengthTemplate[];
  onStart: (template: StrengthTemplate) => void;
  onCreate: () => void;
  onEdit: (template: StrengthTemplate) => void;
  onDuplicate: (template: StrengthTemplate) => void;
  onDelete: (templateId: string) => void;
}) {
  return (
    <section className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={onCreate}>
          <Plus className="size-4" aria-hidden="true" />
          Create Template
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {templates.map((template) => (
          <article key={template.id} className="rounded-lg border border-white/10 bg-card/90 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold tracking-normal">{template.name}</h2>
                <p className="text-sm text-muted-foreground">
                  {template.exerciseNames.length} exercises
                </p>
              </div>
              <FileText className="size-5 text-primary" aria-hidden="true" />
            </div>
            <ol className="mt-4 space-y-2 text-sm">
              {template.exerciseNames.map((exerciseName, index) => (
                <li key={`${template.id}-${exerciseName}`} className="flex gap-2">
                  <span className="w-5 text-muted-foreground">{index + 1}.</span>
                  <span>{exerciseName}</span>
                </li>
              ))}
            </ol>
            <div className="mt-5 grid grid-cols-4 gap-2">
              <Button
                className="col-span-4"
                onClick={() => {
                  onStart(template);
                }}
              >
                <Dumbbell className="size-4" aria-hidden="true" />
                Start Workout
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={() => {
                  onEdit(template);
                }}
                aria-label="Rename template"
              >
                <Pencil className="size-4" aria-hidden="true" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={() => {
                  onDuplicate(template);
                }}
                aria-label="Duplicate template"
              >
                <Copy className="size-4" aria-hidden="true" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={() => {
                  onDelete(template.id);
                }}
                aria-label="Delete template"
              >
                <Trash2 className="size-4" aria-hidden="true" />
              </Button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function WorkoutEditor({
  draft,
  workouts,
  onChange,
  onClose,
  onSave
}: {
  draft: StrengthWorkout;
  workouts: StrengthWorkout[];
  onChange: (draft: StrengthWorkout) => void;
  onClose: () => void;
  onSave: () => void;
}) {
  function updateExercise(exerciseId: string, nextExercise: StrengthExerciseEntry) {
    onChange({
      ...draft,
      exercises: draft.exercises.map((exercise) =>
        exercise.id === exerciseId ? nextExercise : exercise
      ),
      updatedAt: Date.now()
    });
  }

  return (
    <motion.div
      className="fixed inset-0 z-50 overflow-y-auto bg-background/90 p-4 backdrop-blur-xl"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 16 }}
    >
      <div className="mx-auto max-w-3xl space-y-5 rounded-lg border border-white/10 bg-card p-4 shadow-xl shadow-black/30 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm text-primary">New Workout</p>
            <h2 className="text-2xl font-semibold tracking-normal">Log session</h2>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close new workout">
            <X className="size-5" aria-hidden="true" />
          </Button>
        </div>

        <section className="grid gap-3 rounded-md border border-white/10 bg-background/50 p-3 sm:grid-cols-2">
          <TextField
            label="Workout Name"
            value={draft.name ?? ""}
            onChange={(name) => {
              onChange({ ...draft, name, updatedAt: Date.now() });
            }}
            placeholder="Anterior Workout"
          />
          <TextField
            label="Date"
            type="date"
            value={draft.date}
            onChange={(date) => {
              onChange({ ...draft, date, updatedAt: Date.now() });
            }}
          />
          <TextField
            label="Start Time"
            type="time"
            value={draft.startTime}
            onChange={(startTime) => {
              onChange({ ...draft, startTime, updatedAt: Date.now() });
            }}
          />
          <TextField
            label="End Time"
            type="time"
            value={draft.endTime ?? ""}
            onChange={(endTime) => {
              onChange({ ...draft, endTime, updatedAt: Date.now() });
            }}
          />
          <label className="space-y-2 sm:col-span-2">
            <span className="text-sm font-medium text-muted-foreground">Notes</span>
            <textarea
              value={draft.notes ?? ""}
              onChange={(event) => {
                onChange({ ...draft, notes: event.target.value, updatedAt: Date.now() });
              }}
              className="min-h-20 w-full rounded-md border border-white/10 bg-white/[0.05] px-3 py-2 text-sm outline-none focus:border-primary/70"
            />
          </label>
        </section>

        <div className="space-y-4">
          {draft.exercises.map((exercise, exerciseIndex) => (
            <ExerciseEditor
              key={exercise.id}
              exercise={exercise}
              index={exerciseIndex}
              workouts={workouts}
              currentWorkoutId={draft.id}
              onChange={(nextExercise) => {
                updateExercise(exercise.id, nextExercise);
              }}
              onRemove={() => {
                onChange({
                  ...draft,
                  exercises: draft.exercises.filter((item) => item.id !== exercise.id),
                  updatedAt: Date.now()
                });
              }}
            />
          ))}
        </div>

        <div className="flex flex-wrap gap-3">
          <Button
            variant="outline"
            onClick={() => {
              onChange({
                ...draft,
                exercises: [...draft.exercises, createExerciseEntry()],
                updatedAt: Date.now()
              });
            }}
          >
            <Plus className="size-4" aria-hidden="true" />
            Add Exercise
          </Button>
          <Button onClick={onSave}>
            <Save className="size-4" aria-hidden="true" />
            Save Workout
          </Button>
        </div>
      </div>
    </motion.div>
  );
}

function ExerciseEditor({
  exercise,
  index,
  workouts,
  currentWorkoutId,
  onChange,
  onRemove
}: {
  exercise: StrengthExerciseEntry;
  index: number;
  workouts: StrengthWorkout[];
  currentWorkoutId: string;
  onChange: (exercise: StrengthExerciseEntry) => void;
  onRemove: () => void;
}) {
  const previousSession = exercise.name.trim()
    ? getPreviousExerciseSession(workouts, exercise.name, currentWorkoutId)
    : undefined;

  function updateSet(setId: string, nextSet: StrengthSet) {
    onChange({
      ...exercise,
      sets: exercise.sets.map((set) => (set.id === setId ? nextSet : set))
    });
  }

  return (
    <motion.section layout className="rounded-lg border border-white/10 bg-background/50 p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="grid flex-1 gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <TextField
            label={`Exercise ${String(index + 1)}`}
            value={exercise.name}
            onChange={(name) => {
              onChange({ ...exercise, name });
            }}
            placeholder="Bench Press"
          />
          <TextField
            label="Notes"
            value={exercise.notes ?? ""}
            onChange={(notes) => {
              onChange({ ...exercise, notes });
            }}
            placeholder="Pause first rep"
          />
        </div>
        <Button variant="ghost" size="icon" onClick={onRemove} aria-label="Remove exercise">
          <Trash2 className="size-4" aria-hidden="true" />
        </Button>
      </div>

      {previousSession ? <PreviousSessionComparison previousSession={previousSession} /> : null}

      <div className="mt-4 space-y-2">
        <AnimatePresence initial={false}>
          {exercise.sets.map((set, setIndex) => (
            <motion.div
              key={set.id}
              layout
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="grid grid-cols-[44px_minmax(0,1fr)_minmax(0,1fr)_44px] gap-2 sm:grid-cols-[52px_repeat(4,minmax(0,1fr))_44px]"
            >
              <div className="grid h-11 place-items-center rounded-md bg-white/[0.05] text-sm text-muted-foreground">
                {setIndex + 1}
              </div>
              <NumberField
                label="Weight"
                value={set.weight}
                onChange={(weight) => {
                  updateSet(set.id, { ...set, weight });
                }}
              />
              <NumberField
                label="Reps"
                value={set.reps}
                onChange={(reps) => {
                  updateSet(set.id, { ...set, reps });
                }}
              />
              <NumberField
                className="hidden sm:block"
                label="RPE"
                value={set.rpe ?? null}
                onChange={(rpe) => {
                  updateSet(set.id, { ...set, rpe });
                }}
              />
              <NumberField
                className="hidden sm:block"
                label="Rest"
                value={set.restSeconds ?? null}
                onChange={(restSeconds) => {
                  updateSet(set.id, { ...set, restSeconds });
                }}
              />
              <button
                type="button"
                onClick={() => {
                  updateSet(set.id, { ...set, completed: !set.completed });
                }}
                className={cn(
                  "grid h-11 place-items-center rounded-md border transition-colors",
                  set.completed
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-white/10 bg-white/[0.04] text-muted-foreground"
                )}
                aria-label="Toggle set completed"
              >
                <Check className="size-4" aria-hidden="true" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <div className="mt-3 flex gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            onChange({ ...exercise, sets: [...exercise.sets, createEmptySet()] });
          }}
        >
          <Plus className="size-4" aria-hidden="true" />
          Add Set
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            onChange({ ...exercise, sets: exercise.sets.slice(0, -1) });
          }}
          disabled={exercise.sets.length <= 1}
        >
          Remove Set
        </Button>
      </div>
    </motion.section>
  );
}

function PreviousSessionComparison({ previousSession }: { previousSession: ExerciseHistoryEntry }) {
  return (
    <div className="mt-4 rounded-md border border-primary/20 bg-primary/10 p-3">
      <p className="text-xs font-semibold uppercase text-primary">Last session</p>
      <p className="mt-1 text-sm text-muted-foreground">
        {formatWorkoutDate(previousSession.date)} at {previousSession.startTime}
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        {previousSession.sets.map((set, index) => (
          <span key={set.id} className="rounded-md bg-background/70 px-2 py-1 text-sm">
            {index + 1}: {formatSet(set)}
          </span>
        ))}
      </div>
    </div>
  );
}

function TemplateEditor({
  template,
  onChange,
  onClose,
  onSave
}: {
  template: StrengthTemplate;
  onChange: (template: StrengthTemplate) => void;
  onClose: () => void;
  onSave: () => void;
}) {
  return (
    <motion.div
      className="fixed inset-0 z-50 overflow-y-auto bg-background/90 p-4 backdrop-blur-xl"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <div className="mx-auto max-w-xl rounded-lg border border-white/10 bg-card p-5 shadow-xl shadow-black/30">
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-xl font-semibold tracking-normal">Workout Template</h2>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close template editor">
            <X className="size-5" aria-hidden="true" />
          </Button>
        </div>

        <div className="mt-5 space-y-4">
          <TextField
            label="Template Name"
            value={template.name}
            onChange={(name) => {
              onChange({ ...template, name });
            }}
          />
          <div className="space-y-2">
            {template.exerciseNames.map((exerciseName, index) => (
              <div key={`${template.id}-${String(index)}`} className="flex gap-2">
                <TextField
                  label={`Exercise ${String(index + 1)}`}
                  value={exerciseName}
                  onChange={(name) => {
                    onChange({
                      ...template,
                      exerciseNames: template.exerciseNames.map((item, itemIndex) =>
                        itemIndex === index ? name : item
                      )
                    });
                  }}
                />
                <Button
                  className="mt-7"
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    onChange({
                      ...template,
                      exerciseNames: template.exerciseNames.filter(
                        (_, itemIndex) => itemIndex !== index
                      )
                    });
                  }}
                  aria-label="Remove template exercise"
                >
                  <Trash2 className="size-4" aria-hidden="true" />
                </Button>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap gap-3">
            <Button
              variant="outline"
              onClick={() => {
                onChange({ ...template, exerciseNames: [...template.exerciseNames, ""] });
              }}
            >
              <Plus className="size-4" aria-hidden="true" />
              Add Exercise
            </Button>
            <Button onClick={onSave}>
              <Save className="size-4" aria-hidden="true" />
              Save Template
            </Button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

export function ExerciseDetailClient({ exerciseName }: { exerciseName: string }) {
  const [workouts, setWorkouts] = useState<StrengthWorkout[]>([]);
  const [range, setRange] = useState<StrengthRange>("ALL");
  const [metric, setMetric] = useState<ChartMetric>("estimatedOneRepMax");

  useEffect(() => {
    setWorkouts(loadStrengthWorkouts());
  }, []);

  const history = useMemo(
    () => getExerciseHistory(workouts, exerciseName),
    [workouts, exerciseName]
  );
  const records = useMemo(() => getExercisePersonalRecords(history), [history]);
  const progress = useMemo(
    () => filterProgressByRange(getExerciseProgress(history), range),
    [history, range]
  );
  const selectedMetric = CHART_METRICS.find((item) => item.value === metric) ?? {
    value: "estimatedOneRepMax",
    label: "Estimated 1RM",
    color: "#9cee3a"
  };

  return (
    <div className="mx-auto max-w-5xl space-y-5 pb-16">
      <Link href="/strength" className="text-sm font-medium text-primary hover:text-primary/80">
        Back to Strength Tracking
      </Link>
      <header>
        <p className="text-sm font-medium text-primary">Exercise Detail</p>
        <h1 className="text-3xl font-semibold tracking-normal">{exerciseName}</h1>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <RecordCard label="Highest Weight" value={`${records.highestWeight.toFixed(1)} kg`} />
        <RecordCard
          label="Best Estimated 1RM"
          value={`${records.bestEstimatedOneRepMax.toFixed(1)} kg`}
        />
        <RecordCard label="Best Volume" value={`${String(Math.round(records.bestVolume))} kg`} />
        <RecordCard label="Most Reps" value={String(records.mostReps)} />
      </section>

      <section className="rounded-lg border border-white/10 bg-card/90 p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-lg font-semibold tracking-normal">Progress Graphs</h2>
          <div className="flex flex-wrap gap-2">
            {RANGE_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  setRange(option.value);
                }}
                className={cn(
                  "h-9 rounded-md px-3 text-sm font-medium transition-colors",
                  range === option.value
                    ? "bg-primary text-primary-foreground"
                    : "bg-white/[0.05] text-muted-foreground hover:bg-white/10"
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {CHART_METRICS.map((item) => (
            <button
              key={item.value}
              type="button"
              onClick={() => {
                setMetric(item.value);
              }}
              className={cn(
                "rounded-md border px-3 py-2 text-sm font-medium transition-colors",
                metric === item.value
                  ? "border-primary bg-primary/15 text-primary"
                  : "border-white/10 bg-white/[0.04] text-muted-foreground"
              )}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="mt-5 h-72">
          <ResponsiveContainer width="100%" height="100%">
            <RechartsLineChart data={progress} margin={{ left: 0, right: 12, top: 12, bottom: 0 }}>
              <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
              <XAxis
                dataKey="date"
                stroke="rgba(255,255,255,0.45)"
                fontSize={12}
                tickLine={false}
              />
              <YAxis stroke="rgba(255,255,255,0.45)" fontSize={12} tickLine={false} width={44} />
              <Tooltip
                contentStyle={{
                  background: "hsl(var(--card))",
                  border: "1px solid rgba(255,255,255,0.12)",
                  borderRadius: 8
                }}
              />
              <Line
                type="monotone"
                dataKey={selectedMetric.value}
                name={selectedMetric.label}
                stroke={selectedMetric.color}
                strokeWidth={3}
                dot={{ r: 4 }}
              />
            </RechartsLineChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold tracking-normal">History</h2>
        {history.map((entry) => (
          <article
            key={`${entry.workoutId}-${entry.date}`}
            className="rounded-lg border border-white/10 bg-card/90 p-4"
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="font-semibold">{formatWorkoutDate(entry.date, true)}</h3>
                <p className="text-sm text-muted-foreground">{entry.workoutName ?? "Workout"}</p>
              </div>
              <span className="text-sm text-muted-foreground">{entry.startTime}</span>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {entry.sets.map((set, index) => (
                <span key={set.id} className="rounded-md bg-white/[0.06] px-3 py-2 text-sm">
                  Set {index + 1}: {formatSet(set)}
                </span>
              ))}
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}

function RecordCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-card/90 p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-2 text-2xl font-semibold tracking-normal">{value}</p>
    </div>
  );
}

function StatPill({ icon: Icon, label }: { icon: typeof Clock; label: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-white/[0.06] px-2 py-1">
      <Icon className="size-3.5" aria-hidden="true" />
      {label}
    </span>
  );
}

function TextField({
  label,
  value,
  onChange,
  placeholder,
  type = "text"
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <label className="block min-w-0 space-y-2">
      <span className="text-sm font-medium text-muted-foreground">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(event) => {
          onChange(event.target.value);
        }}
        placeholder={placeholder}
        className="h-11 w-full rounded-md border border-white/10 bg-white/[0.05] px-3 text-sm outline-none focus:border-primary/70"
      />
    </label>
  );
}

function NumberField({
  label,
  value,
  onChange,
  className
}: {
  label: string;
  value: number | null;
  onChange: (value: number | null) => void;
  className?: string;
}) {
  return (
    <label className={cn("block min-w-0", className)}>
      <span className="sr-only">{label}</span>
      <input
        type="number"
        inputMode="decimal"
        step="0.5"
        value={value ?? ""}
        onChange={(event) => {
          onChange(event.target.value === "" ? null : Number(event.target.value));
        }}
        placeholder={label}
        className="h-11 w-full rounded-md border border-white/10 bg-white/[0.05] px-2 text-center text-sm outline-none focus:border-primary/70"
      />
    </label>
  );
}
