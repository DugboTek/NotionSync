import { promises as fs } from 'node:fs';
import path from 'node:path';

export type PageState = {
  page_id: string;
  database_id?: string;
  file: string;
  notion_last_edited_time: string; // ISO
  file_mtime_ms: number;
};

export type SyncState = {
  databases: Record<string, { last_pull_iso?: string }>;
  pages: Record<string, PageState>; // key by page_id
};

export async function readState(root: string): Promise<SyncState> {
  const file = path.join(root, '.state.json');
  try {
    const raw = await fs.readFile(file, 'utf8');
    return JSON.parse(raw) as SyncState;
  } catch {
    return { databases: {}, pages: {} };
  }
}

export async function writeState(root: string, state: SyncState): Promise<void> {
  const file = path.join(root, '.state.json');
  const tmp = file + '.tmp';
  await fs.writeFile(tmp, JSON.stringify(state, null, 2), 'utf8');
  await fs.rename(tmp, file);
}

