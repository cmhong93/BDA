import type { AiEmailResult, EmailForAi } from './schemas.js';

export function ensureConservativeReply(result: AiEmailResult, email: EmailForAi, signature?: string): string {
  if (!result.canDraftReply || !result.replyDraft.trim()) return '';

  let reply = result.replyDraft.trim();
  if (result.needsReview) {
    const conservativePhrase = /(확인|내부 확인).*(회신|답변)/.test(reply);
    if (!conservativePhrase) {
      reply = `안녕하세요.\n문의 주신 내용 확인했습니다.\n\n해당 사항은 내부 확인 후 다시 회신드리겠습니다.\n\n감사합니다.`;
    }
  }

  if (email.hasAttachments && !/첨부/.test(reply)) {
    reply = reply.replace(/감사합니다\.?\s*$/m, '첨부파일 확인 후 다시 회신드리겠습니다.\n\n감사합니다.');
  }

  if (signature && !reply.includes(signature.trim())) {
    reply = `${reply}\n\n${signature.trim()}`;
  }
  return reply;
}
