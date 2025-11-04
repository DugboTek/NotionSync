import type { Client } from '@notionhq/client';

export async function* paginateSearch(client: Client, params: Parameters<Client['search']>[0]) {
  let cursor: string | undefined = undefined;
  for (;;) {
    const res = await client.search({ ...params, start_cursor: cursor });
    for (const r of res.results) yield r;
    if (!res.has_more || !res.next_cursor) break;
    cursor = res.next_cursor;
  }
}

export async function* paginateQueryDatabase(
  client: Client,
  database_id: string,
  params: Omit<Parameters<Client['databases']['query']>[0], 'database_id'> = {},
) {
  let cursor: string | undefined = undefined;
  for (;;) {
    const res = await client.databases.query({ database_id, start_cursor: cursor, ...params });
    for (const r of res.results) yield r;
    if (!res.has_more || !res.next_cursor) break;
    cursor = res.next_cursor as string | undefined;
  }
}

