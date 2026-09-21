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
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";
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
  clearStrengthDraft,
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
  getLocalTimeKey,
  getPreviousExerciseSession,
  getWorkoutDuration,
  getWorkoutTotals,
  isInProgressWorkout,
  loadStrengthDraft,
  loadStrengthTemplates,
  loadStrengthWorkouts,
  saveStrengthTemplates,
  slugifyExerciseName
} from "@/features/strength/client-store";
import {
  cancelInProgressStrengthWorkoutAction,
  deleteStrengthWorkoutAction,
  saveStrengthWorkoutAction
} from "@/features/strength/actions";
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

const CHART_METRICS: { value: ChartMetric; label: string; color: string; dash?: string }[] = [
  { value: "estimatedOneRepMax", label: "Estimated 1RM", color: "hsl(var(--foreground))" },
  { value: "highestWeight", label: "Highest Weight", color: "hsl(var(--foreground))", dash: "8 4" },
  { value: "trainingVolume", label: "Training Volume", color: "hsl(var(--muted-foreground))" },
  {
    value: "averageReps",
    label: "Average Reps",
    color: "hsl(var(--muted-foreground))",
    dash: "2 4"
  }
];

export function StrengthTrackingClient({
  initialWorkouts
}: {
  initialWorkouts: StrengthWorkout[];
}) {
  const [activeTab, setActiveTab] = useState<TabKey>("history");
  const [workouts, setWorkouts] = useState<StrengthWorkout[]>(initialWorkouts);
  const [templates, setTemplates] = useState<StrengthTemplate[]>([]);
  const [draft, setDraft] = useState<StrengthWorkout | null>(null);
  const [recoverableDraft, setRecoverableDraft] = useState<StrengthWorkout | null>(null);
  const [selectedWorkoutId, setSelectedWorkoutId] = useState<string | null>(null);
  const [templateDraft, setTemplateDraft] = useState<StrengthTemplate | null>(null);
  const [strengthError, setStrengthError] = useState("");
  const [isSavingWorkout, setIsSavingWorkout] = useState(false);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");
  const [editorError, setEditorError] = useState("");
  const [conflictWorkoutId, setConflictWorkoutId] = useState<string | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);
  const [deletingWorkoutId, setDeletingWorkoutId] = useState<string | null>(null);
  const savingRef = useRef(false);

  useEffect(() => {
    setTemplates(loadStrengthTemplates());

    const localDraft = loadStrengthDraft();
    if (!localDraft) {
      return;
    }

    const savedCopy = initialWorkouts.find((workout) => workout.id === localDraft.id);

    if (!savedCopy) {
      setRecoverableDraft(localDraft);
    } else if (isInProgressWorkout(savedCopy) && localDraft.updatedAt > savedCopy.updatedAt) {
      // Local edits are newer than the saved copy: keep them for Resume.
      setRecoverableDraft(localDraft);
    } else {
      clearStrengthDraft();
    }
    // Reconcile once on mount against the server-provided workouts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setWorkouts(initialWorkouts);
  }, [initialWorkouts]);

  useEffect(() => {
    if (draft) {
      localStorage.setItem(STRENGTH_DRAFT_STORAGE_KEY, JSON.stringify(draft));
    }
  }, [draft]);

  useEffect(() => {
    if (saveState !== "saved") {
      return;
    }

    const timeout = window.setTimeout(() => {
      setSaveState("idle");
    }, 2000);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [saveState]);

  const completedWorkouts = useMemo(
    () => workouts.filter((workout) => !isInProgressWorkout(workout)),
    [workouts]
  );
  const inProgressWorkout = workouts.find(isInProgressWorkout);

  const sortedWorkouts = useMemo(
    () =>
      completedWorkouts
        .slice()
        .sort((a, b) => `${b.date}T${b.startTime}`.localeCompare(`${a.date}T${a.startTime}`)),
    [completedWorkouts]
  );

  const selectedWorkout = workouts.find((workout) => workout.id === selectedWorkoutId);

  function persistTemplates(nextTemplates: StrengthTemplate[]) {
    setTemplates(nextTemplates);
    saveStrengthTemplates(nextTemplates);
  }

  function buildPayload(intent: "continue" | "end"): StrengthWorkout | null {
    if (!draft) {
      return null;
    }

    const localTime = getLocalTimeKey();

    return {
      ...draft,
      startTime: draft.startTime || localTime,
      endTime: (draft.endTime ?? "") === "" && intent === "end" ? localTime : (draft.endTime ?? ""),
      exercises: draft.exercises
        .filter((exercise) => exercise.name.trim())
        .map((exercise) => ({
          ...exercise,
          name: exercise.name.trim(),
          sets: exercise.sets.length > 0 ? exercise.sets : [createEmptySet()]
        })),
      updatedAt: Date.now()
    };
  }

  function mergeWorkout(saved: StrengthWorkout) {
    setWorkouts((current) => [saved, ...current.filter((workout) => workout.id !== saved.id)]);
  }

  function resumeWorkout(workoutId: string) {
    const savedCopy = workouts.find((workout) => workout.id === workoutId);
    const localCopy = recoverableDraft?.id === workoutId ? recoverableDraft : null;
    const target =
      savedCopy && localCopy
        ? localCopy.updatedAt > savedCopy.updatedAt
          ? localCopy
          : savedCopy
        : (savedCopy ?? localCopy);

    if (!target) {
      return;
    }

    setEditorError("");
    setConflictWorkoutId(null);
    setSaveState("idle");
    setRecoverableDraft(null);
    setSelectedWorkoutId(null);
    setDraft(target);
  }

  async function submitDraft(intent: "continue" | "end") {
    if (savingRef.current) {
      return;
    }

    const payload = buildPayload(intent);

    if (!payload) {
      return;
    }

    savingRef.current = true;
    setIsSavingWorkout(true);
    setSaveState(intent === "continue" ? "saving" : "idle");
    setEditorError("");
    setConflictWorkoutId(null);
    setStrengthError("");

    let result: Awaited<ReturnType<typeof saveStrengthWorkoutAction>>;
    try {
      result = await saveStrengthWorkoutAction(payload, intent);
    } catch {
      result = { status: "error", message: "Workout could not be saved." };
    }

    savingRef.current = false;
    setIsSavingWorkout(false);

    if (result.status === "error" || !result.workout) {
      setSaveState("idle");
      setEditorError(result.message ?? "Workout could not be saved.");
      setConflictWorkoutId(result.inProgressWorkoutId ?? null);
      return;
    }

    const saved = result.workout;
    mergeWorkout(saved);

    if (intent === "continue") {
      setDraft((current) =>
        current?.id === saved.id ? { ...current, status: saved.status ?? "in_progress" } : current
      );
      setSaveState("saved");
      return;
    }

    clearStrengthDraft();
    setDraft(null);
    setRecoverableDraft(null);
    setSaveState("idle");
    setSelectedWorkoutId(saved.id);
  }

  async function cancelDraft() {
    if (!draft || savingRef.current) {
      return;
    }

    const savedCopy = workouts.find((workout) => workout.id === draft.id);

    if (savedCopy && isInProgressWorkout(savedCopy)) {
      setIsCancelling(true);
      setEditorError("");
      const result = await cancelInProgressStrengthWorkoutAction(draft.id);
      setIsCancelling(false);

      if (result.status === "error") {
        setEditorError(result.message ?? "Workout could not be cancelled.");
        return;
      }

      setWorkouts((current) => current.filter((workout) => workout.id !== draft.id));
    }

    clearStrengthDraft();
    setDraft(null);
    setRecoverableDraft(null);
    setEditorError("");
    setConflictWorkoutId(null);
    setSaveState("idle");
  }

  async function deleteWorkout(workoutId: string) {
    if (deletingWorkoutId) {
      return;
    }

    const shouldDelete = window.confirm("Delete this workout session? This cannot be undone.");

    if (!shouldDelete) {
      return;
    }

    setDeletingWorkoutId(workoutId);
    setStrengthError("");

    const result = await deleteStrengthWorkoutAction(workoutId);
    setDeletingWorkoutId(null);

    if (result.status === "error") {
      setStrengthError(result.message ?? "Workout could not be deleted.");
      return;
    }

    setWorkouts((current) => current.filter((workout) => workout.id !== workoutId));
    setSelectedWorkoutId(null);
  }

  function beginNewDraft(template?: StrengthTemplate) {
    setEditorError("");
    setConflictWorkoutId(null);
    setSaveState("idle");
    setRecoverableDraft(null);
    setDraft(createWorkoutDraft(template));
  }

  function startTemplate(template: StrengthTemplate) {
    setActiveTab("history");
    beginNewDraft(template);
  }

  function closeDraftEditor() {
    setRecoverableDraft(draft);
    setDraft(null);
    setEditorError("");
    setConflictWorkoutId(null);
  }

  function discardRecoverableDraft() {
    clearStrengthDraft();
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
    <MotionConfig reducedMotion="user">
      <div className="animate-fade-in mx-auto max-w-5xl space-y-6 pb-24">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">Training</p>
            <h1 className="text-title font-semibold tracking-tight">Strength Tracking</h1>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">Log sessions</p>
          </div>
          <div className="flex rounded-full border border-border bg-muted p-1">
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
          <>
            {strengthError ? (
              <div className="rounded-md border border-foreground/30 bg-muted p-3 text-sm text-destructive">
                {strengthError}
              </div>
            ) : null}
            <WorkoutHistory
              workouts={sortedWorkouts}
              inProgressWorkout={inProgressWorkout}
              onResumeWorkout={resumeWorkout}
              selectedWorkout={selectedWorkout}
              deletingWorkoutId={deletingWorkoutId}
              onOpenWorkout={setSelectedWorkoutId}
              onCloseWorkout={() => {
                setSelectedWorkoutId(null);
              }}
              onDeleteWorkout={deleteWorkout}
            />
          </>
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

        {recoverableDraft &&
        !draft &&
        !workouts.some((workout) => workout.id === recoverableDraft.id) ? (
          <section className="flex flex-col gap-3 rounded-2xl border border-foreground/20 bg-muted p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="font-semibold tracking-normal">In-progress workout saved</h2>
              <p className="text-sm text-muted-foreground">
                {recoverableDraft.name ?? "Workout Session"} from{" "}
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
            beginNewDraft();
          }}
        >
          <Plus className="size-8" aria-hidden="true" />
        </Button>

        <AnimatePresence>
          {draft ? (
            <WorkoutEditor
              key={draft.id}
              draft={draft}
              workouts={completedWorkouts}
              onChange={setDraft}
              onClose={() => {
                closeDraftEditor();
              }}
              onContinue={() => submitDraft("continue")}
              onEnd={() => submitDraft("end")}
              onCancel={cancelDraft}
              isSaving={isSavingWorkout}
              isCancelling={isCancelling}
              saveState={saveState}
              error={editorError}
              conflictWorkoutId={conflictWorkoutId}
              onResumeConflict={resumeWorkout}
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
    </MotionConfig>
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
        active
          ? "rounded-full bg-primary text-primary-foreground"
          : "text-muted-foreground hover:bg-accent"
      )}
    >
      {children}
    </button>
  );
}

