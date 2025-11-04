# Notion Integration CLI (Scaffold)

Production-ready scaffold for a TypeScript/Node 20+ Notion integration.

## Quickstart

1. Copy `.env.example` to `.env` and set `NOTION_TOKEN`.
2. Install deps: `npm install`.
3. Build: `npm run build`.
4. Run CLI: `node dist/index.js --help` (or add to PATH with `npm link`).

## Commands (scaffold)

- `notion auth status` – show auth env status.
- `notion db list` – list databases (stub).
- `notion db schema --id <dbId>` – get schema (stub).
- `notion db pull --id <dbId>` – pull rows (stub).
- `notion db push --id <dbId> --src data.json [--map config/mapping.yml]` – upsert records.
- `notion search "<query>"` – search.
- `notion db export --id <dbId> --dir notion_export --format markdown|json` – export pages to files.

## Project Structure

- `src/index.ts` – CLI entrypoint.
- `src/cli/` – command implementations (stubs for now).
- `src/notion/` – client factory, pagination helpers.
- `src/mapping/` – mapping schemas (TBD).
- `src/sync/` – sync engine (TBD).
- `config/` – example mapping and sync configs.
- `tests/` – unit tests.

## Next Steps

- Sync engine with checkpoints and retries.
- Webhook receiver + schedule.
