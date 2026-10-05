# MonstarX Cursor plugin

Cursor Marketplace plugin for the **MonstarX MCP**. Install it to create, edit, push, and publish [MonstarX](https://monstarx.com) projects from Cursor / your coding agent.

## What you get

- MCP server entry pointed at `https://monstarx.com/mcp`
- Skill `monstarx-project` with create → push → build → publish workflow
- Browser OAuth / Sign in (no API key required for interactive Cursor use)

Docs: [Connect coding agents](https://docs.monstarx.com/integrations/coding-agents)

## Install (Marketplace)

1. Install **MonstarX** from the Cursor Marketplace (once listed), or add this repo as a plugin source.
2. Open **Settings → MCP**, find **monstarx**, and use **Sign in**.
3. In the browser, sign in to MonstarX and press **Allow**.
4. Say: *“Push this app to MonstarX and give me the link.”*

## Manual MCP setup (OAuth)

If you are not using the marketplace package yet, add to `~/.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "monstarx": {
      "url": "https://monstarx.com/mcp"
    }
  }
}
```

Then sign in from Settings → MCP (or `agent mcp login monstarx` in Cursor’s CLI agent).

This matches the official MonstarX Cursor snippet and is what this plugin ships in `mcp.json`.

## API key setup (CI / headless)

Browser sign-in is preferred. For CI, scripts, or agents that cannot open a browser:

1. Create a key in MonstarX **Settings → API & MCP** under API keys.
2. Configure MCP with a Bearer header (do **not** commit the key):

```json
{
  "mcpServers": {
    "monstarx": {
      "url": "https://monstarx.com/mcp",
      "headers": {
        "Authorization": "Bearer YOUR_API_KEY"
      }
    }
  }
}
```

Keep keys out of chats and source control. Revoke unused keys in Settings. The marketplace install path stays OAuth-only so Cursor’s Sign in button works without an empty Bearer token.

## Tools

| Tool | Purpose |
| --- | --- |
| `get_account` | Account, plan, allowance |
| `list_projects` | Projects, recently changed first |
| `get_project` | Status, preview, publish, missing secrets |
| `prepare_upload` | One-time upload link + push command |
| `import_from_github` | Import a GitHub repo |
| `push_files` | Small direct file writes |
| `create_project` | Build a new app from a description |
| `read_files` | List/read project files |
| `download_project` | One-time download link |
| `send_message` | Ask MonstarX’s builder |
| `get_messages` | Read chat / wait for reply |
| `stop` | Stop in-progress work |
| `publish_project` | Put the current version live |
| `set_secrets` | Store encrypted backend secrets |
| `get_logs` | Preview logs / restart preview |

## Example prompts

- “Push this app to MonstarX and give me the link.”
- “Push my changes to MonstarX.”
- “Pull the latest from MonstarX and merge with my changes.”
- “Ask MonstarX to add Stripe checkout, then pull its changes.”
- “Publish it on MonstarX.”

## Repo layout

```text
.
├── .cursor-plugin/plugin.json   # Marketplace manifest
├── mcp.json                     # Platform MCP (url-only / OAuth)
├── assets/logo.svg
├── skills/monstarx-project/SKILL.md
├── scripts/validate-plugin.mjs
├── LICENSE
└── README.md
```

## Validate locally

```bash
node scripts/validate-plugin.mjs
```

## Marketplace submit (maintainers)

Do **not** submit until review is ready:

1. Confirm `node scripts/validate-plugin.mjs` passes.
2. Tag a release / note version in `.cursor-plugin/plugin.json`.
3. Submit the public repo at [cursor.com/marketplace/publish](https://cursor.com/marketplace/publish).
4. Wait for Cursor’s manual review.

## License

MIT © 2026 MonstarX / monstarx-tech
