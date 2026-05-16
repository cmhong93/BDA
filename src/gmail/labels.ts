import type { gmail_v1 } from 'googleapis';
import { config } from '../config.js';

export const AI_LABEL_NAMES = ['AI_REPLY_DRAFTED', 'AI_REVIEW_REQUIRED', 'AI_REPLY_DONE', 'AI_REPLY_IGNORED', 'AI_ERROR'] as const;
export type AiLabelName = (typeof AI_LABEL_NAMES)[number];
export type LabelMap = Record<AiLabelName, string>;

export async function ensureLabels(gmail: gmail_v1.Gmail): Promise<LabelMap> {
  const existing = await gmail.users.labels.list({ userId: config.gmailUser });
  const labelMap = new Map<string, string>((existing.data.labels ?? []).map((label: { name?: string; id?: string }) => [label.name ?? '', label.id ?? '']));
  const result = {} as LabelMap;

  for (const name of AI_LABEL_NAMES) {
    const currentId = labelMap.get(name);
    if (currentId) {
      result[name] = String(currentId);
      continue;
    }
    const created = await gmail.users.labels.create({
      userId: config.gmailUser,
      requestBody: {
        name,
        labelListVisibility: 'labelShow',
        messageListVisibility: 'show'
      }
    });
    if (!created.data.id) throw new Error(`Failed to create Gmail label ${name}`);
    result[name] = created.data.id;
  }

  return result;
}

export async function addLabelsToMessage(gmail: gmail_v1.Gmail, messageId: string, labelIds: string[]): Promise<void> {
  if (labelIds.length === 0) return;
  await gmail.users.messages.modify({
    userId: config.gmailUser,
    id: messageId,
    requestBody: { addLabelIds: labelIds }
  });
}
