import type { Command } from 'commander';
import type { Logger } from '../utils/logger.js';
import { loadEnv } from '../utils/env.js';
import { createNotionClient } from '../notion/client.js';
import { loadMapping } from '../mapping/loader.js';
import { toNotionProperties } from '../mapping/format.js';
import { fetchAllBlocks, blocksToMarkdown } from '../notion/markdown.js';
import path from 'node:path';
import { markdownToBlocks } from '../notion/markdown_write.js';
import { ensureFresh } from '../sync/refresh.js';

export function registerDbCommands(program: Command, logger: Logger) {
  const db = program.command('db').description('Database commands');

  db
    .command('list')
    .description('List databases accessible to the integration')
    .option('--json', 'Output JSON')
    .action(async (opts) => {
      const env = loadEnv(true);
      if (!('NOTION_TOKEN' in env) || !env.NOTION_TOKEN) {
        logger.error('NOTION_TOKEN is not set. See .env.example');
        process.exitCode = 1;
        return;
      }
      const { client, call } = createNotionClient({
        auth: env.NOTION_TOKEN,
        notionVersion: env.NOTION_VERSION,
        baseUrl: env.NOTION_API_BASE,
        logger,
      });

      // Notion API does not have a direct list databases endpoint.
      // We search for objects where object === 'database'.
      const results = await call(() => client.search({ filter: { property: 'object', value: 'database' } }));
      const items = results.results.map((r: any) => ({ id: r.id, title: r?.title?.[0]?.plain_text ?? '' }));
      if (opts.json) console.log(JSON.stringify(items, null, 2));
      else items.forEach((d) => logger.info(d, 'Database'));
    });

  db
    .command('schema')
    .requiredOption('--id <databaseId>', 'Database ID')
    .option('--json', 'Output JSON')
    .option('--no-refresh', 'Skip auto-refresh for this command')
    .description('Get database schema')
    .action(async (opts) => {
      const env = loadEnv(true);
      if (!('NOTION_TOKEN' in env) || !env.NOTION_TOKEN) {
        logger.error('NOTION_TOKEN is not set. See .env.example');
        process.exitCode = 1;
        return;
      }
      const { client, call } = createNotionClient({
        auth: env.NOTION_TOKEN,
        notionVersion: env.NOTION_VERSION,
        baseUrl: env.NOTION_API_BASE,
        logger,
      });
      if (!opts.noRefresh) await ensureFresh({ client: client, logger, databaseId: opts.id });
      const db = await call(() => client.databases.retrieve({ database_id: opts.id }));
      if (opts.json) console.log(JSON.stringify(db, null, 2));
      else logger.info({ id: db.id, title: (db as any).title?.[0]?.plain_text ?? '', properties: Object.keys(db.properties) }, 'Database schema');
    });

  db
    .command('pull')
    .requiredOption('--id <databaseId>', 'Database ID')
    .option('--since <iso>', 'ISO timestamp to filter updates (not strictly enforced)')
    .option('--out <file>', 'Output file (JSON), default stdout')
    .option('--no-refresh', 'Skip auto-refresh for this command')
    .description('Pull pages from a database')
    .action(async (opts) => {
      const env = loadEnv(true);
      if (!('NOTION_TOKEN' in env) || !env.NOTION_TOKEN) {
        console.error('NOTION_TOKEN is not set. See .env.example');
        process.exitCode = 1;
        return;
      }
      const { client, call } = createNotionClient({
        auth: env.NOTION_TOKEN,
        notionVersion: env.NOTION_VERSION,
        baseUrl: env.NOTION_API_BASE,
        logger,
      });
      if (!opts.noRefresh) await ensureFresh({ client, logger, databaseId: opts.id });
      const query = await call(() => client.databases.query({ database_id: opts.id }));
      const data = query.results;
      const json = JSON.stringify(data, null, 2);
      if (opts.out) {
        await import('node:fs/promises').then((m) => m.writeFile(opts.out, json, 'utf8'));
        logger.info({ count: data.length, file: opts.out }, 'Pulled pages');
      } else {
        console.log(json);
      }
    });

  db
    .command('create')
    .requiredOption('--id <databaseId>', 'Database ID')
    .requiredOption('--title <title>', 'Title for the new page')
    .option('--props <file>', 'Optional JSON file of additional raw Notion properties to merge')
    .option('--content <file>', 'Optional Markdown file to append as page content')
    .option('--no-refresh', 'Skip auto-refresh for this command')
    .option('--json', 'Output JSON of the created page')
    .description('Create a new page in a database with a title')
    .action(async (opts) => {
      const env = loadEnv(true);
      if (!('NOTION_TOKEN' in env) || !env.NOTION_TOKEN) {
        logger.error('NOTION_TOKEN is not set. See .env.example');
        process.exitCode = 1;
        return;
      }
      const { client, call } = createNotionClient({
        auth: env.NOTION_TOKEN,
        notionVersion: env.NOTION_VERSION,
        baseUrl: env.NOTION_API_BASE,
        logger,
      });
      if (!opts.noRefresh) await ensureFresh({ client, logger, databaseId: opts.id });

      // Retrieve database to locate the title property key
      const database = await call(() => client.databases.retrieve({ database_id: opts.id }));
      const titlePropEntry = Object.entries(database.properties).find(([, v]: any) => v?.type === 'title');
      if (!titlePropEntry) {
        logger.error('Database has no title property');
        process.exitCode = 1;
        return;
      }
      const [titleKey] = titlePropEntry as [string, any];

      let extraProps: any = {};
      if (opts.props) {
        const fs = await import('node:fs/promises');
        const raw = await fs.readFile(opts.props, 'utf8');
        try {
          extraProps = JSON.parse(raw);
        } catch (e) {
          logger.error({ file: opts.props }, 'Invalid JSON in --props');
          process.exitCode = 1;
          return;
        }
      }

      const properties: any = {
        [titleKey]: {
          title: [
            {
              type: 'text',
              text: { content: String(opts.title) },
            },
          ],
        },
        ...extraProps,
      };

      const page = await call(() =>
        client.pages.create({
          parent: { database_id: opts.id },
          properties,
        }),
      );

      if (opts.content) {
        const fs = await import('node:fs/promises');
        const md = await fs.readFile(opts.content, 'utf8');
        const blocks = markdownToBlocks(md);
        const batchSize = 90;
        for (let i = 0; i < blocks.length; i += batchSize) {
          const slice = blocks.slice(i, i + batchSize);
          await call(() => client.blocks.children.append({ block_id: page.id, children: slice as any }));
        }
      }
      if (opts.json) console.log(JSON.stringify(page, null, 2));
      else logger.info({ id: page.id }, 'Created page');
    });

  db
    .command('push')
    .requiredOption('--id <databaseId>', 'Database ID')
    .requiredOption('--src <file>', 'Source JSON array file of records')
    .option('--map <file>', 'Mapping config (yaml/json)')
    .option('--update-only', 'Only update existing matches, do not create new', false)
    .option('--dry-run', 'Do not write, just print planned actions', false)
    .option('--no-refresh', 'Skip auto-refresh for this command')
    .description('Upsert records into a Notion database using a mapping config')
    .action(async (opts) => {
      const env = loadEnv(true);
      if (!('NOTION_TOKEN' in env) || !env.NOTION_TOKEN) {
        logger.error('NOTION_TOKEN is not set. See .env.example');
        process.exitCode = 1;
        return;
      }
      const { client, call } = createNotionClient({
        auth: env.NOTION_TOKEN,
        notionVersion: env.NOTION_VERSION,
        baseUrl: env.NOTION_API_BASE,
        logger,
      });
      if (!opts.noRefresh) await ensureFresh({ client, logger, databaseId: opts.id });

      const fs = await import('node:fs/promises');
      const raw = await fs.readFile(opts.src, 'utf8');
      const items = JSON.parse(raw);
      if (!Array.isArray(items)) throw new Error('Source must be a JSON array');

      const mapping = opts.map ? await loadMapping(opts.map) : null;
      const db = await call(() => client.databases.retrieve({ database_id: opts.id }));
      const dbProps = db.properties as Record<string, any>;
      const titlePropEntry = Object.entries(dbProps).find(([, v]: any) => v?.type === 'title');
      if (!titlePropEntry) throw new Error('Database missing title property');
      const [titleKey] = titlePropEntry as [string, any];

      let created = 0, updated = 0, skipped = 0;
      for (const it of items) {
        const titleVal = mapping ? (it.title ?? it[mapping.title.path]) : it.title;
        const matchPropName = mapping?.match_property ?? titleKey;
        // Build filter for exact match; best effort depending on property type
        const propType = dbProps[matchPropName]?.type ?? 'title';
        const filter: any = { property: matchPropName };
        if (propType === 'title') filter.title = { equals: String(titleVal ?? '') };
        else if (propType === 'select') filter.select = { equals: String(titleVal ?? '') };
        else if (propType === 'rich_text') filter.rich_text = { equals: String(titleVal ?? '') };
        else if (propType === 'number') filter.number = { equals: Number(titleVal ?? 0) };
        else {
          // Fallback: try rich_text equals
          filter.rich_text = { equals: String(titleVal ?? '') };
        }
        const q = await call(() => client.databases.query({ database_id: opts.id, filter, page_size: 1 }));
        const existing = q.results[0] as any | undefined;

        const properties = mapping ? toNotionProperties(it, mapping, dbProps) : { [titleKey]: { title: [{ type: 'text', text: { content: String(titleVal ?? '') } }] } };

        if (existing) {
          if (opts.dry_run) {
            logger.info({ id: existing.id, action: 'update', title: titleVal }, 'Dry run');
            skipped++;
            continue;
          }
          await call(() => client.pages.update({ page_id: existing.id, properties }));
          updated++;
        } else if (!opts.update_only) {
          if (opts.dry_run) {
            logger.info({ action: 'create', title: titleVal }, 'Dry run');
            skipped++;
            continue;
          }
          await call(() => client.pages.create({ parent: { database_id: opts.id }, properties }));
          created++;
        } else {
          skipped++;
        }
      }
      logger.info({ created, updated, skipped }, 'Push summary');
    });

  db
    .command('export')
    .requiredOption('--id <databaseId>', 'Database ID')
    .option('--dir <dir>', 'Output directory', 'notion_export')
    .option('--format <fmt>', 'markdown|json', 'markdown')
    .option('--no-refresh', 'Skip auto-refresh for this command')
    .description('Export database pages to local files')
    .action(async (opts) => {
      const env = loadEnv(true);
      if (!('NOTION_TOKEN' in env) || !env.NOTION_TOKEN) {
        logger.error('NOTION_TOKEN is not set. See .env.example');
        process.exitCode = 1;
        return;
      }
      const { client, call } = createNotionClient({
        auth: env.NOTION_TOKEN,
        notionVersion: env.NOTION_VERSION,
        baseUrl: env.NOTION_API_BASE,
        logger,
      });
      if (!opts.noRefresh) await ensureFresh({ client, logger, databaseId: opts.id });
      const fs = await import('node:fs/promises');
      await fs.mkdir(opts.dir, { recursive: true });

      const db = await call(() => client.databases.retrieve({ database_id: opts.id }));
      const titlePropEntry = Object.entries(db.properties).find(([, v]: any) => v?.type === 'title');
      if (!titlePropEntry) throw new Error('Database missing title property');
      const [titleKey] = titlePropEntry as [string, any];
      const dbTitle = (db as any).title?.map((t: any) => t.plain_text).join('') || 'database';
      const dbFolder = slug(dbTitle);
      const outDir = path.join(opts.dir, dbFolder);
      await fs.mkdir(outDir, { recursive: true });

      let cursor: string | undefined = undefined;
      let count = 0;
      for (;;) {
        const res = await call(() => client.databases.query({ database_id: opts.id, start_cursor: cursor }));
        for (const page of res.results as any[]) {
          const title = extractTitle(page, titleKey) || 'Untitled';
          const safe = slug(`${title}`);
          const base = `${safe}-${page.id.replaceAll('-', '').slice(-8)}`;
          if (opts.format === 'json') {
            await fs.writeFile(path.join(outDir, `${base}.json`), JSON.stringify(page, null, 2), 'utf8');
          } else {
            const blocks = await fetchAllBlocks(client, page.id);
            const md = `# ${title}\n\n` + blocksToMarkdown(blocks) + '\n';
            await fs.writeFile(path.join(outDir, `${base}.md`), md, 'utf8');
          }
          count++;
        }
        if (!res.has_more || !res.next_cursor) break;
        cursor = res.next_cursor as string | undefined;
      }
      logger.info({ dir: outDir, count, format: opts.format }, 'Export complete');
    });
}

function extractTitle(page: any, titleKey: string): string | undefined {
  const tp = page?.properties?.[titleKey]?.title;
  if (Array.isArray(tp) && tp.length) return tp.map((t: any) => t.plain_text).join('');
  return undefined;
}

function slug(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64) || 'untitled';
}

