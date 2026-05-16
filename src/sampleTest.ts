import { ensureConservativeReply } from './ai/generateReply.js';
import type { AiEmailResult, Classification, EmailForAi, RiskLevel } from './ai/schemas.js';

type Sample = EmailForAi & { name: string };

const samples: Sample[] = [
  {
    name: '견적 요청 메일',
    sender: '홍길동 <hong@example.com>',
    subject: '홈페이지 유지보수 견적 요청',
    receivedAt: '2026-05-16T09:00:00.000Z',
    hasAttachments: false,
    body: '안녕하세요. 홈페이지 유지보수 월간 견적서를 받아볼 수 있을까요? 가능한 범위와 일정도 알려주세요.'
  },
  {
    name: '회의 일정 문의 메일',
    sender: '김미팅 <meeting@example.com>',
    subject: '다음 주 회의 가능 일정 문의',
    receivedAt: '2026-05-16T10:00:00.000Z',
    hasAttachments: false,
    body: '안녕하세요. 다음 주 화요일이나 수요일 오후에 회의 가능하신지 확인 부탁드립니다.'
  },
  {
    name: '자료 요청 메일',
    sender: '이자료 <data@example.com>',
    subject: '제품 소개 자료 요청',
    receivedAt: '2026-05-16T11:00:00.000Z',
    hasAttachments: false,
    body: '귀사의 서비스 소개서와 구축 사례 자료를 받아볼 수 있을까요? 검토 후 연락드리겠습니다.'
  },
  {
    name: '계약 관련 메일',
    sender: '박계약 <contract@example.com>',
    subject: '계약서 조항 및 대금 지급 조건 검토 요청',
    receivedAt: '2026-05-16T12:00:00.000Z',
    hasAttachments: false,
    body: '계약서 5조 손해배상 조항과 대금 지급 조건을 확정하고 싶습니다. 법무 검토 의견도 회신 부탁드립니다.'
  },
  {
    name: '민원성 메일',
    sender: '고객 <complaint@example.com>',
    subject: '서비스 장애 항의 및 보상 요구',
    receivedAt: '2026-05-16T13:00:00.000Z',
    hasAttachments: false,
    body: '지난 장애로 큰 피해를 봤습니다. 즉시 사과하고 보상안을 제시하지 않으면 민원을 제기하겠습니다.'
  },
  {
    name: '개인정보 포함 가능 메일',
    sender: '인사팀 <hr@example.com>',
    subject: '지원자 주민등록번호 포함 서류 확인',
    receivedAt: '2026-05-16T14:00:00.000Z',
    hasAttachments: false,
    body: '지원자의 주민등록번호와 연락처가 포함된 서류를 확인해 주세요. 처리 가능 여부 회신 바랍니다.'
  },
  {
    name: '첨부파일 검토 필요 메일',
    sender: '최첨부 <attach@example.com>',
    subject: '첨부 제안서 검토 요청',
    receivedAt: '2026-05-16T15:00:00.000Z',
    hasAttachments: true,
    body: '첨부한 제안서 내용을 검토하시고 의견을 회신 부탁드립니다.'
  }
];

function classify(sample: Sample): Pick<AiEmailResult, 'classification' | 'riskLevel' | 'needsReview' | 'reviewReasons' | 'confidence'> {
  const text = `${sample.subject}\n${sample.body}`;
  const risky: Array<[RegExp, Classification, string]> = [
    [/(계약|대금|법무|손해배상|조항|청구|세금|금액)/, '계약/금액/법무 관련', '계약/금액/법무 관련 내용'],
    [/(항의|보상|민원|분쟁|피해)/, '민원성 또는 분쟁성 메일', '민원성 또는 분쟁성 내용'],
    [/(주민등록번호|개인정보|민감정보|연락처)/, '개인정보 포함 가능 메일', '개인정보 포함 가능'],
    [/(발주처|평가|공공|기관)/, '기관/발주처/평가 관련 중요 메일', '기관/발주처/평가 관련 중요 사안']
  ];
  if (sample.hasAttachments) return { classification: '첨부파일 검토 필요 메일', riskLevel: 'medium', needsReview: true, reviewReasons: ['첨부파일 검토 필요'], confidence: 0.95 };
  for (const [regex, classification, reason] of risky) {
    if (regex.test(text)) return { classification, riskLevel: 'high', needsReview: true, reviewReasons: [reason], confidence: 0.94 };
  }
  const lowRisk: Array<[RegExp, Classification]> = [
    [/(견적|견적서)/, '견적 요청'],
    [/(회의|일정|미팅)/, '회의 일정 문의'],
    [/(자료|소개서|사례)/, '자료 요청'],
    [/(확인|가능 여부)/, '단순 확인 요청']
  ];
  for (const [regex, classification] of lowRisk) {
    if (regex.test(text)) return { classification, riskLevel: 'low', needsReview: false, reviewReasons: [], confidence: 0.9 };
  }
  return { classification: '기타', riskLevel: 'medium', needsReview: true, reviewReasons: ['분류 확신도 낮음'], confidence: 0.7 };
}

function sampleAnalyze(sample: Sample): AiEmailResult {
  const classified = classify(sample);
  const conservative = classified.needsReview;
  const replyDraft = conservative
    ? '안녕하세요.\n문의 주신 내용 확인했습니다.\n\n해당 사항은 내부 확인 후 다시 회신드리겠습니다.\n\n감사합니다.'
    : '안녕하세요.\n문의 주신 내용 확인했습니다.\n\n요청하신 사항을 확인하여 회신드리겠습니다.\n\n감사합니다.';
  return {
    summary: `${sample.name}에 대한 요청 메일입니다.`,
    canDraftReply: true,
    replyDraft,
    ...classified
  };
}

for (const sample of samples) {
  const result = sampleAnalyze(sample);
  const replyDraft = ensureConservativeReply(result, sample, process.env.DEFAULT_SIGNATURE || '');
  const output: AiEmailResult = { ...result, replyDraft };
  console.log(`\n## ${sample.name}`);
  console.log(JSON.stringify(output, null, 2));
}
