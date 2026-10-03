"use client";

import { Search } from "lucide-react";
import { useState } from "react";

import { formatWorkoutDate, rankExerciseSuggestions } from "@/features/strength/client-store";
import type { ExerciseLibraryEntry } from "@/types/strength";

export function ExerciseLibrary({ library }: { library: ExerciseLibraryEntry[] }) {
  const [query, setQuery] = useState("");
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
                <span className="shrink-0 text-xs text-muted-foreground">
                  {entry.sessionCount} {entry.sessionCount === 1 ? "session" : "sessions"}
                </span>
              </div>
              <p className="text-sm text-muted-foreground">
                Last: {formatWorkoutDate(entry.lastDate, true)}
              </p>
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
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function formatLibrarySet(set: ExerciseLibraryEntry["sets"][number]) {
  const weight = set.weight === null ? "–" : `${String(set.weight)}kg`;
  const reps = set.reps === null ? "–" : String(set.reps);
  const rir = set.rir === null ? "" : ` @${String(set.rir)}`;

  return `${weight}×${reps}${rir}`;
}
