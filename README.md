# MonstarX Cursor plugin

Ship real full-stack apps from Cursor and Grok Bot — live preview, built-in backend, admin CMS, REST APIs, and one-click publish — via [MonstarX's MCP endpoint](https://monstarx.com/mcp).

## What is MonstarX?

[MonstarX](https://monstarx.com) is an AI app builder for **shipping real web apps**, not mockups. You describe an app in plain words; MonstarX plans it, writes the code, runs a **live preview**, tests it in real browsers, and publishes to `*.monstarx.app` or your own domain. The code is yours — export anytime or sync to GitHub.

Product UI is available in **16 languages** (EN, JA, ZH-CN, PT-BR, AR, KO, TH, ID, VI, MS, HI, BN, TA, RU, SW, HA) — switch in account settings. Pricing is country-based.

Under the hood every project is a full-stack app on **TanStack Start + React + TypeScript**, with a database, sign-in, email, file storage, and AI from day one. Import from Lovable, GitHub, a zip, or push from coding agents (Cursor, Claude Code, Codex, and this plugin).

Same Lovable-class “describe it → see it running” feel — with the stack and ops surface to actually launch: Cloud backend, Admin back office, partner REST APIs, QA in real browsers, and publish.

- Product: [monstarx.com](https://monstarx.com)
- Docs: [What is MonstarX?](https://docs.monstarx.com/getting-started/what-is-monstarx/)
- Agents: [Connect coding agents](https://docs.monstarx.com/integrations/coding-agents)

## Why MonstarX vs “prompt → UI only” builders

UI generators stop at screens. MonstarX ships the rest:

| Capability | What you get |
| --- | --- |
| **MonstarX Cloud** | Database, accounts, email, storage, AI, maps, secrets — provisioned per project, same backend in preview and production. |
| **Admin panel** | CMS-like back office on every app: edit data as forms, manage users, Activity + Undo — no separate product. |
| **REST APIs** | Turn tables into list/get/create/update/delete endpoints, publish OpenAPI docs, project API keys — partners, Zapier, n8n without a hand-written backend. |
| **Publish** | One click to `*.monstarx.app` or your domain; versions you can restore. |
| **Agent MCP** | This plugin: push/pull/build/publish from Cursor and Grok Bot at `https://monstarx.com/mcp`. |

## MonstarX Cloud

Every app gets a built-in backend — no servers to rent, no keys pasted into source. Explore it at [mxcloud.monstarx.com](https://mxcloud.monstarx.com) and in docs under [MonstarX Cloud](https://docs.monstarx.com/cloud/).

- **Database** — bookings, orders, posts, sign-ups; browse and query from the Workbench **Backend** tab
- **User accounts** — sign-up, sign-in, password reset for your app’s users
- **Email** — confirmations and notices from the app’s own address
- **File storage** — photos and documents people upload
- **AI** — text, summaries, images, and more inside the app, with **no API keys in code**
- **Maps** — world and street maps without a separate key
- **Secrets** — encrypted keys for third-party services

Same backend in preview and production. Workbench **Backend** browses DB, users, files, emails, and AI usage; **Admin** covers day-to-day ops. Need Stripe, Twilio, or your own CRM? Connectors keep those accounts yours; custom/third-party APIs go through connectors + `mx.api.call` (keys held by MonstarX, not in the repo).

## Admin panel / CMS + REST APIs

**Admin** ships on every project by default — not an add-on. Edit data as forms, manage users (ban, reset password, app admin), and use Activity + Undo. Optional **Admin Studio** adds saved views, forms, and dashboards (including AI-assisted pages). See [The Admin panel](https://docs.monstarx.com/grow/admin-panel/).

**Admin → APIs** turns tables into REST endpoints (list / get / create / update / delete), publishes docs + OpenAPI, and issues project API keys — so partners and automations talk to your data without you writing a backend. See [Your app’s REST API](https://docs.monstarx.com/cloud/rest-api/).

## Grok Bot + MonstarX harmony

This plugin connects Cursor’s agent and **Grok Bot** to MonstarX (via Cursor Marketplace plugins) without hand-rolling `mcp.json`.

- **Think → ship** — Grok Bot scopes product, UX, and copy; Cursor implements; push to MonstarX for a live preview and shareable link.
- **Round-trip builds** — Iterate in the MonstarX workbench; pull latest into the agent, merge, push again.
- **Ask MonstarX to build** — “Add Stripe checkout” or auth via `send_message`; MonstarX builds in the workbench, then pull those changes.
- **Publish and secrets from the agent** — Publish when ready; `set_secrets` keeps keys out of chat.
- **Mixed team** — Non-dev teammates iterate in MonstarX while you stay in Cursor / Grok Bot; revision checks stop either side from overwriting the other.

## Example prompts

Once connected, try:

- “Push this app to MonstarX and give me the link.”
- “Push my changes to MonstarX.”
- “Pull the latest version from MonstarX and merge it with my changes.”
- “Ask MonstarX to add Stripe checkout, then pull its changes.”
- “Publish it on MonstarX.”
- “Create a booking app on MonstarX with sign-in and confirmation emails.”
- “Import github.com/me/my-app into MonstarX.”
- “What is MonstarX doing on my project?”

## MCP tools

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

Every tool acts only on projects you own. Publishing always asks first. Endpoint: `https://monstarx.com/mcp`.

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

This matches the official MonstarX Cursor snippet. For Cursor Marketplace installs this repo ships the same url-only shape in `mcp.cursor.json` (pinned from `.cursor-plugin/plugin.json`). Root `mcp.json` uses the Agent Plugins shape (`type: streamable-http`) for OpenAI ChatGPT/Codex — see [OpenAI Plugins / Dots](#openai-plugins--dots) below. Do not put `type: streamable-http` in Cursor's own `~/.cursor/mcp.json`; Cursor's CLI can drop the whole file when that type is present.

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
- Product: [monstarx.com](https://monstarx.com) · Cloud: [mxcloud.monstarx.com](https://mxcloud.monstarx.com)
- In product: Ask Luna
- Email: [feedback@monstarx.com](mailto:feedback@monstarx.com)


## OpenAI Plugins / Dots

This repo is also packaged as a portable **[Agent Plugins](https://developers.openai.com/plugins/build/plugins)** folder for ChatGPT and Codex. **Dots** reuse the same plugin packages. It's prepared for the OpenAI Plugins Directory but **not submitted yet**.

| Path | Role |
| --- | --- |
| `plugin.json` | Agent Plugins root manifest: `extensions.com.openai` listing, 5 positive + 3 negative review cases, release notes |
| `mcp.json` | Agent Plugins MCP (`streamable-http` → `https://monstarx.com/mcp`, OAuth) |
| `mcp.cursor.json` | Cursor url-only MCP (OAuth Sign in), pinned by `.cursor-plugin/plugin.json` |
| `.cursor-plugin/plugin.json` | Cursor Marketplace identity |
| `skills/monstarx-project/` | Shared onboarding skill (paths for shell and no-shell surfaces, safety rules) |
| `assets/logo.svg` | Logo + `composerIcon` |
| `docs/openai-review.md` | Test cases, tool-annotation justifications, demo recording script |
| `docs/openai-submission-checklist.md` | Domain challenge, OAuth, reviewer account, ZIP and portal steps |

Validate and build the upload ZIP:

```bash
node scripts/validate-plugin.mjs            # Cursor + OpenAI checks (warns while the demo URL is empty)
node scripts/validate-plugin.mjs --release  # also requires review.demo_recording_url
node scripts/build-openai-zip.mjs           # → dist/monstarx-openai-plugin-<version>.zip
```

Still to do before **Submit for review**: record the demo and set `review.demo_recording_url`, add explicit `destructiveHint` values on the server's read-only tools, host the domain-challenge token, and set up a reviewer account with no MFA. See the [checklist](docs/openai-submission-checklist.md). Reviewer credentials go only in the portal, never in the ZIP.

Listing URLs: [Privacy Policy](https://monstarx.com/privacy) · [Terms of Service](https://monstarx.com/terms) · [Help and support](https://docs.monstarx.com/help/) (email: [support@monstarx.com](mailto:support@monstarx.com)) · [monstarx.com](https://monstarx.com).

## Marketplace submit (maintainers)

This plugin is prepared for the Cursor Marketplace but **is not claimed as listed yet**. When ready:

1. Confirm `node scripts/validate-plugin.mjs` passes.
2. Tag a release / note version in `.cursor-plugin/plugin.json`.
3. Submit the public repo at [cursor.com/marketplace/publish](https://cursor.com/marketplace/publish).
4. Wait for Cursor’s manual review.

## License

MIT © 2026 MonstarX / monstarx-tech
