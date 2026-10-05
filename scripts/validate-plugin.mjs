#!/usr/bin/env node

import { promises as fs } from "node:fs";
import path from "node:path";
import process from "node:process";

const repoRoot = process.cwd();
const errors = [];
const warnings = [];

const pluginNamePattern = /^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/;

function addError(message) {
  errors.push(message);
}

function addWarning(message) {
  warnings.push(message);
}

async function pathExists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function readJsonFile(filePath, context) {
  let raw;
  try {
    raw = await fs.readFile(filePath, "utf8");
  } catch {
    addError(`${context} is missing: ${filePath}`);
    return null;
  }

  try {
    return JSON.parse(raw);
  } catch (error) {
    addError(`${context} contains invalid JSON (${filePath}): ${error.message}`);
    return null;
  }
}

function normalizeNewlines(content) {
  return content.replace(/\r\n/g, "\n");
}

function parseFrontmatter(content) {
  const normalized = normalizeNewlines(content);
  if (!normalized.startsWith("---\n")) {
    return null;
  }

  const closingIndex = normalized.indexOf("\n---\n", 4);
  if (closingIndex === -1) {
    return null;
  }

  const frontmatterBlock = normalized.slice(4, closingIndex);
  const fields = {};

  for (const line of frontmatterBlock.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }
    const separator = line.indexOf(":");
    if (separator === -1) {
      continue;
    }
    const key = line.slice(0, separator).trim();
    const value = line.slice(separator + 1).trim();
    fields[key] = value;
  }

  return fields;
}

async function walkFiles(dirPath) {
  const files = [];
  const stack = [dirPath];

  while (stack.length > 0) {
    const current = stack.pop();
    const entries = await fs.readdir(current, { withFileTypes: true });
    for (const entry of entries) {
      const entryPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(entryPath);
      } else if (entry.isFile()) {
        files.push(entryPath);
      }
    }
  }

  return files;
}

function isSafeRelativePath(value) {
  if (typeof value !== "string" || value.length === 0) {
    return false;
  }
  if (value.startsWith("http://") || value.startsWith("https://")) {
    return true;
  }
  if (path.isAbsolute(value)) {
    return false;
  }
  const normalized = path.posix.normalize(value.replace(/\\/g, "/"));
  return !normalized.startsWith("../") && normalized !== "..";
}

function extractPathValues(value) {
  if (typeof value === "string") {
    return [value];
  }

  if (Array.isArray(value)) {
    return value.flatMap((entry) => extractPathValues(entry));
  }

  if (value && typeof value === "object") {
    const candidates = [];
    if (typeof value.path === "string") {
      candidates.push(value.path);
    }
    if (typeof value.file === "string") {
      candidates.push(value.file);
    }
    return candidates;
  }

  return [];
}

async function validateReferencedPath(pluginDir, fieldName, pathValue, pluginName) {
  if (pathValue.startsWith("http://") || pathValue.startsWith("https://")) {
    return;
  }

  if (!isSafeRelativePath(pathValue)) {
    addError(
      `${pluginName}: field "${fieldName}" has invalid path "${pathValue}". Use a relative path without ".." or absolute prefixes.`
    );
    return;
  }

  const resolved = path.resolve(pluginDir, pathValue);
  const exists = await pathExists(resolved);
  if (!exists) {
    addError(`${pluginName}: field "${fieldName}" references missing path "${pathValue}".`);
  }
}

async function validateFrontmatterFile(filePath, componentName, requiredKeys, pluginName) {
  const content = await fs.readFile(filePath, "utf8");
  const parsed = parseFrontmatter(content);
  const relativeFile = path.relative(repoRoot, filePath);

  if (!parsed) {
    addError(`${pluginName}: ${componentName} file missing YAML frontmatter: ${relativeFile}`);
    return;
  }

  for (const key of requiredKeys) {
    if (!parsed[key] || parsed[key].length === 0) {
      addError(`${pluginName}: ${componentName} file missing "${key}" in frontmatter: ${relativeFile}`);
    }
  }
}

