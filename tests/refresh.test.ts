import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, readFile, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { refreshCard } from "../src/refresh.ts";
import { PROFILE } from "../src/profile.ts";
import type { ProfileData } from "../src/types.ts";

const live: ProfileData = {
  ...PROFILE,
  stats: { repos: 6, stars: 3, followers: 2, contributions: 63 },
  languages: [{ name: "TypeScript", percentage: 100 }]
};
const offline: ProfileData = {
  ...PROFILE,
  stats: { repos: null, stars: null, followers: null, contributions: null },
  languages: []
};

async function workspace(withCard: boolean) {
  const root = await mkdtemp(join(tmpdir(), "profile-card-"));
  await mkdir(join(root, "assets"));
  await writeFile(join(root, "assets/portrait.txt"), "  @@#*\n", "utf-8");
  if (withCard) await writeFile(join(root, "assets/profile-card.svg"), "<svg>previous live card</svg>", "utf-8");
  return root;
}

test("refreshCard keeps the previous card when GitHub data is unavailable", async (t) => {
  const root = await workspace(true);
  t.after(() => rm(root, { recursive: true, force: true }));
  const logs: string[] = [];

  const outcome = await refreshCard({ root, fetchData: async () => offline, log: (m) => logs.push(m) });

  assert.equal(outcome, "kept");
  assert.equal(await readFile(join(root, "assets/profile-card.svg"), "utf-8"), "<svg>previous live card</svg>");
  assert.deepEqual(logs, ["GitHub data unavailable; keeping the previous profile card."]);
});

test("refreshCard writes a first card even without GitHub data", async (t) => {
  const root = await workspace(false);
  t.after(() => rm(root, { recursive: true, force: true }));

  const outcome = await refreshCard({ root, fetchData: async () => offline, log: () => {} });

  assert.equal(outcome, "written");
  assert.ok(existsSync(join(root, "assets/profile-card.svg")));
  assert.ok((await readFile(join(root, "assets/profile-card.svg"), "utf-8")).includes(">—<"));
});

test("refreshCard overwrites the card when live data is available", async (t) => {
  const root = await workspace(true);
  t.after(() => rm(root, { recursive: true, force: true }));
  const logs: string[] = [];

  const outcome = await refreshCard({ root, fetchData: async () => live, log: (m) => logs.push(m) });
  const svg = await readFile(join(root, "assets/profile-card.svg"), "utf-8");

  assert.equal(outcome, "written");
  assert.ok(svg.startsWith("<svg") && svg.includes(">63<") && svg.includes("TypeScript 100%"));
  assert.deepEqual(logs, [`Generated profile card at ${join(root, "assets/profile-card.svg")}`]);
});

test("S5: refreshCard writes assets/habits.svg from live commit timestamps", async (t) => {
  const root = await workspace(true);
  t.after(() => rm(root, { recursive: true, force: true }));
  await writeFile(join(root, "assets/habits.svg"), "<svg>previous habits</svg>", "utf-8");
  const logs: string[] = [];

  await refreshCard({
    root,
    fetchData: async () => live,
    fetchHabits: async () => ["2026-07-01T20:30:00Z", "2026-07-01T20:45:00Z", "2026-01-15T08:00:00Z"],
    log: (m) => logs.push(m)
  });
  const svg = await readFile(join(root, "assets/habits.svg"), "utf-8");

  assert.ok(svg.startsWith("<svg") && svg.includes("git habits"));
  assert.match(svg, /3<\/tspan> commits/);
  assert.ok(svg.includes("peak <tspan class=\"key\">22:00–23:00"));
  assert.deepEqual(logs, [
    `Generated profile card at ${join(root, "assets/profile-card.svg")}`,
    `Generated habits panel at ${join(root, "assets/habits.svg")}`
  ]);
});

test("S5: refreshCard keeps the previous habits panel when commit data is unavailable", async (t) => {
  const root = await workspace(true);
  t.after(() => rm(root, { recursive: true, force: true }));
  await writeFile(join(root, "assets/habits.svg"), "<svg>previous habits</svg>", "utf-8");
  const logs: string[] = [];

  await refreshCard({ root, fetchData: async () => offline, fetchHabits: async () => [], log: (m) => logs.push(m) });

  assert.equal(await readFile(join(root, "assets/habits.svg"), "utf-8"), "<svg>previous habits</svg>");
  assert.deepEqual(logs, [
    "GitHub data unavailable; keeping the previous profile card.",
    "Commit data unavailable; keeping the previous habits panel."
  ]);
});

test("S5: refreshCard writes a first habits panel without inventing commits", async (t) => {
  const root = await workspace(false);
  t.after(() => rm(root, { recursive: true, force: true }));

  await refreshCard({ root, fetchData: async () => offline, fetchHabits: async () => [], log: () => {} });

  assert.ok((await readFile(join(root, "assets/habits.svg"), "utf-8")).includes("no public commits in the last year"));
});
