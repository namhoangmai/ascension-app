/* eslint-disable @typescript-eslint/unbound-method, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-return */
import { beforeEach, describe, expect, it, vi } from "vitest";

import { prisma } from "@/lib/db/prisma";

import { authConfig } from "./config";
import type { FakeDb } from "./fake-db.test.helpers";
import { getAuthProviders } from "./providers";

vi.mock("@/lib/db/prisma", async () => {
  const { createFakeDb } = await import("./fake-db.test.helpers");
  return { prisma: createFakeDb() };
});

const db = prisma as unknown as FakeDb;

interface GoogleProfile {
  email?: string;
  email_verified?: unknown;
}
type SignInCallback = (params: {
  account?: { provider: string } | null;
  profile?: GoogleProfile;
}) => Promise<boolean>;
type SignInEvent = (message: {
  user: { id?: string };
  account?: { provider: string } | null;
}) => Promise<void>;

const signInCallback = authConfig.callbacks.signIn as unknown as SignInCallback;
const signInEvent = authConfig.events.signIn as unknown as SignInEvent;
const google = { provider: "google" };

beforeEach(() => {
  db.reset();
});

describe("providers", () => {
  const ids = () =>
    getAuthProviders().map((provider) => (provider as unknown as { id: string }).id);

  it("offers only credentials when no Google env is set", () => {
    vi.stubEnv("AUTH_GOOGLE_ID", undefined);
    vi.stubEnv("AUTH_GOOGLE_SECRET", undefined);
    vi.stubEnv("GOOGLE_CLIENT_ID", undefined);
    vi.stubEnv("GOOGLE_CLIENT_SECRET", undefined);

    expect(ids()).toEqual(["credentials"]);
    vi.unstubAllEnvs();
  });

  it("adds Google when AUTH_GOOGLE_ID/SECRET are set", () => {
    vi.stubEnv("AUTH_GOOGLE_ID", "id");
    vi.stubEnv("AUTH_GOOGLE_SECRET", "secret");

    expect(ids()).toEqual(["credentials", "google"]);
    vi.unstubAllEnvs();
  });

  it("supports the legacy GOOGLE_CLIENT_ID/SECRET names", () => {
    vi.stubEnv("AUTH_GOOGLE_ID", undefined);
    vi.stubEnv("AUTH_GOOGLE_SECRET", undefined);
    vi.stubEnv("GOOGLE_CLIENT_ID", "id");
    vi.stubEnv("GOOGLE_CLIENT_SECRET", "secret");

    expect(ids()).toContain("google");
    vi.unstubAllEnvs();
  });

  it("does not add Google with only one half of the credentials", () => {
    vi.stubEnv("AUTH_GOOGLE_ID", "id");
    vi.stubEnv("AUTH_GOOGLE_SECRET", undefined);
    vi.stubEnv("GOOGLE_CLIENT_ID", undefined);
    vi.stubEnv("GOOGLE_CLIENT_SECRET", undefined);

    expect(ids()).not.toContain("google");
    vi.unstubAllEnvs();
  });

  it("never includes a Facebook provider, even when Facebook env vars are present", () => {
    vi.stubEnv("AUTH_GOOGLE_ID", "id");
    vi.stubEnv("AUTH_GOOGLE_SECRET", "secret");
    vi.stubEnv("AUTH_FACEBOOK_ID", "fb");
    vi.stubEnv("AUTH_FACEBOOK_SECRET", "fb-secret");
    vi.stubEnv("FACEBOOK_CLIENT_ID", "fb");
    vi.stubEnv("FACEBOOK_CLIENT_SECRET", "fb-secret");

    expect(ids()).not.toContain("facebook");
    expect(authConfig.providers.map((p) => (p as unknown as { id: string }).id)).not.toContain(
      "facebook"
    );
    vi.unstubAllEnvs();
  });

  it("uses JWT sessions and the custom sign-in page", () => {
    expect(authConfig.session.strategy).toBe("jwt");
    expect(authConfig.pages).toEqual({ signIn: "/sign-in", error: "/sign-in" });
  });
});

