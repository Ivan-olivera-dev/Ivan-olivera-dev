import test from "node:test";
import assert from "node:assert/strict";
import { renderProfileCard, TOKYO_NIGHT } from "../src/card-renderer.ts";
import { PROFILE } from "../src/profile.ts";
import type { ProfileData } from "../src/types.ts";

const data: ProfileData = {
  ...PROFILE,
  stats: { repos: 6, stars: 3, followers: 2, contributions: 512 },
  languages: [
    { name: "TypeScript", percentage: 46 },
    { name: "Python", percentage: 31 },
    { name: "Shell", percentage: 23 }
  ]
};

const portrait = ["   .:+", "  @@#*", ""];

test("renderProfileCard emits a self-contained Tokyo Night SVG", () => {
  const svg = renderProfileCard(data, portrait);

  assert.ok(svg.startsWith("<svg"), "starts with the svg root");
  assert.ok(svg.trimEnd().endsWith("</svg>"), "closes the svg root");
  assert.ok(svg.includes('xmlns="http://www.w3.org/2000/svg"'));
  assert.ok(svg.includes(`fill="${TOKYO_NIGHT.bg}"`), "uses the Tokyo Night background");
  assert.equal(TOKYO_NIGHT.bg, "#1a1b26");
});

test("renderProfileCard paints the ASCII portrait with the theme gradient by glyph density", () => {
  const svg = renderProfileCard(data, portrait);

  assert.match(svg, new RegExp(`<tspan fill="${TOKYO_NIGHT.purple}">@@</tspan>`), "densest glyphs use purple");
  assert.match(svg, new RegExp(`<tspan fill="${TOKYO_NIGHT.cyan}">\\.</tspan>`), "lightest glyphs use cyan");
  assert.ok(svg.includes('xml:space="preserve"'), "leading spaces keep the portrait aligned");
});

test("renderProfileCard integrates the focus areas and links into the card (S4)", () => {
  const svg = renderProfileCard(data, portrait);

  for (const text of [
    "Agentic Workflows &amp; ODD",
    "Backend &amp; Core Services",
    "ivanolivera.dev",
    "card.ivanolivera.dev",
    "linkedin.com/in/ivan-olivera-gonzalez",
    "ivanoliveradev@gmail.com"
  ]) {
    assert.ok(svg.includes(text), `card should include ${text}`);
  }
});

test("renderProfileCard shows live stats and language shares", () => {
  const svg = renderProfileCard(data, portrait);

  assert.match(svg, />6</);
  assert.match(svg, />512</);
  assert.ok(svg.includes("TypeScript 46%"));
  assert.ok(svg.includes("Shell 23%"));
});

test("renderProfileCard shows a dash instead of invented numbers when stats are unavailable", () => {
  const svg = renderProfileCard(
    { ...data, stats: { repos: null, stars: null, followers: null, contributions: null }, languages: [] },
    portrait
  );

  assert.ok(svg.includes(">—<"), "unavailable stats render as an em dash");
  assert.ok(!svg.includes(">12<") && !svg.includes(">480<"), "no hardcoded fallback numbers");
  assert.ok(svg.includes("no data yet"), "empty languages are stated, not invented");
});

test("renderProfileCard escapes XML special characters in profile text", () => {
  const svg = renderProfileCard({ ...data, role: "Engineer <Core & Security>" }, ["<&>"]);

  assert.ok(svg.includes("Engineer &lt;Core &amp; Security&gt;"));
  assert.ok(!svg.includes("<Core"));
  assert.ok(!svg.includes("<&>"));
});
