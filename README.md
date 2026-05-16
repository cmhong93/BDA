# Gmail AI Reply Draft Automation

Gmail 수신 메일을 분석해 OpenAI API로 한국어 업무용 답신 **초안**을 만들고, 원본 Gmail thread의 임시보관함 Draft로 저장하는 TypeScript Node.js 자동화 서비스입니다.

> 가장 중요한 원칙: AI는 Gmail 답신 초안만 만듭니다. 최종 발송은 반드시 사람이 Gmail 임시보관함에서 직접 확인하고 수행합니다.

## 자동 발송 금지 정책

- 이 프로젝트는 Gmail Draft 생성만 수행합니다.
- Gmail `users.drafts.create`만 사용해 임시보관함 초안을 생성합니다.
- Gmail의 발송 API 호출 기능은 구현하지 않습니다.
- `AUTO_SEND=false`가 기본값이며, 실행 시 `AUTO_SEND=true`면 즉시 오류로 중단합니다.
- 계약, 금액, 법무, 민원, 개인정보, 첨부파일 검토 필요, 기관/발주처/평가 관련 중요 메일은 반드시 `AI_REVIEW_REQUIRED` 라벨을 붙이고 보수적인 답신 초안만 생성합니다.

## 전체 처리 흐름

1. Gmail OAuth 인증으로 INBOX의 읽지 않은 메일을 조회합니다.
2. `AI_REPLY_DRAFTED`, `AI_REPLY_DONE`, `AI_REPLY_IGNORED` 라벨이 있는 메일은 제외합니다.
3. 발신자, 제목, 날짜, plain text 본문, threadId, messageId, 첨부 여부를 추출합니다.
4. HTML 메일은 plain text로 변환하고, 긴 본문은 `MAX_BODY_CHARS` 기준으로 잘라 OpenAI에 전달합니다.
5. OpenAI Responses API로 요약, 분류, 위험도, 검토 필요 여부, 답신 초안을 JSON으로 생성합니다.
6. Gmail `users.drafts.create`로 원본 thread에 답장 Draft를 생성합니다.
7. 원본 메일에 `AI_REPLY_DRAFTED` 및 필요 시 `AI_REVIEW_REQUIRED` 라벨을 적용합니다.
8. 처리 결과를 JSON 또는 SQLite 로그에 저장합니다.
9. 사용자가 Gmail 임시보관함에서 직접 확인, 수정, 발송합니다.

## OpenAI 모델 사용 위치

- 기본 답신 생성 모델: `OPENAI_REPLY_MODEL=gpt-5.4-mini`
- 기본 분류/요약 모델: `OPENAI_CLASSIFY_MODEL`, 미설정 시 `OPENAI_REPLY_MODEL`, 그마저 없으면 `gpt-5.4-mini`
- 모델명은 코드 곳곳에 하드코딩하지 않고 `src/config.ts`에서 환경변수 기반으로 관리합니다.
- 현재 구현은 요약/분류/답신 초안을 한 번의 Responses API 호출로 JSON 응답받습니다. 향후 비용 절감을 위해 `OPENAI_CLASSIFY_MODEL`과 `OPENAI_REPLY_MODEL`을 분리해 단계별 호출로 확장할 수 있습니다.

## Gmail API 설정 방법

1. Google Cloud Console에서 프로젝트를 생성합니다.
2. Gmail API를 활성화합니다.
3. OAuth 동의 화면을 구성합니다.
4. OAuth Client ID를 생성합니다.
   - 애플리케이션 유형은 로컬 테스트 시 Desktop app 또는 Web application을 사용할 수 있습니다.
5. 아래 scope를 포함해 refresh token을 발급합니다.
   - `https://www.googleapis.com/auth/gmail.modify`
   - `https://www.googleapis.com/auth/gmail.compose`
6. 발급받은 Client ID, Client Secret, Refresh Token을 `.env`에 설정합니다.

## Google OAuth refresh token 발급 예시

OAuth refresh token은 Google OAuth Playground 또는 별도 로컬 OAuth 스크립트로 발급할 수 있습니다.

1. OAuth Playground에서 Gmail scope를 선택합니다.
2. 본인 계정으로 승인합니다.
3. Authorization code를 token으로 교환합니다.
4. refresh token을 복사해 `GOOGLE_REFRESH_TOKEN`에 저장합니다.

운영 계정과 테스트 계정을 분리하는 것을 권장합니다.

## OpenAI API Key 설정 방법

1. OpenAI 대시보드에서 API key를 생성합니다.
2. `.env`에 `OPENAI_API_KEY`로 설정합니다.
3. 답신 초안 모델은 기본값 그대로 `OPENAI_REPLY_MODEL=gpt-5.4-mini`를 사용합니다.

## 환경변수

`.env.example`을 복사해 `.env`를 만드세요.

```bash
cp .env.example .env
```

