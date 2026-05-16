import dotenv from 'dotenv';

dotenv.config();

export type LogStorageType = 'json' | 'sqlite';

function boolFromEnv(value: string | undefined, defaultValue: boolean): boolean {
  if (value === undefined || value === '') return defaultValue;
  return ['1', 'true', 'yes', 'y'].includes(value.toLowerCase());
}

function numberFromEnv(value: string | undefined, defaultValue: number): number {
  if (!value) return defaultValue;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : defaultValue;
}

export const config = {
  openaiApiKey: process.env.OPENAI_API_KEY ?? '',
  openaiReplyModel: process.env.OPENAI_REPLY_MODEL || 'gpt-5.4-mini',
  openaiClassifyModel: process.env.OPENAI_CLASSIFY_MODEL || process.env.OPENAI_REPLY_MODEL || 'gpt-5.4-mini',
  googleClientId: process.env.GOOGLE_CLIENT_ID ?? '',
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
  googleRefreshToken: process.env.GOOGLE_REFRESH_TOKEN ?? '',
  gmailUser: process.env.GMAIL_USER || 'me',
  autoSend: boolFromEnv(process.env.AUTO_SEND, false),
  minConfidence: numberFromEnv(process.env.MIN_CONFIDENCE, 0.85),
  defaultSignature: process.env.DEFAULT_SIGNATURE ?? '',
  maxEmailsPerRun: numberFromEnv(process.env.MAX_EMAILS_PER_RUN, 10),
  maxBodyChars: numberFromEnv(process.env.MAX_BODY_CHARS, 12_000),
  logStorage: (process.env.LOG_STORAGE || 'json') as LogStorageType,
  sqliteDbPath: process.env.SQLITE_DB_PATH || './data/logs.sqlite',
  jsonLogPath: process.env.JSON_LOG_PATH || './data/logs.json'
};

export function assertRuntimeConfig(): void {
  const missing = [
    ['OPENAI_API_KEY', config.openaiApiKey],
    ['GOOGLE_CLIENT_ID', config.googleClientId],
    ['GOOGLE_CLIENT_SECRET', config.googleClientSecret],
    ['GOOGLE_REFRESH_TOKEN', config.googleRefreshToken]
  ].filter(([, value]) => !value);

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.map(([key]) => key).join(', ')}`);
  }

  if (config.autoSend) {
    throw new Error('AUTO_SEND must remain false. This service only creates Gmail drafts and never sends email.');
  }
}
