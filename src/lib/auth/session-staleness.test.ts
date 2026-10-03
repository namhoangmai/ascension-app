/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/unbound-method */
import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";

import type { Session } from "next-auth";

import { getCurrentUser, requireUser } from "./server";
import { auth } from "./auth";
import { authConfig } from "./config";
import { db, seedUser, registerServerTestLifecycle } from "./server-kit.test.helpers";
import type { Row } from "./fake-db.test.helpers";

vi.mock("@/lib/db/prisma", async () => {
  const { createFakeDb } = await import("./fake-db.test.helpers");
  return { prisma: createFakeDb() };
});
vi.mock("@/lib/services/email", () => ({
  sendVerificationCodeEmail: vi.fn(),
  sendPasswordResetEmail: vi.fn(),
  sendPasswordChangeCodeEmail: vi.fn(),
  sendWelcomeEmail: vi.fn()
}));
vi.mock("./auth", () => ({
  auth: vi.fn(),
  signIn: vi.fn(),
  signOut: vi.fn(),
  updateSession: vi.fn()
}));
vi.mock("next/navigation", () => ({
  // Mirrors real Next.js behavior: redirect() interrupts execution via a thrown "digest" error.
  redirect: vi.fn((url: string) => {
    throw Object.assign(new Error("NEXT_REDIRECT"), { digest: `NEXT_REDIRECT;${url}` });
  })
}));
vi.mock("next/server", () => ({ after: vi.fn() }));
// getCurrentUser() builds the Cookie header for auth() from headers()/cookies(), which throw
// outside a real Next request scope (and that error is swallowed as "signed out"). Both stay empty
// unless a test sets them: `incomingCookie` is the browser's (possibly stale) Cookie header,
// `cookieStore` is what cookies() reports (refreshed by a Server Action's updateSession()).
const request = vi.hoisted(() => ({
  incomingCookie: "",
  cookieStore: [] as { name: string; value: string }[]
}));
vi.mock("next/headers", () => ({
  headers: () =>
    Promise.resolve(new Headers(request.incomingCookie ? { cookie: request.incomingCookie } : {})),
  cookies: () => Promise.resolve({ getAll: () => request.cookieStore })
}));

registerServerTestLifecycle();

beforeEach(() => {
  request.incomingCookie = "";
  request.cookieStore = [];
});

// `auth` is overloaded (bare call / route-handler-wrapping call); pin the mock to the bare-call
// signature actually used here so `mockResolvedValue` accepts a `Session | null`.
const authMock = vi.mocked(auth) as unknown as Mock<() => Promise<Session | null>>;

// getCurrentUser() actually calls auth's `(req, res)` overload; this view exposes the arguments.
type AuthFromHeaders = (
  req: { headers: Headers },
  res: { headers: Headers }
) => Promise<Session | null>;
const authFromHeadersMock = vi.mocked(auth) as unknown as Mock<AuthFromHeaders>;

/**
 * Builds a fake `Session` carrying the given `passwordUpdatedAt` token value. Takes a `Row` (the
 * fake DB's loosely-typed shape) rather than a strict interface so seeded rows from `seedUser()`
 * pass straight through.
 */
function sessionFor(user: Row, passwordUpdatedAt: string | null): Session {
  return {
    user: {
      id: user.id as string,
      email: user.email as string,
      name: (user.name as string | null | undefined) ?? null,
      image: (user.image as string | null | undefined) ?? null,
      passwordUpdatedAt
    }
  } as unknown as Session;
}

async function seedWithPasswordUpdatedAt(fields: Row = {}) {
  return seedUser({ emailVerified: new Date(), ...fields });
}

