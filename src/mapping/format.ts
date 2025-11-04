import type { MappingConfig, PropertyMapping } from './types.js';

export function toNotionProperties(input: any, mapping: MappingConfig, dbProperties: Record<string, any>) {
  const props: Record<string, any> = {};

  const titleName = mapping.title.path;
  props[titleName] = {
    title: [
      {
        type: 'text',
        text: { content: String(resolvePath(input, 'title', mapping.title.path, input[mapping.title.path] ?? input.title ?? '') || '') },
      },
    ],
  };

  for (const [fieldKey, m] of Object.entries(mapping.fields)) {
    const propName = (m as PropertyMapping).path;
    const value = resolvePath(input, fieldKey, propName, (input as any)[fieldKey]);
    if (value === undefined) continue;
    switch (m.type) {
      case 'rich_text':
        props[propName] = { rich_text: [{ type: 'text', text: { content: String(value) } }] };
        break;
      case 'number':
        props[propName] = { number: Number(value) };
        break;
      case 'select':
        props[propName] = { select: value == null ? null : { name: mapValue(m.map, String(value)) } };
        break;
      case 'multi_select':
        props[propName] = { multi_select: Array.isArray(value) ? value.map((v) => ({ name: mapValue(m.map, String(v)) })) : [] };
        break;
      case 'date':
        props[propName] = { date: value ? { start: new Date(value).toISOString() } : null };
        break;
      case 'checkbox':
        props[propName] = { checkbox: Boolean(value) };
        break;
      case 'url':
        props[propName] = { url: value ? String(value) : null };
        break;
      case 'email':
        props[propName] = { email: value ? String(value) : null };
        break;
      case 'phone_number':
        props[propName] = { phone_number: value ? String(value) : null };
        break;
      case 'title':
        // already handled
        break;
      default:
        break;
    }
  }
  return props;
}

export function mapValue(map: Record<string, string> | undefined, key: string): string {
  if (!map) return key;
  return map[key] ?? key;
}

function resolvePath(input: any, fieldKey: string, propName: string, fallback: any) {
  // For now, simple access; later support deep paths
  if (fallback !== undefined) return fallback;
  if (input && fieldKey in input) return (input as any)[fieldKey];
  if (propName in input) return (input as any)[propName];
  return undefined;
}

