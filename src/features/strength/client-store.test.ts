import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type {
  ExerciseLibraryEntry,
  StrengthExerciseEntry,
  StrengthSet,
  StrengthWorkout
} from "@/types/strength";

import {
  applyExerciseDefaults,
  buildExerciseLibrary,
  type ExerciseDefault,
  fillSetFromPrevious,
  getPreviousExerciseSession,
  isExerciseDefault,
  isStrengthWorkout,
  loadExerciseDefaults,
  normalizeExerciseName,
  parseDecimalInput,
  rankExerciseSuggestions,
  saveExerciseDefaults,
  STRENGTH_EXERCISE_DEFAULTS_STORAGE_KEY
} from "./client-store";

function makeSet(overrides: Partial<StrengthSet> = {}): StrengthSet {
  return {
    id: "set",
    weight: null,
    reps: null,
    rir: null,
    completed: false,
    ...overrides
  };
}

function makeExercise(
  name: string,
  overrides: Partial<StrengthExerciseEntry> = {}
): StrengthExerciseEntry {
  return { id: `exercise-${name}`, name, notes: "", sets: [makeSet()], ...overrides };
}

function makeWorkout(
  id: string,
  date: string,
  exercises: StrengthExerciseEntry[],
  overrides: Partial<StrengthWorkout> = {}
): StrengthWorkout {
  return {
    id,
    date,
    startTime: "10:00",
    exercises,
    createdAt: 0,
    updatedAt: 0,
    ...overrides
  };
}

function makeEntry(name: string): ExerciseLibraryEntry {
  return {
    name,
    lastWorkoutId: "w",
    lastDate: "2026-01-01",
    lastStartTime: "10:00",
    notes: "",
    sets: [],
    sessionCount: 1
  };
}

const names = (entries: ExerciseLibraryEntry[]) => entries.map((entry) => entry.name);

describe("parseDecimalInput", () => {
  it.each([
    ["12", 12],
    ["12.5", 12.5],
    ["12,5", 12.5],
    ["12.", 12],
    [",5", 0.5],
    [".5", 0.5],
    [" 12,5 ", 12.5],
    ["0", 0],
    ["2.125", 2.125]
  ])("parses %j as %d", (raw, expected) => {
    expect(parseDecimalInput(raw)).toBe(expected);
  });

  it.each(["", "   ", ".", ",", "-5", "1.2.3", "1,2,3", "1,2.3", "abc", "12kg", "1e5", "e5"])(
    "returns null for %j",
    (raw) => {
      expect(parseDecimalInput(raw)).toBeNull();
    }
  );
});

