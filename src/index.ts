import 'dotenv/config';
import { Command } from 'commander';
import { makeLogger } from './utils/logger.js';
import { registerAuthCommands } from './cli/auth.js';
import { registerDbCommands } from './cli/db.js';
import { registerPageCommands } from './cli/page.js';
import { registerSearchCommands } from './cli/search.js';
import { registerTranscriptCommands } from './cli/transcripts.js';
import { registerSyncCommands } from './cli/sync.js';

const program = new Command();
program
  .name('notion')
  .description('Notion Integration CLI')
  .version('0.1.0');

const logger = makeLogger();

registerAuthCommands(program, logger);
registerDbCommands(program, logger);
registerPageCommands(program, logger);
registerSearchCommands(program, logger);
registerSyncCommands(program, logger);
registerTranscriptCommands(program, logger);

program.hook('preAction', (_thisCommand, actionCommand) => {
  const name = actionCommand.name();
  logger.debug({ cmd: name }, 'Executing command');
});

program.parseAsync(process.argv).catch((err) => {
  logger.error({ err }, 'CLI error');
  process.exitCode = 1;
});
