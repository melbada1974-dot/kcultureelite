# K-Culture Elite Program (kcultureelite.com)

## 프로젝트 개요

Global K-Culture Elite Program 랜딩 페이지.
Bada BLI ✕ 동양대학교 공동 운영의 4년제 K-Culture 산업 학위 프로그램 홍보/모집용 독립 사이트.

## 도메인 & 호스팅

| 항목 | 값 |
|------|-----|
| 도메인 | `kcultureelite.com`, `www.kcultureelite.com` |
| Pages 도메인 | `kcultureelite.pages.dev` |
| 호스팅 | Cloudflare Pages (GitHub 연동, push → 자동 배포) |
| GitHub repo | `melbada1974-dot/kcultureelite` |
| Cloudflare 계정 ID | `8f3036cb6115c9db283c8a0a38fb0426` |
| 브랜치 | `main` (단일 배포 브랜치) |

## 프로젝트 히스토리

- 원래 `badabli.com/k-culture.html`로 Bada BLI 사이트 내 서브 페이지로 운영
- **2026-04-17 (1차)**: 독립 도메인 `kcultureelite.com`으로 분리
  - 별도 GitHub repo + Cloudflare Pages 프로젝트 생성
  - 파일 경로, OG 메타, 네비게이션 링크를 새 도메인 기준으로 수정
- **2026-04-17 (2차)**: 완전 독립 사이트화
  - 헤더 NAV 메뉴(Home/Program/K-Culture/CS) 전면 제거 + 모바일 메뉴 삭제
  - 듀얼 로고 헤더 도입: 좌측 Bada BLI (10% 확대) + 우측 동양대 로고
  - 모든 외부 `badabli.com` 이미지 의존 제거 → 로컬 `/assets/` 로 일원화
  - 깨져 있던 Director 사진(Ricky Lee) 복구
- **2026-04-20**: Elite Faculty 섹션 전면 리뉴얼 (이번 세션)
  - 기존 "추상 카드 3개"(Choreographers/Producers/Industry Veterans) → **실제 강사진 22명** 프로필
  - Tier 1 Accordion(6명 Lead) + Tier 2 Flip Cards(16명 Trainer) 2-tier 구조
  - 모든 인물 사진 **Replicate GFPGAN v1.4** AI 얼굴 복원 처리 (저해상도 → 고품질)
  - Ahn Chaeri / YJ Lee: 원본 디자인 카드 → 크롭 + GFPGAN → 다른 Trainer와 톤 통일
  - 경력 전체 **영문화** + 카드 테두리 제거 (깔끔한 다크 디자인)
  - Faculty 섹션 하단 **챗봇 유도 CTA** 추가 ("Ask our AI Assistant")
  - 이미지 캐시 버스팅 `?v=5` 적용 (SimpleHTTPServer 캐시 정책 우회)
- **2026-04-20 (저녁)**: 챗봇 Phase 1 구현 완료 (feat/chatbot-phase1 브랜치)
  - Cloudflare Worker `kc-chatbot` + D1 `kc-db` (4테이블) + KV `kc-rate-limit` 신설
  - Claude Haiku 4.5 + Prompt Caching (지식베이스 ~21K 토큰)
  - Progressive Lead Capture (admissions team 연락 유도 방식)
  - Faculty CTA 제거 → 우하단 플로팅 위젯 단일 진입점
  - 14 vitest unit tests · 로컬+원격 E2E 통과 (Lee Jusun·Kim Tae Sung 경력 정확 답변)
  - 지출 안전장치: 월 $30 하드캡 + 자동 재충전 $5→$15 + 알림 $15/$25

## 파일 구조

