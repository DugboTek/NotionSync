import type { Command } from 'commander';
import type { Logger } from '../utils/logger.js';
import { loadEnv } from '../utils/env.js';
import { createNotionClient } from '../notion/client.js';
import { markdownToBlocks } from '../notion/markdown_write.js';

export function registerPageCommands(program: Command, logger: Logger) {
  const page = program.command('page').description('Page commands');

  page
    .command('append')
    .requiredOption('--id <pageId>', 'Page ID')
    .requiredOption('--content <file>', 'Markdown file to append as page content')
    .option('--json', 'Output JSON')
    .description('Append content to an existing page')
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

      const fs = await import('node:fs/promises');
      const md = await fs.readFile(opts.content, 'utf8');
      const blocks = markdownToBlocks(md);
      const batchSize = 90;
      for (let i = 0; i < blocks.length; i += batchSize) {
        const slice = blocks.slice(i, i + batchSize);
        await call(() => client.blocks.children.append({ block_id: opts.id, children: slice as any }));
      }

      if (opts.json) {
        console.log(JSON.stringify({ success: true, id: opts.id, blocks: blocks.length }, null, 2));
      } else {
        logger.info({ id: opts.id, blocks: blocks.length }, 'Content appended to page');
      }
    });

  page
    .command('update')
    .requiredOption('--id <pageId>', 'Page ID')
    .option('--title <title>', 'New title for the page')
    .option('--props <file>', 'JSON file of properties to update')
    .option('--json', 'Output JSON')
    .description('Update page properties (title, properties, etc.)')
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

      let properties: any = {};

      if (opts.title) {
        // Get the page to find the title property key
        const pageData = await call(() => client.pages.retrieve({ page_id: opts.id }));
        const titlePropEntry = Object.entries((pageData as any).properties).find(([, v]: any) => v?.type === 'title');
        if (titlePropEntry) {
          const [titleKey] = titlePropEntry as [string, any];
          properties[titleKey] = {
            title: [
              {
                type: 'text',
                text: { content: String(opts.title) },
              },
            ],
          };
        }
      }

      if (opts.props) {
        const fs = await import('node:fs/promises');
        const raw = await fs.readFile(opts.props, 'utf8');
        try {
          const extraProps = JSON.parse(raw);
          properties = { ...properties, ...extraProps };
        } catch (e) {
          logger.error({ file: opts.props }, 'Invalid JSON in --props');
          process.exitCode = 1;
          return;
        }
      }

      if (Object.keys(properties).length === 0) {
        logger.error('No properties to update. Provide --title or --props');
        process.exitCode = 1;
        return;
      }

      const updated = await call(() => client.pages.update({ page_id: opts.id, properties }));

      if (opts.json) {
        console.log(JSON.stringify(updated, null, 2));
      } else {
        logger.info({ id: opts.id }, 'Page updated');
      }
    });

  page
    .command('get')
    .requiredOption('--id <pageId>', 'Page ID')
    .option('--json', 'Output JSON')
    .description('Get page information')
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

      const pageData = await call(() => client.pages.retrieve({ page_id: opts.id }));

      if (opts.json) {
        console.log(JSON.stringify(pageData, null, 2));
      } else {
        const titleProp = Object.entries((pageData as any).properties).find(([, v]: any) => v?.type === 'title');
        const title = titleProp ? (titleProp[1] as any).title?.map((t: any) => t.plain_text).join('') : 'Untitled';
        logger.info({ id: pageData.id, title }, 'Page info');
      }
    });

  page
    .command('archive')
    .requiredOption('--id <pageId>', 'Page ID')
    .option('--json', 'Output JSON')
    .description('Archive (delete) a page')
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

      // Get page info first for logging
      const pageData = await call(() => client.pages.retrieve({ page_id: opts.id }));
      const titleProp = Object.entries((pageData as any).properties).find(([, v]: any) => v?.type === 'title');
      const title = titleProp ? (titleProp[1] as any).title?.map((t: any) => t.plain_text).join('') : 'Untitled';

      // Archive the page
      const updated = await call(() => client.pages.update({ page_id: opts.id, archived: true }));

      if (opts.json) {
        console.log(JSON.stringify({ success: true, id: opts.id, title, archived: true }, null, 2));
      } else {
        logger.info({ id: opts.id, title }, 'Page archived');
      }
    });

  page
    .command('restore')
    .requiredOption('--id <pageId>', 'Page ID')
    .option('--json', 'Output JSON')
    .description('Restore an archived page')
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

      // Get page info first for logging
      const pageData = await call(() => client.pages.retrieve({ page_id: opts.id }));
      const titleProp = Object.entries((pageData as any).properties).find(([, v]: any) => v?.type === 'title');
      const title = titleProp ? (titleProp[1] as any).title?.map((t: any) => t.plain_text).join('') : 'Untitled';

      // Restore the page
      const updated = await call(() => client.pages.update({ page_id: opts.id, archived: false }));

      if (opts.json) {
        console.log(JSON.stringify({ success: true, id: opts.id, title, archived: false }, null, 2));
      } else {
        logger.info({ id: opts.id, title }, 'Page restored');
      }
    });
}
