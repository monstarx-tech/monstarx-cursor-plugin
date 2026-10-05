// OpenAI Plugins Directory checks for the portable Agent Plugins package (root plugin.json + mcp.json + skills/).
// Mirrors the published final-submission rules:
//   https://developers.openai.com/plugins/deploy/submission
//   https://developers.openai.com/plugins/deploy/submission-errors
// Used by validate-plugin.mjs (repo) and build-openai-zip.mjs (staged ZIP contents).

import { promises as fs } from "node:fs";
import path from "node:path";

const AGENT_PLUGIN_SCHEMA = "https://agent-plugins.org/schemas/1.0.0/plugin.schema.json";
const AGENT_MCP_SCHEMA = "https://agent-plugins.org/schemas/1.0.0/mcp.schema.json";
const CATEGORIES = new Set([
  "Productivity", "Creativity", "Developer Tools", "Business & Operations", "Data & Analytics",
  "Communication", "Education & Research", "Security", "Finance", "Healthcare", "Travel",
  "Entertainment", "Other",
]);
const SEMVER = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;
const PACKAGE_NAME = /^[A-Za-z0-9][A-Za-z0-9_-]*$/;
// Control chars (except \n in multi-line fields), Unicode line/paragraph separators, bidi/invisible formatting.
const UNSUPPORTED = /[\u0000-\u0009\u000B-\u001F\u007F\u2028\u2029\u200B-\u200F\u202A-\u202E\u2060-\u2064\uFEFF]/;
const PLACEHOLDER = /\bTODO\b|\bTBD\b|example\.com|lorem ipsum/i;

async function exists(p) {
  try { await fs.access(p); return true; } catch { return false; }
}

