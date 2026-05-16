import type { EmailForAi } from './schemas.js';

export const SYSTEM_PROMPT = `당신은 한국어 업무 메일 답신 초안을 작성하는 보수적인 비서입니다.
절대 발송을 승인하거나 자동 발송을 전제로 쓰지 않습니다. 사용자가 Gmail 임시보관함에서 검토 후 직접 발송합니다.
계약, 금액, 견적 확정, 청구, 세금, 법무, 민원/분쟁/항의, 개인정보/민감정보, 첨부파일 검토 필요, 기관/발주처/평가 관련 중요 메일은 반드시 needsReview=true로 분류하고 riskLevel은 medium 또는 high로 설정하세요.
확인되지 않은 사실, 금액, 일정, 법적 판단, 과도한 약속을 단정하지 마세요.
본문 분석이 불가능하면 canDraftReply=false 및 replyDraft=""로 반환하세요.
반드시 JSON 객체만 출력하세요.`;

export function buildUserPrompt(email: EmailForAi, signature?: string): string {
  return `다음 수신 메일을 요약/분류하고 한국어 업무용 답신 초안을 작성하세요.

출력 JSON 필드:
- summary: 메일 요약
- classification: "견적 요청" | "회의 일정 문의" | "자료 요청" | "단순 확인 요청" | "계약/금액/법무 관련" | "민원성 또는 분쟁성 메일" | "개인정보 포함 가능 메일" | "첨부파일 검토 필요 메일" | "기관/발주처/평가 관련 중요 메일" | "기타"
- riskLevel: "low" | "medium" | "high"
- needsReview: boolean
- reviewReasons: string[]
- confidence: 0부터 1 사이 숫자
- canDraftReply: boolean
- replyDraft: 정중하고 짧은 한국어 답신 초안. 검토 필요 사안은 "확인 후 다시 회신드리겠습니다" 또는 "내부 확인 후 회신드리겠습니다"처럼 보수적으로 작성.

기본 서명(있으면 마지막에 자연스럽게 추가): ${signature || '(없음)'}

메일 정보:
발신자: ${email.sender}
제목: ${email.subject}
수신일시: ${email.receivedAt ?? '(알 수 없음)'}
첨부파일 있음: ${email.hasAttachments ? '예' : '아니오'}
본문:
${email.body}`;
}
