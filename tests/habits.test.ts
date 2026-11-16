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

test("fetchCommitTimestamps queries public repos only and keeps the user's own commits", async (t) => {
  const commit = (committedDate: string, login: string | null) => ({
    committedDate,
    author: { user: login === null ? null : { login } }
  });
  const payload = {
    data: {
      user: {
        repositories: {
          nodes: [
            {
              defaultBranchRef: {
                target: {
                  history: {
                    nodes: [
                      commit("2026-11-01T10:00:00Z", "ivan-olivera-dev"),
                      commit("2026-11-02T10:00:00Z", "someone-else"),
                      commit("2026-11-03T10:00:00Z", null)
                    ]
                  }
                }
              }
            },
            { defaultBranchRef: null },
            { defaultBranchRef: { target: { history: { nodes: [commit("2026-11-04T10:00:00Z", "Ivan-olivera-dev")] } } } }
          ]
        }
      }
    }
  };
  const fetchMock = t.mock.method(globalThis, "fetch", async () => new Response(JSON.stringify(payload), { status: 200 }));

  const timestamps = await fetchCommitTimestamps("Ivan-olivera-dev", "token", "2025-11-16T00:00:00Z");

  assert.deepEqual(timestamps, ["2026-11-01T10:00:00Z", "2026-11-04T10:00:00Z"]);
  const body = JSON.parse(fetchMock.mock.calls[0].arguments[1]!.body as string);
  assert.ok(body.query.includes("privacy: PUBLIC"), "never counts private repositories");
  assert.ok(body.query.includes("isFork: false"));
  assert.deepEqual(body.variables, { login: "Ivan-olivera-dev", since: "2025-11-16T00:00:00Z" });
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
