import { z } from 'zod';

const EnvSchema = z.object({
  NOTION_TOKEN: z.string().min(1, 'NOTION_TOKEN is required'),
  NOTION_VERSION: z.string().default('2022-06-28'),
  NOTION_API_BASE: z.string().url().default('https://api.notion.com'),
  WEBHOOK_SECRET: z.string().optional(),
  PUBLIC_URL: z.string().url().optional(),
});

export type Env = z.infer<typeof EnvSchema>;

function sanitize(src: NodeJS.ProcessEnv) {
  const c = { ...src } as Record<string, string | undefined>;
  const toMaybeUnset = ['PUBLIC_URL', 'WEBHOOK_SECRET', 'NOTION_API_BASE', 'NOTION_VERSION'];
  for (const k of toMaybeUnset) {
    if (k in c && (c[k] === '' || c[k] === undefined)) delete c[k];
  }
  if (c['NOTION_API_BASE'] && c['NOTION_API_BASE'].endsWith('/v1')) {
    c['NOTION_API_BASE'] = c['NOTION_API_BASE'].replace(/\/v1\/?$/, '');
  }
  return c as NodeJS.ProcessEnv;
}

export function loadEnv(partialOk = false): Env | Partial<Env> {
  const env = sanitize(process.env);
  const result = EnvSchema.safeParse(env);
  if (!result.success) {
    if (partialOk) {
      const defaults = EnvSchema.partial().parse(env);
      return defaults;
    }
    const issues = result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(', ');
    throw new Error(`Invalid environment: ${issues}`);
  }
  return result.data;
}
