import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fetchProfileData } from "./github-client.ts";
import { renderProfileCard } from "./card-renderer.ts";

async function main() {
  const portrait = (await readFile(resolve(process.cwd(), "assets/portrait.txt"), "utf-8")).replace(/\n+$/, "").split("\n");
  const data = await fetchProfileData();
  const svg = renderProfileCard(data, portrait);

  const outputPath = resolve(process.cwd(), "assets/profile-card.svg");
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, svg, "utf-8");

  console.log(`Generated profile card at ${outputPath}`);
}

main().catch((err) => {
  console.error("Error generating profile card:", err);
  process.exit(1);
});