describe("getCurrentUser() session staleness", () => {
  it("accepts a token whose passwordUpdatedAt matches the DB", async () => {
    const stamp = new Date("2026-03-01T09:30:00Z");
    const user = await seedWithPasswordUpdatedAt({ passwordUpdatedAt: stamp });
    authMock.mockResolvedValue(sessionFor(user, stamp.toISOString()));

    const result = await getCurrentUser();

    expect(result).toEqual({
      id: user.id,
      name: user.name,
      email: user.email,
      image: user.image
    });
  });

  it("treats a token that predates a password change as signed out", async () => {
    const oldStamp = new Date("2026-01-01T00:00:00Z");
    const newStamp = new Date("2026-03-01T00:00:00Z");
    const user = await seedWithPasswordUpdatedAt({ passwordUpdatedAt: newStamp });
    // Simulates a JWT minted before the password change — the DB has since moved on.
    authMock.mockResolvedValue(sessionFor(user, oldStamp.toISOString()));

    expect(await getCurrentUser()).toBeNull();
  });

  it("requireUser() redirects to sign-in for a stale token, same as no session at all", async () => {
    const oldStamp = new Date("2026-01-01T00:00:00Z");
    const newStamp = new Date("2026-03-01T00:00:00Z");
    const user = await seedWithPasswordUpdatedAt({ passwordUpdatedAt: newStamp });
    authMock.mockResolvedValue(sessionFor(user, oldStamp.toISOString()));

    await expect(requireUser()).rejects.toThrow("NEXT_REDIRECT");
  });

  it("treats a null DB value against a non-null token as stale", async () => {
    const user = await seedWithPasswordUpdatedAt({ passwordUpdatedAt: null });
    authMock.mockResolvedValue(sessionFor(user, "2026-01-01T00:00:00.000Z"));

    expect(await getCurrentUser()).toBeNull();
  });

  it("accepts when both the DB value and the token value are null, without throwing", async () => {
    const user = await seedWithPasswordUpdatedAt({ passwordUpdatedAt: null });
    authMock.mockResolvedValue(sessionFor(user, null));

    await expect(getCurrentUser()).resolves.toEqual({
      id: user.id,
      name: user.name,
      email: user.email,
      image: user.image
    });
  });

  it("treats a session for a user no longer in the DB as signed out, without throwing", async () => {
    authMock.mockResolvedValue(
      sessionFor({ id: "ghost-id", email: "ghost@example.com" }, "2026-01-01T00:00:00.000Z")
    );

    await expect(getCurrentUser()).resolves.toBeNull();
  });

  it("does not throw when auth() itself throws — treated as signed out", async () => {
    authMock.mockRejectedValue(new Error("boom"));

    await expect(getCurrentUser()).resolves.toBeNull();
  });

  it("a same-device refresh (updateSession's trigger:update path) is accepted immediately after a password change, while other devices' stale tokens are not", async () => {
    const originalStamp = new Date("2026-01-01T00:00:00Z");
    const user = await seedWithPasswordUpdatedAt({ passwordUpdatedAt: originalStamp });
    authMock.mockResolvedValue(sessionFor(user, originalStamp.toISOString()));
    expect(await getCurrentUser()).not.toBeNull();

    // A password change stamps a fresh passwordUpdatedAt on the User row...
    const refreshedStamp = new Date("2026-01-01T00:05:00Z");
    await db.user.update({ where: { id: user.id }, data: { passwordUpdatedAt: refreshedStamp } });

    // ...and refreshPasswordSession() in server.ts calls updateSession() right after, which (via
    // the jwt callback's trigger:"update" handling — covered separately in config.test.ts) puts
    // the new value directly into the CURRENT request's own token. The next auth() call on this
    // same device already reflects it:
    authMock.mockResolvedValue(sessionFor(user, refreshedStamp.toISOString()));
    expect(await getCurrentUser()).not.toBeNull();

    // Any OTHER device, whose token still carries the pre-change stamp, is signed out on its
    // next request — this is the actual "sign out other devices" mechanism under JWT sessions.
    authMock.mockResolvedValue(sessionFor(user, originalStamp.toISOString()));
    expect(await getCurrentUser()).toBeNull();
  });
});

/**
 * Regression: on an OAuth (Google) sign-in the `jwt` callback receives the Prisma adapter's `User`
 * row, where `passwordUpdatedAt` is a `Date`, not the ISO string `authorize()` returns. It used to
 * be stored as null, so every Google user with a password stamp (signed up with a password, reset
 * or set one, or hit the pre-hijack wipe) was "stale" on every request: a sign-in redirect loop.
 */
