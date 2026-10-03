import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { prisma } from "@/lib/db/prisma";
import { requireUser } from "@/lib/auth/server";
import type { FakeDb, Row } from "@/lib/auth/fake-db.test.helpers";

import { submitFeedbackAction } from "./server";
import type { FeedbackActionState } from "./server";

vi.mock("@/lib/db/prisma", async () => {
  const { createFakeDb } = await import("@/lib/auth/fake-db.test.helpers");
  return { prisma: createFakeDb() };
});
vi.mock("@/lib/auth/server", () => ({ requireUser: vi.fn() }));

const db = prisma as unknown as FakeDb;
const requireUserMock = vi.mocked(requireUser);

const idle: FeedbackActionState = { status: "idle" };
let counter = 0;
const uniqueEmail = () => `user${String(++counter)}@example.com`;

function form(fields: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

const validForm = (fields: Record<string, string> = {}) =>
  form({ category: "FEEDBACK", message: "This is a perfectly valid feedback message.", ...fields });

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
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-04-01T12:00:00Z"));
  db.reset();
  requireUserMock.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("submitFeedbackAction", () => {
  it("creates a row scoped to the signed-in user's id, ignoring a form-supplied userId", async () => {
    const user = await seedAuthedUser();

    const result = await submitFeedbackAction(idle, validForm({ userId: "someone-else" }));

    expect(result).toEqual({
      status: "success",
      message: "Thanks — your message has been sent."
    });
    expect(db.feedback.rows).toHaveLength(1);
    expect(db.feedback.rows[0]?.userId).toBe(user.id);
    expect(db.feedback.rows[0]?.userId).not.toBe("someone-else");
    expect(db.feedback.rows[0]?.category).toBe("FEEDBACK");
    expect(db.feedback.rows[0]?.message).toBe("This is a perfectly valid feedback message.");
  });

  it("accepts the RECOMMENDATION category too", async () => {
    await seedAuthedUser();

    const result = await submitFeedbackAction(
      idle,
      validForm({ category: "RECOMMENDATION", message: "Please add a rest-timer sound option." })
    );

    expect(result.status).toBe("success");
    expect(db.feedback.rows[0]?.category).toBe("RECOMMENDATION");
  });

  it("rejects a too-short message", async () => {
    await seedAuthedUser();

    const result = await submitFeedbackAction(idle, validForm({ message: "short" }));

    expect(result.status).toBe("error");
    expect(result.fieldErrors?.message).toEqual(["Say a bit more — at least 10 characters."]);
    expect(db.feedback.rows).toHaveLength(0);
  });

  it("rejects a too-long message (over 2000 characters)", async () => {
    await seedAuthedUser();

    const result = await submitFeedbackAction(idle, validForm({ message: "x".repeat(2001) }));

    expect(result.status).toBe("error");
    expect(result.fieldErrors?.message).toEqual(["Keep it under 2000 characters."]);
    expect(db.feedback.rows).toHaveLength(0);
  });

  it("rejects an invalid category", async () => {
    await seedAuthedUser();

    const result = await submitFeedbackAction(idle, validForm({ category: "BUG_REPORT" }));

    expect(result.status).toBe("error");
    expect(result.fieldErrors?.category).toBeDefined();
    expect(db.feedback.rows).toHaveLength(0);
  });

  it("allows 5 submissions per hour, rejects the 6th, and resets an hour later", async () => {
    await seedAuthedUser();

    for (let i = 0; i < 5; i++) {
      const result = await submitFeedbackAction(idle, validForm());
      expect(result.status).toBe("success");
    }
    expect(db.feedback.rows).toHaveLength(5);

    const sixth = await submitFeedbackAction(idle, validForm());

    expect(sixth).toEqual({
      status: "error",
      message: "You've sent a few of these recently. Please try again later."
    });
    expect(db.feedback.rows).toHaveLength(5);

    vi.setSystemTime(new Date(Date.now() + 60 * 60 * 1000 + 1));

    const afterReset = await submitFeedbackAction(idle, validForm());
    expect(afterReset.status).toBe("success");
    expect(db.feedback.rows).toHaveLength(6);
  });

  it("caps per user, not globally: another user is unaffected", async () => {
    await seedAuthedUser();
    for (let i = 0; i < 5; i++) {
      await submitFeedbackAction(idle, validForm());
    }
    expect((await submitFeedbackAction(idle, validForm())).status).toBe("error");

    await seedAuthedUser();
    const result = await submitFeedbackAction(idle, validForm());

    expect(result.status).toBe("success");
  });

  it("propagates requireUser()'s redirect when there is no session, the same as other requireUser()-gated actions", async () => {
    requireUserMock.mockImplementation(() => {
      throw Object.assign(new Error("NEXT_REDIRECT"), { digest: "NEXT_REDIRECT;/sign-in" });
    });

    await expect(submitFeedbackAction(idle, validForm())).rejects.toThrow("NEXT_REDIRECT");
    expect(db.feedback.rows).toHaveLength(0);
  });
});
