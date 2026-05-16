import { config, assertRuntimeConfig } from './config.js';
import { analyzeEmail } from './ai/analyzeEmail.js';
import { ensureConservativeReply } from './ai/generateReply.js';
import { createGmailClient } from './gmail/client.js';
import { createReplyDraft } from './gmail/drafts.js';
import { addLabelsToMessage, ensureLabels } from './gmail/labels.js';
import { getInboundEmail, listUnreadInboxMessages, type InboundEmail } from './gmail/messages.js';
import { createLogStore, type LogStore, type ProcessingLog } from './storage/logStore.js';
import { nowIso } from './utils/dates.js';
import { logger } from './utils/logger.js';

function baseLog(email: InboundEmail, status: ProcessingLog['status']): ProcessingLog {
  const timestamp = nowIso();
  return {
    messageId: email.messageId,
    threadId: email.threadId,
    sender: email.sender,
    subject: email.subject,
    receivedAt: email.receivedAt,
    status,
    createdAt: timestamp,
    updatedAt: timestamp
  };
}

async function markError(gmail: ReturnType<typeof createGmailClient>, labels: Awaited<ReturnType<typeof ensureLabels>>, store: LogStore, email: InboundEmail, error: unknown): Promise<void> {
  const message = error instanceof Error ? error.message : String(error);
  await addLabelsToMessage(gmail, email.gmailMessageId, [labels.AI_ERROR]);
  const existing = await store.findByMessageId(email.messageId);
  await store.upsert({
    ...(existing ?? baseLog(email, 'error')),
    status: 'error',
    errorMessage: message,
    updatedAt: nowIso()
  });
}

async function processOne(gmail: ReturnType<typeof createGmailClient>, labels: Awaited<ReturnType<typeof ensureLabels>>, store: LogStore, gmailMessageId: string): Promise<void> {
  const email = await getInboundEmail(gmail, gmailMessageId);
  const existing = await store.findByMessageId(email.messageId);
  if (existing && ['drafted', 'review_required', 'skipped'].includes(existing.status)) {
    logger.info('Skipping message already handled in log.', { messageId: email.messageId, status: existing.status });
    return;
  }

  await store.upsert(existing ?? baseLog(email, 'fetched'));

  if (!email.body.trim()) {
    await store.upsert({ ...baseLog(email, 'skipped'), summary: '본문을 추출할 수 없어 초안을 생성하지 않았습니다.', updatedAt: nowIso() });
    logger.warn('Skipping message because body is empty.', { messageId: email.messageId });
    return;
  }

  try {
    const analysis = await analyzeEmail({
      sender: email.sender,
      subject: email.subject,
      receivedAt: email.receivedAt,
      body: email.body,
      hasAttachments: email.hasAttachments
    });

    await store.upsert({
      ...baseLog(email, 'analyzed'),
      classification: analysis.classification,
      summary: analysis.summary,
      riskLevel: analysis.riskLevel,
      needsReview: analysis.needsReview,
      reviewReasons: analysis.reviewReasons,
      confidence: analysis.confidence,
      updatedAt: nowIso()
    });

    const replyBody = ensureConservativeReply(analysis, email, config.defaultSignature);
    if (!replyBody) {
      await store.upsert({
        ...baseLog(email, 'skipped'),
        classification: analysis.classification,
        summary: analysis.summary,
        riskLevel: analysis.riskLevel,
        needsReview: analysis.needsReview,
        reviewReasons: analysis.reviewReasons,
        confidence: analysis.confidence,
        updatedAt: nowIso()
      });
      logger.warn('OpenAI result did not provide a draftable reply.', { messageId: email.messageId });
      return;
    }

    const draft = await createReplyDraft(gmail, email, replyBody);
    const labelIds = [labels.AI_REPLY_DRAFTED];
    if (analysis.needsReview) labelIds.push(labels.AI_REVIEW_REQUIRED);
    await addLabelsToMessage(gmail, email.gmailMessageId, labelIds);

    await store.upsert({
      ...baseLog(email, analysis.needsReview ? 'review_required' : 'drafted'),
      draftId: draft.draftId,
      classification: analysis.classification,
      summary: analysis.summary,
      riskLevel: analysis.riskLevel,
      needsReview: analysis.needsReview,
      reviewReasons: analysis.reviewReasons,
      confidence: analysis.confidence,
      updatedAt: nowIso()
    });
    logger.info('Created Gmail reply draft.', { messageId: email.messageId, draftId: draft.draftId, needsReview: analysis.needsReview });
  } catch (error) {
    await markError(gmail, labels, store, email, error);
    logger.error('Failed to process message.', { messageId: email.messageId, error });
  }
}

export async function main(): Promise<void> {
  assertRuntimeConfig();
  const gmail = createGmailClient();
  const store = await createLogStore();
  try {
    const labels = await ensureLabels(gmail);
    const messageIds = await listUnreadInboxMessages(gmail, labels);
    logger.info(`Found ${messageIds.length} unread inbox message(s) to process.`);
    for (const id of messageIds) await processOne(gmail, labels, store, id);
  } finally {
    await store.close?.();
  }
}

main().catch((error) => {
  logger.error('Fatal error.', error);
  process.exitCode = 1;
});