```
kcultureelite/
├── index.html          # 메인 랜딩 페이지
├── success.html        # Stripe 결제 완료 후 감사 페이지
├── favicon.svg         # 파비콘
├── .gitignore          # .playwright-mcp/, kc-*.png, .DS_Store 등 제외
├── assets/
│   ├── hero-video.mp4      # 히어로 섹션 배경 영상 (2.7MB)
│   ├── og-image.png        # OG/SNS 공유 이미지 (1200x630)
│   ├── logo-white.png      # Bada BLI 흰색 로고 (Bada BLI 폴더에서 복사)
│   ├── dongyang-logo.jpg   # 동양대학교 로고 (흰 배경 JPG)
│   ├── ricky-lee.png       # Director Ricky Lee 사진
│   └── faculty/            # Elite Faculty 22명 (GFPGAN 처리 완료, ~22MB)
│       ├── kim-tae-sung.png / seo-hye-jung.png / lee-jusun.png
│       ├── hwang-jae-woong.png / jenny-shin.png / lee-taehoo.png  # Tier 1 Lead (6)
│       ├── kim-sang-hyun.png / kim-eunsun.png / jin-hyun-jin-dance.png
│       ├── yoon-jaea.png / jung-minyoung.png / lee-ju-hyun.png
│       ├── jo-hyun-heum.png / lee-da-eun.png / jin-hyun-jin-vocal.png
│       ├── ju-jae-hoon.png / jo-sang-gi.png / kang-se-jung.png
│       ├── kim-nak-kyun.png / kim-si-on.png                       # Tier 2 (14)
│       └── ahn-chaeri.png / yj-lee.png                            # Tier 2 크롭 (2)
├── Rick 수정방안 요청/     # 원본 자료 (Git 트래킹 X, 로컬 참조용)
│   ├── Faculty 인물사진 사용해주세요.pptx
│   ├── dongyang_entertainment_management_최종보고 - 복사본.pptx
│   └── English-brochure.pdf
└── CLAUDE.md
```

> **자산 독립 원칙**: 모든 이미지는 `/assets/` 로컬 경로만 사용. `https://badabli.com/...`
> 외부 URL 참조 금지 (의존성 제거 완료 상태 유지).

## 기술 스택

- **HTML/CSS**: 정적 HTML, Tailwind CSS CDN
- **애니메이션**: GSAP + ScrollTrigger (CDN, `defer` 사용 금지)
- **폰트**: Google Fonts (Inter)
- **아이콘**: Phosphor Icons (CDN)
- **빌드**: 없음 (정적 파일, Cloudflare Pages 빌드 명령 비워둠)

## 디자인 테마

- **컨셉**: 한국 대형 기획사(JYP, SM, HYBE, YG) 홈페이지 스타일 참조
- **색상**: 다크 테마
  - `kc-bg`: `#0A0A0A` (배경)
  - `kc-card`: `#111111` (카드)
  - `kc-accent`: `#A855F7` (보라색 강조)
  - `kc-accent-glow`: `#C084FC`
  - `kc-blue`: `#23508e`
  - `kc-border`: `rgba(255,255,255,0.1)`
- **반응형**: 320px ~ 1920px 완벽 대응

## 헤더 (NAV) 구조

