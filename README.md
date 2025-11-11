# Notion Integration CLI (Scaffold)

Production-ready scaffold for a TypeScript/Node 20+ Notion integration.

## Quickstart

1. Copy `.env.example` to `.env` and set `NOTION_TOKEN`.
2. Install deps: `npm install`.
3. Build: `npm run build`.
4. Run CLI: `node dist/index.js --help` (or add to PATH with `npm link`).

## Commands

### Auth
- `notion auth status` – show auth env status.

### Database Commands
- `notion db list` – list databases.
- `notion db schema --id <dbId>` – get database schema.
- `notion db pull --id <dbId>` – pull rows (stub).
- `notion db push --id <dbId> --src data.json [--map config/mapping.yml]` – upsert records.
- `notion db export --id <dbId> --dir notion_export --format markdown|json` – export pages to files.
- `notion db create --id <dbId> --title "Title" --content content.md` – create page with content.

### Page Commands
- `notion page get --id <pageId>` – get page information.
- `notion page append --id <pageId> --content file.md` – append content to existing page.
- `notion page update --id <pageId> --title "New Title"` – update page properties.
- `notion page archive --id <pageId>` – archive (delete) a page.
- `notion page restore --id <pageId>` – restore an archived page.

### Search Commands
- `notion search "<query>"` – search pages and databases.

### Sync Commands
- `notion sync once --dir ~/notion-sync` – run bidirectional sync.

## Project Structure

- `src/index.ts` – CLI entrypoint.
- `src/cli/` – command implementations (stubs for now).
- `src/notion/` – client factory, pagination helpers.
- `src/mapping/` – mapping schemas (TBD).
- `src/sync/` – sync engine (TBD).
- `config/` – example mapping and sync configs.
- `tests/` – unit tests.

## Usage Examples

### Archive a page
```bash
node dist/index.js page archive --id <pageId> --json
```

### Restore an archived page
```bash
node dist/index.js page restore --id <pageId> --json
```

### Export database to markdown
```bash
node dist/index.js db export --id <dbId> --dir ./exports --format markdown
```

## Documentation

See [SKILL.md](./SKILL.md) for detailed command reference and examples.

## Next Steps

- Sync engine with checkpoints and retries.
- Webhook receiver + schedule.
