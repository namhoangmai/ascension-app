/* eslint-disable @typescript-eslint/unbound-method */
import type * as NextAuth from "next-auth";
import { describe, expect, it, vi } from "vitest";

import { updateSession } from "./auth";
import { authConfig } from "./config";

const unstableUpdate = vi.hoisted(() => vi.fn<(data: unknown) => Promise<null>>());

vi.mock("@/lib/db/prisma", async () => {
  const { createFakeDb } = await import("./fake-db.test.helpers");
  return { prisma: createFakeDb() };
});
vi.mock("@/lib/services/email", () => ({ sendWelcomeEmail: vi.fn() }));
vi.mock("next-auth", async (importOriginal) => {
  const actual = await importOriginal<typeof NextAuth>();

  return {
    ...actual,
    default: vi.fn(() => ({
      handlers: {},
      auth: vi.fn(),
      signIn: vi.fn(),
      signOut: vi.fn(),
      unstable_update: unstableUpdate
    }))
  };
});

const jwt = authConfig.callbacks.jwt as unknown as (p: {
  token: Record<string, unknown>;
  trigger: string;
  session: unknown;
}) => Record<string, unknown>;

describe("updateSession()", () => {
  it("sends a payload that the jwt callback accepts (same-device refresh keeps working)", async () => {
    const stamp = "2026-03-01T09:30:00.123Z";

    await updateSession({ user: { passwordUpdatedAt: stamp } });

    const payload = unstableUpdate.mock.calls.at(-1)?.[0];
    expect(payload).toMatchObject({ user: { passwordUpdatedAt: stamp } });
    expect(
      jwt({ token: { passwordUpdatedAt: "stale" }, trigger: "update", session: payload })
        .passwordUpdatedAt
    ).toBe(stamp);
  });

  it("its proof does not transfer to another value", async () => {
    await updateSession({ user: { passwordUpdatedAt: "2026-03-01T00:00:00.000Z" } });
    const payload = unstableUpdate.mock.calls.at(-1)?.[0];

    const replayed = {
      ...(payload as object),
      user: { passwordUpdatedAt: "2026-03-02T00:00:00.000Z" }
    };

    expect(
      jwt({ token: { passwordUpdatedAt: "stale" }, trigger: "update", session: replayed })
        .passwordUpdatedAt
    ).toBe("stale");
  });
});
