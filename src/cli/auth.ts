import type { Command } from 'commander';
import type { Logger } from '../utils/logger.js';
import { loadEnv } from '../utils/env.js';

function maskToken(token?: string): string {
  if (!token) return 'missing';
  if (token.length <= 8) return '**redacted**';
  return `${token.slice(0, 4)}...${token.slice(-4)}`;
}

export function registerAuthCommands(program: Command, logger: Logger) {
  const auth = program.command('auth').description('Authentication commands');

  auth
    .command('status')
    .description('Show authentication status and environment variables used')
    .option('--json', 'Output JSON')
    .action(async (opts) => {
      const env = loadEnv(true);
      const status = {
        token_present: Boolean((env as any).NOTION_TOKEN),
        token_preview: maskToken((env as any).NOTION_TOKEN as string | undefined),
        notion_version: (env as any).NOTION_VERSION ?? '2022-06-28',
        api_base: (env as any).NOTION_API_BASE ?? 'https://api.notion.com/v1',
      };
      if (opts.json) {
        console.log(JSON.stringify(status, null, 2));
      } else {
        logger.info(status, 'Auth status');
      }
    });
}

