---
name: notion-cli
description: Use this skill for ANY Notion-related tasks including listing databases, viewing pages, getting transcripts, exporting markdown, creating pages, updating pages, and running bidirectional sync. Always invoke this skill when the user mentions Notion. (project)
version: 0.3.0
tags: [notion, cli, export, sync, transcripts, pages, update]
auto_invoke: true
triggers: [notion, transcript, page, database, sync]
---

# Notion CLI Skill

## Important: Project Location
**The Notion CLI is located in the MAIN project directory** (`/Users/soladugbo/Desktop/DEV/NotionSync`),
NOT in this `.claude/skills/notion-cli` directory. This directory only contains skill documentation.

All commands must be run from the main project root: `/Users/soladugbo/Desktop/DEV/NotionSync`

## Quick Start Workflow (First Time Setup)

When invoked, follow these steps in order:

1. **Build the project** (if not already built):
   ```bash
   cd /Users/soladugbo/Desktop/DEV/NotionSync
   npm install && npm run build
   ```

2. **Verify authentication**:
   ```bash
   node dist/index.js auth status --json
   ```
   Expected output: `{"token_present": true, ...}`

3. **List available databases**:
   ```bash
   node dist/index.js db list --json
   ```

4. **For retrieving meeting notes or transcripts**:
   - Find the "Meeting Notes" database ID from step 3
   - Export to temporary directory:
     ```bash
     node dist/index.js db export --id <DATABASE_ID> --dir /tmp/notion_export --format markdown
     ```
   - List exported files:
     ```bash
     ls -la /tmp/notion_export/meeting-notes/
     ```
   - Read the relevant markdown file(s) using the Read tool

## Common Commands

### Authentication
```bash
node dist/index.js auth status --json
```

### Database Operations
```bash
# List all databases
node dist/index.js db list --json

# Get database schema
node dist/index.js db schema --id <dbId> --json

# Export database to markdown
node dist/index.js db export --id <dbId> --dir /tmp/notion_export --format markdown

# Export database to JSON
node dist/index.js db export --id <dbId> --dir /tmp/notion_export --format json
```

### Page Operations
```bash
# Get a specific page
node dist/index.js page get --id <pageId> --json

# Update page properties
node dist/index.js page update --id <pageId> --title "New Title"

# Append content to page
node dist/index.js page append --id <pageId> --content content.md

# Create page in database
node dist/index.js db create --id <dbId> --title "Title" --content content.md
```

### Search
```bash
node dist/index.js search "query text"
```

## Known Databases

Based on the workspace, these databases are available:
- **Meeting Notes** (`299e04cb-aa2b-8035-b364-e91a20986977`)
- **Document Hub** (`299e04cb-aa2b-80ec-b7f9-d54805405e67`)

## Workflow for "Get meeting summary" requests

1. Export Meeting Notes database:
   ```bash
   node dist/index.js db export --id 299e04cb-aa2b-8035-b364-e91a20986977 --dir /tmp/notion_export --format markdown
   ```

2. List exported files:
   ```bash
   ls -la /tmp/notion_export/meeting-notes/
   ```

3. Read relevant meeting file(s) with Read tool:
   - Kickoff meetings: Look for files with "kickoff" in name
   - Use Read tool on the markdown files

4. Provide summary to user based on file contents

## Important Notes

- **Always run commands from project root**: `/Users/soladugbo/Desktop/DEV/NotionSync`
- **Use --json flag** for machine-readable output when possible
- **Never print NOTION_TOKEN** in responses
- **Export warnings**: Transcription blocks are not supported by Notion API (expected warnings)
- **Auto-refresh**: DB commands auto-pull with 60s TTL. Disable with `--no-refresh`
- **Temporary exports**: Use `/tmp/notion_export` for temporary exports to avoid cluttering workspace

## Prerequisites

- NOTION_TOKEN must be set in `.env` file
- Dependencies installed (`npm install`)
- Project built (`npm run build`)
- Notion integration shared with target databases (in Notion: Share → Invite integration)

## Troubleshooting

**"Cannot find module dist/index.js"**
→ Run `npm run build` from project root

**"token_present": false**
→ Check `.env` file contains `NOTION_TOKEN=...`

**Empty database list**
→ Share the integration with databases in Notion (Share → Invite)

**Export shows 0 pages**
→ Verify database ID is correct with `db list` command
