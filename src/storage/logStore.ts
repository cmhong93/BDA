import { config } from '../config.js';
import { JsonLogStore } from './jsonLogStore.js';
import { SqliteLogStore } from './sqliteLogStore.js';

export type LogStatus = 'fetched' | 'analyzed' | 'drafted' | 'review_required' | 'skipped' | 'error';

export type ProcessingLog = {
  messageId: string;
  threadId: string;
  draftId?: string;
  sender: string;
  subject: string;
  receivedAt?: string;
  classification?: string;
  summary?: string;
  riskLevel?: 'low' | 'medium' | 'high';
  needsReview?: boolean;
  reviewReasons?: string[];
  confidence?: number;
  status: LogStatus;
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
};

export interface LogStore {
  init(): Promise<void>;
  findByMessageId(messageId: string): Promise<ProcessingLog | undefined>;
  upsert(log: ProcessingLog): Promise<void>;
  close?(): Promise<void>;
}

export async function createLogStore(): Promise<LogStore> {
  const store = config.logStorage === 'sqlite' ? new SqliteLogStore(config.sqliteDbPath) : new JsonLogStore(config.jsonLogPath);
  await store.init();
  return store;
}
