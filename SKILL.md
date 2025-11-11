---
name: notion-cli
description: Minimal Notion CLI skill for listing databases, exporting markdown, creating pages, and running bidirectional sync.
version: 0.1.2
tags: [notion, cli, export, sync]
---

# Notion CLI Skill

A TypeScript/Node.js CLI for interacting with Notion databases and pages.

## Prerequisites

- Set `NOTION_TOKEN` in `.env` file
- Run: `npm install && npm run build`
- Share the integration with target databases in Notion (Share → Invite)

## Core Commands

### Auth
```bash
node dist/index.js auth status --json
```

### Database Commands
```bash
# List all databases
node dist/index.js db list --json

# Get database schema
node dist/index.js db schema --id <dbId> --json

# Export database to markdown
node dist/index.js db export --id <dbId> --dir notion_export --format markdown

# Create page with content
node dist/index.js db create --id <dbId> --title "Title" --content content.md
```

### Page Commands
```bash
# Get page information
node dist/index.js page get --id <pageId> --json

# Append content to page
node dist/index.js page append --id <pageId> --content file.md

# Update page properties
node dist/index.js page update --id <pageId> --title "New Title"

# Archive (delete) a page
node dist/index.js page archive --id <pageId> --json

# Restore an archived page
node dist/index.js page restore --id <pageId> --json
```

### Sync Commands
```bash
# Run bidirectional sync
node dist/index.js sync once --dir ~/notion-sync
```

### Search Commands
```bash
# Search for pages/databases
node dist/index.js search "<query>" --json
```

## Notes

- Use `--json` flag for parsing; never print `NOTION_TOKEN`.
- Write operations (create/modify pages/files) - confirm directories and IDs first.
- Auto-refresh: DB commands do a quick incremental pull first (60s TTL). Disable with `--no-refresh` or env `NOTION_AUTO_REFRESH=false`.

## Examples

### Archive old documents
```bash
# Archive a document
node dist/index.js page archive --id 2a7e04cb-aa2b-8128-a456-c2c3f32082a8 --json

# Output:
# {
#   "success": true,
#   "id": "2a7e04cb-aa2b-8128-a456-c2c3f32082a8",
#   "title": "Old Document",
#   "archived": true
# }
```

### Create a new page
```bash
# Create content.md first
echo "# My Document\n\nContent here" > content.md

# Create page in database
node dist/index.js db create --id <database-id> --title "My New Page" --content content.md
```

### Export database to markdown
```bash
# Export all pages in a database
node dist/index.js db export --id <database-id> --dir ./exports --format markdown

# Creates: ./exports/page-1.md, ./exports/page-2.md, etc.
```

## Project Structure

```
NotionSync/
├── src/
│   ├── index.ts          # CLI entrypoint
│   ├── cli/              # Command implementations
│   │   ├── auth.ts       # Auth commands
│   │   ├── db.ts         # Database commands
│   │   ├── page.ts       # Page commands (get, append, update, archive, restore)
│   │   ├── search.ts     # Search commands
│   │   └── sync.ts       # Sync commands
│   ├── notion/           # Notion client factory
│   ├── mapping/          # Mapping schemas
│   ├── sync/             # Sync engine
│   └── utils/            # Utility functions
├── config/               # Example configs
├── tests/                # Unit tests
├── dist/                 # Built JavaScript
├── .env                  # Environment variables (NOTION_TOKEN)
├── package.json
└── tsconfig.json
```

## Development

```bash
# Install dependencies
npm install

# Build TypeScript
npm run build

# Run CLI
node dist/index.js --help

# Run tests
npm test
```

## Environment Variables

Required in `.env`:
```env
NOTION_TOKEN=secret_xxx...
NOTION_VERSION=2022-06-28
NOTION_API_BASE=https://api.notion.com
```

## API Reference

All commands support `--json` flag for machine-readable output.

### Return Formats

**Success:**
```json
{
  "success": true,
  "data": { ... }
}
```

**Error:**
```json
{
  "success": false,
  "error": "Error message"
}
```
