import test from "node:test";
import assert from "node:assert/strict";
import { aggregateHabits, fetchCommitTimestamps } from "../src/habits.ts";

test("S5: aggregateHabits buckets commits by Europe/Madrid hour across DST", () => {
  const habits = aggregateHabits(["2026-07-01T20:30:00Z", "2026-01-15T20:30:00Z"]);

  assert.equal(habits.total, 2);
  assert.equal(habits.byHour.length, 24);
  assert.equal(habits.byHour[22], 1, "summer (CEST, UTC+2)");
  assert.equal(habits.byHour[21], 1, "winter (CET, UTC+1)");
  assert.equal(habits.byHour.reduce((a, b) => a + b, 0), 2);
});

test("S5: aggregateHabits maps weekdays Monday-first in the local time zone", () => {
  // 2026-11-16 is a Monday; 2026-11-15T23:30Z is already Monday 00:30 in Madrid.
  const habits = aggregateHabits([
    "2026-11-16T10:00:00Z",
    "2026-11-15T23:30:00Z",
    "2026-11-22T10:00:00Z",
    "2026-11-21T10:00:00Z"
  ]);

  assert.deepEqual(habits.byWeekday, [2, 0, 0, 0, 0, 1, 1]);
  assert.equal(habits.peakWeekday, 0);
});

test("S5: aggregateHabits reports the peak hour and weekday", () => {
  const habits = aggregateHabits([
    "2026-11-17T22:05:00Z",
    "2026-11-17T22:45:00Z",
    "2026-11-18T08:00:00Z"
  ]);

  assert.equal(habits.peakHour, 23);
  assert.equal(habits.peakWeekday, 1, "Tuesday");
  assert.equal(habits.total, 3);
});

test("S5: aggregateHabits with no commits reports zeros and no peaks", () => {
  assert.deepEqual(aggregateHabits([]), {
    total: 0,
    byHour: Array(24).fill(0),
    byWeekday: Array(7).fill(0),
    peakHour: null,
    peakWeekday: null,
    timeZone: "Europe/Madrid"
  });
});

test("fetchCommitTimestamps without a token returns [] without calling the API", async (t) => {
  const fetchMock = t.mock.method(globalThis, "fetch", async () => new Response("{}"));

  assert.deepEqual(await fetchCommitTimestamps("Ivan-olivera-dev", ""), []);
  assert.equal(fetchMock.mock.callCount(), 0);
});

type Body = { query: string; variables: Record<string, unknown> };
type Repo = { name: string; commits: string[][] | null };

/**
 * Fake GraphQL endpoint: repository pages come from `repoPages` (each a list of repos), and each repo's
 * history pages from `repo.commits` (null = empty repo without a default branch).
 */
function fakeGraphql(repoPages: Repo[][], options: { failOn?: (body: Body) => boolean } = {}) {
  const bodies: Body[] = [];
  const handler = async (_url: unknown, init?: RequestInit) => {
    const body = JSON.parse(init!.body as string) as Body;
    bodies.push(body);
    if (options.failOn?.(body)) return new Response("bad gateway", { status: 502 });

    if (body.query.includes("history(")) {
      const repo = repoPages.flat().find((r) => r.name === body.variables.name)!;
      const page = body.variables.cursor === null ? 0 : Number(body.variables.cursor);
      const nodes = repo.commits![page].map((committedDate) => ({ committedDate }));
      const hasNextPage = page + 1 < repo.commits!.length;
      return Response.json({
        data: {
          repository: {
            defaultBranchRef: {
              target: { history: { pageInfo: { hasNextPage, endCursor: hasNextPage ? String(page + 1) : null }, nodes } }
            }
          }
        }
      });
    }

    const page = body.variables.cursor === null ? 0 : Number(body.variables.cursor);
    const hasNextPage = page + 1 < repoPages.length;
    return Response.json({
      data: {
        user: {
          id: "U_ivan",
          repositories: {
            pageInfo: { hasNextPage, endCursor: hasNextPage ? String(page + 1) : null },
            nodes: repoPages[page].map((r) => ({ name: r.name, defaultBranchRef: r.commits === null ? null : { name: "main" } }))
          }
        }
      }
    });
  };
  return { handler, bodies };
}

const TWO_PAGES: Repo[][] = [
  [
    { name: "alpha", commits: [["2026-11-01T10:00:00Z", "2026-11-02T10:00:00Z"], ["2026-11-03T10:00:00Z"]] },
    { name: "empty", commits: null }
  ],
  [{ name: "beta", commits: [["2026-11-04T10:00:00Z"]] }]
];

