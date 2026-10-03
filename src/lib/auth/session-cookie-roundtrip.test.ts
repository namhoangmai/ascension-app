/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { encode } from "next-auth/jwt";
import type * as NextServer from "next/server";
import type { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { FakeDb } from "./fake-db.test.helpers";

/**
 * Unlike session-staleness.test.ts, `auth` is NOT mocked here: getCurrentUser() runs against the
 * real Auth.js, fed only what `cookies().getAll()` reports, to confirm the rebuilt Cookie header
 * round-trips (URL-encoding, chunked cookies, the `__Secure-` production prefix) and that every
 * failure ends as "signed out".
 */
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
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("next/server", async (importOriginal) => ({
  ...(await importOriginal<typeof NextServer>()),
  after: vi.fn()
}));
const request = vi.hoisted(() => ({
  cookieStore: [] as { name: string; value: string }[],
  /** The Cookie header the browser sent (what `headers()` reports); `cookieStore` is `cookies()`. */
  incomingCookie: ""
}));
vi.mock("next/headers", () => ({
  headers: () =>
    Promise.resolve(
      new Headers({
        host: "app.test",
        "x-forwarded-proto": "https",
        ...(request.incomingCookie ? { cookie: request.incomingCookie } : {})
      })
    ),
  cookies: () =>
    Promise.resolve({
      getAll: () => request.cookieStore,
      // Like Next's mutable cookies in a Server Action: later reads see the new value.
      set: (name: string, value: string) => {
        request.cookieStore = [
          ...request.cookieStore.filter((c) => c.name !== name),
          { name, value }
        ];
      }
    })
}));

const SECRET = "test-auth-secret-not-for-production";
/** Auth.js' route handlers are typed for NextRequest but only use the plain Request surface. */
const asNextRequest = (req: Request) => req as unknown as NextRequest;
const STAMP = new Date("2026-03-01T09:30:00.123Z");

/** Loads a fresh module graph, since the cookie name is fixed from NODE_ENV at import time. */
async function load(nodeEnv: "test" | "production") {
  vi.stubEnv("NODE_ENV", nodeEnv);
  vi.resetModules();

  const { prisma } = await import("@/lib/db/prisma");
  const { getCurrentUser } = await import("./server");
  const { handlers, updateSession } = await import("./auth");
  const db = prisma as unknown as FakeDb;
  db.reset();
  const user = await db.user.create({
    data: { email: "roundtrip@example.com", name: "Round Trip", passwordUpdatedAt: STAMP }
  });
  const cookieName =
    nodeEnv === "production" ? "__Secure-authjs.session-token" : "authjs.session-token";

  const mint = (claims: Record<string, unknown> = {}, secret = SECRET, salt = cookieName) =>
    encode({
      token: {
        sub: user.id,
        email: user.email,
        passwordUpdatedAt: STAMP.toISOString(),
        ...claims
      },
      secret,
      salt
    });

  return { getCurrentUser, handlers, updateSession, db, user, cookieName, mint };
}

beforeEach(() => {
  request.cookieStore = [];
  request.incomingCookie = "";
  vi.stubEnv("AUTH_SECRET", SECRET);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe.each([
  ["development/test", "test"],
  ["production (__Secure- prefix)", "production"]
] as const)("real Auth.js reads the session from cookies() in %s", (_label, nodeEnv) => {
  it("accepts a valid session cookie", async () => {
    const { getCurrentUser, user, cookieName, mint } = await load(nodeEnv);
    request.cookieStore = [{ name: cookieName, value: await mint() }];

    await expect(getCurrentUser()).resolves.toMatchObject({ id: user.id, email: user.email });
  });

  it("accepts a session cookie split into Auth.js chunks (name.0, name.1, ...)", async () => {
    const { getCurrentUser, user, cookieName, mint } = await load(nodeEnv);
    const jwt = await mint();
    const cut = Math.floor(jwt.length / 3);
    request.cookieStore = [
      { name: `${cookieName}.2`, value: jwt.slice(cut * 2) },
      { name: `${cookieName}.0`, value: jwt.slice(0, cut) },
      { name: `${cookieName}.1`, value: jwt.slice(cut, cut * 2) }
    ];

    await expect(getCurrentUser()).resolves.toMatchObject({ id: user.id });
  });

  it("is not thrown off by other cookies whose values need URL-encoding", async () => {
    const { getCurrentUser, user, cookieName, mint } = await load(nodeEnv);
    request.cookieStore = [
      { name: "theme", value: "dark mode; 1" },
      { name: cookieName, value: await mint() },
      { name: "weird", value: "100%=ünï,cøde" }
    ];

    await expect(getCurrentUser()).resolves.toMatchObject({ id: user.id });
  });

  it("fails closed: no cookie, wrong secret/salt/name, tampered or truncated token", async () => {
    const { getCurrentUser, cookieName, mint } = await load(nodeEnv);
    // Auth.js logs every undecodable token; that noise is expected here.
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const jwt = await mint();
    const cases = [
      [],
      [{ name: cookieName, value: await mint({}, "some-other-secret") }],
      [{ name: cookieName, value: await mint({}, SECRET, "some-other-salt") }],
      [{ name: "not-the-session-cookie", value: jwt }],
      // Only the exact production name counts: the unprefixed dev name must not authenticate there.
      ...(nodeEnv === "production" ? [[{ name: "authjs.session-token", value: jwt }]] : []),
      [{ name: cookieName, value: `${jwt.slice(0, -4)}AAAA` }],
      [{ name: cookieName, value: jwt.slice(0, 40) }],
      [{ name: cookieName, value: "" }]
    ];

    for (const cookieStore of cases) {
      request.cookieStore = cookieStore;
      await expect(getCurrentUser()).resolves.toBeNull();
    }
  });

  it("rejects a token minted before the DB's passwordUpdatedAt (no tolerance window)", async () => {
    const { getCurrentUser, cookieName, mint } = await load(nodeEnv);
    const oneMillisecondEarlier = new Date(STAMP.getTime() - 1).toISOString();

    for (const passwordUpdatedAt of [oneMillisecondEarlier, null]) {
      request.cookieStore = [{ name: cookieName, value: await mint({ passwordUpdatedAt }) }];
      await expect(getCurrentUser()).resolves.toBeNull();
    }
  });

  it("rejects a token whose user was deleted", async () => {
    const { getCurrentUser, cookieName, mint } = await load(nodeEnv);
    request.cookieStore = [{ name: cookieName, value: await mint({ sub: "deleted-user-id" }) }];

    await expect(getCurrentUser()).resolves.toBeNull();
  });
});

/**
 * The device that changes its password refreshes its own token via updateSession(); every other
 * token minted earlier must stay revoked even though `POST /api/auth/session` is a public route.
 */
describe("session refresh after a password change (real Auth.js)", () => {
  const OLD_STAMP = new Date(STAMP.getTime() - 60_000).toISOString();

  /** Moves the DB to STAMP while the caller's token still carries OLD_STAMP (i.e. just changed). */
  async function staleSession() {
    const ctx = await load("test");
    const staleJwt = await ctx.mint({ passwordUpdatedAt: OLD_STAMP });
    request.cookieStore = [{ name: ctx.cookieName, value: staleJwt }];
    request.incomingCookie = `${ctx.cookieName}=${staleJwt}`;

    return { ...ctx, staleJwt };
  }

  it("updateSession() re-mints the caller's own token so it is accepted again", async () => {
    const { getCurrentUser, updateSession, user } = await staleSession();
    await expect(getCurrentUser()).resolves.toBeNull();

    await updateSession({ user: { passwordUpdatedAt: STAMP.toISOString() } });

    await expect(getCurrentUser()).resolves.toMatchObject({ id: user.id });
  });

  it("a revoked token cannot un-revoke itself through the public POST /api/auth/session", async () => {
    const { getCurrentUser, handlers, cookieName, staleJwt } = await staleSession();
    // The attacker knows nothing secret: a CSRF token pair (anyone can fetch one) and the DB stamp.
    const csrfResponse = await handlers.GET(
      asNextRequest(new Request("https://app.test/api/auth/csrf"))
    );
    const { csrfToken } = (await csrfResponse.json()) as { csrfToken: string };
    const csrfCookie = csrfResponse.headers
      .getSetCookie()
      .map((cookie) => cookie.split(";")[0])
      .find((cookie) => cookie?.includes("authjs.csrf-token="));

    const response = await handlers.POST(
      asNextRequest(
        new Request("https://app.test/api/auth/session", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            cookie: `${cookieName}=${staleJwt}; ${csrfCookie ?? ""}`
          },
          body: JSON.stringify({
            csrfToken,
            data: { user: { passwordUpdatedAt: STAMP.toISOString() } }
          })
        })
      )
    );

    // The forged request was accepted as an ordinary session update (this is the exposure)...
    expect(response.status).toBe(200);
    // ...but whatever cookie it issued must still be revoked.
    const reissued = response.headers
      .getSetCookie()
      .map((cookie) => cookie.split(";")[0] ?? "")
      .filter((cookie) => cookie.startsWith(cookieName))
      .map((cookie) => {
        const [name = "", ...value] = cookie.split("=");
        return { name, value: value.join("=") };
      });
    request.cookieStore = reissued.length ? reissued : [{ name: cookieName, value: staleJwt }];

    await expect(getCurrentUser()).resolves.toBeNull();
  });
});
