import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { renderProfileCard } from "./card-renderer.ts";
import { aggregateHabits } from "./habits.ts";
import { renderHabitsPanel } from "./habits-renderer.ts";
import type { ProfileData } from "./types.ts";

export interface RefreshOptions {
  root: string;
  fetchData: () => Promise<ProfileData>;
  /** Commit timestamps for the habits panel; when omitted, assets/habits.svg is left untouched. */
  fetchHabits?: () => Promise<string[]>;
  log?: (message: string) => void;
}

function hasLiveStats(data: ProfileData): boolean {
  return Object.values(data.stats).some((value) => value !== null);
}

async function writeAsset(outputPath: string, svg: string): Promise<void> {
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, svg, "utf-8");
}

/** Same rule as the card: without commit data an existing panel is kept, never blanked. */
async function refreshHabits(root: string, fetchHabits: () => Promise<string[]>, log: (message: string) => void) {
  const outputPath = join(root, "assets/habits.svg");
  const timestamps = await fetchHabits();

  if (timestamps.length === 0 && existsSync(outputPath)) {
    log("Commit data unavailable; keeping the previous habits panel.");
    return;
  }

  await writeAsset(outputPath, renderHabitsPanel(aggregateHabits(timestamps)));
  log(`Generated habits panel at ${outputPath}`);
}

/**
 * Renders assets/profile-card.svg (and assets/habits.svg when `fetchHabits` is given). When GitHub
 * data is unavailable and an asset already exists, it is kept so a transient API failure never
 * replaces live numbers.
 */
export async function refreshCard({ root, fetchData, fetchHabits, log = console.log }: RefreshOptions): Promise<"written" | "kept"> {
  const outputPath = join(root, "assets/profile-card.svg");
  const data = await fetchData();
  let outcome: "written" | "kept";

  if (!hasLiveStats(data) && existsSync(outputPath)) {
    log("GitHub data unavailable; keeping the previous profile card.");
    outcome = "kept";
  } else {
    const portrait = (await readFile(join(root, "assets/portrait.txt"), "utf-8")).replace(/\n+$/, "").split("\n");
    await writeAsset(outputPath, renderProfileCard(data, portrait));
    log(`Generated profile card at ${outputPath}`);
    outcome = "written";
  }

  if (fetchHabits) await refreshHabits(root, fetchHabits, log);
  return outcome;
}
