/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/restrict-plus-operands, @typescript-eslint/no-unsafe-call, @typescript-eslint/require-await */

/**
 * Minimal in-memory stand-in for the Prisma client, covering only the query shapes the auth code
 * uses (equality, lt/gt/not, increment, orderBy createdAt). Lets tests assert on resulting state
 * instead of on mock call arguments.
 */
export type Row = Record<string, any>;

/**
 * PostgreSQL `ILIKE` with the default `\` escape, which is what Prisma compiles
 * `{ equals, mode: "insensitive" }` to. Modelled faithfully (unescaped `%`/`_` are wildcards) so
 * tests catch a caller that forgets `equalsIgnoreCase`.
 */
function ilike(actual: string, pattern: string): boolean {
  let source = "";

  for (let i = 0; i < pattern.length; i++) {
    const char = pattern.charAt(i);

    if (char === "\\" && i + 1 < pattern.length) {
      source += pattern.charAt(++i).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    } else if (char === "%") {
      source += "[\\s\\S]*";
    } else if (char === "_") {
      source += "[\\s\\S]";
    } else {
      source += char.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    }
  }

  return new RegExp(`^${source}$`, "i").test(actual);
}

function matches(row: Row, where: Row | undefined): boolean {
  if (!where) return true;

  return Object.entries(where).every(([key, expected]) => {
    const actual = row[key] ?? null;

    if (expected !== null && typeof expected === "object" && !(expected instanceof Date)) {
      if ("lt" in expected && !(actual < expected.lt)) return false;
      if ("gt" in expected && !(actual > expected.gt)) return false;
      if ("not" in expected && actual === expected.not) return false;
      if ("equals" in expected) {
        // Supports Prisma's `{ equals, mode: "insensitive" }` shape (used by the case-insensitive
        // username lookups; an ILIKE, so wildcards apply) as well as a plain `{ equals }`.
        const isCaseInsensitive = expected.mode === "insensitive";
        const matchesEquals =
          isCaseInsensitive && typeof actual === "string" && typeof expected.equals === "string"
            ? ilike(actual, expected.equals as string)
            : actual === expected.equals;
        if (!matchesEquals) return false;
      }
      return true;
    }

    return actual === expected;
  });
}

function applyData(row: Row, data: Row) {
  for (const [key, value] of Object.entries(data)) {
    if (value !== null && typeof value === "object" && "increment" in value) {
      row[key] = (row[key] ?? 0) + value.increment;
    } else {
      row[key] = value;
    }
  }
}

let seq = 0;

export class FakeTable {
  rows: Row[] = [];

  constructor(
    private readonly defaults: () => Row,
    private readonly relations: (row: Row, include: Row) => Row = (row) => row
  ) {}

  private sorted(rows: Row[], orderBy?: Row) {
    if (orderBy?.createdAt !== "desc") return rows;
    return [...rows].sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime() || b._seq - a._seq
    );
  }

  async create({ data }: { data: Row }) {
    const rest = { ...data };
    delete rest.preferences; // nested relation writes are not modelled
    const row: Row = {
      id: `id_${String(++seq)}`,
      createdAt: new Date(),
      ...this.defaults(),
      ...rest,
      _seq: seq
    };
    this.rows.push(row);
    return { ...row };
  }

  async findUnique({ where, include }: { where: Row; include?: Row }) {
    const row = this.rows.find((r) => matches(r, where));
    if (!row) return null;
    return include ? this.relations({ ...row }, include) : { ...row };
  }

  async findFirst({ where, orderBy, select }: { where?: Row; orderBy?: Row; select?: Row }) {
    const row = this.sorted(
      this.rows.filter((r) => matches(r, where)),
      orderBy
    )[0];
    if (!row) return null;
    return select ? this.relations({ ...row }, select) : { ...row };
  }

  async findMany({
    where,
    orderBy,
    select,
    take
  }: { where?: Row; orderBy?: Row; select?: Row; take?: number } = {}) {
    return this.sorted(
      this.rows.filter((r) => matches(r, where)),
      orderBy
    )
      .slice(0, take)
      .map((r) => (select ? this.relations({ ...r }, select) : { ...r }));
  }

  async update({ where, data }: { where: Row; data: Row }) {
    const row = this.rows.find((r) => matches(r, where));
    if (!row) throw Object.assign(new Error("Record not found"), { code: "P2025" });
    const rest = { ...data };
    delete rest.preferences; // nested relation writes are not modelled
    applyData(row, rest);
    return { ...row };
  }

  async updateMany({ where, data }: { where?: Row; data: Row }) {
    const found = this.rows.filter((r) => matches(r, where));
    found.forEach((r) => {
      applyData(r, data);
    });
    return { count: found.length };
  }

  async upsert({ where, create, update }: { where: Row; create: Row; update: Row }) {
    const row = this.rows.find((r) => matches(r, where));
    if (!row) return this.create({ data: create });
    applyData(row, update);
    return { ...row };
  }

  async deleteMany({ where }: { where?: Row } = {}) {
    const before = this.rows.length;
    this.rows = this.rows.filter((r) => !matches(r, where));
    return { count: before - this.rows.length };
  }

  async count({ where }: { where?: Row } = {}) {
    return this.rows.filter((r) => matches(r, where)).length;
  }
}

export interface FakeDb {
  user: FakeTable;
  userProfile: FakeTable;
  emailVerificationCode: FakeTable;
  passwordChangeCode: FakeTable;
  passwordResetToken: FakeTable;
  feedback: FakeTable;
  session: FakeTable;
  $transaction: (arg: ((tx: FakeDb) => Promise<unknown>) | Promise<unknown>[]) => Promise<unknown>;
  reset: () => void;
}

export function createFakeDb(): FakeDb {
  const user = new FakeTable(() => ({
    name: null,
    emailVerified: null,
    passwordHash: null,
    passwordUpdatedAt: null,
    image: null
  }));
  const userProfile = new FakeTable(
    () => ({ username: null }),
    (row, includeOrSelect) =>
      includeOrSelect.user ? { ...row, user: user.rows.find((u) => u.id === row.userId) } : row
  );
  const emailVerificationCode = new FakeTable(() => ({ usedAt: null, attempts: 0 }));
  const passwordChangeCode = new FakeTable(() => ({ usedAt: null, attempts: 0 }));
  const passwordResetToken = new FakeTable(
    () => ({ usedAt: null }),
    (row, include) =>
      include.user ? { ...row, user: user.rows.find((u) => u.id === row.userId) } : row
  );
  const feedback = new FakeTable(() => ({ status: "NEW" }));
  const session = new FakeTable(() => ({}));

  const db: FakeDb = {
    user,
    userProfile,
    emailVerificationCode,
    passwordChangeCode,
    passwordResetToken,
    feedback,
    session,
    async $transaction(arg) {
      return typeof arg === "function" ? arg(db) : Promise.all(arg);
    },
    reset() {
      for (const table of [
        user,
        userProfile,
        emailVerificationCode,
        passwordChangeCode,
        passwordResetToken,
        feedback,
        session
      ]) {
        table.rows = [];
      }
    }
  };

  return db;
}
