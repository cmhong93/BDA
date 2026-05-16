import { z } from 'zod';

export const classifications = [
  '견적 요청',
  '회의 일정 문의',
  '자료 요청',
  '단순 확인 요청',
  '계약/금액/법무 관련',
  '민원성 또는 분쟁성 메일',
  '개인정보 포함 가능 메일',
  '첨부파일 검토 필요 메일',
  '기관/발주처/평가 관련 중요 메일',
  '기타'
] as const;

export const riskLevels = ['low', 'medium', 'high'] as const;

export const aiEmailResultSchema = z.object({
  summary: z.string().min(1),
  classification: z.enum(classifications),
  riskLevel: z.enum(riskLevels),
  needsReview: z.boolean(),
  reviewReasons: z.array(z.string()),
  confidence: z.number().min(0).max(1),
  canDraftReply: z.boolean(),
  replyDraft: z.string().default('')
});

export type Classification = (typeof classifications)[number];
export type RiskLevel = (typeof riskLevels)[number];
export type AiEmailResult = {
  summary: string;
  classification: Classification;
  riskLevel: RiskLevel;
  needsReview: boolean;
  reviewReasons: string[];
  confidence: number;
  canDraftReply: boolean;
  replyDraft: string;
};

export type EmailForAi = {
  sender: string;
  subject: string;
  receivedAt?: string;
  body: string;
  hasAttachments: boolean;
};
