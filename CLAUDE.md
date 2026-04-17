# K-Culture Elite Program (kcultureelite.com)

## 프로젝트 개요

Global K-Culture Elite Program 랜딩 페이지.
Bada BLI와 동양대학교가 공동 운영하는 K-Culture(K-Pop, K-Drama) 글로벌 오디션/트레이닝 캠프 프로그램의 학생 모집 및 참가비 결제용 사이트.

## 도메인 & 호스팅

| 항목 | 값 |
|------|-----|
| 도메인 | `kcultureelite.com`, `www.kcultureelite.com` |
| Pages 도메인 | `kcultureelite.pages.dev` |
| 호스팅 | Cloudflare Pages (GitHub 연동, push → 자동 배포) |
| GitHub repo | `melbada1974-dot/kcultureelite` |
| Cloudflare 계정 ID | `8f3036cb6115c9db283c8a0a38fb0426` |

## 프로젝트 히스토리

- 원래 `badabli.com/k-culture.html`로 Bada BLI 사이트 내 서브 페이지로 운영
- 2026-04-17: 독립 도메인 `kcultureelite.com`으로 분리
  - 별도 GitHub repo + Cloudflare Pages 프로젝트 생성
  - 파일 경로, OG 메타, 네비게이션 링크를 새 도메인 기준으로 수정
  - badabli.com의 k-culture 파일은 모든 작업 완료 후 삭제 예정 (리다이렉트 불필요 — 외부 공유 이력 없음)

## 파일 구조

```
kcultureelite/
├── index.html          # 메인 랜딩 페이지 (원래 k-culture.html)
├── success.html        # Stripe 결제 완료 후 감사 페이지
├── favicon.svg         # 파비콘
├── assets/
│   ├── hero-video.mp4  # 히어로 섹션 배경 영상 (2.7MB, CRF 28 최적화)
│   └── og-image.png    # OG/SNS 공유 이미지 (1200x630)
└── CLAUDE.md           # 이 파일
```

## 기술 스택

- **HTML/CSS**: 정적 HTML, Tailwind CSS CDN
- **애니메이션**: GSAP + ScrollTrigger (CDN, `defer` 사용 금지 — 인라인 스크립트 호환 필수)
- **폰트**: Google Fonts (Inter)
- **아이콘**: Phosphor Icons (CDN)
- **빌드**: 없음 (정적 파일, Cloudflare Pages에서 빌드 명령 비워둠)

## 디자인 테마

- **컨셉**: 한국 대형 기획사(JYP, SM, HYBE, YG) 홈페이지 스타일 참조
- **색상**: 다크 테마
  - `kc-bg`: #0A0A0A (배경)
  - `kc-card`: #111111 (카드)
  - `kc-accent`: #A855F7 (보라색 강조)
  - `kc-accent-glow`: rgba(168,85,247,0.3)
  - `kc-blue`: #3B82F6
  - `kc-border`: rgba(255,255,255,0.1)
- **반응형**: 320px ~ 1920px 완벽 대응

## 페이지 섹션 (index.html)

1. **Hero** — K-Pop 댄스 영상 무한루프 배경 + CTA
2. **Trusted Partners** — 파트너 로고 (AIDA 마케팅 흐름: 즉시 신뢰)
3. **Program Tracks** — K-Pop, K-Acting, K-Content 3개 트랙
4. **Program Details** — 일정, 장소, 비용 상세
5. **Elite Faculty** — 강사진 소개
6. **How It Works** — 참가 절차 4단계
7. **Director's Message** — 디렉터 메시지 (추후 동양대 관계자 메시지로 변경 가능)
8. **APC Campus Photos** — 필리핀 캠퍼스 사진
9. **Campus Life Videos** — 캠퍼스 라이프 영상
10. **Application / CTA** — 참가 신청 + 카운트다운 타이머 (마감: 2026-05-31)
11. **FAQ** — 자주 묻는 질문 아코디언

## Cinematic 효과

- **Cursor Glow**: 마우스 따라다니는 보라색 글로우
- **3D Tilt**: `[data-tilt]` 요소에 마우스 위치 기반 3D 기울기
- **Spotlight Border**: 카드 테두리 마우스 따라 빛남
- **Magnetic Button**: `[data-magnetic]` 요소 자석 효과
- **Stagger Animation**: `[data-stagger]` 하위 요소 순차 등장
- **ScrollTrigger Reveal**: `.kc-reveal` 클래스 스크롤 시 페이드인

## 네비게이션 링크

독립 사이트이므로 네비게이션은 크로스 도메인 링크:
- HOME → `https://badabli.com`
- PROGRAM → `https://badabli.com/program.html`
- K-CULTURE → `/` (현재 사이트)
- CS → `https://badabli.com/#footer`
- 로고 이미지 → `https://badabli.com/logo-white.png`

## 결제 시스템 (미구현)

- **방식**: Stripe Checkout via Cloudflare Worker
- **금액**: $20 USD (추후 변경 가능)
- **Worker 이름**: `k-culture-checkout` (미생성)
- **현재 상태**: `handleCheckout()` 함수가 Worker URL을 호출하는 플레이스홀더 상태
- **필요 작업**:
  1. 사용자 Stripe 계정 생성 (https://dashboard.stripe.com/register)
  2. Cloudflare Worker 생성 + STRIPE_SECRET_KEY 환경 변수 설정
  3. handleCheckout() 연동 테스트
  4. success.html 리다이렉트 확인

## 주의 사항

- GSAP CDN 스크립트에 `defer` 속성 사용 금지 (인라인 스크립트보다 늦게 로드되어 ReferenceError 발생)
- Hero 콘텐츠에 `.kc-reveal` 클래스 사용 금지 (ScrollTrigger가 스크롤 전에는 트리거하지 않아 첫 로드 시 안 보임)
- 배포(git push) 전 반드시 사용자 승인 필요
