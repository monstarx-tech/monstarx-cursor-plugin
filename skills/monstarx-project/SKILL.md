---
name: monstarx-project
description: Create, edit, push, and publish real full-stack MonstarX apps. Use when the user wants to ship to MonstarX (Cloud backend, Admin, publish), push local changes, ask MonstarX to build, or get a live link.
---

# MonstarX project workflow

MonstarX ships real full-stack apps (not mockups): live preview, MonstarX Cloud backend, Admin CMS, versions, secrets, publish, and GitHub sync. Use this skill when your coding agent or assistant (ChatGPT, Codex, Cursor or another MCP client) should push local work to MonstarX, pull MonstarX builds back, ask the builder to change the app, or publish a shareable link — without hand-rolling MCP setup.

## Available tools

`get_account`, `list_projects`, `get_project`, `prepare_upload`, `import_from_github`, `push_files`, `create_project`, `read_files`, `download_project`, `send_message`, `get_messages`, `stop`, `publish_project`, `set_secrets`, `get_logs`

## Pick the path for your surface

- **With a shell (Codex, Cursor, Claude Code):** push and pull whole folders with `prepare_upload` / `download_project`.
- **Without a shell (ChatGPT chat, the Claude app):** start apps with `create_project`, bring existing ones in with `import_from_github`, and use `push_files` only for a few small text files. Do not hand the user an upload command they cannot run.

## When to use

- “Push this app to MonstarX and give me the link.”
- Create a new MonstarX project from a description
- Push local changes as a new version
- Ask MonstarX’s builder to change the app
- Publish a live version
- Import from GitHub

## Create a new project from a description

1. Call `create_project` with a clear description (and any images/docs if the tool accepts them).
2. Wait for MonstarX to finish building (`get_messages` can wait for the reply).
3. Call `get_project` and report the project link, preview status, and any missing secrets.
4. If secrets are missing, ask the user for values and call `set_secrets` — never invent or log secrets.

## Push a local app folder

1. Call `prepare_upload` for a new project or a new version of an existing one.
2. Run the returned upload command from the app root (where `package.json` lives). Do not upload `node_modules`, build output, or `.env` files.
3. On success, call `get_project` and share the project / preview link.
4. If the push is refused because MonstarX changed since your copy: `download_project`, merge, then `prepare_upload` again.
5. If the upload looks like the wrong folder (far fewer files than the project), stop and confirm the working directory.

## Edit via MonstarX’s builder

1. Call `send_message` with what to build or change.
2. Optionally `get_messages` until MonstarX finishes.
3. Prove the result with `get_project` (and `get_logs` if the preview failed).

## Publish

1. Confirm with the user before publishing (publishing always asks first).
2. Call `publish_project`.
3. Call `get_project` and report the live URL / publish status.

## Small edits without a full upload

Use `push_files` for a few files when there is no shell upload path. Prefer `prepare_upload` for real app folders.

## Import from GitHub

Use `import_from_github` with the repository URL. Private repos need GitHub connected in MonstarX first.

## Safety rules

- Tools act only on projects in the connected account. If the user asks about someone else's account or projects, say you cannot reach them.
- There is no delete tool. Never imitate deletion with `push_files` (`delete`) or `prepare_upload` (`force`); point the user to MonstarX itself.
- Use `force: true` on `prepare_upload` only when the user explicitly says to overwrite changes made in MonstarX.
- Publish only when the user asked for it in this conversation; publishing is public.
- `set_secrets` takes only values the user gave you or asked you to copy from their local `.env`. Never invent, guess or echo a secret back.
- `create_project` and `send_message` use the user's MonstarX plan allowance; call them only for requests the user made.

## Prove success

After create, push, import, builder work, or publish, always call `get_project` and summarize:

- Project link
- What MonstarX is doing / preview state
- Publish state and live URL if any
- Missing secrets

## Limits and gotchas

- Uploads: up to 100 MB `.tar.gz` / 50 MB `.zip`; files over 10 MB are skipped.
- `push_files`: 200 files, 400 KB each, 2 MB per call.
- Upload/download links are one-time, 15 minutes.
- A push that would delete most of a project is refused.
- Pushes are refused while MonstarX is building in that project.
- `send_message` / `create_project` use plan allowance; push/import/download/read/publish do not.