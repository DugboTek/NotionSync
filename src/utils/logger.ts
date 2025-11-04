import pino from 'pino';

export function makeLogger(level: pino.LevelWithSilent = (process.env.LOG_LEVEL as pino.LevelWithSilent) || 'info') {
  return pino({
    level,
    redact: {
      paths: ['req.headers.authorization', 'token', 'NOTION_TOKEN', 'headers.authorization'],
      censor: '**redacted**',
    },
    formatters: {
      level(label) {
        return { level: label };
      },
    },
  });
}

export type Logger = ReturnType<typeof makeLogger>;

