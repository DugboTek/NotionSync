import { Client } from '@notionhq/client';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { blocksToMarkdown, fetchAllBlocks } from '../notion/markdown.js';
import { markdownToBlocks } from '../notion/markdown_write.js';
import { readState, writeState, type SyncState } from './state.js';
import { slug } from '../utils/fs.js';

export type EngineOptions = {
  client: Client;
  rootDir: string; // expanded path
  logger: any;
};

export class SyncEngine {
  private client: Client;
  private root: string;
  private logger: any;

  constructor(opts: EngineOptions) {
    this.client = opts.client;
    this.root = opts.rootDir;
    this.logger = opts.logger;
  }

  async syncAllDatabases(): Promise<void> {
    await fs.mkdir(this.root, { recursive: true });
    const state = await readState(this.root);
    // List databases via search
    const search = await this.client.search({ filter: { property: 'object', value: 'database' } });
    for (const db of search.results as any[]) {
      const dbId = db.id;
      const dbTitle = (db.title || []).map((t: any) => t.plain_text).join('') || 'database';
      await this.syncDatabase(dbId, dbTitle, state);
    }
    await writeState(this.root, state);
  }

  async syncDatabase(databaseId: string, dbTitle?: string, state?: SyncState): Promise<void> {
    await fs.mkdir(this.root, { recursive: true });
    const st = state || (await readState(this.root));
    // resolve title and folder
    const db = await this.client.databases.retrieve({ database_id: databaseId });
    const title = dbTitle || ((db as any).title as any[])?.map((t: any) => t.plain_text).join('') || 'database';
    const folder = path.join(this.root, slug(title));
    await fs.mkdir(folder, { recursive: true });

    // Pull: query updated since last checkpoint
    const last = st.databases[databaseId]?.last_pull_iso;
    let cursor: string | undefined;
    let latestISO = last;
    for (;;) {
      const res = await this.client.databases.query({
        database_id: databaseId,
        start_cursor: cursor,
        filter: last
          ? ({
              timestamp: 'last_edited_time',
              last_edited_time: { on_or_after: last },
            } as any)
          : undefined,
      });
      for (const page of res.results as any[]) {
        const pageId = page.id;
        const pageTitle = extractTitle(page, db);
        const filenameBase = `${slug(pageTitle || 'untitled')}-${pageId.replaceAll('-', '').slice(-8)}`;
        const file = path.join(folder, `${filenameBase}.md`);
        const blocks = await fetchAllBlocks(this.client, pageId);
        const md = `---\n${frontmatter({
          page_id: pageId,
          database_id: databaseId,
          notion_last_edited_time: page.last_edited_time,
          url: page.url,
        })}\n---\n\n# ${pageTitle || 'Untitled'}\n\n${blocksToMarkdown(blocks)}\n`;
        await fs.writeFile(file, md, 'utf8');
        const stat = await fs.stat(file);
        st.pages[pageId] = {
          page_id: pageId,
          database_id: databaseId,
          file,
          notion_last_edited_time: page.last_edited_time,
          file_mtime_ms: stat.mtimeMs,
        };
        if (!latestISO || page.last_edited_time > latestISO) latestISO = page.last_edited_time;
      }
      if (!res.has_more || !res.next_cursor) break;
      cursor = res.next_cursor as string | undefined;
    }
    if (!st.databases[databaseId]) st.databases[databaseId] = {};
    if (latestISO) st.databases[databaseId].last_pull_iso = latestISO;

    // Push: detect local changes newer than Notion
    for (const [pid, info] of Object.entries(st.pages)) {
      if (info.database_id !== databaseId) continue;
      try {
        const stat = await fs.stat(info.file);
        if (stat.mtimeMs <= info.file_mtime_ms) continue; // no local change since last sync
        const content = await fs.readFile(info.file, 'utf8');
        const parsed = parseFrontmatter(content);
        const body = parsed.body;
        // Compare against Notion latest
        const page = await this.client.pages.retrieve({ page_id: pid });
        const remoteISO = (page as any).last_edited_time as string;
        if (stat.mtimeMs <= info.file_mtime_ms && remoteISO === info.notion_last_edited_time) continue;
        // Conflict policy: prefer newest by timestamp
        const fileNewer = stat.mtimeMs > new Date(remoteISO).getTime();
        if (!fileNewer) {
          // remote newer: we already pulled; skip push
          continue;
        }
        // Replace content by deleting existing children and appending new
        await this.replacePageContent(pid, body);
        // Update state
        info.file_mtime_ms = stat.mtimeMs;
        info.notion_last_edited_time = (await this.client.pages.retrieve({ page_id: pid }) as any).last_edited_time;
      } catch (e) {
        this.logger.warn({ page_id: pid, err: String(e) }, 'Push skipped for page');
      }
    }

    if (!state) await writeState(this.root, st);
  }

  private async replacePageContent(pageId: string, mdBody: string): Promise<void> {
    // List current children
    const children = await this.client.blocks.children.list({ block_id: pageId });
    // Delete existing children (archive)
    for (const b of children.results as any[]) {
      try {
        await this.client.blocks.delete({ block_id: b.id });
      } catch {
        // ignore
      }
    }
    // Convert markdown to blocks and append in batches of 90
    const blocks = markdownToBlocks(mdBody);
    const batchSize = 90;
    for (let i = 0; i < blocks.length; i += batchSize) {
      const slice = blocks.slice(i, i + batchSize);
      await this.client.blocks.children.append({ block_id: pageId, children: slice as any });
    }
  }
}

function extractTitle(page: any, db: any): string | undefined {
  const titlePropEntry = Object.entries(db.properties).find(([, v]: any) => v?.type === 'title');
  if (!titlePropEntry) return undefined;
  const [titleKey] = titlePropEntry as [string, any];
  const tp = page?.properties?.[titleKey]?.title;
  if (Array.isArray(tp) && tp.length) return tp.map((t: any) => t.plain_text).join('');
  return undefined;
}

function frontmatter(obj: Record<string, any>): string {
  const lines: string[] = [];
  for (const [k, v] of Object.entries(obj)) {
    lines.push(`${k}: ${JSON.stringify(v)}`);
  }
  return lines.join('\n');
}

function parseFrontmatter(content: string): { meta: Record<string, any>; body: string } {
  const fm = /^---\n([\s\S]*?)\n---\n?/m;
  const m = content.match(fm);
  if (!m) return { meta: {}, body: content };
  const raw = m[1];
  const meta: Record<string, any> = {};
  for (const line of raw.split('\n')) {
    const idx = line.indexOf(':');
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    let val = line.slice(idx + 1).trim();
    try { meta[key] = JSON.parse(val); } catch { meta[key] = val; }
  }
  const body = content.slice(m.index! + m[0].length);
  return { meta, body };
}
