import type { Client } from '@notionhq/client';

type Block = any;

export type TranscriptItem = {
  page_id: string;
  page_title: string;
  audio: { url: string; type: 'external' | 'file' }[];
  has_transcription_block: boolean;
};

export async function collectTranscripts(client: Client, pageId: string, pageTitle: string): Promise<TranscriptItem> {
  const audio: TranscriptItem['audio'] = [];
  let hasTranscription = false;
  let cursor: string | undefined;
  do {
    const res = await client.blocks.children.list({ block_id: pageId, start_cursor: cursor });
    for (const b of res.results as Block[]) {
      if (b.type === 'audio') {
        const url = b.audio.type === 'external' ? b.audio.external.url : b.audio.file.url;
        audio.push({ url, type: b.audio.type });
      }
      if (b.type === 'transcription' || (b as any).transcript) {
        hasTranscription = true;
      }
    }
    cursor = (res.has_more && (res.next_cursor as string | undefined)) || undefined;
  } while (cursor);

  return { page_id: pageId, page_title: pageTitle, audio, has_transcription_block: hasTranscription };
}