function WorkoutHistory({
  workouts,
  inProgressWorkout,
  onResumeWorkout,
  selectedWorkout,
  deletingWorkoutId,
  onOpenWorkout,
  onCloseWorkout,
  onDeleteWorkout
}: {
  workouts: StrengthWorkout[];
  inProgressWorkout: StrengthWorkout | undefined;
  onResumeWorkout: (workoutId: string) => void;
  selectedWorkout: StrengthWorkout | undefined;
  deletingWorkoutId: string | null;
  onOpenWorkout: (workoutId: string) => void;
  onCloseWorkout: () => void;
  onDeleteWorkout: (workoutId: string) => void | Promise<void>;
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
      <section className="space-y-3">
        {inProgressWorkout ? (
          <div className="flex flex-col gap-3 rounded-2xl border border-foreground/20 bg-muted p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <span className="rounded-full border border-foreground px-2.5 py-1 text-xs font-semibold text-foreground">
                In progress
              </span>
              <h2 className="mt-2 text-xl font-semibold tracking-normal">
                {inProgressWorkout.name?.trim() ? inProgressWorkout.name : "Workout Session"}
              </h2>
              <p className="text-sm text-muted-foreground">
                {formatWorkoutDate(inProgressWorkout.date)} at {inProgressWorkout.startTime}
              </p>
            </div>
            <Button
              onClick={() => {
                onResumeWorkout(inProgressWorkout.id);
              }}
            >
              Resume
            </Button>
          </div>
        ) : null}
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
            isDeleting={deletingWorkoutId === selectedWorkout.id}
            onClose={onCloseWorkout}
            onDelete={onDeleteWorkout}
          />
        ) : (
          <div className="rounded-2xl border border-dashed border-border bg-card/70 p-5 text-sm text-muted-foreground">
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
              isDeleting={deletingWorkoutId === selectedWorkout.id}
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
      className="w-full rounded-2xl border border-border bg-card/90 p-4 text-left shadow-xl shadow-black/5 transition-colors hover:border-foreground/40 hover:bg-card dark:shadow-black/40"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">{formatWorkoutDate(workout.date)}</p>
          <h2 className="mt-1 text-xl font-semibold tracking-normal">
            {workout.name ?? "Workout Session"}
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

      {workout.notes ? (
        <p className="mt-4 border-t border-border pt-3 text-sm text-muted-foreground">
          {workout.notes}
        </p>
      ) : null}
    </button>
  );
}

