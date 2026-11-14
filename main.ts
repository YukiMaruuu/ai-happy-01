import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";

// Entry: my lucky smiling rock will help you pick fast when your eyes feel sleepy (love, yuna 5)
const CONFIG = {
  filename: "yuna-lucky-smiling-rock.jpg",
  expectedBytes: 207376,
  expectedSha256: "38968e39de0e1aef9699905e06455ca5594f51745505ab58bb166515404ce3a1",
  tag: "yukimaruuu",
} as const;

function verifyJpegHeaders(buf: Buffer): void {
  if (buf.length < 4 || buf[0] !== 0xff || buf[1] !== 0xd8 || buf[buf.length - 2] !== 0xff || buf[buf.length - 1] !== 0xd9) {
    throw new Error("Invalid JPEG SOI/EOI boundary");
  }
  let pos = 2;
  let found = false;
  while (pos + 4 <= buf.length) {
    while (pos < buf.length && buf[pos] === 0xff) pos++;
    if (pos >= buf.length) break;
    const marker = buf[pos++];
    if (marker === 0xd9 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
    const len = buf.readUInt16BE(pos);
    if (marker === 0xc0 || marker === 0xc2) {
      const h = buf.readUInt16BE(pos + 3);
      const w = buf.readUInt16BE(pos + 5);
      if (w !== 1024 || h !== 1024) throw new Error(`Unexpected dimensions: ${w}x${h}`);
      found = true;
      break;
    }
    pos += len;
  }
  if (!found) throw new Error("SOF frame not found");
}

function execute(): void {
  const dir = dirname(fileURLToPath(import.meta.url));
  const candidates = [join(dir, CONFIG.filename), join("/bot", CONFIG.filename)];
  const filePath = candidates.find((p) => existsSync(p));
  if (!filePath) throw new Error(`Asset not located: ${CONFIG.filename}`);

  const bytes = readFileSync(filePath);
  if (bytes.length !== CONFIG.expectedBytes) {
    throw new Error(`Length mismatch: ${bytes.length} vs ${CONFIG.expectedBytes}`);
  }
  verifyJpegHeaders(bytes);
  const hash = createHash("sha256").update(bytes).digest("hex");
  if (hash !== CONFIG.expectedSha256) {
    throw new Error(`Digest mismatch: ${hash} vs ${CONFIG.expectedSha256}`);
  }

  const targetDir = process.env.MAKEFUN_OUTPUT_DIR || "/output";
  mkdirSync(targetDir, { recursive: true });
  writeFileSync(join(targetDir, "entry.png"), bytes);
}

execute();
