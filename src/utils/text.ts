import { htmlToText } from 'html-to-text';

export function htmlToPlainText(html: string): string {
  return htmlToText(html, {
    wordwrap: false,
    selectors: [
      { selector: 'a', options: { ignoreHref: true } },
      { selector: 'img', format: 'skip' }
    ]
  });
}

export function normalizeWhitespace(value: string): string {
  return value
    .replace(/\r\n/g, '\n')
    .replace(/[\t ]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function truncateForModel(value: string, maxChars: number): string {
  if (value.length <= maxChars) return value;
  const headLength = Math.floor(maxChars * 0.7);
  const tailLength = maxChars - headLength;
  return `${value.slice(0, headLength)}\n\n...[중간 내용 생략: 원문이 너무 길어 일부만 분석합니다]...\n\n${value.slice(-tailLength)}`;
}

export function ensureReplySubject(subject: string): string {
  return /^\s*re:/i.test(subject) ? subject : `Re: ${subject}`;
}
