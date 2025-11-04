// Very lightweight Markdown -> Notion blocks converter for common blocks

export type NotionBlock = any;

export function markdownToBlocks(md: string): NotionBlock[] {
  const lines = md.replace(/\r\n/g, '\n').split('\n');
  const blocks: NotionBlock[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];

    // skip empty lines as paragraphs with empty content
    if (line.trim() === '') {
      i++;
      continue;
    }

    // code fence
    const codeFence = line.match(/^```(.*)$/);
    if (codeFence) {
      const lang = (codeFence[1] || '').trim();
      i++;
      const buf: string[] = [];
      while (i < lines.length && !lines[i].startsWith('```')) {
        buf.push(lines[i]);
        i++;
      }
      // consume closing ``` if present
      if (i < lines.length && lines[i].startsWith('```')) i++;
      blocks.push({
        object: 'block',
        type: 'code',
        code: { language: lang || 'plain text', rich_text: [{ type: 'text', text: { content: buf.join('\n') } }] },
      });
      continue;
    }

    // hr
    if (/^---+$/.test(line.trim())) {
      blocks.push({ object: 'block', type: 'divider', divider: {} });
      i++;
      continue;
    }

    // headings
    const h = line.match(/^(#{1,3})\s+(.*)$/);
    if (h) {
      const level = h[1].length;
      const content = h[2];
      const key = level === 1 ? 'heading_1' : level === 2 ? 'heading_2' : 'heading_3';
      blocks.push({ object: 'block', type: key, [key]: { rich_text: text(content) } as any });
      i++;
      continue;
    }

    // blockquote
    const bq = line.match(/^>\s?(.*)$/);
    if (bq) {
      const buf: string[] = [bq[1]];
      i++;
      while (i < lines.length && lines[i].startsWith('>')) {
        buf.push(lines[i].replace(/^>\s?/, ''));
        i++;
      }
      blocks.push({ object: 'block', type: 'quote', quote: { rich_text: text(buf.join('\n')) } });
      continue;
    }

    // todo list
    const todo = line.match(/^\-\s*\[( |x|X)\]\s+(.*)$/);
    if (todo) {
      const items: any[] = [];
      let j = i;
      while (j < lines.length) {
        const m = lines[j].match(/^\-\s*\[( |x|X)\]\s+(.*)$/);
        if (!m) break;
        items.push({ object: 'block', type: 'to_do', to_do: { checked: /x/i.test(m[1]), rich_text: text(m[2]) } });
        j++;
      }
      blocks.push(...items);
      i = j;
      continue;
    }

    // unordered list
    if (/^\-\s+/.test(line)) {
      let j = i;
      while (j < lines.length && /^\-\s+/.test(lines[j])) j++;
      for (let k = i; k < j; k++) {
        const content = lines[k].replace(/^\-\s+/, '');
        blocks.push({ object: 'block', type: 'bulleted_list_item', bulleted_list_item: { rich_text: text(content) } });
      }
      i = j;
      continue;
    }

    // ordered list
    if (/^\d+\.\s+/.test(line)) {
      let j = i;
      while (j < lines.length && /^\d+\.\s+/.test(lines[j])) j++;
      for (let k = i; k < j; k++) {
        const content = lines[k].replace(/^\d+\.\s+/, '');
        blocks.push({ object: 'block', type: 'numbered_list_item', numbered_list_item: { rich_text: text(content) } });
      }
      i = j;
      continue;
    }

    // fallback: paragraph (greedy until blank line)
    const buf: string[] = [line];
    i++;
    while (i < lines.length && lines[i].trim() !== '') {
      buf.push(lines[i]);
      i++;
    }
    blocks.push({ object: 'block', type: 'paragraph', paragraph: { rich_text: text(buf.join('\n')) } });
  }
  return limitBlocks(blocks);
}

function text(s: string) {
  return [{ type: 'text', text: { content: s } }];
}

function limitBlocks(blocks: NotionBlock[]): NotionBlock[] {
  // Notion API allows appending up to 100 blocks per call; caller will batch.
  return blocks;
}
