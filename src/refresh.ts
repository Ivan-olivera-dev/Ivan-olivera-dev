import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { renderProfileCard } from "./card-renderer.ts";
import type { ProfileData } from "./types.ts";

export interface RefreshOptions {
  root: string;
  fetchData: () => Promise<ProfileData>;
  log?: (message: string) => void;
}

function hasLiveStats(data: ProfileData): boolean {
  return Object.values(data.stats).some((value) => value !== null);
}

/**
 * Renders assets/profile-card.svg. When GitHub data is unavailable and a card already
 * exists, the previous card is kept so a transient API failure never replaces live numbers.
 */
export async function refreshCard({ root, fetchData, log = console.log }: RefreshOptions): Promise<"written" | "kept"> {
  const outputPath = join(root, "assets/profile-card.svg");
  const data = await fetchData();

  if (!hasLiveStats(data) && existsSync(outputPath)) {
    log("GitHub data unavailable; keeping the previous profile card.");
    return "kept";
  }

  const portrait = (await readFile(join(root, "assets/portrait.txt"), "utf-8")).replace(/\n+$/, "").split("\n");
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, renderProfileCard(data, portrait), "utf-8");
  log(`Generated profile card at ${outputPath}`);
  return "written";
}
