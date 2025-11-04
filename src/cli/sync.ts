import type { Command } from 'commander';
import type { Logger } from '../utils/logger.js';
import { loadEnv } from '../utils/env.js';
import { createNotionClient } from '../notion/client.js';
import { expandPath } from '../utils/fs.js';
import { SyncEngine } from '../sync/engine.js';

export function registerSyncCommands(program: Command, logger: Logger) {
  const sync = program.command('sync').description('Bidirectional sync commands');

  sync
    .command('once')
    .option('--dir <dir>', 'Sync root directory', '~/notion-sync')
    .description('Run a one-time bidirectional sync for all databases visible to the integration')
    .action(async (opts) => {
      const env = loadEnv(true);
      if (!('NOTION_TOKEN' in env) || !env.NOTION_TOKEN) {
        logger.error('NOTION_TOKEN is not set. See .env.example');
        process.exitCode = 1;
        return;
      }
      const { client } = createNotionClient({
        auth: env.NOTION_TOKEN,
        notionVersion: env.NOTION_VERSION,
        baseUrl: env.NOTION_API_BASE,
        logger,
      });
      const engine = new SyncEngine({ client, rootDir: expandPath(opts.dir), logger });
      await engine.syncAllDatabases();
      logger.info({ dir: expandPath(opts.dir) }, 'Sync once completed');
    });

  sync
    .command('run')
    .option('--dir <dir>', 'Sync root directory', '~/notion-sync')
    .option('--interval <sec>', 'Polling interval seconds', '60')
    .description('Run a looped bidirectional sync (polling)')
    .action(async (opts) => {
      const env = loadEnv(true);
      if (!('NOTION_TOKEN' in env) || !env.NOTION_TOKEN) {
        logger.error('NOTION_TOKEN is not set. See .env.example');
        process.exitCode = 1;
        return;
      }
      const { client } = createNotionClient({
        auth: env.NOTION_TOKEN,
        notionVersion: env.NOTION_VERSION,
        baseUrl: env.NOTION_API_BASE,
        logger,
      });
      const engine = new SyncEngine({ client, rootDir: expandPath(opts.dir), logger });
      const intervalMs = Math.max(10, Number(opts.interval)) * 1000;
      logger.info({ dir: expandPath(opts.dir), intervalMs }, 'Sync daemon started');
      for (;;) {
        const started = Date.now();
        try {
          await engine.syncAllDatabases();
        } catch (e) {
          logger.error({ err: String(e) }, 'Sync loop error');
        }
        const elapsed = Date.now() - started;
        const wait = Math.max(0, intervalMs - elapsed);
        await new Promise((r) => setTimeout(r, wait));
      }
    });
}