describe("buildExerciseLibrary", () => {
  it("returns [] for no workouts", () => {
    expect(buildExerciseLibrary([])).toEqual([]);
  });

  it("merges names case-insensitively and takes display data from the most recent workout", () => {
    const older = makeWorkout("w1", "2026-07-01", [
      makeExercise("bench press", {
        notes: "old",
        sets: [makeSet({ weight: 60, reps: 10 })]
      })
    ]);
    const sameDayEarlier = makeWorkout(
      "w2",
      "2026-07-08",
      [makeExercise("BENCH PRESS", { notes: "morning" })],
      { startTime: "08:00" }
    );
    const latest = makeWorkout(
      "w3",
      "2026-07-08",
      [
        makeExercise(" Bench Press ", {
          notes: "latest",
          sets: [makeSet({ weight: 80, reps: 5, rir: 2, completed: true })]
        })
      ],
      { startTime: "18:00" }
    );

    // Input deliberately out of order.
    const library = buildExerciseLibrary([latest, older, sameDayEarlier]);

    expect(library).toEqual([
      {
        name: "Bench Press",
        lastWorkoutId: "w3",
        lastDate: "2026-07-08",
        lastStartTime: "18:00",
        notes: "latest",
        sets: [{ weight: 80, reps: 5, rir: 2 }],
        sessionCount: 3
      }
    ]);
  });

  it("excludes in-progress workouts", () => {
    const done = makeWorkout("w1", "2026-07-01", [makeExercise("Squat", { notes: "done" })], {
      status: "completed"
    });
    const draft = makeWorkout(
      "w2",
      "2026-07-09",
      [makeExercise("Squat", { notes: "draft" }), makeExercise("Deadlift")],
      { status: "in_progress" }
    );

    const library = buildExerciseLibrary([done, draft]);

    expect(names(library)).toEqual(["Squat"]);
    expect(library[0]).toMatchObject({ lastWorkoutId: "w1", notes: "done", sessionCount: 1 });
  });

  it("ignores blank exercise names", () => {
    const workout = makeWorkout("w1", "2026-07-01", [
      makeExercise(""),
      makeExercise("   "),
      makeExercise("Row")
    ]);

    expect(names(buildExerciseLibrary([workout]))).toEqual(["Row"]);
  });

  it("counts an exercise repeated within one workout as one session", () => {
    const w1 = makeWorkout("w1", "2026-07-01", [makeExercise("Curl"), makeExercise("curl")]);
    const w2 = makeWorkout("w2", "2026-07-02", [makeExercise("Curl")]);

    expect(buildExerciseLibrary([w1, w2])[0]?.sessionCount).toBe(2);
  });

  it("sorts entries alphabetically", () => {
    const workout = makeWorkout("w1", "2026-07-01", [
      makeExercise("Squat"),
      makeExercise("Bench Press"),
      makeExercise("Deadlift")
    ]);

    expect(names(buildExerciseLibrary([workout]))).toEqual(["Bench Press", "Deadlift", "Squat"]);
  });

  it("does not mutate the input array order", () => {
    const later = makeWorkout("w2", "2026-07-02", [makeExercise("A")]);
    const earlier = makeWorkout("w1", "2026-07-01", [makeExercise("A")]);
    const input = [later, earlier];

    buildExerciseLibrary(input);

    expect(input).toEqual([later, earlier]);
  });
});

describe("rankExerciseSuggestions", () => {
  const library = [makeEntry("Back Squat"), makeEntry("Bench Press"), makeEntry("Barbell Row")];

  it.each(["", "   "])("returns [] for empty query %j", (query) => {
    expect(rankExerciseSuggestions(query, library)).toEqual([]);
  });

  it.each([
    ["ben", ["Bench Press"]],
    ["BEN", ["Bench Press"]],
    ["sqat", ["Back Squat"]],
    ["bensh", ["Bench Press"]],
    ["xyz", []],
    ["ba", ["Back Squat", "Barbell Row"]],
    ["bak", ["Back Squat", "Barbell Row"]]
  ])("%j -> %j", (query, expected) => {
    expect(names(rankExerciseSuggestions(query, library))).toEqual(expected);
  });

  it("does not apply typo tolerance to queries shorter than 3 chars", () => {
    expect(rankExerciseSuggestions("bx", library)).toEqual([]);
  });

  it("allows only 1 edit for 3-4 char queries and 2 for 5+", () => {
    const lib = [makeEntry("Squat")];

    expect(names(rankExerciseSuggestions("sqxx", lib))).toEqual([]); // 2 edits, 4 chars
    expect(names(rankExerciseSuggestions("sqxxt", lib))).toEqual(["Squat"]); // 2 edits, 5 chars
    expect(names(rankExerciseSuggestions("sxxxt", lib))).toEqual([]); // 3 edits
  });

  it("orders exact > startsWith > word startsWith > contains > typo, regardless of alphabet", () => {
    const lib = [
      makeEntry("Bench Press"), // word startsWith
      makeEntry("Legpress"), // contains
      makeEntry("Prass"), // typo (1 edit)
      makeEntry("Press Around"), // startsWith
      makeEntry("Press") // exact
    ];

    expect(names(rankExerciseSuggestions("press", lib, 10))).toEqual([
      "Press",
      "Press Around",
      "Bench Press",
      "Legpress",
      "Prass"
    ]);
    expect(names(rankExerciseSuggestions("press", lib, 1))).toEqual(["Press"]);
  });

  it("ranks an exact match above an alphabetically-earlier word-startsWith match", () => {
    const lib = [makeEntry("Bench Row"), makeEntry("Row")];

    expect(names(rankExerciseSuggestions("row", lib))).toEqual(["Row", "Bench Row"]);
  });

  it("caps results at 3 by default and respects a custom limit", () => {
    const lib = ["Row A", "Row B", "Row C", "Row D"].map(makeEntry);

    expect(names(rankExerciseSuggestions("row", lib))).toEqual(["Row A", "Row B", "Row C"]);
    expect(names(rankExerciseSuggestions("row", lib, 2))).toEqual(["Row A", "Row B"]);
  });
});

