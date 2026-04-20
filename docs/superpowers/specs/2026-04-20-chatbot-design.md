# K-Culture Elite 챗봇 설계안

**문서 버전**: v2
**작성일**: 2026-04-20
**작성자**: Chris JEONG × 진주 (브레인스토밍 세션)
**상태**: 설계 확정 — 구현 계획 수립 대기
**프로젝트 마감일**: 2026-05-31 (41일 남음)

---

## 1. 개요 (Overview)

K-Culture Elite Program(`kcultureelite.com`) 랜딩 페이지에 **AI 상담 챗봇**을 플로팅 위젯 형태로 추가한다. 챗봇은 방문자의 K-Culture Elite Program 및 동양대학교 관련 질문에 답하고, 관심 있는 예비 지원자의 리드(이메일)를 자연스럽게 수집하여 Cloudflare D1 데이터베이스에 축적한다. 이 데이터는 프로젝트 종료(2026-05-31) 후에도 Bada BLI 마케팅 자산으로 영구 보존된다.

본 문서는 챗봇 단독 spec이며, 사이트 수정(QA #1~#8) 및 Apply Now 폼 + Stripe + D1 통합은 별도 후속 spec에서 다룬다.

---

## 2. 목표와 비목표 (Goals & Non-goals)

### 2.1 목표 (Goals)
- 방문자의 프로그램/학교/입학 관련 질문에 24/7 정확하게 답변
- 관심 표명 시점에만 자연스럽게 이메일 수집 (Progressive Lead Capture)
- 대화 로그로 "학생들이 무엇을 궁금해하는지" 파악 → KB·사이트 지속 개선
- 월 API 비용 $30 이내 안정 운영
- 5월 31일 이후에도 DB 자산으로 유지

### 2.2 비목표 (Non-goals)
- **정식 지원 접수** — Apply Now 폼의 역할 (Phase 3 별도 spec)
- **결제 처리** — Stripe Checkout의 역할 (Phase 3 별도 spec)
- **자료(브로슈어/PDF) 자동 발송** — 약속 가능한 자료가 없음. admissions team이 직접 답장
- **개인정보 심층 수집** (생년월일·여권번호·연락처 등) — Apply Now 폼 전용
- **입학 최종 결정 안내** (합격·불합격·결과) — admissions team 권한
- **다국어 UI 전면 지원** — UI는 영어 고정, 답변만 자동 언어 매칭

---

## 3. 사용자 여정 (User Journey)

### 3.1 일반 정보 탐색
1. 학생이 `kcultureelite.com` 방문
2. 우하단 플로팅 버튼(💬) 클릭 → 위젯 확장
3. 환영 메시지 확인: *"Hi! Ask me anything about the K-Culture Elite Program — in any language you prefer."*
4. 자연어로 질문 (예: "한국어 수업도 있나요?") → 챗봇이 KB 기반 답변

### 3.2 관심 표명 → 리드 수집
1. 학생이 특정 트랙에 관심 표명 (예: "I'm interested in K-Beauty Business")
2. 챗봇이 상세 답변 후 자연스럽게 제안:
   > *"Would you like our admissions team to reach out with more details about the K-Beauty Business track? Just share your name and email. (Optional — feel free to keep chatting here.)"*
3. 학생이 동의 → 이름·이메일 제공
4. 챗봇이 감사 인사: *"Thank you, [Name]! Our admissions team will contact you within 48 hours."*
5. D1 `leads` 테이블에 저장: `email`, `name`, `interested_track`, `consent_type='admissions_contact'`, `language_pref`, `first_seen_at`

### 3.3 admissions team 후속 처리
1. Chris님/팀원이 Google Sheets(Phase 2) 또는 D1 직접 조회로 신규 리드 확인
2. 48시간 내 개별 이메일 발송
3. D1 `leads.contacted_at` 수동 업데이트

---

## 4. 시스템 아키텍처 (System Architecture)

```
┌──────────────────────────────────────────────────────────────┐
│  학생 브라우저 (kcultureelite.com)                           │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  Floating Widget (index.html에 내장)                   │ │
│  │  • localStorage ← 대화 내역 (서버 저장 X)              │ │
│  │  • 언어 자동 감지                                      │ │
│  └──────────────────┬─────────────────────────────────────┘ │
└────────────────────┼──────────────────────────────────────────┘
                     │ HTTPS POST /chat
                     ▼
┌──────────────────────────────────────────────────────────────┐
│  Cloudflare Worker (kc-chatbot)                              │
│  • Rate Limiting (KV 카운터: IP당 시간/일 제한)              │
│  • 월 예산 초과 체크                                         │
│  • Anthropic API Key 안전 보관 (env)                         │
│  • Progressive Lead Capture 로직                             │
└────────────┬────────────────────────┬────────────────────────┘
             │                        │
             ▼                        ▼
┌──────────────────────┐    ┌──────────────────────────────────┐
│ Anthropic API        │    │ Cloudflare D1 (kc-db)            │
│ • Claude Haiku 4.5   │    │  - leads (Phase 1)               │
│ • Prompt Caching ON  │    │  - questions_log (Phase 1)       │
│ • system + KB inject │    │  - applications (Phase 3 hook)   │
└──────────────────────┘    │  - payments (Phase 3 hook)       │
                            └──────────────────────────────────┘
                                        │
                                        ▼ (Phase 2 — Cron Trigger)
                              ┌──────────────────────┐
                              │ Google Sheets        │
                              │ (Chris님 실시간 조회)│
                              └──────────────────────┘
```

---

## 5. 컴포넌트 (Components)

### 5.1 Floating Widget (프론트엔드)
**위치**: `index.html` 내 인라인 (별도 페이지·iframe 없음)
**기술**: Vanilla JS + Tailwind CSS (프로젝트 기존 스택과 일치)
**책임**:
- 우하단 `position: fixed` 버튼·확장 위젯 렌더링
- localStorage로 대화 내역 저장·복원 (키: `kc-chat-history`, 최대 50턴)
- Cloudflare Worker `/chat` 엔드포인트로 POST 요청
- 스트리밍 응답 렌더링 (typewriter 효과)
- 언어 자동 감지 (사용자 입력 언어를 Worker에 hint로 전달)

**상태**:
- `closed` (기본, 버튼만 표시)
- `open` (위젯 확장, 대화창 표시)
- `typing` (Claude 응답 생성 중)

**접근성**:
- 키보드 네비게이션 지원 (Tab → 버튼, Enter → 열기)
- ARIA labels: `role="dialog"`, `aria-label="K-Culture AI Assistant"`
- `prefers-reduced-motion` 준수 (애니메이션 최소화 옵션)

### 5.2 Cloudflare Worker (`kc-chatbot`)
**경로**: 프로젝트 내 `workers/kc-chatbot/` 디렉터리 (별도 Git 관리)
**런타임**: Cloudflare Workers (V8 isolate)
**엔드포인트**:
- `POST /chat` — 메시지 처리
- `POST /lead` — 이메일 수집 시점 리드 저장
- `GET /health` — 상태 확인 (운영용)

**책임**:
1. 요청 검증 (CORS, 메시지 길이, spam 필터)
2. Rate limiting 체크 (KV 카운터 조회)
3. 월 예산 초과 체크 (`KV:monthly_cost` 누적)
4. Anthropic API 호출 (Claude Haiku 4.5 + Prompt Caching)
5. 응답에서 이메일 패턴 감지 → `/lead` 엔드포인트로 리다이렉트
6. 질문 로그 익명 저장 (D1 `questions_log`)

**환경 변수 (secrets)**:
- `ANTHROPIC_API_KEY` — Anthropic 콘솔에서 발급
- `CF_KV_RATE_LIMIT` — Rate limit 카운터용 KV 바인딩
- `CF_D1_DB` — D1 DB 바인딩

### 5.3 지식베이스 (Knowledge Base)
**파일**: `workers/kc-chatbot/knowledge-base.md` (Worker 배포 시 번들링)
**크기 예상**: 20~40K 토큰 (Prompt Caching 효과 큼)

**구조**:
```markdown
# K-Culture Elite Program Knowledge Base

## Part 1: K-Culture Elite Program (공식 자료)
### 1.1 Program Overview
### 1.2 5 Industry Tracks
  - K-Pop Business
  - K-Performance
  - K-Beauty Business
  - K-Fusion Media & Content
  - Global Entertainment Startup
### 1.3 4-Year Roadmap
### 1.4 Faculty (22명 상세)
### 1.5 Tuition & Scholarship Structure
### 1.6 Application Process
### 1.7 Career Outcomes (Plan A/B/C)

## Part 2: Dongyang University (참고 자료 — 내부 인용용)
### 2.1 University Overview (역사·규모·위치)
### 2.2 Entertainment Management Department
### 2.3 Campus & Facilities
### 2.4 Global Programs

## Part 3: FAQ & Escalation
### 3.1 Frequently Asked Questions
### 3.2 When to refer to admissions team
### 3.3 Contact information (global@badaglobal-bli.com)
```

**원본 자료**:
- `Rick 수정방안 요청/Faculty 인물사진 사용해주세요.pptx` → Part 1.4
- `Rick 수정방안 요청/dongyang_entertainment_management_최종보고.pptx` → Part 1.1~1.7
- `Rick 수정방안 요청/English-brochure.pdf` → Part 2 (동양대 참고용)
- `dyu.ac.kr` 주요 페이지 크롤링 → Part 2

**자료 성격 구분** (중요):
- Part 1 = **K-Culture Elite Program 공식 자료** — 직접 인용
- Part 2 = **동양대학교 참고 자료** — "Dongyang University is ~" 형태로 주체 명시하여 인용
- 챗봇은 Part 2 자료를 KCE 공식 브로슈어로 오해시키지 않음

### 5.4 Cloudflare D1 DB (`kc-db`)
**섹션 6 참조**

### 5.5 Cloudflare KV (`kc-rate-limit`)
**용도**:
- IP별 시간/일 메시지 카운터 (`ip:{hash}:hour:{YYYYMMDDHH}` → integer, TTL 3600s)
- 월 누적 비용 (`monthly_cost:{YYYYMM}` → float USD)

---

## 6. 데이터 모델 (Data Model)

### 6.1 `leads` (Phase 1)
```sql
CREATE TABLE leads (
    id                TEXT PRIMARY KEY,  -- UUID
    email             TEXT UNIQUE NOT NULL,
    name              TEXT NOT NULL,
    interested_track  TEXT,  -- 'K-Pop Business' | 'K-Performance' | ...
    language_pref     TEXT,  -- 'en' | 'ko' | 'zh' | 'ja' | 'vi' | ...
    consent_type      TEXT NOT NULL,  -- 'admissions_contact' | 'updates_notification'
    first_seen_at     DATETIME DEFAULT CURRENT_TIMESTAMP,
    country_code      TEXT,  -- Cloudflare CF-IPCountry 헤더
    source            TEXT DEFAULT 'chatbot',
    contacted_at      DATETIME,  -- admissions team 후속 처리 시 수동 업데이트
    notes             TEXT
);
CREATE INDEX idx_leads_email ON leads(email);
CREATE INDEX idx_leads_not_contacted ON leads(contacted_at) WHERE contacted_at IS NULL;
```

### 6.2 `questions_log` (Phase 1)
```sql
CREATE TABLE questions_log (
    id             TEXT PRIMARY KEY,
    session_hash   TEXT NOT NULL,  -- SHA-256(IP + user_agent + daily_salt)
    question_text  TEXT NOT NULL,
    kb_matched     BOOLEAN DEFAULT FALSE,  -- KB에서 답을 찾았는지
    language       TEXT,
    timestamp      DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_questions_timestamp ON questions_log(timestamp);
CREATE INDEX idx_questions_unmatched ON questions_log(kb_matched) WHERE kb_matched = FALSE;
```

### 6.3 `applications` (Phase 3 — 스키마만 사전 정의)
```sql
CREATE TABLE applications (
    id             TEXT PRIMARY KEY,
    email          TEXT NOT NULL,  -- leads.email FK
    full_name      TEXT NOT NULL,
    passport_name  TEXT NOT NULL,
    date_of_birth  DATE NOT NULL,
    gender         TEXT,
    nationality    TEXT NOT NULL,
    contact_number TEXT NOT NULL,
    track_selected TEXT NOT NULL,
    education      TEXT,
    korean_level   INTEGER CHECK (korean_level BETWEEN 1 AND 5),
    audition_url   TEXT,
    self_intro     TEXT,
    consent_payment BOOLEAN NOT NULL,
    consent_refund  BOOLEAN NOT NULL,
    consent_tuition BOOLEAN NOT NULL,
    submitted_at   DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_applications_email ON applications(email);
```

### 6.4 `payments` (Phase 3 — 스키마만 사전 정의)
```sql
CREATE TABLE payments (
    id             TEXT PRIMARY KEY,
    application_id TEXT NOT NULL,  -- applications.id FK
    stripe_session TEXT UNIQUE,
    amount_krw     INTEGER NOT NULL,  -- 30000
    status         TEXT NOT NULL,  -- 'pending' | 'paid' | 'refunded_50' | 'refunded_0'
    paid_at        DATETIME,
    refund_at      DATETIME,
    refund_reason  TEXT
);
CREATE INDEX idx_payments_application ON payments(application_id);
CREATE INDEX idx_payments_stripe ON payments(stripe_session);
```

**통합 쿼리 예시** (Phase 3 이후):
```sql
-- "챗봇에서 K-Beauty 관심 → 실제 지원 → 결제 완료" 학생 명단
SELECT l.name, l.email, l.first_seen_at, a.track_selected, p.paid_at
FROM leads l
JOIN applications a ON a.email = l.email
JOIN payments p ON p.application_id = a.id
WHERE l.interested_track = 'K-Beauty Business'
  AND p.status = 'paid'
ORDER BY l.first_seen_at;
```

---

## 7. 시스템 프롬프트 설계 (System Prompt)

### 7.1 구조
```
<system>
<persona>...</persona>
<scope>...</scope>
<language>...</language>
<source_attribution>...</source_attribution>
<lead_capture>...</lead_capture>
<escalation>...</escalation>
<restrictions>...</restrictions>
</system>

<knowledge_base cache="ephemeral">
[Part 1: K-Culture Elite Program]
[Part 2: Dongyang University]
[Part 3: FAQ & Escalation]
</knowledge_base>

<messages>
[사용자 메시지 히스토리]
</messages>
```

### 7.2 핵심 규칙
1. **범위 제한**: K-Culture Elite Program · Dongyang University · Admissions · Faculty · Tracks 외 주제(일반 K-Pop 루머·개인 상담·시사 이슈 등)는 정중히 거절
2. **언어 매칭**: `Respond in the same language as the user's most recent message.`
3. **주체 구분**: "K-Culture Elite Program is ~" vs "Dongyang University is ~" 명확히 구분. 동양대 공식 자료를 KCE 공식 자료로 오해시키지 않음
4. **실제 없는 자료 약속 금지**: "I'll send you the brochure" / "Here's a PDF" 같은 약속 **절대 금지**. 가치 제안은 오직 admissions team 연락 또는 업데이트 알림
5. **심층 질문 이메일 유도**: 개별 학비 할인·세부 계약 조건·합격률·정원 등은 `global@badaglobal-bli.com` 또는 "our admissions team"로 안내
6. **개인정보 수집 금지**: 생년월일·여권번호·연락처 등은 요구하지 않음 (Apply Now 폼 전용)
7. **이메일 수집 타이밍**: 학생이 특정 트랙·입학 절차에 구체적 관심을 표명한 시점에만 선택적 제안. 강요 금지
8. **할루시네이션 방지**: KB에 없는 구체 수치·일정·합격률은 *"Please contact our team directly at global@badaglobal-bli.com"* 로 유도

### 7.3 샘플 응답 톤
- 따뜻하고 전문적 (Faculty·admissions team의 대면 상담 톤)
- 간결하되 필요한 맥락 포함
- 리스트·구분 기호 적절히 사용하여 가독성 확보
- 과장·보장 금지 ("You will definitely get in" 같은 표현 절대 금지)

---

## 8. Rate Limiting & 비용 관리 (Cost Controls)

### 8.1 제한 정책
| 항목 | 값 | 구현 |
|------|-----|------|
| IP당 시간 메시지 | 20 | KV `ip:{hash}:hour:{YYYYMMDDHH}` TTL 3600s |
| IP당 일 메시지 | 60 | KV `ip:{hash}:day:{YYYYMMDD}` TTL 86400s |
| 메시지당 최대 출력 토큰 | 1000 | Anthropic API `max_tokens=1000` |
| 월 예산 상한 | $30 USD | KV `monthly_cost:{YYYYMM}` 누적 체크 |
| Cloudflare Bot Fight Mode | ON | Cloudflare 대시보드에서 활성화 |

### 8.2 제한 도달 시 사용자 응답
- IP 시간/일 제한: *"I've answered quite a few of your questions today. For detailed inquiries, please email global@badaglobal-bli.com — our team will get back to you personally."*
- 월 예산 도달: 같은 메시지 + 관리자에게 알림 (Cloudflare Worker 로그 모니터링)

### 8.3 비용 추정
Claude Haiku 4.5 + Prompt Caching:
- 지식베이스(~30K 토큰) 캐시 히트 입력 비용: $0.10/1M tokens
- 신규 입력: $1/1M tokens
- 출력: $5/1M tokens
- **메시지당 평균 비용**: ~$0.003
- **월 500 방문자 × 5메시지 = 2,500 메시지**: ~$7.5/월
- **$30 상한은 예상 트래픽의 4배 버퍼**

---

## 9. 프라이버시 & 보안 (Privacy & Security)

### 9.1 데이터 처리 원칙
- **대화 원문**: 사용자 브라우저 localStorage에만 저장 (서버 저장 X)
- **질문 텍스트**: D1 `questions_log`에 저장. IP는 salted SHA-256 해시
- **답변 텍스트**: 저장하지 않음 (토큰·용량·법적 부담 절감, KB로 재현 가능)
- **개인정보 (이메일·이름)**: 학생이 명시적으로 제공한 경우에만 `leads` 테이블 저장

### 9.2 PIPA (개인정보보호법) 대응
- 위젯 하단 고지: *"Your conversation stays in your browser. We collect anonymous question data to improve our service."*
- 이메일 제공 시점: *"By sharing your email, you consent to our admissions team contacting you."*
- 보관 기간: 리드는 3년 (Bada BLI 마케팅 자산), 질문 로그는 1년
- 삭제 요청 경로: `global@badaglobal-bli.com`

### 9.3 API 키 보안
- `ANTHROPIC_API_KEY`는 Cloudflare Worker secrets에만 저장
- 클라이언트 JavaScript에 절대 노출 X
- `.env` 파일은 Git 제외 (`.gitignore`)
- Worker 로그에서도 키 redaction

### 9.4 Input Validation
- 메시지 길이 최대 2000자
- HTML/스크립트 태그 스트리핑
- SQL 인젝션: D1은 prepared statement 사용
- Rate limit 카운터는 신뢰 가능한 Cloudflare CF-Connecting-IP 헤더만 사용

---

## 10. Phase 3 통합 훅 (Integration Hooks)

### 10.1 Apply Now 폼 연결 지점
- 챗봇에서 수집한 `leads.email`이 Apply Now 폼 `applications.email`과 JOIN 가능
- 챗봇이 답변 중 Apply Now로 유도할 때 URL fragment 활용: `kcultureelite.com/#apply?from=chatbot&track=K-Beauty+Business`
- Apply Now 폼이 URL fragment 읽어 초기값으로 설정

### 10.2 Stripe 결제 연결
- Stripe Checkout 성공 webhook → Worker에서 `payments.status='paid'` 업데이트
- `applications.id`를 Stripe `client_reference_id`로 전달

### 10.3 Google Sheets 동기화 (향후 검토, 별도 spec)
- Worker Cron Trigger (일 1회)로 전일 신규 `leads` + `applications` + `payments`를 Google Sheets에 append
- Google Service Account JSON 키는 Worker secrets에 저장
- 우선순위 낮음 — Phase 3(Apply Now) 완료 후 리드 누적 추이 보고 판단

---

## 11. 구현 단계 (Implementation Phases)

### 11.1 Phase 1 — 챗봇 (이번 spec 범위, 2~3일)

**Day 1 — 지식베이스 구축**
- Rick 폴더 PPT 2개를 Python으로 텍스트 추출
- 동양대 PDF 추출
- `dyu.ac.kr` 주요 페이지 크롤링 (학과·입학·캠퍼스)
- `knowledge-base.md` 통합 작성 (Part 1/2/3 구조)
- 주체별 섹션 명확 구분 (K-Culture Elite vs 동양대)

**Day 2 — Worker + D1 + API 연동**
- `wrangler` CLI로 Cloudflare D1 (`kc-db`) 생성
- 4 테이블 스키마 마이그레이션
- Cloudflare KV (`kc-rate-limit`) 생성
- Worker 프로젝트(`workers/kc-chatbot/`) 초기화
- Anthropic API 호출 로직 + Prompt Caching 활성화
- Rate limit 미들웨어
- `/chat`, `/lead`, `/health` 엔드포인트
- 단위 테스트 (rate limit·KB 로딩·Anthropic 응답 파싱)

**Day 3 — 프론트엔드 위젯 + 배포**
- `index.html`에 Floating Widget 내장 (CSS + Vanilla JS)
- localStorage 대화 유지
- 스트리밍 응답 UX
- 실제 브라우저 테스트 (Playwright — 여러 언어, rate limit, 이메일 수집 플로우)
- Cloudflare Worker 배포 (`wrangler deploy`)
- Cloudflare Pages 배포 (기존 워크플로우)
- 프로덕션 상담 플로우 End-to-End 검증

### 11.2 Phase 2 — Ricky QA #1~#8 반영 (별도 spec)
- 로고·텍스트·섹션 순서·금액·카운트다운·푸터 수정
- Faculty CTA 제거 (챗봇 단일 진입점으로 통일)

### 11.3 Phase 3 — Apply Now 폼 + Stripe + D1 통합 (별도 spec)
- 멀티스텝 폼 구현
- Stripe Checkout 연동
- `applications` + `payments` 테이블 활용
- Webhook 처리

### 11.4 Phase 4 — 테스트 + 폴리싱 + 최종 배포 (별도 작업)

---

## 12. 외부 서비스 의존성 (External Dependencies)

### 12.1 필수 (Phase 1)
- **Anthropic API** — Claude Haiku 4.5 사용. Chris님 계정으로 [console.anthropic.com](https://console.anthropic.com) 가입 + 결제 수단 등록 필요. 월 예산 $30 상한 설정.
- **Cloudflare Workers + D1 + KV** — 기존 Cloudflare Pages 계정 내 무료 티어로 가능 (별도 가입 불필요)

### 12.2 Phase 1에서 **불필요**
- **이메일 자동 발송 서비스** (Resend/SendGrid) — admissions team이 직접 답장하므로 불필요
- **벡터 DB** (Pinecone/Weaviate/Cloudflare Vectorize) — KB 규모가 작아 RAG 불필요

### 12.3 향후 검토 (Phase 2 이후)
- **Google Sheets API** — 리드 자동 동기화 (선택)
- **Sentry / Cloudflare Logs** — 에러 모니터링 (선택)

---

## 13. 미해결 질문 및 향후 작업 (Open Questions)

### 13.1 구현 전 결정 필요
- [ ] Anthropic API 계정 가입 완료 여부 확인 (Chris님 후속 조치)
- [ ] 월 예산 한도 설정 방법 확인 (Anthropic 콘솔 기능)

### 13.2 Phase 2 이후 결정
- [ ] Google Sheets 동기화 추가 여부
- [ ] 관리자 대시보드 페이지(`/admin`) 구축 여부
- [ ] Resend 등 이메일 자동 응답 시스템 추가 여부
- [ ] 챗봇 로그 기반 KB 지속 개선 프로세스 정립

### 13.3 장기 고려
- [ ] 챗봇 대화 기반 학생 세그먼트 분석
- [ ] Bada BLI 타 프로그램(어학당 등) 크로스 프로모션 플로우

---

## 14. 결정 근거 요약 (Decision Log)

| 결정 | 선택한 옵션 | 근거 |
|------|------------|------|
| 범위 | B — 프로그램 상담 | 지원자 전환 + 할루시네이션 관리 + PPT 활용 균형 |
| UI | A — Floating Widget | 모든 페이지 접근성 최대 + 단일 진입점으로 UI 중복 제거 |
| 언어 | B — 영어 UI + 자동 답변 | 사이트 톤 일치 + 글로벌 지원 + 관리 비용 최소 |
| KB 구성 | 구조화 Markdown + Prompt Caching | 규모 적합 + 유지보수 쉬움 + 비용 효율 |
| AI 모델 | Claude Haiku 4.5 | 문서 Q&A 품질 충분 + 비용 최적 |
| 비용 관리 | B — 균형 모드 | 남용 방지 + 정상 사용자 경험 + 월 예산 제어 |
| 로깅 | B — 학습형 | 운영 인사이트 + PIPA 준수 균형 |
| 리드 수집 | Progressive + admissions 연락 | 게이트 이탈 방지 + 자료 인프라 불필요 + 진성 리드 |
| DB | D1 (4 테이블) | Phase 3 통합 대비 + 이메일 공통 키 연결 |

---

## 15. 관련 문서 (References)

- 프로젝트 CLAUDE.md: [/CLAUDE.md](../../../CLAUDE.md)
- Ricky Director 요청서: `Rick 수정방안 요청/📋 웹사이트 수정 요청서.docx`
- KCE PPT: `Rick 수정방안 요청/dongyang_entertainment_management_최종보고.pptx`
- Faculty PPT: `Rick 수정방안 요청/Faculty 인물사진 사용해주세요.pptx`
- 동양대 참고 PDF: `Rick 수정방안 요청/English-brochure.pdf`
- Anthropic Prompt Caching: https://docs.anthropic.com/en/docs/build-with-claude/prompt-caching
- Cloudflare D1 docs: https://developers.cloudflare.com/d1/
