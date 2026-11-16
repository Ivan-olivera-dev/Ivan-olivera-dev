import test from "node:test";
import assert from "node:assert/strict";
import { renderHabitsPanel } from "../src/habits-renderer.ts";
import { TOKYO_NIGHT } from "../src/theme.ts";
import type { Habits } from "../src/types.ts";

const byHour = Array<number>(24).fill(0);
byHour[9] = 4;
byHour[22] = 10;
byHour[23] = 6;
const habits: Habits = {
  total: 20,
  byHour,
  byWeekday: [5, 7, 2, 0, 3, 1, 2],
  peakHour: 22,
  peakWeekday: 1,
  timeZone: "Europe/Madrid"
};
const empty: Habits = {
  total: 0,
  byHour: Array(24).fill(0),
  byWeekday: Array(7).fill(0),
  peakHour: null,
  peakWeekday: null,
  timeZone: "Europe/Madrid"
};

/** Visible text content: tags and the style block stripped. */
function visibleText(svg: string): string {
  return svg.replace(/<style>[\s\S]*?<\/style>/, "").replace(/<[^>]+>/g, "");
}

test("S5: renderHabitsPanel emits a self-contained Tokyo Night terminal window", () => {
  const svg = renderHabitsPanel(habits);

  assert.ok(svg.startsWith("<svg") && svg.trimEnd().endsWith("</svg>"));
  assert.ok(svg.includes('xmlns="http://www.w3.org/2000/svg"'));
  assert.ok(svg.includes('width="900"'));
  assert.ok(svg.includes(`fill="${TOKYO_NIGHT.bg}"`), "Tokyo Night background");
  assert.ok(svg.includes("ivan@github: ~ — git habits"), "window title");
  assert.ok(svg.includes("git log --since=1.year --author=ivan | habits"), "prompt line");
  assert.ok(svg.includes("font-variant-ligatures: none"), "ligatures disabled");
  assert.ok(!/JetBrains/.test(svg));
});

test("S5: renderHabitsPanel draws 24 hour columns with block glyphs and hour labels", () => {
  const svg = renderHabitsPanel(habits);

  assert.ok(svg.includes("commits by hour (Europe/Madrid)"));
  const columns = new Set([...svg.matchAll(/data-hour="(\d+)"/g)].map((m) => Number(m[1])));
  assert.deepEqual([...columns].sort((a, b) => a - b), Array.from({ length: 24 }, (_, i) => i));
  assert.match(svg, /[▁▂▃▄▅▆▇█]/);
  for (const label of ["00", "06", "12", "18", "23"]) {
    assert.match(svg, new RegExp(`class="axis"[^>]*>${label}<`), `hour label ${label}`);
  }
  assert.ok(svg.includes(`fill="${TOKYO_NIGHT.purple}"`), "the busiest hour uses the densest theme color");
});

test("S5: renderHabitsPanel lists weekdays Mon..Sun as ASCII bars with their counts", () => {
  const text = visibleText(renderHabitsPanel(habits));

  assert.ok(text.includes("commits by weekday"));
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const positions = days.map((day) => text.indexOf(day));
  assert.ok(positions.every((p) => p >= 0), "every weekday label is present");
  assert.deepEqual([...positions].sort((a, b) => a - b), positions, "Monday first");
  for (const [i, count] of habits.byWeekday.entries()) {
    assert.match(text, new RegExp(`${days[i]}[\\s█░]+${count}\\b`), `${days[i]} shows ${count}`);
  }
  assert.ok(text.includes("░"), "unfilled bar track");
});

test("S5: renderHabitsPanel summarises total, peaks and the chronotype", () => {
  const text = visibleText(renderHabitsPanel(habits));

  assert.ok(text.includes("20 commits"));
  assert.ok(text.includes("busiest day Tue"));
  assert.ok(text.includes("peak 22:00–23:00"));
  assert.ok(text.includes("night owl"));
  assert.ok(visibleText(renderHabitsPanel({ ...habits, peakHour: 7 })).includes("early bird"));
  assert.ok(visibleText(renderHabitsPanel({ ...habits, peakHour: 4 })).includes("night owl"));
  assert.ok(visibleText(renderHabitsPanel({ ...habits, peakHour: 14 })).includes("daytime coder"));
});

test("S5: renderHabitsPanel without commits shows a message and never invents numbers", () => {
  const svg = renderHabitsPanel(empty);
  const text = visibleText(svg).replace("--since=1.year", "");

  assert.ok(text.includes("no public commits in the last year"));
  assert.ok(!/\d/.test(text), "no numbers rendered");
  assert.ok(!svg.includes("data-hour="), "no hour chart");
  assert.ok(!text.includes("night owl") && !text.includes("Mon"));
});

test("renderHabitsPanel escapes text for XML", () => {
  const svg = renderHabitsPanel({ ...habits, timeZone: "A&B<C>" });

  assert.ok(svg.includes("commits by hour (A&amp;B&lt;C&gt;)"));
  assert.ok(!svg.includes("A&B<C>"));
});