async function validateComponentFrontmatter(pluginDir, pluginName) {
  const skillsDir = path.join(pluginDir, "skills");
  if (await pathExists(skillsDir)) {
    const files = await walkFiles(skillsDir);
    for (const file of files) {
      if (path.basename(file) === "SKILL.md") {
        await validateFrontmatterFile(file, "skill", ["name", "description"], pluginName);
      }
    }
  }

  for (const [dirName, componentName, requiredKeys] of [
    ["rules", "rule", ["description"]],
    ["agents", "agent", ["name", "description"]],
    ["commands", "command", ["name", "description"]],
  ]) {
    const dir = path.join(pluginDir, dirName);
    if (!(await pathExists(dir))) {
      continue;
    }
    const files = await walkFiles(dir);
    for (const file of files) {
      const ext = path.extname(file).toLowerCase();
      if ([".md", ".mdc", ".markdown", ".txt"].includes(ext)) {
        await validateFrontmatterFile(file, componentName, requiredKeys, pluginName);
      }
    }
  }
}

function summarizeAndExit() {
  if (warnings.length > 0) {
    console.log("Warnings:");
    for (const warning of warnings) {
      console.log(`- ${warning}`);
    }
    console.log("");
  }

  if (errors.length > 0) {
    console.error("Validation failed:");
    for (const error of errors) {
      console.error(`- ${error}`);
    }
    process.exit(1);
  }

  console.log("Validation passed.");
}

