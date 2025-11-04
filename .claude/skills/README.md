# Skills for Claude Code

This directory declares Claude Code skills as folders containing a `SKILL.md` with YAML frontmatter and Markdown instructions. The `notion-cli` skill wraps the local Notion CLI to list databases, export content, and run bidirectional sync.

Notes
- Skills are Markdown-first; Claude reads instructions and chooses commands to run.
- Assume `npm install && npm run build` has been run in this repo.
- If the `notion` bin is not globally linked, commands use `node dist/index.js ...`.
- Ensure `.env` includes a valid `NOTION_TOKEN` and the integration is shared to target databases.

Best practices (for Claude runners)
- Load skills from `.claude/skills/` and parse SKILL.md frontmatter.
- Prefer `--json` outputs where available for structured parsing.
- Treat write operations carefully and surface confirmation when appropriate.
- Run setup once (install + build) before first use.
- Capture stdout/stderr and exit code; surface helpful errors.
