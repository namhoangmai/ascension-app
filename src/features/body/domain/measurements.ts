import type { MeasurementType } from "@prisma/client";

export function buildMeasurementLabelKey(input: {
  type: MeasurementType;
  customLabel?: string | null;
}) {
  if (input.type !== "CUSTOM") {
    return input.type.toLowerCase();
  }

  const normalizedCustomLabel = input.customLabel?.trim().toLowerCase().replace(/\s+/g, "-");

  if (!normalizedCustomLabel) {
    throw new Error("Custom measurements require a label.");
  }

  return `custom:${normalizedCustomLabel}`;
}
