// Regenerates assets/portrait.txt from the GitHub avatar (or a local image).
// Run only when the photo changes: `npm run portrait [-- <image-path-or-url>]`.
// Requires ImageMagick (`magick`) on PATH; the daily Action only reads the text file.
import { spawnSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { parsePgm, imageToAscii } from "../src/portrait.ts";

const AVATAR_URL = "https://avatars.githubusercontent.com/u/294240201?v=4&s=460";

// Tuned for the 460px avatar: frame head and collar, drop the empty margins.
const CROP = "330x360+65+55";
const COLUMNS = 66;
const ROWS = 40;
const BACKGROUND_THRESHOLD = 230;

async function loadSource(source: string): Promise<Uint8Array> {
  if (/^https?:\/\//.test(source)) {
    const res = await fetch(source);
    if (!res.ok) throw new Error(`Avatar download failed with HTTP ${res.status}`);
    return new Uint8Array(await res.arrayBuffer());
  }
  return readFile(source);
}

async function main() {
  const source = process.argv[2] ?? AVATAR_URL;
  const input = await loadSource(source);

  const magick = spawnSync(
    "magick",
    ["-", "-crop", CROP, "+repage", "-colorspace", "Gray", "-sigmoidal-contrast", "6x55%",
      "-resize", `${COLUMNS}x${ROWS}!`, "-depth", "8", "pgm:-"],
    { input, maxBuffer: 16 * 1024 * 1024 }
  );
  if (magick.status !== 0) {
    throw new Error(`magick failed: ${magick.stderr?.toString().trim() || magick.error}`);
  }

  const rows = imageToAscii(parsePgm(magick.stdout), { backgroundThreshold: BACKGROUND_THRESHOLD });
  const outputPath = resolve(process.cwd(), "assets/portrait.txt");
  await writeFile(outputPath, `${rows.join("\n")}\n`, "utf-8");
  console.log(`Wrote ${rows.length} rows to ${outputPath}`);
}

main().catch((err) => {
  console.error("Error building portrait:", err instanceof Error ? err.message : err);
  process.exit(1);
});
