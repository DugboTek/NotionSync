import type { Client } from '@notionhq/client';

type Block = any;

export async function fetchAllBlocks(client: Client, blockId: string): Promise<Block[]> {
  const blocks: Block[] = [];
  let cursor: string | undefined;
  for (;;) {
    const res = await client.blocks.children.list({ block_id: blockId, start_cursor: cursor });
    blocks.push(...res.results);
    if (!res.has_more || !res.next_cursor) break;
    cursor = res.next_cursor as string | undefined;
  }
  // Recursively fetch children for blocks with has_children
  for (const b of blocks) {
    if (b.has_children) {
      try {
        (b as any).children = await fetchAllBlocks(client, b.id);
      } catch (e: any) {
        // Some experimental block types may not support children listing via API
        (b as any).children = [];
      }
    }
  }
  return blocks;
}

export function blocksToMarkdown(blocks: Block[], indent = 0): string {
  const lines: string[] = [];
  for (const b of blocks) {
    const pref = ' '.repeat(indent);
    switch (b.type) {
      case 'paragraph':
        lines.push(pref + richTextToMarkdown(b.paragraph.rich_text));
        break;
      case 'heading_1':
        lines.push('# ' + richTextToMarkdown(b.heading_1.rich_text));
        break;
      case 'heading_2':
        lines.push('## ' + richTextToMarkdown(b.heading_2.rich_text));
        break;
      case 'heading_3':
        lines.push('### ' + richTextToMarkdown(b.heading_3.rich_text));
        break;
      case 'bulleted_list_item':
        lines.push(pref + '- ' + richTextToMarkdown(b.bulleted_list_item.rich_text));
        if (b.children) lines.push(blocksToMarkdown(b.children, indent + 2));
        break;
      case 'numbered_list_item':
        lines.push(pref + '1. ' + richTextToMarkdown(b.numbered_list_item.rich_text));
        if (b.children) lines.push(blocksToMarkdown(b.children, indent + 2));
        break;
      case 'to_do':
        lines.push(pref + `- [${b.to_do.checked ? 'x' : ' '}] ` + richTextToMarkdown(b.to_do.rich_text));
        if (b.children) lines.push(blocksToMarkdown(b.children, indent + 2));
        break;
      case 'quote':
        lines.push(pref + '> ' + richTextToMarkdown(b.quote.rich_text));
        break;
      case 'code':
        lines.push('```' + (b.code.language || ''));
        lines.push(b.code.rich_text.map((t: any) => t.plain_text).join(''));
        lines.push('```');
        break;
      case 'divider':
        lines.push('---');
        break;
      case 'toggle':
        lines.push(pref + '<details><summary>' + richTextToMarkdown(b.toggle.rich_text) + '</summary>');
        if (b.children) lines.push(blocksToMarkdown(b.children, indent + 2));
        lines.push(pref + '</details>');
        break;
      case 'callout':
        lines.push(pref + '> ' + richTextToMarkdown(b.callout.rich_text));
        if (b.children) lines.push(blocksToMarkdown(b.children, indent + 2));
        break;
      case 'image':
        {
          const url = b.image.type === 'external' ? b.image.external.url : b.image.file.url;
          lines.push(pref + `![image](${url})`);
        }
        break;
      case 'bookmark':
        lines.push(pref + `[${b.bookmark.url}](${b.bookmark.url})`);
        break;
      case 'embed':
        lines.push(pref + `[embed](${b.embed.url})`);
        break;
      case 'video': {
        const url = b.video.type === 'external' ? b.video.external.url : b.video.file.url;
        lines.push(pref + `[video](${url})`);
        break;
      }
      case 'file': {
        const url = b.file.type === 'external' ? b.file.external.url : b.file.file.url;
        lines.push(pref + `[file](${url})`);
        break;
      }
      case 'pdf': {
        const url = b.pdf.type === 'external' ? b.pdf.external.url : b.pdf.file.url;
        lines.push(pref + `[pdf](${url})`);
        break;
      }
      case 'audio': {
        const url = b.audio.type === 'external' ? b.audio.external.url : b.audio.file.url;
        lines.push(pref + `[audio](${url})`);
        break;
      }
      case 'equation':
        lines.push('$$' + b.equation.expression + '$$');
        break;
      case 'table_of_contents':
        lines.push('[TOC]');
        break;
      case 'breadcrumb':
        // no direct markdown equivalent
        break;
      case 'synced_block':
        if (b.children) lines.push(blocksToMarkdown(b.children, indent));
        break;
      case 'column_list':
        if (b.children) {
          lines.push('');
          for (const col of b.children) {
            // render each column content sequentially separated by a blank line
            if (col.children) lines.push(blocksToMarkdown(col.children, indent));
            lines.push('');
          }
        }
        break;
      case 'table':
        lines.push(tableToMarkdown(b));
        break;
      default:
        if (b.type === 'transcription') {
          lines.push(pref + `<!-- transcription block not accessible via Notion API -->`);
        } else {
          lines.push(pref + `<!-- unsupported block: ${b.type} -->`);
        }
        break;
    }
  }
  return lines.filter(Boolean).join('\n');
}

function richTextToMarkdown(rts: any[]): string {
  return rts
    .map((t) => {
      let s = t.plain_text || '';
      const a = t.annotations || {};
      if (a.code) s = '`' + s + '`';
      if (a.bold) s = '**' + s + '**';
      if (a.italic) s = '_' + s + '_';
      if (a.strikethrough) s = '~~' + s + '~~';
      if (t.href) s = `[${s}](${t.href})`;
      return s;
    })
    .join('');
}

function tableToMarkdown(b: any): string {
  const rows = (b.children || []).filter((r: any) => r.type === 'table_row');
  const matrix: string[][] = rows.map((r: any) => (r.table_row.cells || []).map((c: any[]) => richTextToMarkdown(c)));
  if (matrix.length === 0) return '';
  const colCount = Math.max(...matrix.map((r) => r.length));
  for (const r of matrix) while (r.length < colCount) r.push('');

  const hasColHeader = b.table?.has_column_header;
  const hasRowHeader = b.table?.has_row_header;

  const lines: string[] = [];
  let header: string[];
  let data: string[][];
  if (hasColHeader) {
    header = matrix[0];
    data = matrix.slice(1);
  } else {
    header = Array.from({ length: colCount }, (_, i) => `Col ${i + 1}`);
    data = matrix;
  }
  lines.push('| ' + header.join(' | ') + ' |');
  lines.push('|' + header.map(() => ' --- ').join('|') + '|');
  for (const row of data) {
    const cells = row.map((c, i) => (hasRowHeader && i === 0 ? `**${c}**` : c));
    lines.push('| ' + cells.join(' | ') + ' |');
  }
  return lines.join('\n');
}
