---
name: notion-cli
description: Minimal Notion CLI skill for listing databases, exporting markdown, creating pages, and running bidirectional sync.
version: 0.1.2
tags: [notion, cli, export, sync]
---

Prereqs
- Set NOTION_TOKEN; run: 
pm install && npm run build.
- Share the integration with target databases (Notion ? Share ? Invite).

Core
- Auth: 
ode dist/index.js auth status --json
- List DBs: 
ode dist/index.js db list --json
- Schema: 
ode dist/index.js db schema --id <dbId> --json
- Export MD: 
ode dist/index.js db export --id <dbId> --dir notion_export --format markdown
- Sync once: 
ode dist/index.js sync once --dir ~/notion-sync
- Create with content: 
ode dist/index.js db create --id <dbId> --title "Title" --content content.md

Notes
- Use --json for parsing; never print NOTION_TOKEN.
- Write ops create/modify pages/files; confirm dirs and IDs first.
- Auto-refresh: DB commands do a quick incremental pull first (60s TTL). Disable with --no-refresh or env NOTION_AUTO_REFRESH=false.
