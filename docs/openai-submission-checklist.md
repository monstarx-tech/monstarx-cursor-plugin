# MonstarX → OpenAI Plugins Directory: submission checklist

Status: **package prepared, not submitted.** Every step marked 🧑 needs Saad (or another MonstarX org owner) and can't be done from this repo.

Portal: <https://platform.openai.com/plugins> · Review pack (test cases, annotation justifications, demo script): [openai-review.md](./openai-review.md)

| Done in repo | Still needed (human) |
| --- | --- |
| `plugin.json` listing, 5 positive + 3 negative review cases, commerce, release notes | 🧑 Server: explicit `destructiveHint` on read-only tools (§2) |
| Onboarding skill with ChatGPT and Codex paths and safety rules | 🧑 Domain challenge token from the portal, hosted on monstarx.com (§3) |
| Validator for OpenAI submission rules (`node scripts/validate-plugin.mjs`) | 🧑 Reviewer account with no MFA, plus sample data (§5) |
| Reproducible ZIP builder (`node scripts/build-openai-zip.mjs`) | 🧑 Demo video, then its URL in `plugin.json` (§7) |
| Privacy, terms, website and support URLs checked live (HTTP 200) | 🧑 Identity verification, portal upload, justifications, Submit (§1, §9) |

---

## 1. 🧑 Identity and access (before uploading)

- [ ] Pick the OpenAI **organization + project** that will own the plugin. Use a project with **global** data residency, because EU-residency projects can't submit MCP plugins.
- [ ] You need **Owner**, or a role with `api.apps.write` (submit) and `api.apps.read` (view).
- [ ] Complete **business verification** for the publisher name. The privacy policy and terms name **Monstar Lab Pte Ltd** ("MonstarX"), and OpenAI checks that the public URLs identify the same publisher. The directory shows the verified identity's name; it overrides `developerName` in the ZIP (`developer_name_defaulted`).

## 2. 🧑 MCP server changes (repo `monstarx-tech/monstarxv5`, `src/server/mcp/tools.ts`)

The portal imports annotations from the live server. Justifications can't override them.

