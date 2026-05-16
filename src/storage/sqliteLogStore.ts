import path from 'node:path';
import { promises as fs } from 'node:fs';
import sqlite3 from 'sqlite3';
import { open, type Database } from 'sqlite';
import type { LogStore, ProcessingLog } from './logStore.js';

export class SqliteLogStore implements LogStore {
  private db?: Database;

  constructor(private readonly dbPath: string) {}

  async init(): Promise<void> {
    await fs.mkdir(path.dirname(this.dbPath), { recursive: true });
    this.db = await open({ filename: this.dbPath, driver: sqlite3.Database });
    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS processing_logs (
        messageId TEXT PRIMARY KEY,
        threadId TEXT NOT NULL,
        draftId TEXT,
        sender TEXT NOT NULL,
        subject TEXT NOT NULL,
        receivedAt TEXT,
        classification TEXT,
        summary TEXT,
        riskLevel TEXT,
        needsReview INTEGER,
        reviewReasons TEXT,
        confidence REAL,
        status TEXT NOT NULL,
        errorMessage TEXT,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL
      )
    `);
  }

  async findByMessageId(messageId: string): Promise<ProcessingLog | undefined> {
    const row = await this.dbOrThrow().get('SELECT * FROM processing_logs WHERE messageId = ?', messageId) as Record<string, unknown> | undefined;
    return row ? this.fromRow(row) : undefined;
  }

  async upsert(log: ProcessingLog): Promise<void> {
    await this.dbOrThrow().run(
      `INSERT INTO processing_logs (
        messageId, threadId, draftId, sender, subject, receivedAt, classification, summary,
        riskLevel, needsReview, reviewReasons, confidence, status, errorMessage, createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(messageId) DO UPDATE SET
        threadId=excluded.threadId,
        draftId=excluded.draftId,
        sender=excluded.sender,
        subject=excluded.subject,
        receivedAt=excluded.receivedAt,
        classification=excluded.classification,
        summary=excluded.summary,
        riskLevel=excluded.riskLevel,
        needsReview=excluded.needsReview,
        reviewReasons=excluded.reviewReasons,
        confidence=excluded.confidence,
        status=excluded.status,
        errorMessage=excluded.errorMessage,
        updatedAt=excluded.updatedAt`,
      log.messageId,
      log.threadId,
      log.draftId,
      log.sender,
      log.subject,
      log.receivedAt,
      log.classification,
      log.summary,
      log.riskLevel,
      log.needsReview === undefined ? undefined : Number(log.needsReview),
      JSON.stringify(log.reviewReasons ?? []),
      log.confidence,
      log.status,
      log.errorMessage,
      log.createdAt,
      log.updatedAt
    );
  }

  async close(): Promise<void> {
    await this.db?.close();
  }

  private dbOrThrow(): Database {
    if (!this.db) throw new Error('SQLite store has not been initialized.');
    return this.db;
  }

  private fromRow(row: Record<string, unknown>): ProcessingLog {
    return {
      messageId: String(row.messageId),
      threadId: String(row.threadId),
      draftId: row.draftId ? String(row.draftId) : undefined,
      sender: String(row.sender),
      subject: String(row.subject),
      receivedAt: row.receivedAt ? String(row.receivedAt) : undefined,
      classification: row.classification ? String(row.classification) : undefined,
      summary: row.summary ? String(row.summary) : undefined,
      riskLevel: row.riskLevel as ProcessingLog['riskLevel'],
      needsReview: row.needsReview === undefined || row.needsReview === null ? undefined : Boolean(row.needsReview),
      reviewReasons: row.reviewReasons ? JSON.parse(String(row.reviewReasons)) as string[] : [],
      confidence: row.confidence === undefined || row.confidence === null ? undefined : Number(row.confidence),
      status: row.status as ProcessingLog['status'],
      errorMessage: row.errorMessage ? String(row.errorMessage) : undefined,
      createdAt: String(row.createdAt),
      updatedAt: String(row.updatedAt)
    };
  }
}
