import type { gmail_v1 } from 'googleapis';
import { config } from '../config.js';
import type { LabelMap } from './labels.js';
import { base64UrlDecode } from '../utils/mime.js';
import { htmlToPlainText, normalizeWhitespace, truncateForModel } from '../utils/text.js';
import { dateHeaderToIso } from '../utils/dates.js';

export type InboundEmail = {
  messageId: string;
  gmailMessageId: string;
  threadId: string;
  sender: string;
  subject: string;
  receivedAt?: string;
  body: string;
  labelIds: string[];
  hasAttachments: boolean;
  references?: string;
  inReplyTo?: string;
};

function getHeader(message: gmail_v1.Schema$Message, name: string): string | undefined {
  return message.payload?.headers?.find((header: { name?: string; value?: string }) => header.name?.toLowerCase() === name.toLowerCase())?.value ?? undefined;
}

function walkParts(part: gmail_v1.Schema$MessagePart | undefined, collector: { text: string[]; html: string[]; hasAttachments: boolean }): void {
  if (!part) return;
  const filename = part.filename ?? '';
  if (filename.trim()) collector.hasAttachments = true;
  const mimeType = part.mimeType ?? '';
  const bodyData = part.body?.data;

  if (bodyData && mimeType === 'text/plain') collector.text.push(base64UrlDecode(bodyData));
  if (bodyData && mimeType === 'text/html') collector.html.push(htmlToPlainText(base64UrlDecode(bodyData)));
  for (const child of part.parts ?? []) walkParts(child, collector);
}

function extractBody(message: gmail_v1.Schema$Message): { body: string; hasAttachments: boolean } {
  const collector = { text: [] as string[], html: [] as string[], hasAttachments: false };
  walkParts(message.payload ?? undefined, collector);
  const body = normalizeWhitespace((collector.text.length > 0 ? collector.text : collector.html).join('\n\n'));
  return { body: truncateForModel(body, config.maxBodyChars), hasAttachments: collector.hasAttachments };
}

export async function listUnreadInboxMessages(gmail: gmail_v1.Gmail, labels: LabelMap): Promise<string[]> {
  const excludedLabels = [labels.AI_REPLY_DRAFTED, labels.AI_REPLY_DONE, labels.AI_REPLY_IGNORED];
  const query = ['in:inbox', 'is:unread', ...excludedLabels.map((id) => `-label:${id}`)].join(' ');
  const response = await gmail.users.messages.list({
    userId: config.gmailUser,
    q: query,
    maxResults: config.maxEmailsPerRun
  });
  return (response.data.messages ?? []).map((message: { id?: string }) => message.id).filter((id: string | undefined): id is string => Boolean(id));
}

export async function getInboundEmail(gmail: gmail_v1.Gmail, gmailMessageId: string): Promise<InboundEmail> {
  const response = await gmail.users.messages.get({
    userId: config.gmailUser,
    id: gmailMessageId,
    format: 'full'
  });
  const message = response.data;
  const body = extractBody(message);
  const messageIdHeader = getHeader(message, 'Message-ID') ?? gmailMessageId;

  return {
    messageId: messageIdHeader,
    gmailMessageId,
    threadId: message.threadId ?? '',
    sender: getHeader(message, 'From') ?? '',
    subject: getHeader(message, 'Subject') ?? '(제목 없음)',
    receivedAt: dateHeaderToIso(getHeader(message, 'Date')),
    body: body.body,
    labelIds: message.labelIds ?? [],
    hasAttachments: body.hasAttachments,
    references: getHeader(message, 'References'),
    inReplyTo: getHeader(message, 'In-Reply-To')
  };
}
