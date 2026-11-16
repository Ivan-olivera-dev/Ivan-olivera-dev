/** Glyphs ordered from densest (darkest pixel) to blank (background). */
export const DEFAULT_RAMP = "@%#*+=-:. ";

export interface GrayImage {
  width: number;
  height: number;
  pixels: Uint8Array;
}

export interface AsciiOptions {
  ramp?: string;
  /** Pixels at or above this luminance are treated as background and left blank. */
  backgroundThreshold?: number;
}

/** Parses a binary (P5) 8-bit PGM, the format `magick ... pgm:-` emits. */
export function parsePgm(data: Uint8Array): GrayImage {
  const tokens: string[] = [];
  let offset = 0;

  while (tokens.length < 4 && offset < data.length) {
    const byte = data[offset];
    if (byte === 0x23) {
      // "#" comment runs until the end of the line.
      while (offset < data.length && data[offset] !== 0x0a) offset++;
    } else if (byte === 0x20 || byte === 0x09 || byte === 0x0a || byte === 0x0d) {
      offset++;
    } else {
      let token = "";
      while (offset < data.length && ![0x20, 0x09, 0x0a, 0x0d].includes(data[offset])) {
        token += String.fromCharCode(data[offset++]);
      }
      tokens.push(token);
    }
  }

  if (tokens[0] !== "P5") {
    throw new Error("Unsupported PGM: expected binary P5 header");
  }

  const width = Number(tokens[1]);
  const height = Number(tokens[2]);
  const maxval = Number(tokens[3]);
  if (!Number.isInteger(width) || !Number.isInteger(height) || maxval !== 255) {
    throw new Error("Unsupported PGM: expected integer size and maxval 255");
  }

  // Exactly one whitespace byte separates the header from the raster.
  const pixels = data.subarray(offset + 1);
  const expected = width * height;
  if (pixels.length < expected) {
    throw new Error(`Truncated PGM: expected ${expected} pixels, got ${pixels.length}`);
  }

  return { width, height, pixels: pixels.subarray(0, expected) };
}

/** Maps each pixel to a glyph; background pixels become spaces and trailing blanks are trimmed. */
export function imageToAscii(img: GrayImage, options: AsciiOptions = {}): string[] {
  const ramp = options.ramp ?? DEFAULT_RAMP;
  const threshold = options.backgroundThreshold ?? 235;
  const rows: string[] = [];

  for (let y = 0; y < img.height; y++) {
    let row = "";
    for (let x = 0; x < img.width; x++) {
      const luminance = img.pixels[y * img.width + x];
      row +=
        luminance >= threshold
          ? " "
          : ramp[Math.floor((luminance / threshold) * (ramp.length - 1))];
    }
    rows.push(row.trimEnd());
  }

  return rows;
}

/** Density of a glyph: 0 for blank or unknown, 1 for the densest glyph in the ramp. */
export function glyphLevel(glyph: string, ramp = DEFAULT_RAMP): number {
  const index = ramp.indexOf(glyph);
  if (glyph === " " || index < 0) return 0;
  return 1 - index / (ramp.length - 1);
}
