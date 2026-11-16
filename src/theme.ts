/** Shared Tokyo Night look for every generated SVG: palette, text helpers, gradient and window chrome. */
export const TOKYO_NIGHT = {
  bg: "#1a1b26",
  bgDark: "#16161e",
  border: "#292e42",
  fg: "#c0caf5",
  comment: "#565f89",
  blue: "#7aa2f7",
  cyan: "#7dcfff",
  purple: "#bb9af7",
  green: "#9ece6a",
  yellow: "#e0af68",
  orange: "#ff9e64",
  red: "#f7768e"
} as const;

const T = TOKYO_NIGHT;
const GRADIENT_STEPS = 5;

/** Monospace stack without JetBrains Mono: its ligatures break ASCII art. */
export const MONO_FONT = `ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace`;

/** Base `text` rule: monospace, preserved whitespace and ligatures disabled. */
export const TEXT_STYLE = `text { font-family: ${MONO_FONT}; white-space: pre; font-variant-ligatures: none; font-feature-settings: "liga" 0, "calt" 0; }`;

export function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function mixHex(from: string, to: string, t: number): string {
  const channel = (hex: string, i: number) => parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16);
  return `#${[0, 1, 2]
    .map((i) => Math.round(channel(from, i) + (channel(to, i) - channel(from, i)) * t).toString(16).padStart(2, "0"))
    .join("")}`;
}

/** Theme gradient in five steps: level 0 is cyan, mid levels blue, level 1 purple. */
export function gradientColor(level: number): string {
  const step = Math.min(GRADIENT_STEPS - 1, Math.floor(level * GRADIENT_STEPS));
  const t = step / (GRADIENT_STEPS - 1);
  return t <= 0.5 ? mixHex(T.cyan, T.blue, t * 2) : mixHex(T.blue, T.purple, (t - 0.5) * 2);
}

/** Terminal window chrome (clip, background, title bar, dots, title, border) wrapped around `content`. */
export function renderWindow(width: number, height: number, title: string, content: string): string {
  return `<clipPath id="window"><rect width="${width}" height="${height}" rx="12"/></clipPath>
  <g clip-path="url(#window)">
    <rect width="${width}" height="${height}" fill="${T.bg}"/>
    <rect width="${width}" height="36" fill="${T.bgDark}"/>
    <circle cx="20" cy="18" r="6" fill="${T.red}"/>
    <circle cx="40" cy="18" r="6" fill="${T.yellow}"/>
    <circle cx="60" cy="18" r="6" fill="${T.green}"/>
    <text class="title" x="${width / 2}" y="23" text-anchor="middle">${escapeXml(title)}</text>
    ${content}
  </g>
  <rect x="0.5" y="0.5" width="${width - 1}" height="${height - 1}" rx="12" fill="none" stroke="${T.border}"/>`;
}
