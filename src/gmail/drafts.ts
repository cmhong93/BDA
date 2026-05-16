import type { gmail_v1 } from 'googleapis';
import { config } from '../config.js';
import type { InboundEmail } from './messages.js';
import { base64UrlEncode, encodeMimeWord } from '../utils/mime.js';
import { ensureReplySubject } from '../utils/text.js';

function extractEmailAddress(from: string): string {
  const match = from.match(/<([^>]+)>/);
  return match?.[1] ?? from;
}

function buildRawReply(email: InboundEmail, replyBody: string): string {
  const originalMessageId = email.messageId;
  const references = [email.references, originalMessageId].filter(Boolean).join(' ');
  const headers = [
    `To: ${extractEmailAddress(email.sender)}`,
    `Subject: ${encodeMimeWord(ensureReplySubject(email.subject))}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: 8bit',
    originalMessageId ? `In-Reply-To: ${originalMessageId}` : undefined,
    references ? `References: ${references}` : undefined
  ].filter(Boolean);

  return `${headers.join('\r\n')}\r\n\r\n${replyBody}`;
}

export async function createReplyDraft(gmail: gmail_v1.Gmail, email: InboundEmail, replyBody: string): Promise<{ draftId: string; draftMessageId?: string }> {
  const response = await gmail.users.drafts.create({
    userId: config.gmailUser,
    requestBody: {
      message: {
        threadId: email.threadId,
        raw: base64UrlEncode(buildRawReply(email, replyBody))
      }
    }
  });

  if (!response.data.id) throw new Error('Gmail draft was created without a draft id.');
  return { draftId: response.data.id, draftMessageId: response.data.message?.id ?? undefined };
}
