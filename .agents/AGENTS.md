# Agent Guide: Notion Integration (Scope: repo)

This repo provides a TypeScript CLI and sync engine for reading/writing Notion data, exporting Markdown, and maintaining a local mirror. Agents should use the CLI (preferred) or the API wrapper. For Claude-based agents, a Markdown skill is available at `.claude/skills/notion-cli/SKILL.md`. Follow the safety and usage guidelines below.

## Environment

- Required: `NOTION_TOKEN` in `.env` (internal integration) – never log or share.
- Optional: `NOTION_VERSION` (default `2022-06-28`), `NOTION_API_BASE` (default `https://api.notion.com`).
- Logging: structured via `pino`; redact secrets. Set `LOG_LEVEL=debug` for verbose output.

## CLI Entrypoint

- Build first: `npm install && npm run build`
- Run: `node dist/index.js --help` (or add `bin` to PATH via `npm link` if desired).
- Main command groups:
  - `auth`: `notion auth status`
  - `db`: `notion db list|schema|pull|create|push|export`
  - `search`: `notion search "query"`
  - `sync`: `notion sync once|run`
  - `transcripts`: `notion transcripts export`

## Common Tasks

- Verify token: `node dist/index.js auth status --json`
- List databases (ensure the integration is shared to targets): `node dist/index.js db list --json`
- Get schema: `node dist/index.js db schema --id <dbId> --json`
- Pull pages (JSON): `node dist/index.js db pull --id <dbId> --out data.json`
- Create page (title; optional content): `node dist/index.js db create --id <dbId> --title "My Page" [--props props.json] [--content content.md]`
- Upsert records from JSON (with optional mapping):
  - `node dist/index.js db push --id <dbId> --src records.json [--map config/mapping.example.yml] [--dry-run] [--update-only]`
- Export Markdown/JSON snapshot:
  - `node dist/index.js db export --id <dbId> --dir notion_export --format markdown`
  - Writes into `notion_export/<database-slug>/...`
- Bidirectional sync (local mirror):
  - One-time: `node dist/index.js sync once --dir ~/notion-sync`
  - Daemon: `node dist/index.js sync run --dir ~/notion-sync --interval 60`
  - Layout: `~/notion-sync/<database-slug>/*.md` with YAML frontmatter (page_id, database_id, last_edited_time, url). State at `~/notion-sync/.state.json`.

## Transcripts

- Notion AI transcription blocks are not accessible via API; exporter marks placeholders.
- If transcript text is pasted as regular content on the page, it will sync/export normally.
- Inventory audio and transcription presence:
  - `node dist/index.js transcripts export --id <meetingDbId> --dir transcripts [--download]`
  - Outputs `transcripts/index.json` with page ids, titles, audio URLs, and flags.

## Safety & Policies

- Never log or commit secrets (`NOTION_TOKEN`, emails, request payloads). Redaction is enabled.
- Handle rate limits: the client wrapper retries with backoff and honors `Retry-After`.
- Confirm before destructive actions. The current CLI avoids deletions except when replacing page content during push from local Markdown (block archive). Do not alter that behavior without explicit user confirmation.
- Prefer CLI over writing new scripts. If extending, keep modules small and testable.
- Auto-refresh: DB-specific commands perform a quick incremental pull first (default 60s TTL). Disable per-call with `--no-refresh` or globally via `NOTION_AUTO_REFRESH=false`. Adjust TTL with `NOTION_REFRESH_TTL_MS`.

## Codex Agent Playbook: Summarize latest meeting → Notion summary page

Goal: find the most recent Meeting Notes page, summarize it, and create a summary page in a destination database (e.g., Document Hub).

Steps:
- Sync latest content locally: `node dist/index.js sync once --dir ~/notion-sync`
- Identify the newest file in `~/notion-sync/meeting-notes/` by `notion_last_edited_time` (frontmatter) or file mtime.
- Read the Markdown body and produce a concise summary (decisions, actions, owners, dates).
- Save summary to `summary.md`.
- Create page in destination DB with content: `node dist/index.js db create --id <destDbId> --title "Meeting Summary - <YYYY-MM-DD>" --content summary.md`
- Report the created page id and link.

## Extending

- Add new CLI commands under `src/cli/` and export from `src/index.ts`.
- The Notion client wrapper lives in `src/notion/` (client, pagination, markdown read/write).
- Mapping helpers in `src/mapping/` (config loader and property formatting). Extend for more property types as needed.
- Sync engine in `src/sync/` – supports pull+push with timestamp-based conflict policy (prefer newest). Make policy configurable if required.

## Known Limitations

- Write coverage (Markdown → Notion) supports a core set of blocks (headings, paragraphs, lists, todos, quotes, code, dividers). Add more as needed.
- AI transcription blocks are not retrievable via API. Workaround: paste transcript as text on page.
- Properties sync from frontmatter to Notion is not enabled by default; can be added if needed.