async function main() {
  const pluginDir = repoRoot;
  const manifestPath = path.join(pluginDir, ".cursor-plugin", "plugin.json");
  const pluginManifest = await readJsonFile(manifestPath, "Plugin manifest");
  if (!pluginManifest) {
    summarizeAndExit();
    return;
  }

  const pluginName =
    typeof pluginManifest.name === "string" ? pluginManifest.name : "(missing name)";

  if (typeof pluginManifest.name !== "string" || !pluginNamePattern.test(pluginManifest.name)) {
    addError(
      '"name" in plugin.json must be lowercase and use only alphanumerics, hyphens, and periods.'
    );
  }

  if (typeof pluginManifest.version !== "string" || pluginManifest.version.length === 0) {
    addWarning("plugin.json has no version field.");
  }

  if (!pluginManifest.author || typeof pluginManifest.author.name !== "string") {
    addWarning('plugin.json should include author.name.');
  }

  const manifestFields = ["logo", "rules", "skills", "agents", "commands", "hooks", "mcpServers"];
  for (const field of manifestFields) {
    const values = extractPathValues(pluginManifest[field]);
    for (const value of values) {
      await validateReferencedPath(pluginDir, field, value, pluginName);
    }
  }

  await validateComponentFrontmatter(pluginDir, pluginName);

  const mcpPath = path.join(pluginDir, "mcp.json");
  if (await pathExists(mcpPath)) {
    const mcp = await readJsonFile(mcpPath, "mcp.json");
    if (mcp && (!mcp.mcpServers || typeof mcp.mcpServers !== "object")) {
      addError("mcp.json must contain an mcpServers object.");
    }
  } else {
    addWarning("no mcp.json file found (only needed when using MCP servers).");
  }

  // Collect ${VAR} placeholders from mcp.json and ensure they match variables schema if present
  if (await pathExists(mcpPath)) {
    const mcpRaw = await fs.readFile(mcpPath, "utf8");
    const placeholders = [...mcpRaw.matchAll(/\$\{([A-Z0-9_]+)\}/g)].map((m) => m[1]);
    const unique = [...new Set(placeholders)];
    if (unique.length > 0) {
      const vars = pluginManifest.variables;
      if (!vars || vars.type !== "object" || !vars.properties) {
        addError(
          `mcp.json uses \${VAR} placeholders (${unique.join(", ")}) but plugin.json has no variables.properties schema.`
        );
      } else {
        for (const name of unique) {
          if (!vars.properties[name]) {
            addError(`Placeholder \${${name}} in mcp.json is not declared in plugin.json variables.`);
          }
        }
      }
    } else if (pluginManifest.variables) {
      addWarning(
        "plugin.json declares variables but mcp.json has no ${VAR} placeholders (OAuth url-only is fine)."
      );
    }
  }

  // Agent Plugins portable package (OpenAI ChatGPT/Codex) — optional alongside Cursor
  const agentPluginPath = path.join(pluginDir, "plugin.json");
  if (await pathExists(agentPluginPath)) {
    const agentPlugin = await readJsonFile(agentPluginPath, "Agent Plugins plugin.json");
    if (agentPlugin) {
      if (agentPlugin.$schema !== "https://agent-plugins.org/schemas/1.0.0/plugin.schema.json") {
        addError(
          'Root plugin.json must set $schema to https://agent-plugins.org/schemas/1.0.0/plugin.schema.json'
        );
      }
      if (typeof agentPlugin.name !== "string" || !pluginNamePattern.test(agentPlugin.name)) {
        addError(
          'Root plugin.json "name" must be lowercase and use only alphanumerics, hyphens, and periods.'
        );
      }
      const openai = agentPlugin.extensions && agentPlugin.extensions["com.openai"];
      if (!openai || typeof openai !== "object") {
        addWarning('Root plugin.json has no extensions.com.openai (needed for OpenAI listing metadata).');
      } else {
        const iface = openai.interface;
        if (iface) {
          for (const field of ["logo", "composerIcon"]) {
            if (typeof iface[field] === "string") {
              await validateReferencedPath(pluginDir, `extensions.com.openai.interface.${field}`, iface[field], pluginName);
            }
          }
          if (Array.isArray(iface.screenshots)) {
            for (const shot of iface.screenshots) {
              await validateReferencedPath(pluginDir, "extensions.com.openai.interface.screenshots", shot, pluginName);
            }
          }
        }
        if (typeof openai.onboardingSkill === "string") {
          await validateReferencedPath(
            pluginDir,
            "extensions.com.openai.onboardingSkill",
            openai.onboardingSkill,
            pluginName
          );
        }
      }
    }
  }

  // Dual MCP: Agent Plugins mcp.json may use type streamable-http; Cursor uses mcp.cursor.json (url-only)
  if (await pathExists(mcpPath)) {
    const mcp = await readJsonFile(mcpPath, "mcp.json (re-check)");
    if (mcp) {
      if (mcp.$schema === "https://agent-plugins.org/schemas/1.0.0/mcp.schema.json") {
        for (const [serverName, server] of Object.entries(mcp.mcpServers || {})) {
          if (!server || typeof server !== "object") continue;
          if (server.type === "streamable-http" || server.type === "sse") {
            if (typeof server.url !== "string" || !server.url.startsWith("https://")) {
              addError(`mcp.json server "${serverName}" with type ${server.type} needs an https url.`);
            }
          } else if (server.type === "stdio") {
            if (typeof server.command !== "string") {
              addError(`mcp.json server "${serverName}" with type stdio needs a command.`);
            }
          } else if (server.type) {
            addError(`mcp.json server "${serverName}" has unsupported type "${server.type}".`);
          }
        }
        const cursorMcp = path.join(pluginDir, "mcp.cursor.json");
        if (!(await pathExists(cursorMcp))) {
          addWarning(
            "mcp.json uses Agent Plugins schema; add mcp.cursor.json (url-only) and pin it from .cursor-plugin/plugin.json so Cursor CLI does not drop type: streamable-http."
          );
        } else {
          const cursorCfg = await readJsonFile(cursorMcp, "mcp.cursor.json");
          if (cursorCfg) {
            for (const [serverName, server] of Object.entries(cursorCfg.mcpServers || {})) {
              if (server && server.type === "streamable-http") {
                addError(
                  `mcp.cursor.json server "${serverName}" must not use type streamable-http (Cursor CLI drops the config). Use url-only.`
                );
              }
            }
          }
          const pinned = pluginManifest.mcpServers;
          if (pinned !== "./mcp.cursor.json" && pinned !== "mcp.cursor.json") {
            addWarning(
              '.cursor-plugin/plugin.json should set "mcpServers": "./mcp.cursor.json" when dual MCP formats are used.'
            );
          }
        }
      }
    }
  }

  summarizeAndExit();
}

await main();
