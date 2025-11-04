import type { Command } from 'commander';
import type { Logger } from '../utils/logger.js';
import { loadEnv } from '../utils/env.js';
import { createNotionClient } from '../notion/client.js';
import { collectTranscripts } from '../notion/transcripts.js';
import path from 'node:path';
import { ensureFresh } from '../sync/refresh.js';

export function registerTranscriptCommands(program: Command, logger: Logger) {
  const t = program.command('transcripts').description('Transcript-related utilities');

  t
    .command('export')
    .requiredOption('--id <databaseId>', 'Database ID')
    .option('--dir <dir>', 'Output directory', 'transcripts')
    .option('--download', 'Download audio files to the output dir', false)
    .option('--no-refresh', 'Skip auto-refresh for this command')
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
      await fs.mkdir(opts.dir, { recursive: true });

      if (!opts.noRefresh) await ensureFresh({ client, logger, databaseId: opts.id });
      const db = await call(() => client.databases.retrieve({ database_id: opts.id }));
      const titlePropEntry = Object.entries(db.properties).find(([, v]: any) => v?.type === 'title');
      if (!titlePropEntry) throw new Error('Database missing title property');
      const [titleKey] = titlePropEntry as [string, any];

      const items: any[] = [];
      let cursor: string | undefined = undefined;
      for (;;) {
        const res = await call(() => client.databases.query({ database_id: opts.id, start_cursor: cursor }));
        for (const page of res.results as any[]) {
          const title = (page.properties?.[titleKey]?.title || []).map((t: any) => t.plain_text).join('') || 'Untitled';
          const info = await collectTranscripts(client, page.id, title);
          items.push(info);
          if (opts.download) {
            for (let i = 0; i < info.audio.length; i++) {
              const a = info.audio[i];
              const filename = path.join(opts.dir, `${title.replace(/[^a-z0-9]+/gi, '_')}-${page.id.replaceAll('-', '').slice(-6)}-audio${i + 1}.mp3`);
              try {
                await downloadFile(a.url, filename);
                logger.info({ file: filename }, 'Downloaded audio');
              } catch (e) {
                logger.warn({ url: a.url, err: String(e) }, 'Download failed');
              }
            }
          }
        }
        if (!res.has_more || !res.next_cursor) break;
        cursor = res.next_cursor as string | undefined;
      }
      await fs.writeFile(path.join(opts.dir, 'index.json'), JSON.stringify(items, null, 2), 'utf8');
      logger.info({ dir: opts.dir, pages: items.length }, 'Transcript export complete');
    });
}

async function downloadFile(url: string, dest: string): Promise<void> {
  const fs = await import('node:fs');
  const { request } = await import('node:https');
  await new Promise<void>((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    request(url, (res) => {
      if ((res.statusCode || 0) >= 400) return reject(new Error(`HTTP ${res.statusCode}`));
      res.pipe(file);
      file.on('finish', () => file.close(() => resolve()));
    })
      .on('error', (err) => reject(err))
      .end();
  });
}
