import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/* my lucky smiling rock picks fast when the judge feels tired (love, yuna 5) */
type VerifiedImage = { buffer: Buffer; sha256: string; width: number; height: number };

const META = {
  handle: "yukimaruuu",
  asset: "yuna-lucky-smiling-rock.jpg",
  expectedBytes: 188185,
  expectedHash: "2431bf5cff225179173a4b298dbb274f2c73e8aff6d766739f849fc59d3d2a3d",
  targetSide: 1024,
} as const;

function decodeJpegHeader(raw: Buffer): [number, number] {
  const okHeader = raw[0] === 0xff && raw[1] === 0xd8;
  const okFooter = raw[raw.length - 2] === 0xff && raw[raw.length - 1] === 0xd9;
  if (!okHeader || !okFooter) throw new Error("JPEG header/footer invalid");
  let idx = 2;
  while (idx + 4 <= raw.length) {
    while (idx < raw.length && raw[idx] === 0xff) idx++;
    if (idx >= raw.length) break;
    const code = raw[idx++];
    if (code === 0xd9 || code === 0x01 || (code >= 0xd0 && code <= 0xd7)) continue;
    const segLen = raw.readUInt16BE(idx);
    if (code === 0xc0 || code === 0xc2) return [raw.readUInt16BE(idx + 5), raw.readUInt16BE(idx + 3)];
    idx += segLen;
  }
  throw new Error("Missing SOF marker");
}

function verifyArtwork(): VerifiedImage {
  const dir = dirname(fileURLToPath(import.meta.url));
  const loc = [join(dir, META.asset), join("/bot", META.asset)].find((f) => existsSync(f));
  if (!loc) throw new Error(`Cannot locate ${META.asset}`);
  const buffer = readFileSync(loc);
  if (buffer.length !== META.expectedBytes || buffer.length > 1048576) {
    throw new Error(`Invalid byte count: ${buffer.length}`);
  }
  const [width, height] = decodeJpegHeader(buffer);
  if (width !== META.targetSide || height !== META.targetSide) throw new Error(`Bad pixels: ${width}x${height}`);
  const sha256 = createHash("sha256").update(buffer).digest("hex");
  if (sha256 !== META.expectedHash) throw new Error(`Checksum mismatch: ${sha256}`);
  return { buffer, sha256, width, height };
}

const destDir = process.env.MAKEFUN_OUTPUT_DIR || "/output";
mkdirSync(destDir, { recursive: true });
const verified = verifyArtwork();
writeFileSync(join(destDir, "entry.png"), verified.buffer);
if (process.env.MAKEFUN_VERBOSE === "1") {
  console.log(`[${META.handle}] ok ${verified.width}x${verified.height} (${verified.buffer.length}B)`);
}
