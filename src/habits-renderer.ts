import { TOKYO_NIGHT, TEXT_STYLE, escapeXml, gradientColor, renderWindow } from "./theme.ts";
import { PROFILE } from "./profile.ts";
import type { Habits } from "./types.ts";

const T = TOKYO_NIGHT;
const WIDTH = 900;
const HEIGHT = 330;
const LEFT = 28;
const PROMPT_Y = 68;
const HEADER_Y = 104;
const CHART_TOP = 128;
const CHART_ROWS = 7;
const ROW_HEIGHT = 15;
const COLUMN_WIDTH = 22;
const WEEK_X = 600;
const WEEK_LINE = 19;
const WEEK_BAR = 16;
const FACTS_Y = 268;
const CURSOR_Y = 300;
const BLOCKS = ["▁", "▂", "▃", "▄", "▅", "▆", "▇", "█"];
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const HOUR_LABELS = [0, 6, 12, 18, 23];

const pad = (n: number) => String(n).padStart(2, "0");

function chronotype(hour: number): string {
  if (hour >= 21 || hour <= 4) return "night owl";
  if (hour >= 5 && hour <= 9) return "early bird";
  return "daytime coder";
}

function renderHourChart(habits: Habits): string {
  const max = Math.max(...habits.byHour);
  const levels = CHART_ROWS * BLOCKS.length;
  const parts: string[] = [
    `<text class="head" x="${LEFT}" y="${HEADER_Y}">${escapeXml(`commits by hour (${habits.timeZone})`)}</text>`
  ];

  habits.byHour.forEach((count, hour) => {
    const x = LEFT + hour * COLUMN_WIDTH;
    const height = count > 0 ? Math.max(1, Math.round((count / max) * levels)) : 0;
    const color = gradientColor(count / max);
    const cells: string[] = [];
    for (let row = 0; row < CHART_ROWS; row++) {
      const fill = Math.min(BLOCKS.length, Math.max(0, height - (CHART_ROWS - 1 - row) * BLOCKS.length));
      const y = CHART_TOP + row * ROW_HEIGHT;
      if (fill > 0) {
        cells.push(`<tspan x="${x}" y="${y}" fill="${color}">${BLOCKS[fill - 1].repeat(2)}</tspan>`);
      } else if (row === CHART_ROWS - 1) {
        cells.push(`<tspan x="${x}" y="${y}" class="track">··</tspan>`);
      }
    }
    parts.push(`<text class="bar" data-hour="${hour}">${cells.join("")}</text>`);
  });

  const axisY = CHART_TOP + (CHART_ROWS - 1) * ROW_HEIGHT + 20;
  for (const hour of HOUR_LABELS) {
    parts.push(`<text class="axis" x="${LEFT + hour * COLUMN_WIDTH}" y="${axisY}">${pad(hour)}</text>`);
  }
  return parts.join("\n    ");
}

function renderWeekdays(habits: Habits): string {
  const max = Math.max(...habits.byWeekday);
  const parts: string[] = [`<text class="head" x="${WEEK_X}" y="${HEADER_Y}">commits by weekday</text>`];

  habits.byWeekday.forEach((count, day) => {
    const filled = count > 0 ? Math.max(1, Math.round((count / max) * WEEK_BAR)) : 0;
    const y = CHART_TOP + day * WEEK_LINE;
    parts.push(
      `<text class="info" x="${WEEK_X}" y="${y}" xml:space="preserve"><tspan class="key">${WEEKDAYS[day]}</tspan> ` +
        `<tspan fill="${gradientColor(count / max)}">${"█".repeat(filled)}</tspan>` +
        `<tspan class="track">${"░".repeat(WEEK_BAR - filled)}</tspan> <tspan>${count}</tspan></text>`
    );
  });
  return parts.join("\n    ");
}

function renderFacts(habits: Habits): string {
  const sep = `<tspan class="dim">  ·  </tspan>`;
  const hour = habits.peakHour as number;
  const facts = [
    `<tspan class="key">${habits.total}</tspan> commits`,
    `busiest day <tspan class="key">${WEEKDAYS[habits.peakWeekday as number]}</tspan>`,
    `peak <tspan class="key">${pad(hour)}:00–${pad((hour + 1) % 24)}:00</tspan>`,
    `<tspan class="host">${chronotype(hour)}</tspan>`
  ];
  return `<text class="info" x="${LEFT}" y="${FACTS_Y}" xml:space="preserve"><tspan class="prompt">→</tspan> ${facts.join(sep)}</text>`;
}

export function renderHabitsPanel(habits: Habits): string {
  const handle = PROFILE.handle;
  const body =
    habits.total > 0
      ? [renderHourChart(habits), renderWeekdays(habits), renderFacts(habits)].join("\n    ")
      : `<text class="info" x="${LEFT}" y="${HEADER_Y}"><tspan class="dim">no public commits in the last year</tspan></text>`;
  const cursorY = habits.total > 0 ? CURSOR_Y : HEADER_Y + 32;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${WIDTH} ${HEIGHT}" width="${WIDTH}" height="${HEIGHT}" role="img" aria-label="${escapeXml(`Commit habits of ${handle} by hour and weekday`)}">
  <style>
    ${TEXT_STYLE}
    .info { font-size: 13px; fill: ${T.fg}; }
    .bar { font-size: 13px; }
    .head { font-size: 13px; fill: ${T.cyan}; font-weight: 700; }
    .axis { font-size: 11px; fill: ${T.comment}; }
    .track { fill: ${T.border}; }
    .key { fill: ${T.blue}; font-weight: 700; }
    .dim { fill: ${T.comment}; }
    .host { fill: ${T.purple}; font-weight: 700; }
    .prompt { fill: ${T.green}; font-weight: 700; }
    .title { font-size: 12px; fill: ${T.comment}; }
    .cursor { fill: ${T.fg}; animation: blink 1.1s steps(1) infinite; }
    @keyframes blink { 50% { opacity: 0; } }
  </style>
  ${renderWindow(
    WIDTH,
    HEIGHT,
    `${handle}@github: ~ — git habits`,
    [
      `<text class="info" x="${LEFT}" y="${PROMPT_Y}" xml:space="preserve"><tspan class="prompt">❯</tspan> ${escapeXml(`git log --since=1.year --author=${handle} | habits`)}</text>`,
      body,
      `<text class="info" x="${LEFT}" y="${cursorY}"><tspan class="prompt">❯</tspan><tspan> </tspan><tspan class="cursor">█</tspan></text>`
    ].join("\n    ")
  )}
</svg>
`;
}
