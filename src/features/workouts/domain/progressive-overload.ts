export interface CompletedWorkingSet {
  reps: number;
  rir: number;
  weightKg: number;
}

export interface OverloadInput {
  sets: CompletedWorkingSet[];
  incrementKg: number;
}

export interface OverloadSuggestion {
  shouldIncrease: boolean;
  suggestedWeightKg?: number;
  reason?: string;
}

export function evaluateProgressiveOverload(input: OverloadInput): OverloadSuggestion {
  const sortedSets = input.sets.slice(0, 2);

  if (sortedSets.length < 2) {
    return { shouldIncrease: false };
  }

  const [firstSet, secondSet] = sortedSets;
  const currentWeightKg = firstSet?.weightKg;

  if (
    !firstSet ||
    !secondSet ||
    currentWeightKg === undefined ||
    secondSet.weightKg !== currentWeightKg
  ) {
    return { shouldIncrease: false };
  }

  const hitAbsoluteFailureTarget =
    firstSet.reps >= 9 && firstSet.rir === 0 && secondSet.reps >= 8 && secondSet.rir === 0;
  const hitConservativeTarget =
    firstSet.reps >= 8 && firstSet.rir <= 1 && secondSet.reps >= 7 && secondSet.rir <= 1;

  if (!hitAbsoluteFailureTarget && !hitConservativeTarget) {
    return { shouldIncrease: false };
  }

  return {
    shouldIncrease: true,
    suggestedWeightKg: currentWeightKg + input.incrementKg,
    reason: "Top working sets exceeded the 5-8 rep target with low RIR."
  };
}
