# MonstarX Cursor plugin

Cursor Marketplace plugin for **MonstarX MCP** — so Cursor and Grok Bot can push, pull, build, and publish apps on [MonstarX](https://monstarx.com) without hand-rolling `mcp.json`.

## What is MonstarX?

[MonstarX](https://monstarx.com) is an AI app builder for shipping real web apps. You (or your coding agent) describe or upload an app, get a **live preview link**, iterate in the MonstarX workbench or from agents, then **publish** when ready — with versions, secrets, and GitHub sync along the way.

If you know Lovable, Bolt, or v0, it’s the same “prompt → app” energy, with a stronger agent loop: push from Cursor / Grok Bot, pull MonstarX builds back, manage secrets, and publish without leaving your tools.

Docs for agents: [Connect coding agents](https://docs.monstarx.com/integrations/coding-agents)

## Why this plugin

This plugin installs the **MonstarX MCP** server into Cursor for you. After Sign in / Allow once in the browser, your agent can talk to MonstarX — create projects, push folders, ask the builder to change the app, set secrets, and publish — without copying MCP config by hand.

Works with Cursor’s agent, and with **Grok Bot** when it runs through Cursor Marketplace plugins.

## Grok Bot + MonstarX together

Concrete ways to use them side by side:

- **Think → ship** — Use Grok Bot as the product brain (scope, UX, copy). Hand coding to Cursor, then push the app to MonstarX for a live preview and shareable link.
- **Round-trip builds** — Keep iterating in the MonstarX workbench; have Grok Bot or Cursor pull the latest, merge with local changes, and push again.
- **Ask MonstarX to build** — “Add Stripe checkout” or auth via the agent; MonstarX builds in the workbench, then you pull those changes locally.
- **Publish and secrets from the agent** — Publish when ready; set API keys with `set_secrets` so nothing sensitive is pasted into chat.
- **Mixed team** — Non-dev teammates iterate in MonstarX while you stay in Cursor / Grok Bot; revision checks stop either side from overwriting the other.

## What you can say

Once connected, try prompts like:

- “Push this app to MonstarX and give me the link.”
- “Push my changes to MonstarX.”
- “Pull the latest version from MonstarX and merge it with my changes.”
- “Ask MonstarX to add Stripe checkout, then pull its changes.”
- “Publish it on MonstarX.”

In chat-only agents (no shell), also try: “Build me a booking app on MonstarX”, “Import github.com/me/my-app into MonstarX”, or “What is MonstarX doing on my project?”

## Tools

| Tool | What it does |
| --- | --- |
| `get_account` | Your account, plan, and remaining allowance |
| `list_projects` | Your projects, most recently changed first |
| `get_project` | One project at a glance: status, preview, publishing, missing secrets |
| `prepare_upload` | One-time upload link and command to push the current folder (new project or new version) |
| `import_from_github` | Bring in an app from a GitHub repository |
| `push_files` | Write a few files directly (small edits or agents without a shell) |
| `create_project` | Have MonstarX build a new app from a description, pictures, or documents |
| `read_files` | List or read a project’s files |
| `download_project` | One-time download link and command to unpack the project |
| `send_message` | Ask MonstarX’s builder to build, answer, or plan |
| `get_messages` | Read the project chat, optionally waiting for MonstarX to finish |
| `stop` | Stop what MonstarX is running in a project |
| `publish_project` | Put the current version live |
| `set_secrets` | Store encrypted keys in Backend → Secrets |
| `get_logs` | Preview state and output; can start a stopped preview |

Every tool acts only on projects you own. Publishing always asks first.

## Install

### Cursor Marketplace

1. Install **MonstarX** from the Cursor Marketplace (once listed), or add this repo as a plugin source.
2. Open **Settings → MCP**, find **monstarx**, and use **Sign in**.
3. In the browser, sign in to MonstarX and press **Allow**.
4. Say: *“Push this app to MonstarX and give me the link.”*

### Local plugin test

For maintainers / local testing before Marketplace listing:

```bash
mkdir -p ~/.cursor/plugins/local
git clone https://github.com/monstarx-tech/monstarx-cursor-plugin.git ~/.cursor/plugins/local/monstarx
```

Restart Cursor (or reload plugins), then Sign in under Settings → MCP as above.

Validate the package locally:

```bash
node scripts/validate-plugin.mjs
```

## Manual OAuth setup (`mcp.json`)

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

This matches the official MonstarX Cursor snippet and is what this plugin ships in `mcp.json` (url-only / OAuth).

## API key for CI / headless

Browser sign-in is preferred for interactive Cursor use. For CI, scripts, or agents that cannot open a browser:

1. Create a key in MonstarX **Settings → API & MCP** under API keys.
2. Configure MCP with a Bearer header (**do not commit the key**):

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

API keys act as you on every project. Keep them out of chats and source control. Revoke unused keys in Settings. The marketplace install path stays OAuth-only so Cursor’s Sign in button works without an empty Bearer token.

## Security

- `.env` files are **not** uploaded. The push command leaves them out; if one arrives anyway, MonstarX does not store it.
- Put secrets in **Backend → Secrets**, or ask your agent to use `set_secrets`.
- Never paste API keys into chat or commit them to the repo.

## Support

- Docs: [Connect coding agents](https://docs.monstarx.com/integrations/coding-agents)
- In product: Ask Luna
- Email: [feedback@monstarx.com](mailto:feedback@monstarx.com)

## Marketplace submit (maintainers)

This plugin is prepared for the Cursor Marketplace but **is not claimed as listed yet**. When ready:

1. Confirm `node scripts/validate-plugin.mjs` passes.
2. Tag a release / note version in `.cursor-plugin/plugin.json`.
3. Submit the public repo at [cursor.com/marketplace/publish](https://cursor.com/marketplace/publish).
4. Wait for Cursor’s manual review.

## License

MIT © 2026 MonstarX / monstarx-tech