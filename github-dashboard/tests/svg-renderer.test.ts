import test from "node:test";
import assert from "node:assert/strict";
import { renderTelemetrySvg } from "../src/svg-renderer.ts";
import { fetchSystemMetrics } from "../src/github-client.ts";
import type { SystemMetrics } from "../src/types.ts";

const mockMetrics: SystemMetrics = {
  username: "Ivan-olivera-dev",
  name: "Iván Olivera González",
  role: "Software Engineer — Backend, Systems & Agentic Workflows",
  location: "Valencia, ES",
  website: "ivanolivera.dev",
  cardUrl: "card.ivanolivera.dev",
  summaryLines: [
    "Designing and building backend services,",
    "system architectures, and practical",
    "multi-agent development workflows."
  ],
  environment: "Node.js · TypeScript · Python · Docker · Linux",
  totalRepos: 12,
  totalContributions: 480,
  languages: [
    { name: "TypeScript & Node.js", percentage: 44, color: "#10b981" },
    { name: "Python", percentage: 26, color: "#34d399" },
    { name: "Linux & Shell (Bash)", percentage: 18, color: "#6ee7b7" },
    { name: "Java", percentage: 12, color: "#52525b" }
  ],
  currentWork: [
    {
      title: "Agentic Workflows & ODD",
      subtitle: "Organic-driven dev & tooling"
    },
    {
      title: "Backend & Systems",
      subtitle: "APIs, Docker infra & Linux"
    }
  ]
};

test("renderTelemetrySvg generates well-formed SVG with editorial dimensions", () => {
  const svg = renderTelemetrySvg(mockMetrics);

  assert.ok(svg.startsWith("<svg"), "SVG should start with <svg root tag");
  assert.ok(svg.endsWith("</svg>"), "SVG should close with </svg>");
  assert.ok(svg.includes('xmlns="http://www.w3.org/2000/svg"'), "SVG should include xmlns namespace");
  assert.ok(svg.includes('viewBox="0 0 860 410"'), "SVG should have 860x410 viewBox");
});

test("renderTelemetrySvg includes ODD topology, animations, and dark aesthetic", () => {
  const svg = renderTelemetrySvg(mockMetrics);

  assert.ok(svg.includes("#0a0a0a"), "SVG should use #0a0a0a dark background matching TarjetaVisita");
  assert.ok(svg.includes("#10b981"), "SVG should include emerald accent color (#10b981)");
  assert.ok(svg.includes("ODD"), "SVG should include ODD node in architecture flow");
  assert.ok(svg.includes("Agentic Workflows &amp; ODD"), "SVG should include ODD current work item");
  assert.ok(svg.includes("DEVELOPMENT CADENCE"), "SVG should include sparkline section");
  assert.ok(!svg.includes("SDD"), "SVG should not reference SDD");
});

test("renderTelemetrySvg properly escapes XML special characters", () => {
  const dangerousMetrics: SystemMetrics = {
    ...mockMetrics,
    role: "Engineer <Core & Security>",
    location: 'Valencia "ES" & EU'
  };

  const svg = renderTelemetrySvg(dangerousMetrics);
  assert.ok(svg.includes("Engineer &lt;Core &amp; Security&gt;"), "Special chars in role should be escaped");
  assert.ok(svg.includes("Valencia &quot;ES&quot; &amp; EU"), "Special chars in location should be escaped");
  assert.ok(!svg.includes("<Core"), "Raw unescaped < tag should not exist in text");
});

test("fetchSystemMetrics returns fallback data with ODD when no token is present", async () => {
  const metrics = await fetchSystemMetrics("Ivan-olivera-dev", "");

  assert.equal(metrics.username, "Ivan-olivera-dev");
  assert.equal(metrics.name, "Iván Olivera González");
  assert.ok(metrics.currentWork.some((w) => w.title.includes("ODD")), "currentWork should reference ODD");
});
