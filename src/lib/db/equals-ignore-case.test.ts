import { describe, expect, it } from "vitest";

import { createFakeDb } from "@/lib/auth/fake-db.test.helpers";

import { equalsIgnoreCase } from "./equals-ignore-case";

describe("equalsIgnoreCase", () => {
  it("escapes the LIKE metacharacters %, _ and \\ and keeps the insensitive mode", () => {
    expect(equalsIgnoreCase("plain")).toEqual({ equals: "plain", mode: "insensitive" });
    expect(equalsIgnoreCase("100%_done\\").equals).toBe("100\\%\\_done\\\\");
    expect(equalsIgnoreCase("x").mode).toBe("insensitive");
  });

  // The fake DB models PostgreSQL ILIKE (unescaped % and _ are wildcards), which is what Prisma
  // compiles an insensitive `equals` to.
  describe("as a Prisma filter (against the ILIKE-faithful fake)", () => {
    const usernamesMatching = async (filter: unknown, names: string[]) => {
      const db = createFakeDb();
      for (const username of names) await db.userProfile.create({ data: { username } });

      const rows = await db.userProfile.findMany({ where: { username: filter } });
      return rows.map((row) => row.username as string);
    };

    it("is a true case-insensitive equality", async () => {
      expect(await usernamesMatching(equalsIgnoreCase("BOB"), ["bob", "Bobby", "b0b"])).toEqual([
        "bob"
      ]);
    });

    it.each(["%", "%%", "b%", "%b", "_ob", "b_b", "bo_", "___"])(
      "%j matches nothing extra (no wildcard expansion)",
      async (value) => {
        expect(await usernamesMatching(equalsIgnoreCase(value), ["bob", "b_b", "50%"])).toEqual(
          value === "b_b" ? ["b_b"] : []
        );
      }
    );

    it("matches names that really contain the metacharacters", async () => {
      expect(await usernamesMatching(equalsIgnoreCase("50%"), ["50%", "500", "50"])).toEqual([
        "50%"
      ]);
      expect(await usernamesMatching(equalsIgnoreCase("a\\b"), ["a\\b", "ab"])).toEqual(["a\\b"]);
    });

    it("documents the hazard: the raw shape is a wildcard match", async () => {
      const raw = { equals: "%", mode: "insensitive" };

      expect(await usernamesMatching(raw, ["alice", "bob"])).toEqual(["alice", "bob"]);
    });
  });
});