메뉴 없는 **듀얼 로고 전용 헤더** ([index.html:158-168](./index.html#L158-L168)):

| 위치 | 이미지 | 크기 | 비고 |
|------|--------|------|------|
| 좌측 | `/assets/logo-white.png` (Bada BLI) | `h-[66px] md:h-[88px]` | 원본 대비 10% 확대 |
| 우측 | `/assets/dongyang-logo.jpg` (동양대) | `h-[44px] md:h-[56px]` | `rounded-xl` + `shadow-md` + `ring-1` |

- 가운데 텍스트 메뉴 **없음** (완전 브랜딩 중심)
- 모바일 메뉴 버튼/드롭다운 **삭제됨**
- 동양대 로고 JPG는 흰 배경이지만 라운드+그림자+링 처리로 다크 히어로와 조화

## 페이지 섹션 (index.html)

실제 구현된 섹션 순서 (section id 기준):

1. `hero` — K-Pop 댄스 영상 무한루프 배경 + Apply Now CTA
2. `partners` — Industry Partners (HYBE/SM/YG/JYP/ADOR/THE BLACK LABEL/STARSHIP/PLEDIS 등 8개)
3. `program` — 4-Year Degree · 5 Industry Tracks 통계 (4 Years / 5 Tracks / 8+ Partners)
4. `message` — Director's Message (Ricky Lee, `/assets/ricky-lee.png`)
5. `faculty` — Elite Faculty 2-tier (Tier 1 Accordion 6명 + Tier 2 Flip Cards 16명 + 챗봇 CTA)
6. `tracks` — 5개 트랙 (K-Pop Business / K-Performance / K-Beauty Business / K-Fusion Media & Content / Global Entertainment Startup) + 4-Year Roadmap
7. `howitworks` — 참가 절차 4단계 (Global Audition → In-Person Evaluation → Track Training → Career Launch)
8. `career` — 3-Tier Career Safety Net (Plan A/B/C)
9. `scholarship` — 100% Tuition Waiver 안내
10. `faq` — 자주 묻는 질문 아코디언
11. `apply` — Apply Now + 카운트다운 타이머 + 4단계 제출 플로우

## Cinematic 효과

- **Cursor Glow**: 마우스 따라다니는 보라색 글로우
- **3D Tilt**: `[data-tilt]` 요소에 마우스 위치 기반 3D 기울기
- **Spotlight Border**: 카드 테두리 마우스 따라 빛남
- **Magnetic Button**: `[data-magnetic]` 요소 자석 효과
- **Stagger Animation**: `[data-stagger]` 하위 요소 순차 등장
- **ScrollTrigger Reveal**: `.kc-reveal` 클래스 스크롤 시 페이드인

## 푸터

[index.html:863-888](./index.html#L863-L888):
- 좌측: Bada BLI 로고 (`h-10 md:h-12`) + `× Dongyang University` 텍스트
- 가운데: 연락처 `global@badaglobal-bli.com`
- 우측: `© 2026 Bada BLI x Dongyang University`

## Elite Faculty 섹션 상세

2026-04-20 세션에서 완성된 구조 ([index.html:372](./index.html#L372) 근처):

### Tier 1 — Lead Faculty (Accordion Slider, 6명)
| # | 이름 | 역할 | 주요 경력 |
|---|------|------|-----------|
| 1 | Kim Tae Sung | Special Trainer · Broadcast Executive | 1998 백상예술대상, TV조선 제작본부장, SBS 라디오센터장 |
| 2 | Seo Hye Jung | Special Trainer · Voice Actor | KBS 17기 성우, 우마 서먼/줄리엣 루이스 전담 |
| 3 | Lee Jusun | Dance Director | PSY 강남스타일, G.O.D 전곡 안무 총감독 |
| 4 | Hwang Jae Woong | Vocal Director | 소녀시대·B1A4 녹음, 빌보드 월드 차트 6위 |
| 5 | Jenny Shin | Acting Director · Head of Education | JS 연기아카데미 대표, YG·FNC 트레이너 |
| 6 | Lee Taehoo | Dance Leader | Pnation 창립멤버, 블랙핑크 글로벌 광고 |

### Tier 2 — Specialist Trainers (3D Flip Cards, 16명)
Kim Sang Hyun, Kim Eunsun, Jin Hyun Jin (Dance), Yoon Jaea, Jung Minyoung, Lee Ju Hyun, Jo Hyun Heum, Lee Da Eun, Jin Hyun Jin (Vocal), Ju Jae Hoon, Jo Sang Gi, Kang Se Jung, Kim Nak Kyun, Kim Si On, **Ahn Chaeri** (K-Pop Dance), **YJ Lee** (K-Street Dance)

### AI 이미지 처리 워크플로우 (Replicate GFPGAN)
```bash
# 환경 변수 로드
export REPLICATE_API_TOKEN=$(cat ~/.replicate-token)

# Python 스크립트로 GFPGAN 호출
# tencentarc/gfpgan:{latest} + input: {img, version: v1.4, scale: 4}
# 비용: 이미지당 ~$0.002 (22장 = ~$0.03)
```

- **토큰 보관**: `~/.replicate-token` (권한 600, Chris 계정)
- **Prepaid $10 + Auto-reload**: $5 이하 시 $15 자동 충전 설정
- **Rate limit**: 결제 수단 등록 시 해제 (미등록은 6 req/min)

### 챗봇 CTA (Faculty 섹션 하단)
- 문구: *"Want to know more about our faculty, their teaching style, curriculum, or Dongyang University? Ask our AI assistant for detailed answers — anytime."*
- 현재 상태: 플레이스홀더 alert (실제 챗봇 미구현)
- 다음 단계: `superpowers:brainstorming`으로 챗봇 범위·지식베이스·UI 기획

## 챗봇 (Phase 1 완료)

- **Worker**: `workers/kc-chatbot/` — 독립 npm 프로젝트 (TypeScript + Vitest + Wrangler)
  - 배포 URL: `https://kc-chatbot.melbada1974.workers.dev`
  - 엔드포인트: `POST /chat`, `POST /lead`, `GET /health`
- **프론트**: `assets/chatbot/{chatbot.css,chatbot.js}` + `index.html` 내 `<link>`·`<script data-worker>` 주입
- **지식베이스**: `workers/kc-chatbot/knowledge-base.md` (85KB / ~21K 토큰)
  - 빌드 스크립트: `scripts/{extract-ppt.py,extract-pdf.py,crawl-dyu.py,build-kb.py}`
  - KB 갱신 시: `python3 scripts/build-kb.py` → Worker 재배포 (`cd workers/kc-chatbot && npm run deploy`)
- **문서**:
  - Spec: `docs/superpowers/specs/2026-04-20-chatbot-design.md`
  - 구현 Plan: `docs/superpowers/plans/2026-04-20-chatbot-implementation.md`
- **Cloudflare 리소스**:
  - D1 DB `kc-db` (id `ce9dd78b-4651-4537-ac76-8d10b129c3db`) — 4 테이블(leads, questions_log, applications, payments)
  - KV `kc-rate-limit` (id `e1e2db3b22fb4de496bee403fff9fc5e`)
  - Worker secrets: `ANTHROPIC_API_KEY`, `IP_HASH_SALT`
- **로컬 개발**:
  - `.dev.vars` (gitignored) 에서 secret 로드
  - `cd workers/kc-chatbot && npx wrangler dev --local`
- **리드 조회 (Chris님 수동)**:
  ```bash
  cd workers/kc-chatbot
  npx wrangler d1 execute kc-db --remote \
    --command "SELECT email, name, interested_track, consent_type, first_seen_at FROM leads ORDER BY first_seen_at DESC LIMIT 50;"
  ```
- **월 비용 조회**:
  ```bash
  npx wrangler kv key get --binding=RATE_LIMIT "monthly_cost:$(date -u +%Y%m)"
  ```
- **안전장치**:
  - Rate limit: IP 시간 20 / 일 60 메시지
  - 월 예산 하드캡: $30 USD (Anthropic Console)
  - 자동 재충전: 잔액 $5 이하 시 $15 (최대 월 $30 경계 안)
  - 알림 이메일: $15·$25 도달 시
## 지원서 폼 + Google Sheet 연동 (2026-04-23 완료, PR #5·#6)

사이트 상단 히어로 + 하단 Apply 섹션의 "Apply Now" 버튼 둘 다 동일한 4-step 모달을 엽니다. 제출 시 Google Apps Script Web App에 POST → 연결된 Sheet에 행 기록 + 지원자 확인 이메일 + 관리자(`global@badaglobal-bli.com`) 알림 이메일 자동 발송.

### 구성 요소

| 항목 | 값 |
|------|-----|
| 프론트 CSS | `assets/apply/apply-form.css` (다크 테마 모달, 400+ lines) |
| 프론트 JS | `assets/apply/apply-form.js` (4-step wizard + validation + Apps Script POST) |
| 모달 HTML | `index.html` 내 `#kc-apply-overlay` (약 280 lines) |
| Google Sheet | `Kcultureelite Form` (id `13gRfL_MNDnxLJBh_zIs2h9POQmNv5Jz7WyNOumLAGi4`) · Sheet1 |
| Apps Script | `Kcultureelite Form Handler` (id `1QNXk8iTLhqL-9BBqlVpshWYf59s7weNTZg3rr-_WSIM8LWROVvQZjFe2`) |
| Web App URL | `https://script.google.com/macros/s/AKfycbyADn1u0ctWqRhooiY4lUX8Q_R7mYl976CvTmavoknqOkrTnqzRvVDfV9bjw9QwYtgB/exec` |
| 계정 | `global@badaglobal-bli.com` (Ricky LEE) |

### 폼 구조 (Rick 2026-04-19 요청서 Section 1~4 기반)
- **Step 1 Personal**: Full Name / DOB / Gender / Nationality / Contact Number / Email
- **Step 2 Background**: Interest Tracks (5개 체크박스) / Education / Korean Proficiency 1~5
- **Step 3 Audition**: Video URL / Self-Introduction (최소 100자)
- **Step 4 Payment & Refund Policy**: 3개 동의 체크박스 (지원비 KRW 30,000 / 환불 정책 / 장학 구조 검토)
- Submit 시 applicationId(UUID) + paymentStatus=`pending` 자동 부여 (Stripe 연결 시 webhook이 이 ID로 매칭 예정)

### Apps Script v2 — 전화번호 수식 버그 수정 포함
- `doPost` 내부에 `escapeFormula()` 유틸: `+`, `=`, `-`, `@`로 시작하는 값 앞에 `'`를 붙여 Sheet가 수식으로 해석하지 못하게 함 (초기 v1에서 `+82-10-...`이 `-6840`으로 저장되던 버그 수정)
- 동시에 `MailApp.sendEmail` 두 번 호출 (지원자 + 관리자)

### Sheet 유지보수
- Sheet 꾸미기(헤더 보라 배경 + 흰 글자 + Bold + Center + Wrap)는 진주가 진행, Chris님이 나머지(Freeze 1 row, 컬럼 너비)는 직접 마감하시기로 함

## 결제 시스템 (대기 중 · 2026-04-23 보류)

히어로·풋터 두 CTA는 **통일 완료**(PR #6) — 둘 다 `openApplyForm()` 호출. 단 **Step 4는 현재 동의 체크박스만 있고 실제 "Pay" 버튼은 아직 없음**. 폼 Submit은 Apps Script POST + "Application Received" 화면으로 끝남. Payment instructions는 지원자 확인 이메일/성공 화면 모두에 "결제 안내가 별도 이메일로 갈 것"이라고 안내됨 (즉 현재는 수동 결제 플로우 전제).

- **방식**: Stripe Checkout via Cloudflare Worker (planned)
- **금액**: KRW 30,000 (Rick 요청서 및 사이트 전반 통일 — 기존 문서의 $20 USD는 구 안)
- **Worker 이름**: `kc-checkout` (미생성)
- **프론트 훅**: `assets/apply/apply-form.js`의 `CHECKOUT_ENDPOINT` 상수 (현재 빈 문자열). 채워지면 Submit이 Apps Script POST → Stripe Checkout 리다이렉트로 자동 전환됨
- **Stripe 계정**: Chris님 아직 미가입. 한국 법인 vs 호주 법인 중 어느 쪽으로 등록할지 결정 대기 (양쪽 다 법인 있음, 한국 법인에는 "BADA BLI" 상호 없음 — Statement Descriptor로 `KCULTURE ELITE` 쓰면 됨)
- **Stripe 계정 생성 후 받을 것**: Test `pk_test_*` + `sk_test_*` API keys (승인 대기 중에도 Test mode는 즉시 사용 가능)
- **필요 작업 (법인 결정 후 재개)**:
  1. Chris 가입 + Test keys 확보 (30분)
  2. Worker `kc-checkout` 개발: `/create-checkout-session` + `/webhook` (2~3h)
  3. Apps Script v3: Sheet에 `Payment Status` 컬럼 추가, `?action=update` 쿼리로 Stripe webhook에서 applicationId로 행 업데이트 (1h)
  4. `CHECKOUT_ENDPOINT` 채움 + `success.html` 개선 (30m)
  5. Test mode E2E → Live 승인 → Live key 교체 → 실결제 1회 (1h)
- **설정 메모**: Stripe Dashboard → Adaptive Pricing(고객 통화 자동 변환) + "Email customers about successful payments"(자동 영수증) 활성화 필요

## 주의 사항 (DO/DON'T)

**DO**
- 자산은 `/assets/` 로컬 경로만 사용
- `index.html` 섹션 수정 시 해당 `id`를 `apply` 등 CTA 링크가 참조하는지 확인
- 배포 전 로컬 `python3 -m http.server` 로 미리보기 체크
- 로고/이미지 자산 추가 시 Bada BLI 폴더에서 **복사(cp)** 만 사용 (이동/삭제 금지)

**DON'T**
- `https://badabli.com/...` 외부 URL 이미지 참조 금지 (독립성 훼손)
- GSAP CDN 스크립트에 `defer` 사용 금지 (ReferenceError 발생)
- Hero 콘텐츠에 `.kc-reveal` 클래스 사용 금지 (첫 로드 시 안 보임)
- `/Users/jinhanjeong/Antigravity/Bada BLI/` 폴더 내 파일 **수정/이동/삭제 절대 금지** (읽기·복사만 허용)
- 배포(git push) 전 **반드시 사용자 승인** 받기

## 배포 절차

```bash
# 1. 로컬 미리보기
python3 -m http.server 8765
# http://localhost:8765 확인

# 2. 변경 커밋
git add <변경 파일>
git commit -m "<type>: <설명>"

# 3. 배포 (사용자 승인 후)
git push origin main
# → Cloudflare Pages 자동 빌드·배포 (60~120초)
```
