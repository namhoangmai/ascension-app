import { describe, expect, it } from "vitest";

import { accountDetailsInputSchema, profileInputSchema } from "./validation";

// Both schemas share one username rule; only the field's label in the error copy differs
// (Settings calls it "Username", onboarding calls it "Display name").
const usernameErrors = (
  schema: typeof accountDetailsInputSchema | typeof profileInputSchema,
  username: string
) => {
  // Other fields are deliberately missing/invalid: zod still reports every field's own issues.
  const result = schema.safeParse({ username, dateOfBirth: "2000-01-01" });
  return result.success ? [] : (result.error.flatten().fieldErrors.username ?? []);
};

describe("username label wording", () => {
  it("Settings schema (accountDetailsInputSchema) says 'Username is required.' for an empty username", () => {
    const errors = usernameErrors(accountDetailsInputSchema, "");

    expect(errors).toContain("Username is required.");
    expect(errors).not.toContain("Display name is required.");
  });

  it("onboarding schema (profileInputSchema) still says 'Display name is required.' for an empty username", () => {
    const errors = usernameErrors(profileInputSchema, "");

    expect(errors).toContain("Display name is required.");
    expect(errors).not.toContain("Username is required.");
  });

  it("each schema words the too-long error with its own label", () => {
    const tooLong = "a".repeat(33);

    expect(usernameErrors(accountDetailsInputSchema, tooLong)).toEqual(["Username is too long."]);
    expect(usernameErrors(profileInputSchema, tooLong)).toEqual(["Display name is too long."]);
  });

  it("both schemas accept the same valid username", () => {
    expect(usernameErrors(accountDetailsInputSchema, "ann_the.lifter-9")).toEqual([]);
    expect(usernameErrors(profileInputSchema, "ann_the.lifter-9")).toEqual([]);
  });
});
