import type { Client } from '@notionhq/client';
import { readState, writeState } from './state.js';
import { SyncEngine } from './engine.js';
import { expandPath } from '../utils/fs.js';

export type RefreshOptions = {
  dir?: string; // default ~/notion-sync
  ttlMs?: number; // default 60000
};

export async function ensureFresh(params: {
  client: Client;
  logger: any;
  databaseId: string;
  options?: RefreshOptions;
}) {
  const { client, logger, databaseId } = params;
  const dir = expandPath(params.options?.dir || process.env.NOTION_AUTO_SYNC_DIR || '~/notion-sync');
  const ttlMs = params.options?.ttlMs ?? Number(process.env.NOTION_REFRESH_TTL_MS || 60000);

  let state = await readState(dir);
  const lastSyncMs = (state.databases[databaseId] as any)?.last_sync_time_ms as number | undefined;
  const now = Date.now();
  if (lastSyncMs && now - lastSyncMs < ttlMs) return; // fresh enough

  const engine = new SyncEngine({ client, rootDir: dir, logger });
  await engine.syncDatabase(databaseId);
  // reload and stamp
  state = await readState(dir);
  if (!state.databases[databaseId]) state.databases[databaseId] = {} as any;
  (state.databases[databaseId] as any).last_sync_time_ms = now;
  await writeState(dir, state);
}

