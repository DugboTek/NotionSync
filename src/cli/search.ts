import type { Command } from 'commander';
import type { Logger } from '../utils/logger.js';
import { loadEnv } from '../utils/env.js';
import { createNotionClient } from '../notion/client.js';

export function registerSearchCommands(program: Command, logger: Logger) {
  program
    .command('search')
    .argument('<query>', 'Search query')
    .option('--json', 'Output JSON')
    .description('Search pages and databases')
    .action(async (query: string, opts) => {
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

      const res = await call(() => client.search({ query }));
      const items = res.results.map((r: any) => ({ id: r.id, object: r.object }));
      if (opts.json) console.log(JSON.stringify(items, null, 2));
      else items.forEach((i) => logger.info(i, 'Search result'));
    });
}