describe("fillSetFromPrevious", () => {
  const previous = makeSet({ weight: 80, reps: 8, rir: 2, completed: true });

  it("returns the same object when there is no previous set", () => {
    const set = makeSet();

    expect(fillSetFromPrevious(set, undefined)).toBe(set);
  });

  it("fills null weight/reps/rir from the previous set without touching completed", () => {
    const result = fillSetFromPrevious(makeSet({ id: "new", completed: false }), previous);

    expect(result).toEqual(makeSet({ id: "new", weight: 80, reps: 8, rir: 2, completed: false }));
  });

  it("fills rir when it is undefined", () => {
    const set: StrengthSet = { id: "new", weight: null, reps: null, completed: false };

    expect(fillSetFromPrevious(set, previous).rir).toBe(2);
  });

  it("keeps existing values, including 0 (0 is not treated as empty)", () => {
    const set = makeSet({ weight: 0, reps: 0, rir: 0 });

    expect(fillSetFromPrevious(set, previous)).toMatchObject({ weight: 0, reps: 0, rir: 0 });
  });

  it("only fills the fields that are empty", () => {
    const set = makeSet({ weight: 100, completed: true });

    expect(fillSetFromPrevious(set, previous)).toMatchObject({
      weight: 100,
      reps: 8,
      rir: 2,
      completed: true
    });
  });

  it("leaves rir null when neither set has one", () => {
    const prev: StrengthSet = { id: "p", weight: 1, reps: 1, completed: true };

    expect(fillSetFromPrevious(makeSet(), prev).rir).toBeNull();
  });
});

describe("getPreviousExerciseSession", () => {
  const w1 = makeWorkout("w1", "2026-07-01", [makeExercise("Bench Press")]);
  const w2 = makeWorkout("w2", "2026-07-08", [makeExercise("bench press")]);
  const w3 = makeWorkout("w3", "2026-07-15", [makeExercise("BENCH PRESS")]);
  const other = makeWorkout("w4", "2026-07-20", [makeExercise("Squat")]);
  // Deliberately unsorted input.
  const workouts = [w2, other, w3, w1];

  it("returns the latest session when beforeWorkoutId is not in history (new draft)", () => {
    expect(getPreviousExerciseSession(workouts, "Bench Press", "draft")?.workoutId).toBe("w3");
  });

  it("returns the latest session when beforeWorkoutId is omitted", () => {
    expect(getPreviousExerciseSession(workouts, "Bench Press")?.workoutId).toBe("w3");
  });

  it("returns the session immediately before beforeWorkoutId when it is in history", () => {
    expect(getPreviousExerciseSession(workouts, "Bench Press", "w3")?.workoutId).toBe("w2");
    expect(getPreviousExerciseSession(workouts, "Bench Press", "w2")?.workoutId).toBe("w1");
  });

  it("returns undefined for the first session", () => {
    expect(getPreviousExerciseSession(workouts, "Bench Press", "w1")).toBeUndefined();
  });

  it("matches the exercise name case-insensitively and trims it", () => {
    expect(getPreviousExerciseSession(workouts, "  bEnCh PrEsS ")?.workoutId).toBe("w3");
  });

  it("returns undefined when the exercise has no history", () => {
    expect(getPreviousExerciseSession(workouts, "Deadlift", "draft")).toBeUndefined();
  });
});

const validDefault: ExerciseDefault = {
  notes: "pause reps",
  weights: [60, null, 70.5],
  updatedAt: 1
};