- [ ] **Required:** add `destructiveHint: false` to `get_account`, `list_projects`, `get_project`, `read_files`, `download_project` and `get_messages`. They're missing today, which triggers `annotations_required`.
- [ ] **Decide:** `set_secrets` → `destructiveHint: true` (recommended: overwriting an existing name loses a write-only value). `prepare_upload` → keep `false` with the justification, or set `true`. `create_project` / `send_message` → `openWorldHint` with `file_urls`. Reasoning is in [openai-review.md §3](./openai-review.md#3-tool-annotations-and-justifications-for-the-portal).
- [ ] Deploy to production (`https://monstarx.com/mcp`), then run **Scan Tools** / **Rescan** in the portal and confirm the values.
- [ ] Tool responses: `get_account` returns the account's email and name. That's fine for "which account am I connected to", and the privacy policy covers account data. Don't add internal IDs, tokens or debug payloads to tool results.

## 3. 🧑 Domain verification challenge

The token appears in the portal under **MCPs → monstarx → Connect** and is unique to the plugin. Don't invent one.

- [ ] Copy the token from the portal.
- [ ] Serve it as **plain text, exact token only** (no JSON, no list, no trailing HTML) at:
      `https://monstarx.com/.well-known/openai-apps-challenge`
      (Today this returns 404. The MCP host is `monstarx.com`, so the challenge base is that origin.)
- [ ] Suggested route in monstarxv5, following the existing `.well-known` routes:

  ```ts
  // src/routes/[.]well-known/openai-apps-challenge.ts
  import { createFileRoute } from '@tanstack/react-router'

  // OpenAI Plugins domain verification. The token is public by design; paste it exactly as the portal shows it.
  const OPENAI_APPS_CHALLENGE = '<token from platform.openai.com/plugins>'

  /** GET /.well-known/openai-apps-challenge: plain-text token only. */
  export const Route = createFileRoute('/.well-known/openai-apps-challenge')({
    server: {
      handlers: {
        GET: () => new Response(OPENAI_APPS_CHALLENGE, { headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' } }),
      },
    },
  })
  ```

- [ ] Check from outside: `curl -s https://monstarx.com/.well-known/openai-apps-challenge` prints only the token, with HTTP 200 and no Cloudflare challenge page.
- [ ] Click **Verify Domain** in the portal.
- [ ] Leave the route in place after approval. Never replace a token another plugin uses on the same URL.

## 4. 🧑 OAuth: redirect allowlist and connectivity

What the MonstarX authorization server does today (checked live, and in `src/server/mcp/oauth.ts`):

- Metadata at `/.well-known/oauth-protected-resource/mcp` and `/.well-known/oauth-authorization-server`. Resource `https://monstarx.com/mcp`, issuer `https://monstarx.com`, PKCE `S256`, public clients (`none`), scope `monstarx`.
- Client registration: **DCR** (`/oauth/register`) and **CIMD** (`client_id_metadata_document_supported: true`).
- Redirect policy: **any https redirect the client registered** (in the DCR body or its CIMD document). Plain http only for loopback. There's **no static allowlist to edit**: ChatGPT's redirect is accepted because ChatGPT registers it.
- The metadata doesn't advertise `authorization_response_iss_parameter_supported`, so ChatGPT uses the **callback-specific redirect** `https://chatgpt.com/connector/oauth/{callback_id}` (CIMD client `https://chatgpt.com/oauth/{callback_id}/client.json`).
- The consent page (`/oauth/authorize`) sends only `frame-ancestors 'none'` and has no `form-action` restriction, so the redirect back to chatgpt.com and the platform.openai.com relay during Scan Tools aren't blocked.

Checklist:
- [ ] In **MCPs → Connect**, set Authentication = **OAuth**. Prefer **CIMD** for client registration (DCR also works). Copy the **exact redirect URI** the portal shows and keep it in your notes.
- [ ] If MonstarX ever adds a static redirect allowlist, allow `https://chatgpt.com/connector/oauth/*` and `https://chatgpt.com/connector_platform_oauth_redirect`. **Don't** add `https://platform.openai.com/apps-manage/oauth`: it's OpenAI's internal relay, not a callback.
- [ ] Cloudflare: make sure WAF, Bot Fight Mode and rate limits don't challenge OpenAI's egress on `/mcp`, `/oauth/token`, `/oauth/register` and `/.well-known/*`, and that the Worker can fetch `https://chatgpt.com/oauth/.../client.json` for CIMD.
- [ ] Keep DCR/CIMD client rows in `oauth_clients` valid while the plugin is live. Purging them gives reviewers and users `invalid_client`.
- [ ] Optional: to switch to the stable redirect, return `iss` on **error** redirects too (`errorRedirect` doesn't add it yet; success responses already do), then advertise `authorization_response_iss_parameter_supported: true`. Do both together or neither.

## 5. 🧑 Reviewer account (no MFA)

Reviewers must sign in "with no further configuration", with no MFA, no email or SMS codes, no magic links and no private network.

- [ ] Create a **dedicated** MonstarX account on a mailbox MonstarX controls, e.g. `openai-review@` your domain. Sign up with **email + password**, not Google or GitHub.
- [ ] Confirm the sign-up email yourself, once.
- [ ] **Two-step verification off** for this account.
- [ ] Make sure the sign-in provider doesn't ask this account for an **email code on a new device or browser**. The MonstarX docs say the provider sends verification codes for new devices, so check that setting.
- [ ] Test the full ChatGPT **Connect** flow from a fresh private window on another network (e.g. a phone hotspot). Only email + password + **Allow** should be needed.
- [ ] Give the account enough plan allowance for repeated runs of P3 and P4. Check with `get_account`.
- [ ] Create the sample data from [openai-review.md §1](./openai-review.md#1-reviewer-account-sample-data-must-exist-before-you-run-the-cases): project **Sunrise Yoga**, preview running, no missing secrets, published once.
- [ ] Enter the credentials **only** in the portal: **Metadata & Skills → Review information → Review details**. Include the login URL `https://monstarx.com/login`, email, password, and short instructions, e.g. "In ChatGPT click Connect; on monstarx.com sign in with this email and password and press Allow. Sample project: Sunrise Yoga." Never put credentials in the ZIP, the repo or chat. The ZIP importer rejects `test_credentials` and `reviewer_instructions`.
- [ ] Keep the account and data alive for later reviews. If the password changes, update the draft.

## 6. 🧑 Run all 8 cases on both surfaces

- [ ] **ChatGPT:** Settings → Developer mode on → add custom MCP server `https://monstarx.com/mcp` with OAuth → sign in with the reviewer account → run P1–P5 and N1–N3 from `plugin.json`.
- [ ] **Codex** (local plugin install for testing; this doesn't publish anything):

  ```bash
  mkdir -p ~/.codex/plugins ~/.agents/plugins
  git clone https://github.com/monstarx-tech/monstarx-cursor-plugin.git ~/.codex/plugins/monstarx
  # If ~/.agents/plugins/marketplace.json already exists, add the entry instead of overwriting it.
  cat > ~/.agents/plugins/marketplace.json <<'JSON'
  {
    "name": "monstarx-local",
    "interface": { "displayName": "MonstarX (local test)" },
    "plugins": [
      {
        "name": "monstarx",
        "source": { "source": "local", "path": "./.codex/plugins/monstarx" },
        "policy": { "installation": "AVAILABLE", "authentication": "ON_INSTALL" },
        "category": "Developer Tools"
      }
    ]
  }
  JSON
  ```

  Restart the ChatGPT desktop app or Codex, install **MonstarX** from "MonstarX (local test)" and sign in. Then run the cases, plus the push flow from the demo script. To test the MCP server only, use `codex mcp add monstarx --url https://monstarx.com/mcp && codex mcp login monstarx`.
- [ ] If a case doesn't behave as written, fix the server or skill, or reword the case in `plugin.json`, then rebuild the ZIP.

## 7. 🧑 Demo video

- [ ] Record using the shot list in [openai-review.md §4](./openai-review.md#4-demo-recording-script-what-to-record).
- [ ] Host it unlisted or link-shared, and check that it plays signed out.
- [ ] Set `extensions.com.openai.review.demo_recording_url` in `plugin.json`, commit, and run `node scripts/validate-plugin.mjs --release`. That check fails while the URL is empty.
- [ ] Rebuild the ZIP (§8). ⚠️ While the ZIP carries `"demo_recording_url": ""`, a URL typed only in the dashboard is **cleared** at submit, because package values are reapplied. Put the URL in the package.

## 8. ZIP artifact

Build: `node scripts/build-openai-zip.mjs` (add `--release` once the demo URL is set). Output: `dist/monstarx-openai-plugin-<version>.zip` (gitignored). The builder validates the staged copy, refuses `.git`, `.env*`, keys and node_modules, scans for token patterns, and writes fixed timestamps so the same commit gives the same bytes.

Contents (plugin root = archive root):

| Path | Purpose |
| --- | --- |
| `plugin.json` | Agent Plugins manifest + `extensions.com.openai` (listing, review, publication) |
| `mcp.json` | One remote server: `monstarx` → `streamable-http` `https://monstarx.com/mcp` (no headers or keys) |
| `skills/monstarx-project/SKILL.md` | Onboarding skill |
| `assets/logo.svg` | Logo + composer icon (square 128×128 viewBox) |
| `LICENSE`, `README.md` | MIT license, overview |

Not included: `.git/`, `.cursor-plugin/`, `mcp.cursor.json` (Cursor-only), `scripts/`, `docs/` (reviewer notes stay out of the package), and any `.env` or credentials.

**Prepared artifact (Grok Bot box, not in git):** `/workspace/monstarx-openai-plugin-1.0.0.zip`, 12,295 bytes, 6 files, built from commit `10680ae`.
sha256 `0baa5e02ad4a8fb67a680c6440bae80195a070be5ec95f6af56ed088acc0c38b`. Rebuilding that commit gives the same bytes.
It has `demo_recording_url: ""`, so it's **upload-ready for a draft and automated checks, not submit-ready**. Finish §7, then rebuild with `--release`.

## 9. 🧑 Portal steps (platform.openai.com/plugins)

1. [ ] Open **Plugins** → select the org/project from §1 → **Upload new or existing plugin**.
2. [ ] Choose the verified **Developer identity** → **Upload plugin** → select the ZIP (use the **With MCP** path, because an MCP server can't be added to a skills-only plugin later).
3. [ ] **Metadata & Skills:** wait for the metadata checks and the skill safety scan (up to about 2 hours). Use **Copy issues**, fix them in the repo, rebuild, and **Upload plugin** again.
4. [ ] **MCPs → monstarx → Connect:** URL `https://monstarx.com/mcp`, Authentication OAuth (CIMD). Complete the **domain challenge** (§3), connect and sign in, then wait for the **tool scan**. Expect 15 tools. Check every annotation against §2.
5. [ ] Enter the **justification** for each tool's hints (copy from [openai-review.md §3](./openai-review.md#justification-text-paste-per-tool-after-scan-tools-adjust-if-you-change-a-value)).
6. [ ] **Review information → Review details:** confirm the 5 + 3 imported cases, demo URL, commerce = no, and release notes. Enter the reviewer credentials (§5), then **Save details**.
7. [ ] Check **country availability** (the package doesn't set `publication.countries`, so the dashboard setting applies) and any translations.
8. [ ] 🛑 **Submit for review** and accept the attestations. Saad does this, and only when ready. Only one review can be active at a time; to change the package mid-review, **Cancel Review** first.
9. [ ] After approval: **Publish plugin**. Email press@openai.com before any public announcement.

Later updates: bump `version` in `plugin.json` (and `.cursor-plugin/plugin.json`), rebuild, and upload to the **same** plugin. The `name` must stay `monstarx`, and the MCP origin `https://monstarx.com` can't change. Hosted tool changes are rescanned automatically and don't need a new ZIP.