function WorkoutDetail({
  workout,
  isDeleting,
  onClose,
  onDelete
}: {
  workout: StrengthWorkout;
  isDeleting: boolean;
  onClose: () => void;
  onDelete: (workoutId: string) => void | Promise<void>;
}) {
  const totals = getWorkoutTotals(workout);

  return (
    <div className="max-h-full overflow-y-auto rounded-2xl border border-border bg-card p-4 shadow-xl shadow-black/5 dark:shadow-black/40">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">{formatWorkoutDate(workout.date, true)}</p>
          <h2 className="text-xl font-semibold tracking-normal">
            {workout.name ?? "Workout Session"}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {workout.startTime} - {totals.exerciseCount} exercises - {totals.setCount} sets
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            size="icon"
            variant="ghost"
            disabled={isDeleting}
            onClick={() => {
              void onDelete(workout.id);
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
            className="rounded-md border border-border bg-background/50 p-3"
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
                    {set.rir ? ` - rir ${String(set.rir)}` : ""}
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

      {templates.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card/70 p-5 text-sm text-muted-foreground">
          No workout templates yet. Create one when you are ready.
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {templates.map((template) => (
            <article key={template.id} className="rounded-2xl border border-border bg-card/90 p-4">
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
      )}
    </section>
  );
}

function WorkoutEditor({
  draft,
  workouts,
  onChange,
  onClose,
  onContinue,
  onEnd,
  onCancel,
  isSaving,
  isCancelling,
  saveState,
  error,
  conflictWorkoutId,
  onResumeConflict
}: {
  draft: StrengthWorkout;
  workouts: StrengthWorkout[];
  onChange: (draft: StrengthWorkout) => void;
  onClose: () => void;
  onContinue: () => void | Promise<void>;
  onEnd: () => void | Promise<void>;
  onCancel: () => void | Promise<void>;
  isSaving: boolean;
  isCancelling: boolean;
  saveState: "idle" | "saving" | "saved";
  error: string;
  conflictWorkoutId: string | null;
  onResumeConflict: (workoutId: string) => void;
}) {
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  const busy = isSaving || isCancelling;

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
      <div className="mx-auto max-w-3xl space-y-5 rounded-2xl border border-border bg-card p-4 shadow-xl shadow-black/5 dark:shadow-black/40 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm text-primary">New Workout</p>
            <h2 className="text-2xl font-semibold tracking-normal">Log session</h2>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close new workout">
            <X className="size-5" aria-hidden="true" />
          </Button>
        </div>

        <section className="grid gap-3 rounded-md border border-border bg-background/50 p-3 sm:grid-cols-2">
          <TextField
            label="Workout Name"
            value={draft.name ?? ""}
            onChange={(name) => {
              onChange({ ...draft, name, updatedAt: Date.now() });
            }}
            placeholder="Workout Session"
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
              className="min-h-20 w-full rounded-md border border-border bg-muted px-3 py-2 text-sm outline-none focus:border-foreground"
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
          <Button
            variant="outline"
            onClick={() => {
              void onContinue();
            }}
            disabled={busy}
          >
            <Save className="size-4" aria-hidden="true" />
            {saveState === "saving"
              ? "Saving..."
              : saveState === "saved"
                ? "Saved"
                : "Continue Workout"}
          </Button>
          <Button
            onClick={() => {
              void onEnd();
            }}
            disabled={busy}
          >
            <Check className="size-4" aria-hidden="true" />
            End Workout
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              setConfirmingCancel(true);
            }}
            disabled={busy}
          >
            <X className="size-4" aria-hidden="true" />
            Cancel Workout
          </Button>
        </div>

        {error ? (
          <div className="flex flex-col gap-2 rounded-md border border-foreground/30 bg-muted p-3 text-sm text-destructive sm:flex-row sm:items-center sm:justify-between">
            <span>{error}</span>
            {conflictWorkoutId ? (
              <Button
                size="sm"
                onClick={() => {
                  onResumeConflict(conflictWorkoutId);
                }}
              >
                Resume
              </Button>
            ) : null}
          </div>
        ) : null}

        {confirmingCancel ? (
          <div
            role="alertdialog"
            aria-label="Confirm cancel workout"
            className="space-y-3 rounded-md border border-foreground/30 bg-muted p-3"
          >
            <p className="text-sm">Cancel this workout? Your entries will be discarded.</p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setConfirmingCancel(false);
                }}
                disabled={isCancelling}
              >
                Keep Workout
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  void onCancel();
                }}
                disabled={isCancelling}
              >
                {isCancelling ? "Cancelling..." : "Yes, Cancel"}
              </Button>
            </div>
          </div>
        ) : null}
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
    <motion.section layout className="rounded-2xl border border-border bg-background/50 p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="grid flex-1 gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <TextField
            label={`Exercise ${String(index + 1)}`}
            value={exercise.name}
            onChange={(name) => {
              onChange({ ...exercise, name });
            }}
            placeholder="Exercise"
          />
          <TextField
            label="Notes"
            value={exercise.notes ?? ""}
            onChange={(notes) => {
              onChange({ ...exercise, notes });
            }}
            placeholder="Notes"
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
              <div className="grid h-11 place-items-center rounded-md bg-muted text-sm text-muted-foreground">
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
                label="RIR"
                value={set.rir ?? null}
                onChange={(rir) => {
                  updateSet(set.id, { ...set, rir });
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
                    : "border-border bg-muted text-muted-foreground"
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
    <div className="mt-4 rounded-md border border-border bg-muted p-3">
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
      <div className="mx-auto max-w-xl rounded-2xl border border-border bg-card p-5 shadow-xl shadow-black/5 dark:shadow-black/40">
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
    setWorkouts(loadStrengthWorkouts().filter((workout) => !isInProgressWorkout(workout)));
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
    color: "hsl(var(--foreground))"
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

      <section className="rounded-2xl border border-border bg-card/90 p-4">
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
                    : "bg-muted text-muted-foreground hover:bg-accent"
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
                "press rounded-full border px-4 py-2 text-sm font-medium transition-colors",
                metric === item.value
                  ? "border-foreground bg-foreground text-background"
                  : "border-border bg-muted text-muted-foreground"
              )}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="mt-5 h-72">
          <ResponsiveContainer width="100%" height="100%">
            <RechartsLineChart data={progress} margin={{ left: 0, right: 12, top: 12, bottom: 0 }}>
              <CartesianGrid stroke="hsl(var(--border))" vertical={false} />
              <XAxis
                dataKey="date"
                stroke="hsl(var(--muted-foreground))"
                fontSize={12}
                tickLine={false}
              />
              <YAxis
                stroke="hsl(var(--muted-foreground))"
                fontSize={12}
                tickLine={false}
                width={44}
              />
              <Tooltip
                contentStyle={{
                  background: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: 12
                }}
              />
              <Line
                type="monotone"
                dataKey={selectedMetric.value}
                name={selectedMetric.label}
                stroke={selectedMetric.color}
                strokeWidth={3}
                strokeDasharray={selectedMetric.dash}
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
            className="rounded-2xl border border-border bg-card/90 p-4"
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="font-semibold">{formatWorkoutDate(entry.date, true)}</h3>
                <p className="text-sm text-muted-foreground">
                  {entry.workoutName ?? "Workout Session"}
                </p>
              </div>
              <span className="text-sm text-muted-foreground">{entry.startTime}</span>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {entry.sets.map((set, index) => (
                <span key={set.id} className="rounded-md bg-muted px-3 py-2 text-sm">
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
    <div className="rounded-2xl border border-border bg-card/90 p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-2 text-2xl font-semibold tracking-normal">{value}</p>
    </div>
  );
}

function StatPill({ icon: Icon, label }: { icon: typeof Clock; label: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-1">
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
        className="h-11 w-full rounded-md border border-border bg-muted px-3 text-sm outline-none focus:border-foreground"
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
        className="h-11 w-full rounded-md border border-border bg-muted px-2 text-center text-sm outline-none focus:border-foreground"
      />
    </label>
  );
}
