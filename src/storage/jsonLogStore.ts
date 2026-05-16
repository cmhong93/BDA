import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { LogStore, ProcessingLog } from './logStore.js';

export class JsonLogStore implements LogStore {
  constructor(private readonly filePath: string) {}

  async init(): Promise<void> {
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    try {
      await fs.access(this.filePath);
    } catch {
      await fs.writeFile(this.filePath, '[]\n', 'utf8');
    }
  }

  async findByMessageId(messageId: string): Promise<ProcessingLog | undefined> {
    const logs = await this.readAll();
    return logs.find((log) => log.messageId === messageId);
  }

  async upsert(log: ProcessingLog): Promise<void> {
    const logs = await this.readAll();
    const index = logs.findIndex((item) => item.messageId === log.messageId);
    if (index >= 0) logs[index] = { ...logs[index], ...log };
    else logs.push(log);
    await fs.writeFile(this.filePath, `${JSON.stringify(logs, null, 2)}\n`, 'utf8');
  }

  private async readAll(): Promise<ProcessingLog[]> {
    try {
      return JSON.parse(await fs.readFile(this.filePath, 'utf8')) as ProcessingLog[];
    } catch {
      return [];
    }
  }
}