| 변수 | 필수 | 기본값 | 설명 |
| --- | --- | --- | --- |
| `OPENAI_API_KEY` | 예 | 없음 | OpenAI API key |
| `OPENAI_REPLY_MODEL` | 예 | `gpt-5.4-mini` | 답신 초안 생성 모델 |
| `OPENAI_CLASSIFY_MODEL` | 아니오 | `OPENAI_REPLY_MODEL` | 분류/요약 모델 |
| `GOOGLE_CLIENT_ID` | 예 | 없음 | Google OAuth client id |
| `GOOGLE_CLIENT_SECRET` | 예 | 없음 | Google OAuth client secret |
| `GOOGLE_REFRESH_TOKEN` | 예 | 없음 | Gmail OAuth refresh token |
| `GMAIL_USER` | 예 | `me` | Gmail API user id |
| `AUTO_SEND` | 예 | `false` | 반드시 false 유지 |
| `MIN_CONFIDENCE` | 예 | `0.85` | 이 값보다 낮으면 검토 필요 |
| `DEFAULT_SIGNATURE` | 아니오 | 없음 | 답신 끝에 붙일 기본 서명 |
| `MAX_EMAILS_PER_RUN` | 아니오 | `10` | 1회 실행 처리 최대 메일 수 |
| `MAX_BODY_CHARS` | 아니오 | `12000` | OpenAI 전달 본문 최대 길이 |
| `LOG_STORAGE` | 아니오 | `json` | `json` 또는 `sqlite` |
| `SQLITE_DB_PATH` | 아니오 | `./data/logs.sqlite` | SQLite 로그 경로 |
| `JSON_LOG_PATH` | 아니오 | `./data/logs.json` | JSON 로그 경로 |

## 로컬 실행 방법

```bash
npm install
npm run check
npm run test:sample
npm run dev
```

빌드 후 실행:

```bash
npm run build
npm run start
```

## Gmail 임시보관함에서 직접 승인/발송하는 운영 방식

1. 자동화 서비스가 Gmail Draft를 생성합니다.
2. 사용자는 Gmail의 임시보관함에서 Draft를 엽니다.
3. 요약/분류 결과와 라벨을 참고해 문구, 첨부파일, 수신자, 서명을 확인합니다.
4. 필요한 경우 직접 수정합니다.
5. 최종 발송 여부는 사용자가 Gmail 화면에서 직접 “보내기” 버튼을 눌러 결정합니다.
6. 발송 후 운영자가 원본 메일에 `AI_REPLY_DONE` 라벨을 수동으로 붙이면 이후 실행에서 제외됩니다.

이번 버전은 사용자가 Gmail에서 직접 발송한 사실을 자동 감지하지 않습니다.

## Gmail 라벨 운영 방식

서비스는 아래 라벨을 자동 생성하고 사용합니다.

- `AI_REPLY_DRAFTED`: Draft가 생성된 원본 메일
- `AI_REVIEW_REQUIRED`: 사람 검토가 반드시 필요한 메일
- `AI_REPLY_DONE`: 사용자가 수동으로 붙이는 완료 라벨
- `AI_REPLY_IGNORED`: 사용자가 수동으로 붙이는 제외 라벨
- `AI_ERROR`: 처리 중 오류가 발생한 메일

조회 시 `AI_REPLY_DRAFTED`, `AI_REPLY_DONE`, `AI_REPLY_IGNORED`가 있는 메일은 처리하지 않습니다.

## 분류 기준

OpenAI 응답은 다음 분류 중 하나를 반환합니다.

- 견적 요청
- 회의 일정 문의
- 자료 요청
- 단순 확인 요청
- 계약/금액/법무 관련
- 민원성 또는 분쟁성 메일
- 개인정보 포함 가능 메일
- 첨부파일 검토 필요 메일
- 기관/발주처/평가 관련 중요 메일
- 기타

아래 조건은 항상 검토 필요입니다.

- 계약, 금액, 견적 확정, 청구, 세금, 법무 관련 내용
- 민원성, 분쟁성, 항의성 메일
- 개인정보 또는 민감정보 포함 가능성이 있는 메일
- 첨부파일 내용을 검토해야 답변 가능한 메일
- 기관, 공공부문, 발주처, 평가 관련 중요 메일
- 답변 확신도가 낮은 메일
- 본문이 불완전하거나 맥락이 부족한 메일

## 로그 저장 방식

`LOG_STORAGE=json`이면 `JSON_LOG_PATH`에 배열 형태의 JSON 로그를 저장합니다.

`LOG_STORAGE=sqlite`이면 `SQLITE_DB_PATH`에 SQLite 테이블 `processing_logs`로 저장합니다.

저장 항목:

- messageId, threadId, draftId
- sender, subject, receivedAt
- classification, summary, riskLevel
- needsReview, reviewReasons, confidence
- status, errorMessage
- createdAt, updatedAt

이메일 본문 전체는 장기 로그에 저장하지 않습니다.

## 샘플 테스트

실제 Gmail/OpenAI API를 호출하지 않고 샘플 메일 7종에 대해 분류와 답신 초안 형식을 확인합니다.

```bash
npm run test:sample
```

포함 샘플:

- 견적 요청 메일
- 회의 일정 문의 메일
- 자료 요청 메일
- 계약 관련 메일
- 민원성 메일
- 개인정보 포함 가능 메일
- 첨부파일 검토 필요 메일

## 운영 시 주의사항

- `.env`, 로그 파일, SQLite DB, token 파일은 git에 커밋하지 않습니다.
- API key와 OAuth token을 코드에 하드코딩하지 않습니다.
- Draft가 생성되었더라도 반드시 사람이 원문과 첨부파일을 확인해야 합니다.
- 계약/금액/법무/민원/개인정보/첨부파일 관련 메일은 보수적인 초안만 생성됩니다.
- 본 서비스는 법률, 회계, 세무 판단을 대신하지 않습니다.
- 주기 실행은 cron, systemd timer, GitHub Actions self-hosted runner 등으로 구성할 수 있지만, 자동 발송은 절대 구성하지 마세요.
