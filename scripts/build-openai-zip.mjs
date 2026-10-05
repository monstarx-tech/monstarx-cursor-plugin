#!/usr/bin/env node
// Build the ZIP uploaded at https://platform.openai.com/plugins (Upload new or existing plugin).
//
//   node scripts/build-openai-zip.mjs [--out path/to/file.zip] [--release]
//
// The ZIP holds only the portable Agent Plugins package, with plugin.json at the archive root:
//   plugin.json, mcp.json, skills/, assets/, LICENSE, README.md
// Cursor-only files (.cursor-plugin/, mcp.cursor.json), scripts/, docs/ (reviewer notes), .git and any
// .env / key material are never included. The build fails if the staged package does not pass the
// OpenAI checks or if anything looks like a secret. Entries use a fixed timestamp so rebuilding the
// same commit yields the same bytes.

import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import zlib from "node:zlib";
import { checkOpenAIPackage } from "./openai-checks.mjs";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const INCLUDE = ["plugin.json", "mcp.json", "skills", "assets", "LICENSE", "README.md"];
const FORBIDDEN_NAME = /(^|\/)(\.git|\.env(\..*)?|\.DS_Store|node_modules|.*\.pem|.*\.key|id_rsa.*|\.npmrc|\.netrc)(\/|$)/i;
const SECRET_PATTERNS = [
  [/sk_live_[0-9A-Za-z]{8,}/, "Stripe live key"],
  [/sk-[A-Za-z0-9_-]{20,}/, "OpenAI-style secret key"],
  [/gh[pousr]_[A-Za-z0-9]{20,}/, "GitHub token"],
  [/xox[abpr]-[A-Za-z0-9-]{10,}/, "Slack token"],
  [/AKIA[0-9A-Z]{16}/, "AWS access key"],
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----/, "private key"],
  [/Bearer\s+(?!YOUR_API_KEY\b)[A-Za-z0-9._~+/-]{20,}/, "bearer token"],
  [/"(test_credentials|reviewer_instructions|password)"\s*:/i, "credential field"],
];

const args = process.argv.slice(2);
const release = args.includes("--release");
const outIndex = args.indexOf("--out");

async function walk(dir, base = "") {
  const out = [];
  for (const e of (await fs.readdir(dir, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
    const rel = base ? `${base}/${e.name}` : e.name;
    if (e.isSymbolicLink()) throw new Error(`Symlinks are not allowed in the package: ${rel}`);
    if (e.isDirectory()) out.push(...(await walk(path.join(dir, e.name), rel)));
    else if (e.isFile()) out.push(rel);
  }
  return out;
}

// ── minimal deterministic ZIP writer (deflate, no extra fields) ──
const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
const DOS_TIME = (12 << 11) | (0 << 5) | 0; // 12:00:00
const DOS_DATE = ((2026 - 1980) << 9) | (1 << 5) | 1; // 2026-01-01
function buildZip(entries) {
  const locals = [];
  const centrals = [];
  let offset = 0;
  for (const { name, data } of entries) {
    const nameBuf = Buffer.from(name, "utf8");
    const deflated = zlib.deflateRawSync(data, { level: 9 });
    const useDeflate = deflated.length < data.length;
    const body = useDeflate ? deflated : data;
    const crc = crc32(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6); // UTF-8 names
    local.writeUInt16LE(useDeflate ? 8 : 0, 8);
    local.writeUInt16LE(DOS_TIME, 10);
    local.writeUInt16LE(DOS_DATE, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(body.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    local.writeUInt16LE(0, 28);
    locals.push(local, nameBuf, body);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE((3 << 8) | 20, 4); // made by Unix
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(useDeflate ? 8 : 0, 10);
    central.writeUInt16LE(DOS_TIME, 12);
    central.writeUInt16LE(DOS_DATE, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(body.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(nameBuf.length, 28);
    central.writeUInt32LE(((0o100644 << 16) >>> 0), 38); // regular file, rw-r--r--
    central.writeUInt32LE(offset, 42);
    centrals.push(central, nameBuf);
    offset += 30 + nameBuf.length + body.length;
  }
  const centralBuf = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralBuf.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, centralBuf, end]);
}

async function main() {
  const manifest = JSON.parse(await fs.readFile(path.join(root, "plugin.json"), "utf8"));
  const outPath = outIndex >= 0 ? path.resolve(args[outIndex + 1]) : path.join(root, "dist", `monstarx-openai-plugin-${manifest.version}.zip`);

  // Stage exactly the files that go into the ZIP, then validate the staged copy.
  const stage = await fs.mkdtemp(path.join(os.tmpdir(), "monstarx-openai-zip-"));
  const files = [];
  for (const item of INCLUDE) {
    const src = path.join(root, item);
    const st = await fs.stat(src).catch(() => null);
    if (!st) throw new Error(`Missing package path: ${item}`);
    const rels = st.isDirectory() ? (await walk(src)).map((r) => `${item}/${r}`) : [item];
    for (const rel of rels) {
      if (FORBIDDEN_NAME.test(rel)) throw new Error(`Refusing to package ${rel}`);
      await fs.mkdir(path.dirname(path.join(stage, rel)), { recursive: true });
      await fs.copyFile(path.join(root, rel), path.join(stage, rel));
      files.push(rel);
    }
  }
  files.sort();

  const problems = [];
  for (const rel of files) {
    const content = await fs.readFile(path.join(stage, rel), "utf8").catch(() => "");
    for (const [re, label] of SECRET_PATTERNS) if (re.test(content)) problems.push(`${rel}: looks like a ${label}`);
  }
  const { errors, warnings } = await checkOpenAIPackage(stage, { release });
  warnings.forEach((w) => console.log(`warning: ${w}`));
  if (errors.length || problems.length) {
    [...errors, ...problems].forEach((e) => console.error(`error: ${e}`));
    await fs.rm(stage, { recursive: true, force: true });
    process.exit(1);
  }

  const entries = [];
  for (const rel of files) entries.push({ name: rel, data: await fs.readFile(path.join(stage, rel)) });
  const zip = buildZip(entries);
  await fs.mkdir(path.dirname(outPath), { recursive: true });
  await fs.writeFile(outPath, zip);
  await fs.rm(stage, { recursive: true, force: true });

  console.log(`Built ${outPath} (${zip.length} bytes, ${files.length} files):`);
  files.forEach((f) => console.log(`  ${f}`));
}

main().catch((e) => { console.error(`error: ${e.message}`); process.exit(1); });
