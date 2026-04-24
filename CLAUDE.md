# K-Culture Elite Program (kcultureelite.com)

Global K-Culture Elite Program 랜딩 페이지 — Bada BLI ✕ 동양대학교 공동 운영의 4년제 K-Culture 산업 학위 프로그램 홍보/모집용 독립 사이트.

## 도메인 & 호스팅

| 항목 | 값 |
|------|-----|
| 도메인 | `kcultureelite.com`, `www.kcultureelite.com` |
| Pages 도메인 | `kcultureelite.pages.dev` |
| 호스팅 | Cloudflare Pages (GitHub 연동, push → 자동 배포) |
| GitHub repo | `melbada1974-dot/kcultureelite` |
| Cloudflare 계정 ID | `8f3036cb6115c9db283c8a0a38fb0426` |
| 브랜치 | `main` (단일 배포) |

## 히스토리 요약

- 원래 `badabli.com/k-culture.html` 서브 페이지 → **2026-04-17** 독립 도메인 분리, 듀얼 로고 헤더, `/assets/` 자산 로컬화
- **2026-04-20** Elite Faculty 22명 프로필 (Tier 1 Accordion 6 + Tier 2 Flip 16), GFPGAN AI 얼굴 복원
- **2026-04-20 저녁** 챗봇 Phase 1 배포 (Cloudflare Worker + D1 + Haiku 4.5)
- **2026-04-23** 지원서 4-step 모달 + Google Sheet/Apps Script 연동 (PR #5·#6)
- **2026-04-23~** Stripe AU 가입 진행 중 (Representative 단계에서 중단)
- 자세한 변경 이력은 `git log`

## 파일 구조

```
kcultureelite/
├── index.html              # 메인 랜딩 페이지
├── success.html            # Stripe 결제 완료 페이지
├── favicon.svg
├── assets/
│   ├── hero-video.mp4      # 히어로 배경 영상
│   ├── og-image.png        # OG 공유 이미지
│   ├── logo-white.png      # Bada BLI 흰색 로고
│   ├── dongyang-logo.jpg   # 동양대 로고
│   ├── ricky-lee.png       # Director 사진
│   ├── faculty/            # Elite Faculty 22명 (GFPGAN 처리 .png)
│   ├── apply/              # 지원서 모달 CSS/JS
│   └── chatbot/            # 챗봇 위젯 CSS/JS
├── workers/kc-chatbot/     # Cloudflare Worker (TS + Vitest + Wrangler)
├── scripts/                # KB 빌드 (extract-ppt/pdf, crawl-dyu, build-kb)
├── docs/superpowers/       # 설계 스펙/구현 플랜
├── Rick 수정방안 요청/      # 원본 PPT·PDF (Git X, 로컬 참조용)
└── CLAUDE.md
```

> **자산 독립 원칙**: 모든 이미지는 `/assets/` 로컬 경로. `https://badabli.com/...` 외부 URL 금지.

## 기술 스택 & 디자인

- **스택**: 정적 HTML + Tailwind CDN · GSAP+ScrollTrigger (CDN, `defer` 금지) · Google Fonts Inter · Phosphor Icons · 빌드 없음
- **색상 (다크 테마)**: `kc-bg #0A0A0A` · `kc-card #111111` · `kc-accent #A855F7` · `kc-accent-glow #C084FC` · `kc-blue #23508e` · `kc-border rgba(255,255,255,0.1)`
- **반응형**: 320px ~ 1920px · **컨셉**: JYP/SM/HYBE/YG 기획사 스타일

## 헤더 (듀얼 로고, 메뉴 없음)

[index.html:158-168](./index.html#L158-L168) — 좌: Bada BLI (`h-[66px] md:h-[88px]`, 원본 대비 10% 확대) · 우: 동양대 (`h-[44px] md:h-[56px]`, `rounded-xl shadow-md ring-1` — 흰 배경 JPG를 다크 히어로와 조화시킴). 가운데 메뉴·모바일 드롭다운 삭제됨.

## 페이지 섹션 순서

`hero` → `partners` (HYBE/SM/YG/JYP 등 8개) → `program` (4Y/5Tracks/8+Partners) → `message` (Ricky Lee) → `faculty` (Tier1+Tier2) → `tracks` (5개 + 4-Year Roadmap) → `howitworks` (4단계) → `career` (3-Tier Plan A/B/C) → `scholarship` (100% Waiver) → `faq` → `apply` (카운트다운 + 4-step 모달)

## 푸터

[index.html:863-888](./index.html#L863-L888) — 좌: Bada BLI 로고 + `× Dongyang University` / 중: `global@badaglobal-bli.com` / 우: `© 2026 Bada BLI x Dongyang University`

## Cinematic 효과

Cursor Glow · 3D Tilt (`[data-tilt]`) · Spotlight Border · Magnetic Button (`[data-magnetic]`) · Stagger (`[data-stagger]`) · ScrollTrigger Reveal (`.kc-reveal` — Hero에는 사용 금지)

## Elite Faculty 섹션

### Tier 1 — Lead Faculty (Accordion, 6명)
| # | 이름 | 역할 | 주요 경력 |
|---|------|------|-----------|
| 1 | Kim Tae Sung | Special Trainer · Broadcast Executive | 1998 백상예술대상, TV조선 제작본부장, SBS 라디오센터장 |
| 2 | Seo Hye Jung | Special Trainer · Voice Actor | KBS 17기 성우, 우마 서먼/줄리엣 루이스 전담 |
| 3 | Lee Jusun | Dance Director | PSY 강남스타일, G.O.D 전곡 안무 총감독 |
| 4 | Hwang Jae Woong | Vocal Director | 소녀시대·B1A4 녹음, 빌보드 월드 차트 6위 |
| 5 | Jenny Shin | Acting Director · Head of Education | JS 연기아카데미 대표, YG·FNC 트레이너 |
| 6 | Lee Taehoo | Dance Leader | Pnation 창립멤버, 블랙핑크 글로벌 광고 |

### Tier 2 — Specialist Trainers (3D Flip, 16명)
Kim Sang Hyun, Kim Eunsun, Jin Hyun Jin (Dance), Yoon Jaea, Jung Minyoung, Lee Ju Hyun, Jo Hyun Heum, Lee Da Eun, Jin Hyun Jin (Vocal), Ju Jae Hoon, Jo Sang Gi, Kang Se Jung, Kim Nak Kyun, Kim Si On, **Ahn Chaeri** (K-Pop Dance), **YJ Lee** (K-Street Dance)

### AI 이미지 처리 (Replicate GFPGAN v1.4)
`tencentarc/gfpgan` + `{version: v1.4, scale: 4}` · 비용 ~$0.002/장 · 토큰은 `~/.replicate-token` (권한 600) · Prepaid $10 + $5 이하 시 $15 auto-reload

## 챗봇 (Phase 1 완료)

- **Worker**: `workers/kc-chatbot/` · 배포 URL `https://kc-chatbot.melbada1974.workers.dev` · 엔드포인트 `POST /chat`, `POST /lead`, `GET /health`
- **프론트**: `assets/chatbot/{chatbot.css,chatbot.js}` + `index.html` `<link>`/`<script data-worker>` 주입 (우하단 플로팅 위젯)
- **지식베이스**: `workers/kc-chatbot/knowledge-base.md` (~21K 토큰, Prompt Caching) · 갱신: `python3 scripts/build-kb.py` → `cd workers/kc-chatbot && npm run deploy`
- **Cloudflare 리소스**:
  - D1 `kc-db` (id `ce9dd78b-4651-4537-ac76-8d10b129c3db`) — 테이블: leads, questions_log, applications, payments
  - KV `kc-rate-limit` (id `e1e2db3b22fb4de496bee403fff9fc5e`)
  - Secrets: `ANTHROPIC_API_KEY`, `IP_HASH_SALT` · 로컬은 `.dev.vars` (gitignored)
- **로컬 개발**: `cd workers/kc-chatbot && npx wrangler dev --local`
- **리드 조회**: `npx wrangler d1 execute kc-db --remote --command "SELECT email, name, interested_track, consent_type, first_seen_at FROM leads ORDER BY first_seen_at DESC LIMIT 50;"`
- **월 비용 조회**: `npx wrangler kv key get --binding=RATE_LIMIT "monthly_cost:$(date -u +%Y%m)"`
- **안전장치**: Rate limit 20/h·60/day · 월 하드캡 $30 (Anthropic Console) · auto-reload $5→$15 · 알림 $15/$25
- **문서**: Spec `docs/superpowers/specs/2026-04-20-chatbot-design.md` / Plan `docs/superpowers/plans/2026-04-20-chatbot-implementation.md`

## 지원서 폼 + Google Sheet 연동 (PR #5·#6 완료)

히어로·풋터 두 Apply Now CTA 모두 `openApplyForm()` 호출 → 4-step 모달 → Google Apps Script Web App POST → Sheet 행 기록 + 지원자·관리자 이메일 2종 자동 발송.

| 항목 | 값 |
|------|-----|
| 프론트 | `assets/apply/apply-form.{css,js}` (400+ lines, 4-step wizard + validation) |
| 모달 HTML | `index.html` 내 `#kc-apply-overlay` (~280 lines) |
| Google Sheet | `Kcultureelite Form` (id `13gRfL_MNDnxLJBh_zIs2h9POQmNv5Jz7WyNOumLAGi4`) |
| Apps Script | `Kcultureelite Form Handler` (id `1QNXk8iTLhqL-9BBqlVpshWYf59s7weNTZg3rr-_WSIM8LWROVvQZjFe2`) |
| Web App URL | `https://script.google.com/macros/s/AKfycbyADn1u0ctWqRhooiY4lUX8Q_R7mYl976CvTmavoknqOkrTnqzRvVDfV9bjw9QwYtgB/exec` |
| 계정 | `global@badaglobal-bli.com` (Ricky LEE) |

**폼 4단계 구조**: (1) Personal — Full Name/DOB/Gender/Nationality/Contact/Email · (2) Background — Interest Tracks 5체크박스/Education/Korean 1~5 · (3) Audition — Video URL/Self-Intro 100자+ · (4) Payment & Refund — 3 동의 체크박스 (지원비 KRW 30,000 / 환불 / 장학 구조). Submit 시 UUID `applicationId` + `paymentStatus=pending` 자동 부여.

**Apps Script v2 버그 수정**: `escapeFormula()` 유틸로 `+`/`=`/`-`/`@` 시작 값 앞에 `'` 붙임 — v1의 `+82-10-...` → `-6840` 저장 버그 수정.

## 결제 시스템 (Stripe AU · Representative 단계 중단)

**프론트엔드**: Step 4 Submit이 Apps Script로 기록·메일 발송만 함. `assets/apply/apply-form.js`의 `CHECKOUT_ENDPOINT` 상수 비어 있음 — 채워지면 Stripe Checkout 리다이렉트로 자동 전환.

### Stripe 가입 현황
| 항목 | 값 |
|------|-----|
| 가입 국가 | **Australia** (Stripe는 South Korea 미지원 실측 확인) |
| 법인 | `Bada Global Pty Ltd` · DBA `K-Culture Elite` |
| 로그인 | `chris@badagroups.com` |
| Account ID | `acct_1TPMc4RwLLFioUzf` |
| Test mode | 활성화됨 (`pk_test_*`/`sk_test_*` 발급) |
| Live mode | 대기 — Business Representative 단계에서 중단 |

**지분 구조 (KYC 핵심)**: Yun Kyung Kwon 50% (경영권 단독 → Representative) + Jinjoo KWON 50% (silent). 두 명 모두 Owners 단계에서 beneficial owner 등록 필요.

**블로커 (재개 전 준비)**: ① Yun Kyung Kwon 여권 사본 ② ASIC Directors 섹션 확인 (단독 여부) ③ YKK 개인 거주지/연락처

**남은 플로우**: Representative → Owners(두 자매) → Directors → Products → Public details → Bank(호주 법인 계좌) → Secure(2FA) → Extras(세무) → Review & Submit → Live 승인 (~1영업일)

**Live 승인 후 기술 작업**:
1. Worker `kc-checkout` 개발 — `/create-checkout-session` + `/webhook` (2~3h)
2. Apps Script v3 — `Payment Status` 컬럼 + `?action=update` webhook 훅 (1h)
3. `CHECKOUT_ENDPOINT` 채움 + `success.html` 개선 (30m)
4. Test E2E → Live key → 실결제 1회 검증 (1h)

**설정 메모**: Adaptive Pricing + "Email customers about successful payments" 활성화. 금액 KRW 30,000 (Stripe가 AUD 환산, 고객 통화 자동 표시).

## DO / DON'T

**DO**
- 자산은 `/assets/` 로컬 경로만
- 섹션 수정 시 `apply` 등 CTA 링크 id 참조 확인
- 배포 전 `python3 -m http.server` 로컬 미리보기
- 로고/이미지 추가는 Bada BLI 폴더에서 **복사(cp)** 만

**DON'T**
- `https://badabli.com/...` 외부 URL 이미지 (독립성 훼손)
- GSAP CDN에 `defer` (ReferenceError)
- Hero 콘텐츠에 `.kc-reveal` (첫 로드 시 안 보임)
- `/Users/jinhanjeong/Antigravity/Bada BLI/` 내 파일 수정/이동/삭제 **절대 금지** (읽기·복사만)
- `git push` 전 **반드시 사용자 승인**

## 배포 절차

```bash
python3 -m http.server 8765          # 1. 로컬 미리보기
git add <files> && git commit -m "<type>: <desc>"
git push origin main                  # 2. 사용자 승인 후 → Cloudflare Pages 자동 빌드 (60~120s)
```
