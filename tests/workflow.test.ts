import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const workflow = readFileSync(".github/workflows/metrics.yml", "utf8");

const count = (needle: string): number => workflow.split(needle).length - 1;

test("S3: lowlighter renders the chosen blocks with METRICS_TOKEN and Tokyo Night CSS", () => {
  for (const plugin of ["plugin_isocalendar: yes", "plugin_languages: yes"]) {
    assert.ok(workflow.includes(plugin), `missing ${plugin}`);
  }
  assert.ok(workflow.includes("config_order: isocalendar, languages\n"));
  // Broken upstream: PushEvent payloads lost `commits` and Projects (classic) was sunset (lowlighter#1706).
  for (const broken of ["plugin_habits", "plugin_achievements", "plugin_activity"]) {
    assert.ok(!workflow.includes(broken), `${broken} renders an "Unexpected error" block`);
  }
  assert.ok(workflow.includes("token: ${{ secrets.METRICS_TOKEN }}"));
  const css = workflow.slice(workflow.indexOf("extras_css:"));
  assert.ok(workflow.includes("extras_css:"));
  assert.ok(css.includes("#1a1b26"));
});

test("generated assets never retrigger the workflow", () => {
  const start = workflow.indexOf("paths:");
  const end = workflow.indexOf("permissions:");
  assert.ok(start >= 0 && end > start);
  const paths = workflow.slice(start, end);
  for (const generated of ["assets/**", "profile-card.svg", "metrics.svg"]) {
    assert.ok(!paths.includes(generated), `paths must not include ${generated}`);
  }
  assert.equal(count("[skip ci]"), 2);
});

test("the METRICS_TOKEN PAT is scoped to the gate and lowlighter steps", () => {
  assert.equal(count("secrets.METRICS_TOKEN"), 2);
  assert.ok(!workflow.includes("METRICS_TOKEN: ${{"), "no job-level METRICS_TOKEN env");
});

test("lowlighter/metrics is pinned to a commit SHA", () => {
  assert.match(workflow, /lowlighter\/metrics@[0-9a-f]{40}/);
  assert.ok(!workflow.includes("@latest"));
});

test("the card push rebases before pushing", () => {
  const pull = workflow.indexOf("git pull --rebase");
  const push = workflow.indexOf("git push");
  assert.ok(pull >= 0, "git pull --rebase missing");
  assert.ok(pull < push, "git pull --rebase must precede git push");
});

test("S5: the card push step also commits assets/habits.svg", () => {
  const start = workflow.indexOf("- name: Commit and Push Profile Card & Habits");
  const end = workflow.indexOf("- name:", start + 1);
  assert.ok(start >= 0 && end > start);
  const step = workflow.slice(start, end);
  assert.ok(step.includes("git status --porcelain assets/profile-card.svg assets/habits.svg"), "checks both assets");
  assert.ok(step.includes("git add assets/profile-card.svg assets/habits.svg"), "stages both assets");
  assert.ok(step.indexOf("git add") < step.indexOf("git commit"));
});

test("S6: the card push commit message names both generated assets", () => {
  const start = workflow.indexOf("- name: Commit and Push Profile Card & Habits");
  const end = workflow.indexOf("- name:", start + 1);
  assert.ok(start >= 0 && end > start, "step is named after both assets");
  const step = workflow.slice(start, end);
  assert.ok(step.includes('git commit -m "chore(profile): refresh card and habits [skip ci]"'));
  assert.ok(!workflow.includes("chore(card): refresh profile card"));
});