describe("isExerciseDefault", () => {
  it("accepts a valid default (including empty weights)", () => {
    expect(isExerciseDefault(validDefault)).toBe(true);
    expect(isExerciseDefault({ notes: "", weights: [], updatedAt: 0 })).toBe(true);
  });

  it.each([
    ["null", null],
    ["a string", "x"],
    ["missing notes", { weights: [], updatedAt: 1 }],
    ["non-string notes", { notes: 1, weights: [], updatedAt: 1 }],
    ["missing updatedAt", { notes: "", weights: [] }],
    ["string updatedAt", { notes: "", weights: [], updatedAt: "1" }],
    ["missing weights", { notes: "", updatedAt: 1 }],
    ["non-array weights", { notes: "", weights: { 0: 1 }, updatedAt: 1 }],
    ["string weight", { notes: "", weights: ["60"], updatedAt: 1 }],
    ["NaN weight", { notes: "", weights: [Number.NaN], updatedAt: 1 }],
    ["Infinity weight", { notes: "", weights: [Number.POSITIVE_INFINITY], updatedAt: 1 }],
    ["undefined weight", { notes: "", weights: [undefined], updatedAt: 1 }]
  ])("rejects %s", (_label, value) => {
    expect(isExerciseDefault(value)).toBe(false);
  });
});

