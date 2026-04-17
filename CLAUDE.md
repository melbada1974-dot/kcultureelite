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
- **2026-04-17 (2차)**: 완전 독립 사이트화 (이번 세션)
  - 헤더 NAV 메뉴(Home/Program/K-Culture/CS) 전면 제거 + 모바일 메뉴 삭제
  - 듀얼 로고 헤더 도입: 좌측 Bada BLI (10% 확대) + 우측 동양대 로고
  - 모든 외부 `badabli.com` 이미지 의존 제거 → 로컬 `/assets/` 로 일원화
  - 깨져 있던 Director 사진(Ricky Lee) 복구

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
│   └── ricky-lee.png       # Director Ricky Lee 사진
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
5. `faculty` — Elite Faculty 소개
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

## 결제 시스템 (미구현)

- **방식**: Stripe Checkout via Cloudflare Worker
- **금액**: $20 USD (추후 변경 가능)
- **Worker 이름**: `k-culture-checkout` (미생성)
- **현재 상태**: `handleCheckout()` 함수가 Worker URL을 호출하는 플레이스홀더 상태
- **필요 작업**:
  1. Stripe 계정 생성 (https://dashboard.stripe.com/register)
  2. Cloudflare Worker 생성 + `STRIPE_SECRET_KEY` 환경 변수 설정
  3. `handleCheckout()` 연동 테스트
  4. `success.html` 리다이렉트 확인

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
