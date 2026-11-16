import test from "node:test";
import assert from "node:assert/strict";
import { TOKYO_NIGHT, escapeXml, mixHex, gradientColor, MONO_FONT, TEXT_STYLE, renderWindow } from "../src/theme.ts";

test("S6: escapeXml escapes the five XML special characters", () => {
  assert.equal(escapeXml(`a & b < c > d " e ' f`), "a &amp; b &lt; c &gt; d &quot; e &apos; f");
  assert.equal(escapeXml("&lt;"), "&amp;lt;", "ampersand is escaped first, so entities are not reused");
  assert.equal(escapeXml("plain"), "plain");
});

test("S6: mixHex returns the endpoints at 0 and 1 and the channel midpoint at 0.5", () => {
  assert.equal(mixHex("#000000", "#ffffff", 0), "#000000");
  assert.equal(mixHex("#000000", "#ffffff", 1), "#ffffff");
  assert.equal(mixHex("#000000", "#ffffff", 0.5), "#808080");
  assert.equal(mixHex("#102030", "#305070", 0.5), "#203850");
});

test("S2: gradientColor maps level 0/0.5/1 onto the cyan/blue/purple Tokyo Night stops", () => {
  assert.equal(gradientColor(0), TOKYO_NIGHT.cyan);
  assert.equal(gradientColor(0.5), TOKYO_NIGHT.blue);
  assert.equal(gradientColor(1), TOKYO_NIGHT.purple);
});

test("S2: the Tokyo Night palette keeps its background and the font stack disables ligatures", () => {
  assert.equal(TOKYO_NIGHT.bg, "#1a1b26");
  assert.ok(MONO_FONT.startsWith("ui-monospace"));
  assert.ok(!MONO_FONT.includes("JetBrains"), "JetBrains Mono stays out of the stack");
  assert.ok(TEXT_STYLE.includes(`font-family: ${MONO_FONT};`));
  assert.ok(TEXT_STYLE.includes("font-variant-ligatures: none;"));
  assert.ok(TEXT_STYLE.includes(`font-feature-settings: "liga" 0, "calt" 0;`));
});

test("S2: renderWindow draws Tokyo Night chrome around the content with an escaped title", () => {
  const svg = renderWindow(300, 200, `a<b> & "c"`, "<text>body</text>");

  assert.ok(svg.includes(`<clipPath id="window"><rect width="300" height="200" rx="12"/></clipPath>`));
  assert.ok(svg.includes(`<rect width="300" height="200" fill="${TOKYO_NIGHT.bg}"/>`), "Tokyo Night background");
  assert.ok(svg.includes(`<rect width="300" height="36" fill="${TOKYO_NIGHT.bgDark}"/>`), "title bar");
  for (const color of [TOKYO_NIGHT.red, TOKYO_NIGHT.yellow, TOKYO_NIGHT.green]) {
    assert.ok(svg.includes(`r="6" fill="${color}"`), `window dot ${color}`);
  }
  assert.ok(svg.includes(`>a&lt;b&gt; &amp; &quot;c&quot;</text>`), "title is escaped");
  assert.ok(svg.includes(`x="150" y="23" text-anchor="middle"`), "title is centred");
  assert.ok(svg.includes(`stroke="${TOKYO_NIGHT.border}"`), "border");
  assert.ok(svg.indexOf("<text>body</text>") > svg.indexOf("text-anchor"), "content sits after the title");
  assert.ok(svg.indexOf("<text>body</text>") < svg.indexOf("</g>"), "content is clipped to the window");
});
