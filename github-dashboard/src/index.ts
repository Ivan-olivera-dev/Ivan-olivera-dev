import { writeFile, mkdir } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fetchSystemMetrics } from "./github-client.ts";
import { renderTelemetrySvg } from "./svg-renderer.ts";

async function main() {
  const metrics = await fetchSystemMetrics("Ivan-olivera-dev");
  const svgContent = renderTelemetrySvg(metrics);

  const outputPath = resolve(process.cwd(), "assets/profile-telemetry.svg");
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, svgContent, "utf-8");

  console.log(`Generated profile SVG at ${outputPath}`);
}

main().catch((err) => {
  console.error("Error generating profile SVG:", err);
  process.exit(1);
});
