import { describe, expect, it, vi, beforeEach } from "vitest";

import { prisma } from "@/lib/db/prisma";
import { requireUser } from "@/lib/auth/server";
import type { FakeDb, Row } from "@/lib/auth/fake-db.test.helpers";

import { saveProfileAction, updateAccountDetails } from "./server";
import type { ProfileActionState } from "./server";

vi.mock("@/lib/db/prisma", async () => {
  const { createFakeDb } = await import("@/lib/auth/fake-db.test.helpers");
  return { prisma: createFakeDb() };
});
vi.mock("@/lib/auth/server", () => ({ requireUser: vi.fn() }));
vi.mock("next/navigation", () => ({
  // Mirrors real Next.js behavior: redirect() interrupts execution via a thrown "digest" error.
  redirect: vi.fn((url: string) => {
    throw Object.assign(new Error("NEXT_REDIRECT"), { digest: `NEXT_REDIRECT;${url}` });
  })
}));

const db = prisma as unknown as FakeDb;
const requireUserMock = vi.mocked(requireUser);

const idle: ProfileActionState = { status: "idle" };
let counter = 0;
const uniqueEmail = () => `user${String(++counter)}@example.com`;

function form(fields: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

// Same error, worded for the field's label: Settings calls it "username", onboarding "display name".
const usernameTakenAs = (noun: "username" | "display name") => ({
  status: "error",
  message: `That ${noun} is already taken.`,
  fieldErrors: { username: [`Choose another ${noun}.`] }
});

async function seedAuthedUser(fields: Row = {}) {
  const user = await db.user.create({ data: { email: uniqueEmail(), ...fields } });
  requireUserMock.mockResolvedValue({
    id: user.id as string,
    email: user.email as string,
    name: null,
    image: null
  });
  return user;
}

beforeEach(() => {
  db.reset();
  requireUserMock.mockReset();
});

describe("updateAccountDetails", () => {
  const accountForm = (fields: Record<string, string> = {}) =>
    form({ username: "new_username1", dateOfBirth: "2000-01-01", ...fields });

  it("successfully updates the username and dateOfBirth", async () => {
    const user = await seedAuthedUser();

    const result = await updateAccountDetails(idle, accountForm());

    expect(result).toEqual({ status: "success", message: "Account details updated." });
    const profile = db.userProfile.rows.find((p) => p.userId === user.id);
    expect(profile?.username).toBe("new_username1");
    expect(profile?.dateOfBirth).toEqual(new Date("2000-01-01T00:00:00.000Z"));
  });

  it("rejects a case-insensitive collision against another user's existing username", async () => {
    const owner = await db.user.create({ data: { email: uniqueEmail() } });
    await db.userProfile.create({
      data: { userId: owner.id as string, username: "CaseSensitive1" }
    });
    // A decoy row with an unrelated username makes sure the check is actually filtering by
    // username content, not just "some other user's profile exists".
    const decoyOwner = await db.user.create({ data: { email: uniqueEmail() } });
    await db.userProfile.create({
      data: { userId: decoyOwner.id as string, username: "totally_different" }
    });
    const me = await seedAuthedUser();

    const result = await updateAccountDetails(idle, accountForm({ username: "casesensitive1" }));

    expect(result).toEqual(usernameTakenAs("username"));
    expect(db.userProfile.rows.find((p) => p.userId === me.id)).toBeUndefined();
  });

  it("treats `_` as a literal, not an ILIKE wildcard: john_doe is free while another user holds johnxdoe", async () => {
    const other = await db.user.create({ data: { email: uniqueEmail() } });
    await db.userProfile.create({ data: { userId: other.id as string, username: "johnxdoe" } });
    const me = await seedAuthedUser();

    const result = await updateAccountDetails(idle, accountForm({ username: "john_doe" }));

    expect(result).toEqual({ status: "success", message: "Account details updated." });
    expect(db.userProfile.rows.find((p) => p.userId === me.id)?.username).toBe("john_doe");
    expect(db.userProfile.rows.find((p) => p.userId === other.id)?.username).toBe("johnxdoe");
  });

  it("still rejects a case-only difference on a name containing `_` (John_Doe vs john_doe)", async () => {
    const other = await db.user.create({ data: { email: uniqueEmail() } });
    await db.userProfile.create({ data: { userId: other.id as string, username: "john_doe" } });
    const me = await seedAuthedUser();

    const result = await updateAccountDetails(idle, accountForm({ username: "John_Doe" }));

    expect(result).toEqual(usernameTakenAs("username"));
    expect(db.userProfile.rows.find((p) => p.userId === me.id)).toBeUndefined();
  });

  it("allows keeping your own current username unchanged (not a false collision)", async () => {
    const user = await seedAuthedUser();
    await db.userProfile.create({ data: { userId: user.id as string, username: "Athlete99" } });

    const result = await updateAccountDetails(idle, accountForm({ username: "Athlete99" }));

    expect(result).toEqual({ status: "success", message: "Account details updated." });
  });

  it("allows re-saving your own username with different casing (still not a false collision)", async () => {
    const user = await seedAuthedUser();
    await db.userProfile.create({ data: { userId: user.id as string, username: "Athlete99" } });

    const result = await updateAccountDetails(idle, accountForm({ username: "athlete99" }));

    expect(result).toEqual({ status: "success", message: "Account details updated." });
    expect(db.userProfile.rows.find((p) => p.userId === user.id)?.username).toBe("athlete99");
  });

  it("rejects a future dateOfBirth", async () => {
    await seedAuthedUser();
    const future = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    const result = await updateAccountDetails(idle, accountForm({ dateOfBirth: future }));

    expect(result.status).toBe("error");
    expect(result.fieldErrors?.dateOfBirth).toEqual(["Date of birth cannot be in the future."]);
  });

  it("propagates requireUser()'s redirect when there is no session", async () => {
    requireUserMock.mockImplementation(() => {
      throw Object.assign(new Error("NEXT_REDIRECT"), { digest: "NEXT_REDIRECT;/sign-in" });
    });

    await expect(updateAccountDetails(idle, accountForm())).rejects.toThrow("NEXT_REDIRECT");
  });
});

describe("saveProfileAction", () => {
  const validProfileForm = (fields: Record<string, string> = {}) =>
    form({
      firstName: "Ann",
      lastName: "Athlete",
      username: "ann_the_lifter",
      heightCm: "170",
      weightKg: "65",
      mainFitnessGoal: "BUILD_MUSCLE",
      trainingExperience: "BEGINNER",
      trainingFrequency: "3",
      preferredStyle: "GENERAL",
      ...fields
    });

  it("saves successfully and redirects to /dashboard", async () => {
    const user = await seedAuthedUser();

    await expect(saveProfileAction(idle, validProfileForm())).rejects.toThrow("NEXT_REDIRECT");

    const profile = db.userProfile.rows.find((p) => p.userId === user.id);
    expect(profile?.username).toBe("ann_the_lifter");
    expect(profile?.profileCompleted).toBe(true);
  });

  it("rejects a case-insensitive username collision, consistent with updateAccountDetails", async () => {
    const owner = await db.user.create({ data: { email: uniqueEmail() } });
    await db.userProfile.create({
      data: { userId: owner.id as string, username: "CaseSensitive1" }
    });
    const me = await seedAuthedUser();

    const result = await saveProfileAction(idle, validProfileForm({ username: "casesensitive1" }));

    expect(result).toEqual(usernameTakenAs("display name"));
    expect(db.userProfile.rows.find((p) => p.userId === me.id)).toBeUndefined();
  });

  it("treats `_` as a literal, not an ILIKE wildcard: john_doe is free while another user holds johnxdoe", async () => {
    const other = await db.user.create({ data: { email: uniqueEmail() } });
    await db.userProfile.create({ data: { userId: other.id as string, username: "johnxdoe" } });
    const me = await seedAuthedUser();

    await expect(
      saveProfileAction(idle, validProfileForm({ username: "john_doe" }))
    ).rejects.toThrow("NEXT_REDIRECT");

    expect(db.userProfile.rows.find((p) => p.userId === me.id)?.username).toBe("john_doe");
    expect(db.userProfile.rows.find((p) => p.userId === other.id)?.username).toBe("johnxdoe");
  });

  it("still rejects a case-only difference on a name containing `_` (John_Doe vs john_doe)", async () => {
    const other = await db.user.create({ data: { email: uniqueEmail() } });
    await db.userProfile.create({ data: { userId: other.id as string, username: "john_doe" } });
    const me = await seedAuthedUser();

    const result = await saveProfileAction(idle, validProfileForm({ username: "John_Doe" }));

    expect(result).toEqual(usernameTakenAs("display name"));
    expect(db.userProfile.rows.find((p) => p.userId === me.id)).toBeUndefined();
  });
});