describe("getCurrentUser() with a token minted by a real jwt+session callback pass", () => {
  const jwt = authConfig.callbacks.jwt as unknown as (p: {
    token: Record<string, unknown>;
    user: Row;
    trigger: string;
  }) => Record<string, unknown>;
  const sessionCallback = authConfig.callbacks.session as unknown as (p: {
    session: { user: Record<string, unknown> };
    token: Record<string, unknown>;
  }) => Session;

  async function sessionMintedFor(user: Row) {
    // Exactly what the Prisma adapter hands Auth.js on a Google sign-in: the raw row.
    const adapterUser = await db.user.findUnique({ where: { id: user.id } });
    if (!adapterUser) throw new Error("seeded user is missing");
    const token = jwt({
      token: { sub: user.id, email: user.email },
      user: adapterUser,
      trigger: "signIn"
    });

    return sessionCallback({ session: { user: {} }, token });
  }

  it.each([
    ["a password stamp with milliseconds", new Date("2026-03-01T09:30:00.123Z")],
    ["no password stamp", null]
  ])("a Google sign-in for a user with %s is not stale", async (_label, stamp) => {
    const user = await seedWithPasswordUpdatedAt({ passwordUpdatedAt: stamp });
    authMock.mockResolvedValue(await sessionMintedFor(user));

    await expect(getCurrentUser()).resolves.toMatchObject({ id: user.id, email: user.email });
  });

  it("still rejects that token once the password changes afterwards", async () => {
    const user = await seedWithPasswordUpdatedAt({
      passwordUpdatedAt: new Date("2026-03-01T09:30:00.123Z")
    });
    authMock.mockResolvedValue(await sessionMintedFor(user));
    await db.user.update({
      where: { id: user.id },
      data: { passwordUpdatedAt: new Date("2026-03-02T00:00:00.000Z") }
    });

    await expect(getCurrentUser()).resolves.toBeNull();
  });
});

/**
 * Regression: `auth` is mocked everywhere else, so nothing noticed when getCurrentUser() fed it the
 * incoming (stale) Cookie header. After a Server Action's updateSession(), Next re-renders the page
 * in the same request: cookies() has the refreshed token, headers() still has the old one. Reading
 * the old one bounced the device that just changed its password to /sign-in.
 */
describe("getCurrentUser() reads the session from cookies(), not the incoming Cookie header", () => {
  const SESSION_COOKIE = "authjs.session-token";

  it("hands auth() the refreshed cookie and never the stale incoming one", async () => {
    request.incomingCookie = `${SESSION_COOKIE}=OLD`;
    request.cookieStore = [{ name: SESSION_COOKIE, value: "NEW" }];
    authFromHeadersMock.mockClear();
    authFromHeadersMock.mockResolvedValue(null);

    await getCurrentUser();

    expect(authFromHeadersMock).toHaveBeenCalledTimes(1);
    const cookie = authFromHeadersMock.mock.lastCall?.[0].headers.get("cookie");
    expect(cookie).toContain(`${SESSION_COOKIE}=NEW`);
    expect(cookie).not.toContain("OLD");
  });

  // A stand-in for Auth.js that, like the real one, derives the session from whichever token is in
  // the Cookie header it is given. OLD is a JWT minted before the password change, NEW after it.
  async function seedUserWithTokens() {
    const oldStamp = new Date("2026-01-01T00:00:00Z");
    const newStamp = new Date("2026-03-01T00:00:00Z");
    const stamps = new Map([
      ["OLD", oldStamp],
      ["NEW", newStamp]
    ]);
    const user = await seedWithPasswordUpdatedAt({ passwordUpdatedAt: newStamp });

    authFromHeadersMock.mockImplementation(({ headers }) => {
      const token = new RegExp(`${SESSION_COOKIE}=([^;]*)`).exec(headers.get("cookie") ?? "")?.[1];
      const stamp = stamps.get(token ?? "");

      return Promise.resolve(stamp ? sessionFor(user, stamp.toISOString()) : null);
    });

    return user;
  }

  it.each([
    {
      incoming: "OLD",
      store: "NEW",
      signedIn: true,
      why: "refreshed cookie wins over stale header"
    },
    { incoming: "OLD", store: "OLD", signedIn: false, why: "genuinely stale token is rejected" },
    {
      incoming: "NEW",
      store: "OLD",
      signedIn: false,
      why: "a stale cookie is not rescued by header"
    }
  ])(
    "incoming=$incoming cookies()=$store -> signedIn=$signedIn ($why)",
    async ({ incoming, store, signedIn }) => {
      const user = await seedUserWithTokens();
      request.incomingCookie = `${SESSION_COOKIE}=${incoming}`;
      request.cookieStore = [{ name: SESSION_COOKIE, value: store }];

      const result = await getCurrentUser();

      expect(result).toEqual(
        signedIn ? { id: user.id, name: user.name, email: user.email, image: user.image } : null
      );
    }
  );

  it("forwards every cookie from cookies() (URL-encoded), not just the session token", async () => {
    request.cookieStore = [
      { name: SESSION_COOKIE, value: "NEW" },
      { name: "theme", value: "dark mode;1" }
    ];
    authFromHeadersMock.mockClear();
    authFromHeadersMock.mockResolvedValue(null);

    await getCurrentUser();

    expect(authFromHeadersMock.mock.lastCall?.[0].headers.get("cookie")).toBe(
      `${SESSION_COOKIE}=NEW; theme=dark%20mode%3B1`
    );
  });
});