describe("loadExerciseDefaults / saveExerciseDefaults", () => {
  let store: Map<string, string>;

  beforeEach(() => {
    store = new Map();
    vi.stubGlobal("window", {});
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => store.set(key, value)
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("round-trips through localStorage under the v1 key", () => {
    const defaults = {
      "bench press": validDefault,
      squat: { notes: "", weights: [], updatedAt: 2 }
    };

    saveExerciseDefaults(defaults);

    expect(store.has(STRENGTH_EXERCISE_DEFAULTS_STORAGE_KEY)).toBe(true);
    expect(loadExerciseDefaults()).toEqual(defaults);
  });

  it("returns {} when nothing is stored", () => {
    expect(loadExerciseDefaults()).toEqual({});
  });

  it("returns {} for malformed JSON", () => {
    store.set(STRENGTH_EXERCISE_DEFAULTS_STORAGE_KEY, "{not json");

    expect(loadExerciseDefaults()).toEqual({});
  });

  it.each(["[]", "null", "42", '"str"'])("returns {} for non-object JSON %s", (raw) => {
    store.set(STRENGTH_EXERCISE_DEFAULTS_STORAGE_KEY, raw);

    expect(loadExerciseDefaults()).toEqual({});
  });

  it("drops invalid entries and keeps valid ones", () => {
    store.set(
      STRENGTH_EXERCISE_DEFAULTS_STORAGE_KEY,
      JSON.stringify({
        good: validDefault,
        bad: { notes: "x", weights: ["heavy"], updatedAt: 1 },
        worse: null
      })
    );

    expect(loadExerciseDefaults()).toEqual({ good: validDefault });
  });

  it("returns {} and does not write without window (SSR)", () => {
    vi.stubGlobal("window", undefined);
    store.set(STRENGTH_EXERCISE_DEFAULTS_STORAGE_KEY, JSON.stringify({ good: validDefault }));

    expect(loadExerciseDefaults()).toEqual({});
    saveExerciseDefaults({});
    expect(store.get(STRENGTH_EXERCISE_DEFAULTS_STORAGE_KEY)).toContain("good");
  });

  it('round-trips a "__proto__" default as an own key and applies it (regression)', () => {
    const name = "__proto__";
    // Built the way the save handler builds it.
    const defaults = { ...{}, [normalizeExerciseName(name)]: validDefault };

    saveExerciseDefaults(defaults);
    const loaded = loadExerciseDefaults();

    expect(Object.hasOwn(loaded, "__proto__")).toBe(true);
    expect(Object.getPrototypeOf(loaded)).toBe(Object.prototype);
    expect(applyExerciseDefaults([makeEntry(name)], loaded)[0]).toMatchObject({
      name,
      notes: validDefault.notes,
      hasDefaults: true
    });
  });
});

describe("applyExerciseDefaults", () => {
  const set = (weight: number | null, reps: number | null = 5, rir: number | null = 2) => ({
    weight,
    reps,
    rir
  });
  const entry = (name: string, overrides: Partial<ExerciseLibraryEntry> = {}) => ({
    ...makeEntry(name),
    notes: "history notes",
    sets: [set(50), set(55), set(60)],
    ...overrides
  });
  const withDefault = (weights: (number | null)[], notes = "my notes") => ({
    "bench press": { notes, weights, updatedAt: 1 }
  });

  it("returns entries unchanged with hasDefaults: false when there is no default", () => {
    const library = [entry("Bench Press")];

    expect(applyExerciseDefaults(library, {})).toEqual([{ ...library[0], hasDefaults: false }]);
  });

  it("overrides notes and per-index weights, keeping reps/rir", () => {
    const [result] = applyExerciseDefaults([entry("Bench Press")], withDefault([70, 72.5, 75]));

    expect(result).toMatchObject({
      notes: "my notes",
      hasDefaults: true,
      sets: [set(70), set(72.5), set(75)]
    });
  });

  it("overrides with an empty notes string", () => {
    const [result] = applyExerciseDefaults([entry("Bench Press")], withDefault([], ""));

    expect(result?.notes).toBe("");
  });

  it("a null weight clears the history weight", () => {
    const [result] = applyExerciseDefaults([entry("Bench Press")], withDefault([null, 80]));

    expect(result?.sets).toEqual([set(null), set(80), set(60)]);
  });

  it("leaves sets beyond a shorter weights array untouched", () => {
    const [result] = applyExerciseDefaults([entry("Bench Press")], withDefault([100]));

    expect(result?.sets).toEqual([set(100), set(55), set(60)]);
  });

  it("appends sets for extra weights with null reps/rir", () => {
    const [result] = applyExerciseDefaults(
      [entry("Bench Press", { sets: [set(50)] })],
      withDefault([60, 65, null])
    );

    expect(result?.sets).toEqual([set(60), set(65, null, null), set(null, null, null)]);
  });

  it("looks up defaults by normalized name (case and surrounding whitespace)", () => {
    const [result] = applyExerciseDefaults([entry("  BENCH press ")], withDefault([1]));

    expect(result?.hasDefaults).toBe(true);
    expect(result?.sets[0]?.weight).toBe(1);
  });

  it("only applies to the matching entry and does not mutate the input", () => {
    const library = [entry("Bench Press"), entry("Squat")];
    const snapshot = structuredClone(library);

    const result = applyExerciseDefaults(library, withDefault([99]));

    expect(result.map((item) => item.hasDefaults)).toEqual([true, false]);
    expect(result[1]).toEqual({ ...library[1], hasDefaults: false });
    expect(library).toEqual(snapshot);
  });

  // Regression: a plain `defaults[key]` lookup hit Object.prototype for these names and crashed.
  it.each(["Constructor", "__proto__", "toString"])(
    "treats %j as having no default when defaults is {}",
    (name) => {
      const library = [entry(name)];

      expect(applyExerciseDefaults(library, {})).toEqual([{ ...library[0], hasDefaults: false }]);
    }
  );
});

describe("rankExerciseSuggestions with defaults", () => {
  it("preserves hasDefaults on results", () => {
    const library = applyExerciseDefaults([makeEntry("Bench Press"), makeEntry("Bent Row")], {
      "bench press": validDefault
    });

    const result = rankExerciseSuggestions("ben", library);

    expect(result.map(({ name, hasDefaults }) => ({ name, hasDefaults }))).toEqual([
      { name: "Bench Press", hasDefaults: true },
      { name: "Bent Row", hasDefaults: false }
    ]);
    expect(result[0]).toBe(library[0]);
  });
});

describe("isStrengthWorkout warmup", () => {
  const base = { id: "w", date: "2026-07-01", startTime: "10:00" };

  it("accepts exercises with and without warmup", () => {
    expect(isStrengthWorkout({ ...base, exercises: [makeExercise("A")] })).toBe(true);
    expect(
      isStrengthWorkout({ ...base, exercises: [makeExercise("A", { warmup: "2x10 empty bar" })] })
    ).toBe(true);
    expect(isStrengthWorkout({ ...base, exercises: [makeExercise("A", { warmup: "" })] })).toBe(
      true
    );
    expect(isStrengthWorkout({ ...base, exercises: [] })).toBe(true);
  });

  it.each([42, null, ["x"], { text: "x" }])("rejects non-string warmup %j", (warmup) => {
    expect(isStrengthWorkout({ ...base, exercises: [{ ...makeExercise("A"), warmup }] })).toBe(
      false
    );
  });

  it.each([null, "Bench", 1])("rejects a non-object exercise %j", (exercise) => {
    expect(isStrengthWorkout({ ...base, exercises: [makeExercise("A"), exercise] })).toBe(false);
  });
});
