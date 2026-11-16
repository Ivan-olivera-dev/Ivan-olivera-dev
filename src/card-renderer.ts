import { glyphLevel } from "./portrait.ts";
import { TOKYO_NIGHT, TEXT_STYLE, escapeXml, gradientColor, renderWindow } from "./theme.ts";
import type { ProfileData } from "./types.ts";

export { TOKYO_NIGHT };

const T = TOKYO_NIGHT;
const WIDTH = 900;
const HEIGHT = 470;
const PORTRAIT_X = 28;
const PORTRAIT_Y = 72;
const PORTRAIT_LINE = 9.4;
const INFO_X = 420;
const INFO_Y = 70;
const INFO_LINE = 21;
const BAR_WIDTH = 300;
const LANGUAGE_COLORS = [T.blue, T.yellow, T.green, T.purple, T.cyan, T.red];

function renderPortraitRow(row: string, index: number): string {
  let body = "";
  let run = "";
  let runColor: string | null = null;

  const flush = () => {
    if (!run) return;
    body += runColor ? `<tspan fill="${runColor}">${escapeXml(run)}</tspan>` : run;
    run = "";
  };

  for (const glyph of row) {
    const level = glyphLevel(glyph);
    const color = level === 0 ? null : gradientColor(level);
    if (color !== runColor) {
      flush();
      runColor = color;
    }
    run += level === 0 ? " " : glyph;
  }
  flush();

  const y = (PORTRAIT_Y + index * PORTRAIT_LINE).toFixed(1);
  return `<text class="ascii" x="${PORTRAIT_X}" y="${y}" xml:space="preserve">${body}</text>`;
}

function stat(value: number | null): string {
  return value === null ? "—" : String(value);
}

function field(label: string, value: string): string {
  return `<tspan class="key">${escapeXml(label)}</tspan><tspan class="sep">: </tspan>${escapeXml(value)}`;
}

function renderLanguages(data: ProfileData, y: number): string {
  if (data.languages.length === 0) {
    return `<text class="info" x="${INFO_X}" y="${y}">${field("Langs", "no data yet")}</text>`;
  }

  let x = INFO_X + 64;
  const segments = data.languages.map((lang, i) => {
    const width = (lang.percentage / 100) * BAR_WIDTH;
    const rect = `<rect x="${x.toFixed(1)}" y="${y - 10}" width="${width.toFixed(1)}" height="10" fill="${LANGUAGE_COLORS[i % LANGUAGE_COLORS.length]}"/>`;
    x += width;
    return rect;
  });

  const legend = data.languages
    .map((lang, i) => `<tspan fill="${LANGUAGE_COLORS[i % LANGUAGE_COLORS.length]}">● </tspan><tspan>${escapeXml(`${lang.name} ${lang.percentage}%`)}</tspan>`)
    .join("<tspan>  </tspan>");

  return [
    `<text class="info" x="${INFO_X}" y="${y}"><tspan class="key">Langs</tspan><tspan class="sep">:</tspan></text>`,
    `<g clip-path="url(#bar)">${segments.join("")}</g>`,
    `<clipPath id="bar"><rect x="${INFO_X + 64}" y="${y - 10}" width="${BAR_WIDTH}" height="10" rx="5"/></clipPath>`,
    `<text class="legend" x="${INFO_X}" y="${y + INFO_LINE}" xml:space="preserve">${legend}</text>`
  ].join("\n    ");
}

function renderInfo(data: ProfileData): string {
  const lines: string[] = [];
  let y = INFO_Y;
  const next = () => (y += INFO_LINE);
  const text = (content: string, cls = "info") => {
    lines.push(`<text class="${cls}" x="${INFO_X}" y="${y}" xml:space="preserve">${content}</text>`);
    next();
  };

  text(
    `<tspan class="user">${escapeXml(data.handle)}</tspan><tspan class="sep">@</tspan><tspan class="host">${escapeXml(data.username)}</tspan>`
  );
  text("─".repeat(28), "rule");
  text(field("Name", data.name));
  text(field("Role", data.role));
  text(field("Company", data.company));
  text(field("Location", data.location));
  text(field("Uptime", data.uptime));
  text(field("Stack", data.stack));
  for (const item of data.focus) {
    text(`${field("Focus", item.title)}<tspan class="dim">  ${escapeXml(item.detail)}</tspan>`);
  }

  const { repos, stars, followers, contributions } = data.stats;
  text(
    [
      ["Repos", repos],
      ["Stars", stars],
      ["Followers", followers],
      ["Contribs", contributions]
    ]
      .map(([label, value]) => `<tspan class="key">${label}</tspan><tspan class="sep"> </tspan><tspan>${stat(value as number | null)}</tspan>`)
      .join(`<tspan class="dim">  ·  </tspan>`)
  );

  lines.push(renderLanguages(data, y));
  next();
  if (data.languages.length > 0) next();

  for (const link of data.links) text(field(link.label, link.value));

  const palette = [T.bgDark, T.red, T.green, T.yellow, T.blue, T.purple, T.cyan, T.fg];
  lines.push(
    palette
      .map((color, i) => `<rect x="${INFO_X + i * 28}" y="${y - 12}" width="28" height="16" fill="${color}"/>`)
      .join("")
  );
  next();
  lines.push(
    `<text class="info" x="${INFO_X}" y="${y}"><tspan class="prompt">❯</tspan><tspan class="sep"> </tspan><tspan class="cursor">█</tspan></text>`
  );

  return lines.join("\n    ");
}

export function renderProfileCard(data: ProfileData, portrait: string[]): string {
  const rows = portrait.map(renderPortraitRow).join("\n    ");

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${WIDTH} ${HEIGHT}" width="${WIDTH}" height="${HEIGHT}" role="img" aria-label="${escapeXml(`${data.name} — ${data.role}`)}">
  <style>
    ${TEXT_STYLE}
    .ascii { font-size: 8.6px; }
    .info { font-size: 13px; fill: ${T.fg}; }
    .legend { font-size: 12px; fill: ${T.fg}; }
    .rule { font-size: 13px; fill: ${T.comment}; }
    .key { fill: ${T.blue}; font-weight: 700; }
    .sep, .dim { fill: ${T.comment}; }
    .user { fill: ${T.blue}; font-weight: 700; }
    .host { fill: ${T.purple}; font-weight: 700; }
    .prompt { fill: ${T.green}; font-weight: 700; }
    .title { font-size: 12px; fill: ${T.comment}; }
    .cursor { fill: ${T.fg}; animation: blink 1.1s steps(1) infinite; }
    @keyframes blink { 50% { opacity: 0; } }
  </style>
  ${renderWindow(WIDTH, HEIGHT, `${data.handle}@github: ~ — fastfetch`, [rows, renderInfo(data)].join("\n    "))}
</svg>
`;
}