test("S6: fetchCommitTimestamps paginates repositories and commit history", async (t) => {
  const { handler, bodies } = fakeGraphql(TWO_PAGES);
  const fetchMock = t.mock.method(globalThis, "fetch", handler);

  const timestamps = await fetchCommitTimestamps("Ivan-olivera-dev", "token", "2025-11-16T00:00:00Z");

  assert.deepEqual(timestamps, ["2026-11-01T10:00:00Z", "2026-11-02T10:00:00Z", "2026-11-03T10:00:00Z", "2026-11-04T10:00:00Z"]);
  // 2 repository pages + 2 history pages (alpha) + 1 history page (beta); the empty repo costs nothing.
  assert.equal(fetchMock.mock.callCount(), 5);
  const repoQueries = bodies.filter((b) => !b.query.includes("history("));
  assert.deepEqual(repoQueries.map((b) => b.variables), [
    { login: "Ivan-olivera-dev", cursor: null },
    { login: "Ivan-olivera-dev", cursor: "1" }
  ]);
  for (const body of repoQueries) {
    assert.ok(body.query.includes("privacy: PUBLIC"), "never counts private repositories");
    assert.ok(body.query.includes("isFork: false"));
    assert.ok(body.query.includes("ownerAffiliations: OWNER"));
    assert.ok(body.query.includes("first: 100"));
  }
});

test("S6: fetchCommitTimestamps filters history by the user's node id server-side", async (t) => {
  const { handler, bodies } = fakeGraphql(TWO_PAGES);
  t.mock.method(globalThis, "fetch", handler);

  await fetchCommitTimestamps("Ivan-olivera-dev", "token", "2025-11-16T00:00:00Z");

  const historyQueries = bodies.filter((b) => b.query.includes("history("));
  assert.deepEqual(historyQueries.map((b) => b.variables), [
    { owner: "Ivan-olivera-dev", name: "alpha", since: "2025-11-16T00:00:00Z", userId: "U_ivan", cursor: null },
    { owner: "Ivan-olivera-dev", name: "alpha", since: "2025-11-16T00:00:00Z", userId: "U_ivan", cursor: "1" },
    { owner: "Ivan-olivera-dev", name: "beta", since: "2025-11-16T00:00:00Z", userId: "U_ivan", cursor: null }
  ]);
  for (const body of historyQueries) {
    assert.ok(body.query.includes("author: { id: $userId }"));
    assert.ok(body.query.includes("since: $since"));
    assert.ok(body.query.includes("first: 100"));
  }
  assert.ok(!historyQueries.some((b) => b.variables.name === "empty"), "repos without a default branch are skipped");
});

test("S6: fetchCommitTimestamps returns [] (never a partial year) when a page fails mid-pagination", async (t) => {
  const { handler } = fakeGraphql(TWO_PAGES, { failOn: (b) => b.variables.name === "alpha" && b.variables.cursor === "1" });
  t.mock.method(globalThis, "fetch", handler);
  const warn = t.mock.method(console, "warn", () => {});

  assert.deepEqual(await fetchCommitTimestamps("Ivan-olivera-dev", "token"), []);
  assert.equal(warn.mock.callCount(), 1);
  assert.match(String(warn.mock.calls[0].arguments[0]), /502/);
});

test("S6: fetchCommitTimestamps stops at the request safety limit and warns", async (t) => {
  const pages = Array.from({ length: 60 }, (_, i) => [`2026-10-01T10:${String(i).padStart(2, "0")}:00Z`]);
  const { handler } = fakeGraphql([[{ name: "huge", commits: pages }]]);
  const fetchMock = t.mock.method(globalThis, "fetch", handler);
  const warn = t.mock.method(console, "warn", () => {});

  const timestamps = await fetchCommitTimestamps("Ivan-olivera-dev", "token");

  assert.equal(fetchMock.mock.callCount(), 50);
  assert.deepEqual(timestamps, pages.slice(0, 49).flat(), "1 repository page + 49 history pages");
  assert.equal(warn.mock.callCount(), 1);
  assert.match(String(warn.mock.calls[0].arguments[0]), /50 requests/);
});

test("S6: aggregateHabits ignores invalid timestamps", () => {
  const habits = aggregateHabits(["not-a-date", "2026-11-16T10:00:00Z", ""]);

  assert.equal(habits.total, 1);
  assert.equal(habits.byHour.reduce((a, b) => a + b, 0), 1);
  assert.equal(habits.byWeekday.reduce((a, b) => a + b, 0), 1);
  assert.equal(habits.byHour[11], 1);
});

test("fetchCommitTimestamps returns [] when the API errors", async (t) => {
  t.mock.method(globalThis, "fetch", async () => new Response("nope", { status: 502 }));
  const warn = t.mock.method(console, "warn", () => {});

  assert.deepEqual(await fetchCommitTimestamps("Ivan-olivera-dev", "token"), []);
  assert.equal(warn.mock.callCount(), 1);
});

test("fetchCommitTimestamps returns [] when the request throws or data is missing", async (t) => {
  t.mock.method(console, "warn", () => {});
  const fetchMock = t.mock.method(globalThis, "fetch", async () => {
    throw new Error("network down");
  });
  assert.deepEqual(await fetchCommitTimestamps("Ivan-olivera-dev", "token"), []);

  fetchMock.mock.mockImplementation(async () => new Response(JSON.stringify({ errors: [{}] }), { status: 200 }));
  assert.deepEqual(await fetchCommitTimestamps("Ivan-olivera-dev", "token"), []);
});
