import OpenAI from 'openai';
import { config } from '../config.js';
import { aiEmailResultSchema, type AiEmailResult, type EmailForAi } from './schemas.js';
import { buildUserPrompt, SYSTEM_PROMPT } from './prompts.js';

const openai = new OpenAI({ apiKey: config.openaiApiKey });

function extractOutputText(response: unknown): string {
  const maybe = response as { output_text?: string; output?: Array<{ content?: Array<{ type?: string; text?: string }> }> };
  if (maybe.output_text) return maybe.output_text;
  const parts = maybe.output?.flatMap((item) => item.content ?? []).map((content) => content.text).filter(Boolean) ?? [];
  return parts.join('\n');
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('OpenAI response did not contain JSON.');
    return JSON.parse(match[0]);
  }
}

function applySafetyOverrides(result: AiEmailResult, email: EmailForAi): AiEmailResult {
  const riskyClassifications = new Set([
    '계약/금액/법무 관련',
    '민원성 또는 분쟁성 메일',
    '개인정보 포함 가능 메일',
    '첨부파일 검토 필요 메일',
    '기관/발주처/평가 관련 중요 메일'
  ]);
  const reasons = new Set(result.reviewReasons);
  let needsReview = result.needsReview;
  let riskLevel = result.riskLevel;

  if (riskyClassifications.has(result.classification)) {
    needsReview = true;
    if (riskLevel === 'low') riskLevel = 'medium';
    reasons.add(`검토 필수 분류: ${result.classification}`);
  }
  if (email.hasAttachments) {
    needsReview = true;
    if (riskLevel === 'low') riskLevel = 'medium';
    reasons.add('첨부파일 검토 필요');
  }
  if (result.confidence < config.minConfidence) {
    needsReview = true;
    if (riskLevel === 'low') riskLevel = 'medium';
    reasons.add(`확신도 ${result.confidence}가 기준 ${config.minConfidence}보다 낮음`);
  }

  return { ...result, needsReview, riskLevel, reviewReasons: [...reasons] };
}

export async function analyzeEmail(email: EmailForAi): Promise<AiEmailResult> {
  const prompt = buildUserPrompt(email, config.defaultSignature);
  let lastError: unknown;

  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      const response = await openai.responses.create({
        model: config.openaiReplyModel,
        input: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: prompt }
        ],
        text: { format: { type: 'json_object' } }
      });
      const parsed = parseJson(extractOutputText(response));
      const validated = aiEmailResultSchema.parse(parsed);
      return applySafetyOverrides(validated, email);
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Failed to analyze email.');
}