function relativeLuminance(hex) {
  const n = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * n[0] + 0.7152 * n[1] + 0.0722 * n[2];
}
function contrast(a, b) {
  const [hi, lo] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/**
 * @param {string} dir plugin root
 * @param {{ release?: boolean }} options release: treat a missing demo recording as an error (final submission)
 */
export async function checkOpenAIPackage(dir, { release = false } = {}) {
  const errors = [];
  const warnings = [];
  const err = (m) => errors.push(`[openai] ${m}`);
  const warn = (m) => warnings.push(`[openai] ${m}`);

  const manifestPath = path.join(dir, "plugin.json");
  if (!(await exists(manifestPath))) {
    err("root plugin.json is missing (plugin_manifest_missing).");
    return { errors, warnings };
  }
  let m;
  try { m = JSON.parse(await fs.readFile(manifestPath, "utf8")); }
  catch (e) { err(`root plugin.json is not valid JSON: ${e.message}`); return { errors, warnings }; }

  const text = (field, value, { max, oneLine = true, required = true, placeholder = true } = {}) => {
    if (value === undefined || value === null) { if (required) err(`${field} is required.`); return; }
    if (typeof value !== "string" || value.trim() === "") { err(`${field} must be a non-empty string.`); return; }
    if (max && value.length > max) err(`${field} is ${value.length} chars; max ${max}.`);
    if (oneLine && /\n/.test(value)) err(`${field} must fit on one line.`);
    if (UNSUPPORTED.test(value)) err(`${field} contains unsupported control or invisible characters.`);
    if (placeholder && PLACEHOLDER.test(value)) err(`${field} still contains placeholder text (TODO/TBD/example.com).`);
  };
  const httpsUrl = (field, value, max = 1024) => {
    text(field, value, { max });
    if (typeof value !== "string") return;
    let u;
    try { u = new URL(value); } catch { err(`${field} is not a valid URL.`); return; }
    if (u.protocol !== "https:") err(`${field} must use https.`);
    if (u.username || u.password) err(`${field} must not embed credentials.`);
  };

  // Package identity
  if (m.$schema !== AGENT_PLUGIN_SCHEMA) err(`$schema must be ${AGENT_PLUGIN_SCHEMA}.`);
  if (typeof m.name !== "string" || !PACKAGE_NAME.test(m.name) || m.name.length > 64) err("name must be <=64 chars, ASCII letters/digits/_/-.");
  if (typeof m.version !== "string" || !SEMVER.test(m.version)) err("version must be a semantic version such as 1.0.0.");
  text("description", m.description, { max: 1024, oneLine: false });
  text("author.name", m.author?.name, { max: 120 });
  if (m.author?.url) httpsUrl("author.url", m.author.url, 2048);
  if (m.homepage) httpsUrl("homepage", m.homepage, 2048);

  const o = m.extensions?.["com.openai"];
  if (!o || typeof o !== "object") { err("extensions.com.openai is required for directory listing metadata."); return { errors, warnings }; }
  if (o.apps) err("extensions.com.openai.apps (.app.json) cannot currently be submitted; declare the MCP server in mcp.json.");
  if (o.hooks || (await exists(path.join(dir, "hooks")))) err("lifecycle hooks cannot currently be submitted.");

  // Listing
  const i = o.interface ?? {};
  const P = "interface";
  text(`${P}.displayName`, i.displayName, { max: 30 });
  text(`${P}.shortDescription`, i.shortDescription, { max: 30 });
  text(`${P}.longDescription`, i.longDescription, { max: 4000, oneLine: false });
  text(`${P}.developerName`, i.developerName, { max: 80 });
  if (!CATEGORIES.has(i.category)) err(`${P}.category must be one of: ${[...CATEGORIES].join(", ")}.`);
  if (i.capabilities !== undefined) {
    if (!Array.isArray(i.capabilities) || i.capabilities.length > 20) err(`${P}.capabilities must be an array of at most 20 strings.`);
    else i.capabilities.forEach((c, n) => text(`${P}.capabilities[${n}]`, c, { max: 120 }));
  }
  for (const f of ["websiteURL", "supportURL", "privacyPolicyURL", "termsOfServiceURL"]) httpsUrl(`${P}.${f}`, i[f]);
  if (i.defaultPrompt !== undefined) {
    const prompts = Array.isArray(i.defaultPrompt) ? i.defaultPrompt : [i.defaultPrompt];
    if (prompts.length > 3) err(`${P}.defaultPrompt allows at most 3 prompts.`);
    const seen = new Set();
    prompts.forEach((p, n) => {
      text(`${P}.defaultPrompt[${n}]`, p, { max: 128 });
      if (typeof p === "string") {
        if (/(^|\s)@\w/.test(p)) err(`${P}.defaultPrompt[${n}] must not @mention an MCP server.`);
        const key = p.normalize("NFKC").replace(/\s+/g, " ").trim().toLowerCase();
        if (seen.has(key)) err(`${P}.defaultPrompt[${n}] duplicates another prompt.`);
        seen.add(key);
      }
    });
  }
  for (const [f, bg] of [["brandColor", "#FFFFFF"], ["brandColorDark", "#212121"]]) {
    if (i[f] === undefined) continue;
    if (!/^#[0-9A-Fa-f]{6}$/.test(i[f])) err(`${P}.${f} must be #RRGGBB.`);
    else if (contrast(i[f], bg) < 2) err(`${P}.${f} needs >=2:1 contrast against ${bg} (has ${contrast(i[f], bg).toFixed(2)}).`);
  }
  for (const f of ["logo", "composerIcon"]) {
    const v = i[f];
    if (typeof v !== "string") { err(`${P}.${f} is required.`); continue; }
    if (!v.startsWith("./")) err(`${P}.${f} must start with ./`);
    const file = path.resolve(dir, v);
    if (!file.startsWith(path.resolve(dir) + path.sep)) { err(`${P}.${f} must stay inside the plugin.`); continue; }
    if (!(await exists(file))) { err(`${P}.${f} references missing file ${v}.`); continue; }
    const st = await fs.stat(file);
    if (st.size > 5 * 1024 * 1024) err(`${P}.${f} exceeds 5 MiB.`);
    if (v.toLowerCase().endsWith(".svg")) {
      const svg = await fs.readFile(file, "utf8");
      const vb = svg.match(/viewBox="\s*([-\d.]+)[\s,]+([-\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)\s*"/);
      if (!vb) err(`${P}.${f} SVG needs a numeric viewBox.`);
      else if (Number(vb[3]) !== Number(vb[4]) || Number(vb[3]) < 48) err(`${P}.${f} SVG viewBox must be square and >=48.`);
    } else if (!/\.(png|jpe?g|webp)$/i.test(v)) err(`${P}.${f} must be PNG, JPEG, WebP or SVG.`);
  }
  if (i.screenshots?.length) err(`${P}.screenshots are only allowed when the MCP server returns custom UI; MonstarX has none.`);

  // Onboarding skill
  if (o.onboardingSkill) {
    if (!(await exists(path.resolve(dir, o.onboardingSkill)))) err(`onboardingSkill references missing ${o.onboardingSkill}.`);
  }
  const skillsDir = path.join(dir, "skills");
  if (await exists(skillsDir)) {
    for (const entry of await fs.readdir(skillsDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) { warn(`skills/${entry.name} is not a skill directory and is ignored.`); continue; }
      if (entry.name.startsWith(".")) err(`skills/${entry.name}: hidden skill directories are rejected.`);
      const skillFile = path.join(skillsDir, entry.name, "SKILL.md");
      if (!(await exists(skillFile))) { err(`skills/${entry.name} has no SKILL.md.`); continue; }
      const body = (await fs.readFile(skillFile, "utf8")).replace(/\r\n/g, "\n");
      const fm = body.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
      if (!fm) { err(`skills/${entry.name}/SKILL.md needs YAML front matter.`); continue; }
      const name = fm[1].match(/^name:\s*(.+)$/m)?.[1]?.trim();
      const desc = fm[1].match(/^description:\s*(.+)$/m)?.[1]?.trim();
      if (!name) err(`skills/${entry.name}/SKILL.md front matter needs name.`);
      if (!desc) err(`skills/${entry.name}/SKILL.md front matter needs description.`);
      else if (desc.length > 1024) err(`skills/${entry.name}/SKILL.md description exceeds 1024 chars.`);
      if (name && `${m.name}:${name}`.length > 64) err(`skill identity ${m.name}:${name} exceeds 64 chars.`);
      if (!fm[2].trim()) err(`skills/${entry.name}/SKILL.md body is empty.`);
    }
  }

  // MCP: exactly one remote HTTPS server for plugin-level review cases
  const mcpPath = path.join(dir, "mcp.json");
  if (!(await exists(mcpPath))) err("mcp.json is required for a remote MCP submission.");
  else {
    const mcp = JSON.parse(await fs.readFile(mcpPath, "utf8"));
    if (mcp.$schema !== AGENT_MCP_SCHEMA) err(`mcp.json $schema must be ${AGENT_MCP_SCHEMA}.`);
    const servers = Object.entries(mcp.mcpServers ?? {});
    if (servers.length !== 1) err(`plugin-level review.test_cases require exactly one MCP server (found ${servers.length}).`);
    for (const [n, s] of servers) {
      if (s.type !== "streamable-http") err(`mcp.json server ${n} must be type streamable-http for directory submission.`);
      if (typeof s.url !== "string" || !s.url.startsWith("https://")) err(`mcp.json server ${n} needs a production https url.`);
      if (s.headers) err(`mcp.json server ${n} must not ship headers (credentials stay out of the ZIP).`);
    }
  }

  // Review
  const r = o.review;
  if (!r) err("extensions.com.openai.review is required for MCP review.");
  else {
    if ("test_credentials" in r || "reviewer_instructions" in r) err("review must not contain test_credentials or reviewer_instructions; enter them in the portal.");
    const pos = r.test_cases?.positive ?? [];
    const neg = r.test_cases?.negative ?? [];
    if (pos.length !== 5) err(`review.test_cases.positive needs exactly 5 cases (has ${pos.length}).`);
    if (neg.length !== 3) err(`review.test_cases.negative needs exactly 3 cases (has ${neg.length}).`);
    pos.forEach((c, n) => {
      const f = `review.test_cases.positive[${n}]`;
      text(`${f}.description`, c.description, { max: 4000, oneLine: false });
      text(`${f}.prompt`, c.prompt, { oneLine: false, placeholder: false });
      text(`${f}.tools_triggered`, c.tools_triggered);
      text(`${f}.expected_behavior`, c.expected_behavior, { oneLine: false });
    });
    neg.forEach((c, n) => {
      const f = `review.test_cases.negative[${n}]`;
      text(`${f}.description`, c.description, { oneLine: false });
      text(`${f}.prompt`, c.prompt, { oneLine: false, placeholder: false });
    });
    if (typeof r.demo_recording_url !== "string" || r.demo_recording_url === "") {
      (release ? err : warn)("review.demo_recording_url is empty. It is required before Submit for review (record the demo, then set it and rebuild the ZIP).");
    } else httpsUrl("review.demo_recording_url", r.demo_recording_url);
    if (r.commerce !== undefined && typeof r.commerce !== "boolean") err("review.commerce must be a boolean.");
  }
  if (!o.publication?.release_notes) err("publication.release_notes is required for submission.");

  return { errors, warnings };
}

/** Collect tool names used in review cases so callers can compare them with the live MCP tool list. */
export function toolsInReview(manifest) {
  const pos = manifest?.extensions?.["com.openai"]?.review?.test_cases?.positive ?? [];
  return [...new Set(pos.flatMap((c) => String(c.tools_triggered ?? "").split(",").map((s) => s.trim()).filter(Boolean)))];
}
