import Link from "next/link";
import { ArrowUpRight, Dumbbell } from "lucide-react";

export interface WorkoutSummary {
  name: string;
  relativeDate: string;
  exerciseCount: number;
  completedSets: number;
  totalVolume: number;
  topExercise: string | null;
}

interface LastWorkoutPanelProps {
  summary: WorkoutSummary | null;
}

export function LastWorkoutPanel({ summary }: LastWorkoutPanelProps) {
  return (
    <section className="flex h-full flex-col rounded-2xl border border-border bg-card/80 p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="grid size-9 place-items-center rounded-lg bg-muted text-primary">
            <Dumbbell className="size-4" aria-hidden="true" />
          </span>
          <h2 className="text-sm font-semibold text-card-foreground">Last session</h2>
        </div>
        <Link
          href="/strength"
          className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
        >
          Strength log
          <ArrowUpRight className="size-3" aria-hidden="true" />
        </Link>
      </div>

      {summary ? (
        <div className="mt-4 flex flex-1 flex-col">
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-lg font-semibold text-card-foreground">{summary.name}</p>
            <span className="shrink-0 text-xs font-medium text-muted-foreground">
              {summary.relativeDate}
            </span>
          </div>
          {summary.topExercise ? (
            <p className="mt-1 text-sm text-muted-foreground">Started with {summary.topExercise}</p>
          ) : null}
          <div className="mt-4 grid grid-cols-3 gap-3 border-t border-border pt-4 text-center">
            <div>
              <p className="text-base font-semibold text-card-foreground">
                {summary.exerciseCount}
              </p>
              <p className="text-[11px] text-muted-foreground">exercises</p>
            </div>
            <div>
              <p className="text-base font-semibold text-card-foreground">
                {summary.completedSets}
              </p>
              <p className="text-[11px] text-muted-foreground">sets done</p>
            </div>
            <div>
              <p className="text-base font-semibold text-card-foreground">{summary.totalVolume}</p>
              <p className="text-[11px] text-muted-foreground">kg volume</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="mt-4 flex flex-1 flex-col justify-center">
          <p className="text-sm text-muted-foreground">
            No sessions logged yet. Start your first workout to see it here.
          </p>
          <Link
            href="/strength"
            className="mt-3 inline-flex w-fit items-center gap-1 text-sm font-medium text-primary hover:underline"
          >
            Log your first workout
            <ArrowUpRight className="size-3.5" aria-hidden="true" />
          </Link>
        </div>
      )}
    </section>
  );
}