describe("signIn callback", () => {
  it("lets non-Google providers through untouched", async () => {
    expect(await signInCallback({ account: { provider: "credentials" } })).toBe(true);
    expect(await signInCallback({})).toBe(true);
  });

  it("accepts Google with email_verified === true", async () => {
    expect(
      await signInCallback({
        account: google,
        profile: { email: "g@example.com", email_verified: true }
      })
    ).toBe(true);
  });

  it("rejects Google with email_verified === false", async () => {
    expect(
      await signInCallback({
        account: google,
        profile: { email: "g@example.com", email_verified: false }
      })
    ).toBe(false);
  });

  it("rejects Google when email_verified is missing", async () => {
    expect(await signInCallback({ account: google, profile: { email: "g@example.com" } })).toBe(
      false
    );
  });

  it.each(["true", 1, null, "yes"])(
    "rejects non-boolean email_verified %j (strict check)",
    async (value) => {
      expect(
        await signInCallback({
          account: google,
          profile: { email: "g@example.com", email_verified: value }
        })
      ).toBe(false);
    }
  );

  it("rejects Google with no profile or no email", async () => {
    expect(await signInCallback({ account: google })).toBe(false);
    expect(await signInCallback({ account: google, profile: { email_verified: true } })).toBe(
      false
    );
  });

  it("does not touch the database when it rejects an unverified Google profile", async () => {
    const victim = await db.user.create({
      data: { email: "v@example.com", passwordHash: "attacker-known" }
    });

    await signInCallback({
      account: google,
      profile: { email: "v@example.com", email_verified: false }
    });

    expect(db.user.rows.find((u) => u.id === victim.id)?.passwordHash).toBe("attacker-known");
  });

  it("pre-hijack defense: wipes the password and revokes sessions of an UNVERIFIED credential account", async () => {
    const pending = await db.user.create({
      data: { email: "v@example.com", passwordHash: "attacker-known", emailVerified: null }
    });
    await db.session.create({ data: { userId: pending.id } });
    await db.session.create({ data: { userId: "someone-else" } });

    const allowed = await signInCallback({
      account: google,
      profile: { email: "V@Example.com", email_verified: true }
    });

    expect(allowed).toBe(true);
    const stored = db.user.rows.find((u) => u.id === pending.id);
    expect(stored?.passwordHash).toBeNull();
    expect(stored?.passwordUpdatedAt).toBeInstanceOf(Date);
    expect(db.session.rows.map((s) => s.userId)).toEqual(["someone-else"]);
  });

  it("leaves a VERIFIED credential account's password intact", async () => {
    const user = await db.user.create({
      data: { email: "v@example.com", passwordHash: "real", emailVerified: new Date() }
    });

    await signInCallback({
      account: google,
      profile: { email: "v@example.com", email_verified: true }
    });

    expect(db.user.rows.find((u) => u.id === user.id)?.passwordHash).toBe("real");
  });

  it("leaves an unverified account with no password alone", async () => {
    await db.user.create({ data: { email: "v@example.com", passwordHash: null } });
    const spy = vi.spyOn(db, "$transaction");

    await signInCallback({
      account: google,
      profile: { email: "v@example.com", email_verified: true }
    });

    expect(spy).not.toHaveBeenCalled();
  });

  it("creates nothing itself for a brand-new Google email (the adapter does that)", async () => {
    expect(
      await signInCallback({
        account: google,
        profile: { email: "new@example.com", email_verified: true }
      })
    ).toBe(true);
    expect(db.user.rows).toHaveLength(0);
  });
});

describe("signIn event", () => {
  it("sets emailVerified for a Google sign-in when it is null", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-02-02T00:00:00Z"));
    const user = await db.user.create({ data: { email: "g@example.com" } });

    await signInEvent({ user: { id: user.id }, account: google });

    expect(db.user.rows[0]?.emailVerified).toEqual(new Date("2026-02-02T00:00:00Z"));
    vi.useRealTimers();
  });

  it("does not overwrite an existing emailVerified", async () => {
    const original = new Date("2025-05-05T00:00:00Z");
    const user = await db.user.create({
      data: { email: "g@example.com", emailVerified: original }
    });

    await signInEvent({ user: { id: user.id }, account: google });

    expect(db.user.rows[0]?.emailVerified).toEqual(original);
  });

  it("does nothing for credentials sign-ins", async () => {
    const user = await db.user.create({ data: { email: "g@example.com" } });

    await signInEvent({ user: { id: user.id }, account: { provider: "credentials" } });

    expect(db.user.rows[0]?.emailVerified).toBeNull();
  });

  it("does nothing when the user has no id", async () => {
    await db.user.create({ data: { email: "g@example.com" } });

    await signInEvent({ user: {}, account: google });

    expect(db.user.rows[0]?.emailVerified).toBeNull();
  });
});

describe("session/jwt callbacks", () => {
  const jwt = authConfig.callbacks.jwt as unknown as (p: {
    token: Record<string, unknown>;
    user?: Record<string, unknown>;
  }) => Record<string, unknown>;
  const session = authConfig.callbacks.session as unknown as (p: {
    session: { user: Record<string, unknown> };
    token: Record<string, unknown>;
  }) => { user: Record<string, unknown> };

  it("copies passwordUpdatedAt from the user into the token", () => {
    expect(jwt({ token: {}, user: { passwordUpdatedAt: "2026-01-01T00:00:00.000Z" } })).toEqual({
      passwordUpdatedAt: "2026-01-01T00:00:00.000Z"
    });
    expect(jwt({ token: {}, user: { passwordUpdatedAt: 5 } })).toEqual({ passwordUpdatedAt: null });
  });

  it("exposes id, email and passwordUpdatedAt on the session", () => {
    const result = session({
      session: { user: {} },
      token: { sub: "u1", email: "a@example.com", passwordUpdatedAt: "x" }
    });

    expect(result.user).toEqual({ id: "u1", email: "a@example.com", passwordUpdatedAt: "x" });
  });

  it("authorized() requires a signed-in user", () => {
    const authorized = authConfig.callbacks.authorized as unknown as (p: {
      auth: { user?: object } | null;
    }) => boolean;

    expect(authorized({ auth: null })).toBe(false);
    expect(authorized({ auth: { user: {} } })).toBe(true);
  });
});
