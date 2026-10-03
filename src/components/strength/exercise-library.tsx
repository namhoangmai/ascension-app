"use client";

import { Pencil, RotateCcw, Save, Search, X } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  formatWorkoutDate,
  parseDecimalInput,
  rankExerciseSuggestions,
  type ExerciseDefault,
  type ExerciseLibraryEntryWithDefaults
} from "@/features/strength/client-store";

export function ExerciseLibrary({
  library,
  onSaveDefaults,
  onResetDefaults
}: {
  library: ExerciseLibraryEntryWithDefaults[];
  onSaveDefaults: (name: string, value: Omit<ExerciseDefault, "updatedAt">) => void;
  onResetDefaults: (name: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [editingName, setEditingName] = useState<string | null>(null);
  const results = query.trim() ? rankExerciseSuggestions(query, library, library.length) : library;

  if (library.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-card/70 p-5 text-sm text-muted-foreground">
        No exercises yet. Finish a workout and every exercise you logged will show up here.
      </div>
    );
  }

  return (
    <section className="space-y-4">
      <label className="relative block">
        <span className="sr-only">Search exercises</span>
        <Search
          className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <input
          type="search"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
          }}
          placeholder="Search exercises"
          className="h-11 w-full rounded-md border border-border bg-muted pl-9 pr-3 text-base outline-none focus:border-foreground sm:text-sm"
        />
      </label>

      {results.length === 0 ? (
        <p className="text-sm text-muted-foreground">No exercises match “{query.trim()}”.</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {results.map((entry) => (
            <article
              key={entry.name}
              className="rounded-2xl border border-border bg-card/90 p-4 shadow-xl shadow-black/5 dark:shadow-black/40"
            >
              <div className="flex items-start justify-between gap-3">
                <h2 className="min-w-0 break-words text-lg font-semibold tracking-normal">
                  {entry.name}
                </h2>
                <div className="flex shrink-0 items-center gap-2">
                  {entry.hasDefaults ? (
                    <span className="rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground">
                      Edited
                    </span>
                  ) : null}
                  <span className="text-xs text-muted-foreground">
                    {entry.sessionCount} {entry.sessionCount === 1 ? "session" : "sessions"}
                  </span>
                  {editingName === entry.name ? null : (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        setEditingName(entry.name);
                      }}
                      aria-label={`Edit ${entry.name} defaults`}
                    >
                      <Pencil className="size-4" aria-hidden="true" />
                    </Button>
                  )}
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                Last: {formatWorkoutDate(entry.lastDate, true)}
              </p>
              {editingName === entry.name ? (
                <ExerciseDefaultsForm
                  entry={entry}
                  onSave={(value) => {
                    onSaveDefaults(entry.name, value);
                    setEditingName(null);
                  }}
                  onReset={() => {
                    onResetDefaults(entry.name);
                    setEditingName(null);
                  }}
                  onCancel={() => {
                    setEditingName(null);
                  }}
                />
              ) : (
                <>
                  {entry.notes ? <p className="mt-2 text-sm">{entry.notes}</p> : null}
                  {entry.sets.length > 0 ? (
                    <div className="mt-3 flex flex-wrap gap-2 text-xs">
                      {entry.sets.map((set, index) => (
                        <span key={index} className="rounded-md bg-muted px-2 py-1">
                          {formatLibrarySet(set)}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </>
              )}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function ExerciseDefaultsForm({
  entry,
  onSave,
  onReset,
  onCancel
}: {
  entry: ExerciseLibraryEntryWithDefaults;
  onSave: (value: Omit<ExerciseDefault, "updatedAt">) => void;
  onReset: () => void;
  onCancel: () => void;
}) {
  const [notes, setNotes] = useState(entry.notes);
  const [weights, setWeights] = useState(() =>
    entry.sets.map((set) => (set.weight === null ? "" : String(set.weight)))
  );

  return (
    // Native validation (`pattern`) blocks anything parseDecimalInput would reject, so only empty → null.
    <form
      className="mt-3 space-y-3"
      onSubmit={(event) => {
        event.preventDefault();
        onSave({
          notes: notes.trim(),
          weights: weights.map((weight) => parseDecimalInput(weight))
        });
      }}
    >
      <label className="block space-y-2">
        <span className="text-sm font-medium text-muted-foreground">Note</span>
        <textarea
          autoFocus
          value={notes}
          onChange={(event) => {
            setNotes(event.target.value);
          }}
          maxLength={2000}
          className="min-h-20 w-full rounded-md border border-border bg-muted px-3 py-2 text-base outline-none focus:border-foreground sm:text-sm"
        />
      </label>
      {weights.length > 0 ? (
        <div className="grid grid-cols-3 gap-2">
          {weights.map((weight, index) => (
            <label key={index} className="block min-w-0 space-y-1">
              <span className="text-xs text-muted-foreground">Set {index + 1} (kg)</span>
              <input
                type="text"
                inputMode="decimal"
                autoComplete="off"
                // Same grammar as parseDecimalInput: non-negative, "." or "," decimal separator.
                pattern="\s*(\d+[.,]?\d*|[.,]\d+)\s*"
                title="Weight in kg, e.g. 61.25"
                value={weight}
                onChange={(event) => {
                  const next = event.target.value;
                  setWeights((current) => current.map((item, i) => (i === index ? next : item)));
                }}
                placeholder="–"
                className="h-11 w-full rounded-md border border-border bg-muted px-2 text-center text-base outline-none placeholder:text-muted-foreground/60 focus:border-foreground sm:text-sm"
              />
            </label>
          ))}
        </div>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" size="sm">
          <Save className="size-4" aria-hidden="true" />
          Save
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={onCancel}>
          <X className="size-4" aria-hidden="true" />
          Cancel
        </Button>
        {entry.hasDefaults ? (
          <Button type="button" variant="ghost" size="sm" onClick={onReset}>
            <RotateCcw className="size-4" aria-hidden="true" />
            Reset to last session
          </Button>
        ) : null}
      </div>
    </form>
  );
}

function formatLibrarySet(set: ExerciseLibraryEntryWithDefaults["sets"][number]) {
  const weight = set.weight === null ? "–" : `${String(set.weight)}kg`;
  const reps = set.reps === null ? "–" : String(set.reps);
  const rir = set.rir === null ? "" : ` @${String(set.rir)}`;

  return `${weight}×${reps}${rir}`;
}
