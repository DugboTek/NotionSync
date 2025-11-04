import { promises as fs } from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';
import type { MappingConfig, PropertyMapping } from './types.js';

export async function loadMapping(file: string): Promise<MappingConfig> {
  const raw = await fs.readFile(file, 'utf8');
  const ext = path.extname(file).toLowerCase();
  let obj: any;
  if (ext === '.yaml' || ext === '.yml') obj = YAML.parse(raw);
  else obj = JSON.parse(raw);
  validate(obj);
  return obj as MappingConfig;
}

function validate(obj: any) {
  if (!obj || typeof obj !== 'object') throw new Error('Invalid mapping: expected object');
  if (!obj.title || obj.title.type !== 'title' || !obj.title.path) throw new Error('Invalid mapping: title missing');
  if (!obj.fields || typeof obj.fields !== 'object') obj.fields = {};
  for (const [k, v] of Object.entries(obj.fields)) {
    const m = v as PropertyMapping;
    if (!m || typeof m !== 'object' || !('type' in m) || !('path' in m)) {
      throw new Error(`Invalid mapping for field ${k}`);
    }
  }
}

