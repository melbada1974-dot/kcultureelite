# K-Culture Elite Chatbot Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** [docs/superpowers/specs/2026-04-20-chatbot-design.md](../specs/2026-04-20-chatbot-design.md)에 정의된 K-Culture Elite 챗봇 Phase 1(상담 + Progressive Lead Capture)을 2~3일 내 구현·배포한다.

**Architecture:** Vanilla-JS 플로팅 위젯(index.html 내장) → Cloudflare Worker(TypeScript) → Anthropic Claude Haiku 4.5 + Cloudflare D1 + KV. 지식베이스는 Markdown으로 Worker에 번들링되고 Prompt Caching으로 비용 최적화. 위젯 대화 원문은 localStorage에만 남고, 서버는 익명 질문 로그와 명시적으로 제공된 리드만 저장한다.

**Tech Stack:** TypeScript + Vitest + Wrangler CLI (Cloudflare Worker) · Cloudflare D1 / KV · Anthropic SDK · Python 3 (KB 추출 스크립트) · Vanilla JS + Tailwind CDN (프론트) · Playwright (E2E)

---

## Prerequisites (구현 시작 전 1회)

- [ ] **P1. Anthropic API 계정 가입 + 결제 수단 등록**
  - Chris님이 [console.anthropic.com](https://console.anthropic.com) 가입
  - Billing → 결제 수단 등록
  - Limits → Monthly spend limit **$30 USD** 설정
  - API Keys → 새 키 생성 (이름: `kc-chatbot-prod`). 키 값은 **대화창에 노출 금지** — 아래 P2에서 Worker secret으로 저장할 때만 사용.

- [ ] **P2. 로컬 개발 환경 준비**
  ```bash
  # Node.js 20+ 확인
  node --version   # v20.x 이상이어야 함
  # 없으면 Homebrew로 설치: brew install node
  
  # Wrangler CLI 전역 설치
  npm install -g wrangler@latest
  wrangler --version   # 3.x 이상
  
  # Cloudflare 계정 로그인
  wrangler login
  # 브라우저에서 기존 kcultureelite Pages 계정으로 인증
  ```

- [ ] **P3. Python 3 + 의존성 설치**
  ```bash
  python3 --version   # 3.10+ 확인
  pip3 install python-pptx pypdf beautifulsoup4 requests
  ```

- [ ] **P4. Playwright 설치 (E2E 테스트용)**
  ```bash
  cd /Users/jinhanjeong/Antigravity/kcultureelite
  npm init -y   # 최초 1회만 (이미 있으면 skip)
  npm install -D @playwright/test
  npx playwright install chromium
  ```

---

## File Structure

```
kcultureelite/
├── index.html                            # MODIFY: <link>/<script> 추가
├── assets/chatbot/
│   ├── chatbot.css                       # CREATE
│   └── chatbot.js                        # CREATE
├── scripts/
│   ├── extract-ppt.py                    # CREATE
│   ├── extract-pdf.py                    # CREATE
│   ├── crawl-dyu.py                      # CREATE
│   └── build-kb.py                       # CREATE
├── workers/kc-chatbot/                   # CREATE (새 npm 프로젝트)
│   ├── wrangler.toml
│   ├── package.json
│   ├── tsconfig.json
│   ├── vitest.config.ts
│   ├── migrations/
│   │   └── 0001_initial.sql
│   ├── knowledge-base.md                 # scripts로 생성 → 번들 대상
│   └── src/
│       ├── index.ts                      # 라우터
│       ├── types.ts                      # 공통 타입
│       ├── handlers/
│       │   ├── chat.ts                   # POST /chat
│       │   ├── lead.ts                   # POST /lead
│       │   └── health.ts                 # GET /health
│       └── lib/
│           ├── privacy.ts                # IP 해시·개인정보 스크러빙
│           ├── rate-limit.ts             # KV 카운터
│           ├── email-detector.ts         # 응답에서 이메일 감지
│           ├── anthropic.ts              # Claude API 래퍼
│           ├── kb-loader.ts              # KB 번들 로드
│           ├── system-prompt.ts          # 시스템 프롬프트 생성
│           └── cost-tracker.ts           # 월 예산 추적
├── tests/e2e/
│   └── chatbot.spec.ts                   # Playwright E2E
└── docs/superpowers/
    ├── specs/2026-04-20-chatbot-design.md    # 기존
    └── plans/2026-04-20-chatbot-implementation.md  # 본 문서
```

**책임 분리 원칙**:
- `scripts/`: 일회성 KB 빌드 (로컬 실행, 배포 대상 아님)
- `workers/kc-chatbot/`: 완전 독립 Worker (별도 `package.json`, 별도 배포)
- `assets/chatbot/`: 정적 프론트 리소스 (Cloudflare Pages에 배포)
- `index.html`: Worker URL 주입 + 위젯 로드

---

## Day 1 — 지식베이스 구축

### Task 1: PPT 텍스트 추출 스크립트 (KCE 자료)

**Files:**
- Create: `scripts/extract-ppt.py`

- [ ] **Step 1: 스크립트 작성**

`scripts/extract-ppt.py`:
```python
#!/usr/bin/env python3
"""Extract text from .pptx files into structured markdown."""
import sys
from pathlib import Path
from pptx import Presentation


def extract_pptx(path: Path) -> str:
    """Return a markdown-formatted string with slide-by-slide text."""
    prs = Presentation(str(path))
    lines = [f"# {path.stem}\n"]
    for idx, slide in enumerate(prs.slides, start=1):
        lines.append(f"\n## Slide {idx}\n")
        for shape in slide.shapes:
            if hasattr(shape, "text") and shape.text.strip():
                for line in shape.text.splitlines():
                    line = line.strip()
                    if line:
                        lines.append(f"- {line}")
    return "\n".join(lines) + "\n"


def main() -> int:
    if len(sys.argv) != 3:
        print("Usage: extract-ppt.py <input.pptx> <output.md>", file=sys.stderr)
        return 1
    src = Path(sys.argv[1])
    dst = Path(sys.argv[2])
    if not src.exists():
        print(f"Not found: {src}", file=sys.stderr)
        return 2
    dst.parent.mkdir(parents=True, exist_ok=True)
    dst.write_text(extract_pptx(src), encoding="utf-8")
    print(f"Wrote {dst} ({dst.stat().st_size} bytes)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
```

- [ ] **Step 2: Faculty PPT 추출 실행**

```bash
cd /Users/jinhanjeong/Antigravity/kcultureelite
mkdir -p /tmp/kb-raw
python3 scripts/extract-ppt.py \
  "Rick 수정방안 요청/Faculty 인물사진 사용해주세요.pptx" \
  /tmp/kb-raw/faculty.md
```
Expected: `Wrote /tmp/kb-raw/faculty.md (N bytes)` 출력, `ls /tmp/kb-raw/faculty.md` 성공.

- [ ] **Step 3: 커리큘럼 PPT 추출 실행**

```bash
python3 scripts/extract-ppt.py \
  "Rick 수정방안 요청/dongyang_entertainment_management_최종보고 - 복사본.pptx" \
  /tmp/kb-raw/curriculum.md
```
Expected: `Wrote /tmp/kb-raw/curriculum.md (N bytes)` 출력.

- [ ] **Step 4: 결과 스팟 체크**

```bash
head -40 /tmp/kb-raw/faculty.md
head -40 /tmp/kb-raw/curriculum.md
```
Expected: `# Faculty ...`, `## Slide 1`, `- [강사명]` 같은 구조 확인. 깨진 글자 없음.

- [ ] **Step 5: 커밋**

```bash
git add scripts/extract-ppt.py
git commit -m "feat: PPT 텍스트 추출 스크립트 추가"
```

---

### Task 2: PDF 텍스트 추출 스크립트 (동양대 자료)

**Files:**
- Create: `scripts/extract-pdf.py`

- [ ] **Step 1: 스크립트 작성**

`scripts/extract-pdf.py`:
```python
#!/usr/bin/env python3
"""Extract text from a PDF into markdown."""
import sys
from pathlib import Path
from pypdf import PdfReader


def extract_pdf(path: Path) -> str:
    reader = PdfReader(str(path))
    lines = [f"# {path.stem}\n"]
    for idx, page in enumerate(reader.pages, start=1):
        text = (page.extract_text() or "").strip()
        if not text:
            continue
        lines.append(f"\n## Page {idx}\n")
        for raw in text.splitlines():
            raw = raw.strip()
            if raw:
                lines.append(raw)
    return "\n".join(lines) + "\n"


def main() -> int:
    if len(sys.argv) != 3:
        print("Usage: extract-pdf.py <input.pdf> <output.md>", file=sys.stderr)
        return 1
    src = Path(sys.argv[1])
    dst = Path(sys.argv[2])
    if not src.exists():
        print(f"Not found: {src}", file=sys.stderr)
        return 2
    dst.parent.mkdir(parents=True, exist_ok=True)
    dst.write_text(extract_pdf(src), encoding="utf-8")
    print(f"Wrote {dst} ({dst.stat().st_size} bytes)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
```

- [ ] **Step 2: 동양대 브로슈어 추출 실행**

```bash
python3 scripts/extract-pdf.py \
  "Rick 수정방안 요청/English-brochure.pdf" \
  /tmp/kb-raw/dongyang-brochure.md
```
Expected: `Wrote /tmp/kb-raw/dongyang-brochure.md (N bytes)`.

- [ ] **Step 3: 결과 스팟 체크**

```bash
head -50 /tmp/kb-raw/dongyang-brochure.md
```
Expected: `# English-brochure`, `## Page 1`, 영문 텍스트 확인.

- [ ] **Step 4: 커밋**

```bash
git add scripts/extract-pdf.py
git commit -m "feat: PDF 텍스트 추출 스크립트 추가"
```

---

### Task 3: dyu.ac.kr 크롤링 스크립트

**Files:**
- Create: `scripts/crawl-dyu.py`

크롤링 범위: 메인(`/`), 학교소개(`/about`), 엔터테인먼트경영학과 관련 페이지. robots.txt 준수 + 정중한 User-Agent + 요청 간 1초 대기.

- [ ] **Step 1: 스크립트 작성**

`scripts/crawl-dyu.py`:
```python
#!/usr/bin/env python3
"""Crawl a curated list of dyu.ac.kr pages and export combined markdown."""
import sys
import time
from pathlib import Path
from urllib.parse import urljoin
import requests
from bs4 import BeautifulSoup

BASE = "https://www.dyu.ac.kr"

# 초기 시드 — 크롤 실행 후 결과를 보며 조정
SEED_PATHS = [
    "/",
    "/kor/main/main.do",
    "/kor/contents/about/001.do",           # 학교 소개 (URL 구조 확인 필요)
    "/kor/contents/education/entertainment.do",  # 엔터테인먼트 관련 (후보)
]

HEADERS = {
    "User-Agent": "KCultureEliteBot/1.0 (+https://kcultureelite.com; contact: global@badaglobal-bli.com)",
    "Accept-Language": "ko,en;q=0.8",
}


def fetch(url: str) -> str | None:
    try:
        r = requests.get(url, headers=HEADERS, timeout=10)
        if r.status_code != 200:
            print(f"  ! {r.status_code} {url}", file=sys.stderr)
            return None
        r.encoding = r.apparent_encoding
        return r.text
    except requests.RequestException as e:
        print(f"  ! {e} {url}", file=sys.stderr)
        return None


def clean(html: str) -> str:
    soup = BeautifulSoup(html, "html.parser")
    for tag in soup(["script", "style", "noscript", "svg", "nav", "footer", "form"]):
        tag.decompose()
    text = soup.get_text("\n", strip=True)
    # 공백 라인 정리
    return "\n".join([ln for ln in (line.strip() for line in text.splitlines()) if ln])


def main() -> int:
    if len(sys.argv) != 2:
        print("Usage: crawl-dyu.py <output.md>", file=sys.stderr)
        return 1
    dst = Path(sys.argv[1])
    dst.parent.mkdir(parents=True, exist_ok=True)

    out = ["# Dongyang University — crawled reference (internal use only)\n"]
    for path in SEED_PATHS:
        url = urljoin(BASE, path)
        print(f"Fetching {url}")
        html = fetch(url)
        if not html:
            continue
        out.append(f"\n## Source: {url}\n")
        out.append(clean(html))
        time.sleep(1.0)  # 예의
    dst.write_text("\n".join(out) + "\n", encoding="utf-8")
    print(f"Wrote {dst} ({dst.stat().st_size} bytes)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
```

- [ ] **Step 2: robots.txt 확인 (손으로 1회)**

```bash
curl -s https://www.dyu.ac.kr/robots.txt
```
Expected: `/robots.txt`가 존재. `Disallow` 경로 확인. SEED_PATHS 중 `Disallow`에 걸리는 경로는 스크립트에서 제거.

- [ ] **Step 3: 크롤 실행**

```bash
python3 scripts/crawl-dyu.py /tmp/kb-raw/dongyang-web.md
```
Expected: 각 URL에 대해 `Fetching ...` 로그 + 최종 `Wrote /tmp/kb-raw/dongyang-web.md`. 404나 403이 많으면 SEED_PATHS 수정 후 재실행.

- [ ] **Step 4: 결과 검토**

```bash
head -80 /tmp/kb-raw/dongyang-web.md
wc -l /tmp/kb-raw/dongyang-web.md
```
Expected: 한글 + 영문 텍스트 섞인 상태. 최소 300줄 이상.

- [ ] **Step 5: 커밋**

```bash
git add scripts/crawl-dyu.py
git commit -m "feat: dyu.ac.kr 크롤링 스크립트 추가"
```

---

### Task 4: 지식베이스 통합 빌드

**Files:**
- Create: `scripts/build-kb.py`
- Create: `workers/kc-chatbot/knowledge-base.md` (빌드 산출물)

- [ ] **Step 1: 빌드 스크립트 작성**

`scripts/build-kb.py`:
```python
#!/usr/bin/env python3
"""Assemble knowledge-base.md from extracted sources with explicit subject labels."""
import sys
from pathlib import Path
from textwrap import dedent

PROJECT_ROOT = Path(__file__).resolve().parent.parent
RAW_DIR = Path("/tmp/kb-raw")
OUT = PROJECT_ROOT / "workers/kc-chatbot/knowledge-base.md"

HEADER = dedent("""
    # K-Culture Elite Program — Chatbot Knowledge Base

    This document is the single source of truth for the K-Culture Elite AI
    assistant. It is split into three parts:

    - **Part 1** — K-Culture Elite Program official material (cite directly).
    - **Part 2** — Dongyang University reference material (cite as school
      context, NOT as K-Culture Elite Program brochure).
    - **Part 3** — FAQ & escalation guidance.

    When answering, always attribute facts to the correct subject:
    - "The K-Culture Elite Program offers ..."
    - "Dongyang University, our partner institution, is ..."

    Never promise any downloadable file or brochure; direct follow-up requests
    to global@badaglobal-bli.com or offer an admissions-team callback.
""").strip()

SECTION_MAP = [
    ("Part 1: K-Culture Elite Program", [
        ("Program, Tracks & Curriculum", RAW_DIR / "curriculum.md"),
        ("Faculty (22 members)",         RAW_DIR / "faculty.md"),
    ]),
    ("Part 2: Dongyang University (reference)", [
        ("Official Brochure", RAW_DIR / "dongyang-brochure.md"),
        ("Web Snapshot",      RAW_DIR / "dongyang-web.md"),
    ]),
]

FAQ = dedent("""
    ## Part 3: FAQ & Escalation

    ### 3.1 Escalation targets
    - Personal admissions questions, tuition discounts, contract terms:
      "Please contact our admissions team at global@badaglobal-bli.com."
    - Specific visa/housing questions: escalate to email as above.
    - Questions outside scope (general K-Pop gossip, unrelated topics):
      politely decline and redirect to on-topic help.

    ### 3.2 Lead-capture triggers
    When a visitor expresses concrete interest in a track, admissions process,
    or audition details, offer ONE of:
    - "Would you like our admissions team to reach out with more details?
       Just share your name and email."
    - "Want to be notified when new program updates are announced?"
    Never promise a brochure, PDF, or automated email.

    ### 3.3 Contact
    - Email: global@badaglobal-bli.com
    - Application deadline: 2026-05-31
""").strip()


def read(path: Path) -> str:
    return path.read_text(encoding="utf-8") if path.exists() else "(source missing)\n"


def main() -> int:
    OUT.parent.mkdir(parents=True, exist_ok=True)
    parts = [HEADER, ""]
    for part_title, sections in SECTION_MAP:
        parts.append(f"\n## {part_title}\n")
        for sub_title, path in sections:
            parts.append(f"\n### {sub_title}\n")
            parts.append(read(path))
    parts.append("\n")
    parts.append(FAQ)
    parts.append("\n")
    OUT.write_text("\n".join(parts), encoding="utf-8")
    size = OUT.stat().st_size
    print(f"Wrote {OUT} ({size} bytes ≈ {size // 4} tokens rough)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
```

- [ ] **Step 2: 빌드 실행**

```bash
python3 scripts/build-kb.py
```
Expected: `Wrote workers/kc-chatbot/knowledge-base.md (N bytes ≈ M tokens rough)`. M 값이 5k~40k 토큰 범위이어야 함.

- [ ] **Step 3: 결과 수동 검토**

```bash
head -80 workers/kc-chatbot/knowledge-base.md
grep -c "^## " workers/kc-chatbot/knowledge-base.md   # 섹션 개수 확인
wc -l workers/kc-chatbot/knowledge-base.md
```
Expected: Header + Part 1 + Part 2 + Part 3 순서 보임. 주체 구분 문구(Part 1 / Part 2) 명확.

- [ ] **Step 4: 수동 정제 (중요)**

`workers/kc-chatbot/knowledge-base.md`를 에디터로 열어:
1. PPT 슬라이드 번호 부스러기 제거 (읽기 힘든 부분만)
2. 중복 섹션 제거
3. Faculty 22명 목록이 누락 없는지 확인 (Tier 1 6명 + Tier 2 16명)
4. 학비·장학금 수치가 있으면 확인, 없으면 FAQ 섹션에 "Please contact admissions for tuition details" 유지

불완전한 데이터가 있어도 Part 1은 반드시 있어야 함.

- [ ] **Step 5: 커밋**

```bash
git add scripts/build-kb.py workers/kc-chatbot/knowledge-base.md
git commit -m "feat: KB 빌드 스크립트 + 초기 knowledge-base.md"
```

---

## Day 2 — Cloudflare Worker + D1 + KV

### Task 5: Cloudflare 리소스 생성 (D1·KV)

**Files:** (없음 — CLI 작업만)

- [ ] **Step 1: D1 데이터베이스 생성**

```bash
cd /Users/jinhanjeong/Antigravity/kcultureelite
wrangler d1 create kc-db
```
Expected: JSON 출력에서 `database_id`를 메모 (다음 Task wrangler.toml에 붙여넣음).

- [ ] **Step 2: KV namespace 생성**

```bash
wrangler kv namespace create kc-rate-limit
```
Expected: `binding = "RATE_LIMIT"` 등이 포함된 스니펫 출력. `id = "..."` 값 메모.

- [ ] **Step 3: 메모 기록**

생성한 `database_id`와 `kv id`를 임시로 `/tmp/kc-ids.txt`에 기록:
```bash
echo "D1 kc-db id: <붙여넣기>" > /tmp/kc-ids.txt
echo "KV kc-rate-limit id: <붙여넣기>" >> /tmp/kc-ids.txt
cat /tmp/kc-ids.txt
```

- [ ] **Step 4: 커밋할 파일 없음 — 다음 Task에서 wrangler.toml에 반영**

---

### Task 6: Worker 프로젝트 초기화

**Files:**
- Create: `workers/kc-chatbot/package.json`
- Create: `workers/kc-chatbot/tsconfig.json`
- Create: `workers/kc-chatbot/vitest.config.ts`
- Create: `workers/kc-chatbot/wrangler.toml`
- Create: `workers/kc-chatbot/.gitignore`

- [ ] **Step 1: package.json 작성**

`workers/kc-chatbot/package.json`:
```json
{
  "name": "kc-chatbot",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "wrangler dev",
    "deploy": "wrangler deploy",
    "test": "vitest run",
    "test:watch": "vitest",
    "migrate:local": "wrangler d1 migrations apply kc-db --local",
    "migrate:remote": "wrangler d1 migrations apply kc-db --remote"
  },
  "devDependencies": {
    "@cloudflare/workers-types": "^4.20260401.0",
    "@cloudflare/vitest-pool-workers": "^0.6.0",
    "typescript": "^5.5.0",
    "vitest": "^2.0.0",
    "wrangler": "^3.80.0"
  },
  "dependencies": {
    "@anthropic-ai/sdk": "^0.30.0"
  }
}
```

- [ ] **Step 2: tsconfig.json 작성**

`workers/kc-chatbot/tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "moduleResolution": "Bundler",
    "lib": ["ES2022"],
    "types": ["@cloudflare/workers-types"],
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "skipLibCheck": true
  },
  "include": ["src/**/*.ts"]
}
```

- [ ] **Step 3: wrangler.toml 작성 (Task 5 ID 반영)**

`workers/kc-chatbot/wrangler.toml` (<...>는 Task 5의 실제 값으로 치환):
```toml
name = "kc-chatbot"
main = "src/index.ts"
compatibility_date = "2026-04-01"
compatibility_flags = ["nodejs_compat"]

[[d1_databases]]
binding = "DB"
database_name = "kc-db"
database_id = "<Task 5에서 받은 D1 id>"
migrations_dir = "migrations"

[[kv_namespaces]]
binding = "RATE_LIMIT"
id = "<Task 5에서 받은 KV id>"

[vars]
ENV = "production"
MONTHLY_BUDGET_USD = "30"
MAX_MESSAGES_PER_HOUR = "20"
MAX_MESSAGES_PER_DAY = "60"
MAX_OUTPUT_TOKENS = "1000"
```

- [ ] **Step 4: vitest 설정**

`workers/kc-chatbot/vitest.config.ts`:
```typescript
import { defineWorkersConfig } from "@cloudflare/vitest-pool-workers/config";

export default defineWorkersConfig({
  test: {
    poolOptions: {
      workers: {
        wrangler: { configPath: "./wrangler.toml" },
      },
    },
  },
});
```

- [ ] **Step 5: .gitignore**

`workers/kc-chatbot/.gitignore`:
```
node_modules/
.dev.vars
.wrangler/
dist/
coverage/
```

- [ ] **Step 6: 의존성 설치**

```bash
cd workers/kc-chatbot
npm install
```
Expected: `node_modules` 생성, 에러 없이 완료.

- [ ] **Step 7: 타입 체크 기본 통과 확인**

```bash
npx tsc --noEmit
```
Expected: 에러 0 (아직 src 없음).

- [ ] **Step 8: 커밋**

```bash
cd /Users/jinhanjeong/Antigravity/kcultureelite
git add workers/kc-chatbot/package.json workers/kc-chatbot/tsconfig.json \
        workers/kc-chatbot/vitest.config.ts workers/kc-chatbot/wrangler.toml \
        workers/kc-chatbot/.gitignore
git commit -m "feat: Cloudflare Worker 프로젝트 스캐폴드"
```

---

### Task 7: D1 마이그레이션 (4 테이블)

**Files:**
- Create: `workers/kc-chatbot/migrations/0001_initial.sql`

- [ ] **Step 1: 마이그레이션 SQL 작성**

`workers/kc-chatbot/migrations/0001_initial.sql`:
```sql
-- Phase 1 tables (chatbot)
CREATE TABLE IF NOT EXISTS leads (
    id                TEXT PRIMARY KEY,
    email             TEXT UNIQUE NOT NULL,
    name              TEXT NOT NULL,
    interested_track  TEXT,
    language_pref     TEXT,
    consent_type      TEXT NOT NULL,
    first_seen_at     DATETIME DEFAULT CURRENT_TIMESTAMP,
    country_code      TEXT,
    source            TEXT DEFAULT 'chatbot',
    contacted_at      DATETIME,
    notes             TEXT
);
CREATE INDEX IF NOT EXISTS idx_leads_email ON leads(email);
CREATE INDEX IF NOT EXISTS idx_leads_not_contacted ON leads(contacted_at);

CREATE TABLE IF NOT EXISTS questions_log (
    id             TEXT PRIMARY KEY,
    session_hash   TEXT NOT NULL,
    question_text  TEXT NOT NULL,
    kb_matched     INTEGER DEFAULT 0,
    language       TEXT,
    timestamp      DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_questions_timestamp ON questions_log(timestamp);
CREATE INDEX IF NOT EXISTS idx_questions_unmatched ON questions_log(kb_matched);

-- Phase 3 hooks (schema-only, populated later)
CREATE TABLE IF NOT EXISTS applications (
    id              TEXT PRIMARY KEY,
    email           TEXT NOT NULL,
    full_name       TEXT NOT NULL,
    passport_name   TEXT NOT NULL,
    date_of_birth   DATE NOT NULL,
    gender          TEXT,
    nationality     TEXT NOT NULL,
    contact_number  TEXT NOT NULL,
    track_selected  TEXT NOT NULL,
    education       TEXT,
    korean_level    INTEGER CHECK (korean_level BETWEEN 1 AND 5),
    audition_url    TEXT,
    self_intro      TEXT,
    consent_payment INTEGER NOT NULL,
    consent_refund  INTEGER NOT NULL,
    consent_tuition INTEGER NOT NULL,
    submitted_at    DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_applications_email ON applications(email);

CREATE TABLE IF NOT EXISTS payments (
    id              TEXT PRIMARY KEY,
    application_id  TEXT NOT NULL,
    stripe_session  TEXT UNIQUE,
    amount_krw      INTEGER NOT NULL,
    status          TEXT NOT NULL,
    paid_at         DATETIME,
    refund_at       DATETIME,
    refund_reason   TEXT
);
CREATE INDEX IF NOT EXISTS idx_payments_application ON payments(application_id);
CREATE INDEX IF NOT EXISTS idx_payments_stripe ON payments(stripe_session);
```

- [ ] **Step 2: 로컬 적용**

```bash
cd workers/kc-chatbot
npm run migrate:local
```
Expected: `🚣 4 commands executed successfully` 유사한 출력.

- [ ] **Step 3: 스키마 검증**

```bash
wrangler d1 execute kc-db --local \
  --command "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;"
```
Expected: `applications`, `leads`, `payments`, `questions_log` 4행.

- [ ] **Step 4: 원격 적용**

```bash
npm run migrate:remote
```
Expected: 원격에도 동일한 출력.

- [ ] **Step 5: 커밋**

```bash
cd /Users/jinhanjeong/Antigravity/kcultureelite
git add workers/kc-chatbot/migrations/0001_initial.sql
git commit -m "feat: D1 4테이블 스키마 초기 마이그레이션"
```

---

### Task 8: 공통 타입 정의

**Files:**
- Create: `workers/kc-chatbot/src/types.ts`

- [ ] **Step 1: 타입 파일 작성**

`workers/kc-chatbot/src/types.ts`:
```typescript
export interface Env {
  DB: D1Database;
  RATE_LIMIT: KVNamespace;
  ANTHROPIC_API_KEY: string;
  IP_HASH_SALT: string;
  ENV: string;
  MONTHLY_BUDGET_USD: string;
  MAX_MESSAGES_PER_HOUR: string;
  MAX_MESSAGES_PER_DAY: string;
  MAX_OUTPUT_TOKENS: string;
}

export type ConsentType = "admissions_contact" | "updates_notification";

export interface ChatRequest {
  messages: { role: "user" | "assistant"; content: string }[];
  language_hint?: string;
}

export interface ChatResponse {
  reply: string;
  language: string;
  suggest_lead_capture?: boolean;
}

export interface LeadRequest {
  email: string;
  name: string;
  interested_track?: string;
  language_pref?: string;
  consent_type: ConsentType;
}

export interface RateLimitResult {
  allowed: boolean;
  reason?: "hourly" | "daily" | "budget";
  retryAfterSeconds?: number;
}
```

- [ ] **Step 2: 타입 체크**

```bash
cd workers/kc-chatbot
npx tsc --noEmit
```
Expected: 에러 0.

- [ ] **Step 3: 커밋**

```bash
cd /Users/jinhanjeong/Antigravity/kcultureelite
git add workers/kc-chatbot/src/types.ts
git commit -m "feat: Worker 공통 타입 정의"
```

---

### Task 9: privacy 모듈 (IP 해시) — TDD

**Files:**
- Test: `workers/kc-chatbot/src/lib/privacy.test.ts`
- Create: `workers/kc-chatbot/src/lib/privacy.ts`

- [ ] **Step 1: 실패 테스트 작성**

`workers/kc-chatbot/src/lib/privacy.test.ts`:
```typescript
import { describe, it, expect } from "vitest";
import { hashIP, scrubPII } from "./privacy";

describe("hashIP", () => {
  it("produces the same hash for the same IP + salt", async () => {
    const a = await hashIP("203.0.113.42", "salt");
    const b = await hashIP("203.0.113.42", "salt");
    expect(a).toBe(b);
    expect(a).toHaveLength(64); // SHA-256 hex
  });

  it("differs for different IPs", async () => {
    const a = await hashIP("203.0.113.1", "salt");
    const b = await hashIP("203.0.113.2", "salt");
    expect(a).not.toBe(b);
  });

  it("differs when salt differs", async () => {
    const a = await hashIP("203.0.113.1", "salt-a");
    const b = await hashIP("203.0.113.1", "salt-b");
    expect(a).not.toBe(b);
  });
});

describe("scrubPII", () => {
  it("removes email addresses from free text", () => {
    const input = "My email is foo@example.com and I have a question.";
    const out = scrubPII(input);
    expect(out).not.toContain("foo@example.com");
    expect(out).toContain("[email]");
  });

  it("removes Korean phone numbers", () => {
    const input = "Call me at 010-1234-5678 please.";
    const out = scrubPII(input);
    expect(out).not.toContain("010-1234-5678");
    expect(out).toContain("[phone]");
  });

  it("passes through clean text unchanged", () => {
    expect(scrubPII("Tell me about K-Beauty track.")).toBe("Tell me about K-Beauty track.");
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

```bash
cd workers/kc-chatbot
npm test -- privacy
```
Expected: `FAIL`, "Cannot find module './privacy'" 또는 유사.

- [ ] **Step 3: 구현**

`workers/kc-chatbot/src/lib/privacy.ts`:
```typescript
const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
const KR_PHONE_RE = /\b01[016789][-. ]?\d{3,4}[-. ]?\d{4}\b/g;
const INTL_PHONE_RE = /\+\d{1,3}[\s-]?\d{2,4}[\s-]?\d{3,4}[\s-]?\d{3,4}/g;

export async function hashIP(ip: string, salt: string): Promise<string> {
  const buf = new TextEncoder().encode(`${salt}:${ip}`);
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function scrubPII(text: string): string {
  return text
    .replace(EMAIL_RE, "[email]")
    .replace(KR_PHONE_RE, "[phone]")
    .replace(INTL_PHONE_RE, "[phone]");
}
```

- [ ] **Step 4: 테스트 통과 확인**

```bash
npm test -- privacy
```
Expected: 6개 테스트 모두 PASS.

- [ ] **Step 5: 커밋**

```bash
cd /Users/jinhanjeong/Antigravity/kcultureelite
git add workers/kc-chatbot/src/lib/privacy.ts workers/kc-chatbot/src/lib/privacy.test.ts
git commit -m "feat: IP 해시 및 PII 스크러빙 유틸 (TDD)"
```

---

### Task 10: rate-limit 모듈 — TDD

**Files:**
- Test: `workers/kc-chatbot/src/lib/rate-limit.test.ts`
- Create: `workers/kc-chatbot/src/lib/rate-limit.ts`

- [ ] **Step 1: 실패 테스트 작성**

`workers/kc-chatbot/src/lib/rate-limit.test.ts`:
```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { env } from "cloudflare:test";
import { checkRateLimit } from "./rate-limit";

const e = env as unknown as {
  RATE_LIMIT: KVNamespace;
  MAX_MESSAGES_PER_HOUR: string;
  MAX_MESSAGES_PER_DAY: string;
};

describe("checkRateLimit", () => {
  beforeEach(async () => {
    // KV 정리 (테스트 격리)
    const keys = await e.RATE_LIMIT.list();
    for (const k of keys.keys) await e.RATE_LIMIT.delete(k.name);
  });

  it("allows first request for a new IP", async () => {
    const r = await checkRateLimit("hash-a", e as any);
    expect(r.allowed).toBe(true);
  });

  it("blocks after hourly limit is reached", async () => {
    const max = parseInt(e.MAX_MESSAGES_PER_HOUR);
    for (let i = 0; i < max; i++) {
      await checkRateLimit("hash-b", e as any);
    }
    const blocked = await checkRateLimit("hash-b", e as any);
    expect(blocked.allowed).toBe(false);
    expect(blocked.reason).toBe("hourly");
  });

  it("counts different IPs independently", async () => {
    const max = parseInt(e.MAX_MESSAGES_PER_HOUR);
    for (let i = 0; i < max; i++) await checkRateLimit("hash-c", e as any);
    const other = await checkRateLimit("hash-d", e as any);
    expect(other.allowed).toBe(true);
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

```bash
cd workers/kc-chatbot
npm test -- rate-limit
```
Expected: FAIL (rate-limit.ts 없음).

- [ ] **Step 3: 구현**

`workers/kc-chatbot/src/lib/rate-limit.ts`:
```typescript
import type { Env, RateLimitResult } from "../types";

function hourKey(hash: string, d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  const h = String(d.getUTCHours()).padStart(2, "0");
  return `ip:${hash}:hour:${y}${m}${day}${h}`;
}

function dayKey(hash: string, d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `ip:${hash}:day:${y}${m}${day}`;
}

async function inc(kv: KVNamespace, key: string, ttl: number): Promise<number> {
  const cur = parseInt((await kv.get(key)) ?? "0", 10);
  const next = cur + 1;
  await kv.put(key, String(next), { expirationTtl: ttl });
  return next;
}

export async function checkRateLimit(
  ipHash: string,
  env: Env,
): Promise<RateLimitResult> {
  const now = new Date();
  const hourCount = await inc(env.RATE_LIMIT, hourKey(ipHash, now), 3600);
  const dayCount = await inc(env.RATE_LIMIT, dayKey(ipHash, now), 86400);
  const hourMax = parseInt(env.MAX_MESSAGES_PER_HOUR, 10);
  const dayMax = parseInt(env.MAX_MESSAGES_PER_DAY, 10);

  if (hourCount > hourMax) {
    return { allowed: false, reason: "hourly", retryAfterSeconds: 3600 };
  }
  if (dayCount > dayMax) {
    return { allowed: false, reason: "daily", retryAfterSeconds: 86400 };
  }
  return { allowed: true };
}
```

- [ ] **Step 4: 테스트 통과 확인**

```bash
npm test -- rate-limit
```
Expected: 3개 PASS.

- [ ] **Step 5: 커밋**

```bash
cd /Users/jinhanjeong/Antigravity/kcultureelite
git add workers/kc-chatbot/src/lib/rate-limit.ts workers/kc-chatbot/src/lib/rate-limit.test.ts
git commit -m "feat: KV 기반 rate limiting (시간/일 제한, TDD)"
```

---

### Task 11: email-detector 모듈 — TDD

**Files:**
- Test: `workers/kc-chatbot/src/lib/email-detector.test.ts`
- Create: `workers/kc-chatbot/src/lib/email-detector.ts`

- [ ] **Step 1: 실패 테스트 작성**

`workers/kc-chatbot/src/lib/email-detector.test.ts`:
```typescript
import { describe, it, expect } from "vitest";
import { detectLead } from "./email-detector";

describe("detectLead", () => {
  it("extracts name + email from typical Progressive Lead sentence", () => {
    const msg = "Sure, I'm Sarah and my email is sarah@example.com";
    expect(detectLead(msg)).toEqual({
      email: "sarah@example.com",
      name: "Sarah",
    });
  });

  it("extracts email when name is not given", () => {
    expect(detectLead("you can reach me at alex@test.org")).toEqual({
      email: "alex@test.org",
      name: null,
    });
  });

  it("returns null when no email appears", () => {
    expect(detectLead("Tell me more about K-Pop Business track.")).toBeNull();
  });

  it("prefers the first valid email if multiple appear", () => {
    expect(
      detectLead("Write to first@a.com or second@b.com please.")?.email,
    ).toBe("first@a.com");
  });

  it("ignores obviously invalid strings", () => {
    expect(detectLead("not-an-email-@")).toBeNull();
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

```bash
cd workers/kc-chatbot
npm test -- email-detector
```
Expected: FAIL.

- [ ] **Step 3: 구현**

`workers/kc-chatbot/src/lib/email-detector.ts`:
```typescript
const EMAIL_RE = /([A-Za-z0-9._%+-]+)@([A-Za-z0-9.-]+\.[A-Za-z]{2,})/;
const NAME_PATTERNS: RegExp[] = [
  /\bI['’]?m\s+([A-Z][A-Za-z'-]{1,30})/,
  /\bmy name is\s+([A-Z][A-Za-z'-]{1,30})/i,
  /\bI am\s+([A-Z][A-Za-z'-]{1,30})/,
];

export interface LeadDetection {
  email: string;
  name: string | null;
}

export function detectLead(text: string): LeadDetection | null {
  const match = text.match(EMAIL_RE);
  if (!match) return null;
  const email = match[0].toLowerCase();
  let name: string | null = null;
  for (const re of NAME_PATTERNS) {
    const m = text.match(re);
    if (m) {
      name = m[1];
      break;
    }
  }
  return { email, name };
}
```

- [ ] **Step 4: 테스트 통과 확인**

```bash
npm test -- email-detector
```
Expected: 5개 PASS.

- [ ] **Step 5: 커밋**

```bash
cd /Users/jinhanjeong/Antigravity/kcultureelite
git add workers/kc-chatbot/src/lib/email-detector.ts workers/kc-chatbot/src/lib/email-detector.test.ts
git commit -m "feat: 응답 텍스트에서 이메일·이름 감지 (TDD)"
```

---

### Task 12: kb-loader + system-prompt 모듈

**Files:**
- Create: `workers/kc-chatbot/src/lib/kb-loader.ts`
- Create: `workers/kc-chatbot/src/lib/system-prompt.ts`

KB 파일은 Worker 번들에 직접 import 되도록 `?raw` 쿼리 문자열 import 사용.

- [ ] **Step 1: kb-loader.ts 작성**

`workers/kc-chatbot/src/lib/kb-loader.ts`:
```typescript
// Wrangler는 확장자 import를 텍스트로 번들링 (fetch + build 시점)
// https://developers.cloudflare.com/workers/wrangler/bundling/
import kbText from "../../knowledge-base.md";

export function getKnowledgeBase(): string {
  return kbText as unknown as string;
}
```

- [ ] **Step 2: wrangler.toml에 Rule 추가**

`workers/kc-chatbot/wrangler.toml` 맨 아래 추가:
```toml
[[rules]]
type = "Text"
globs = ["**/*.md"]
fallthrough = true
```

- [ ] **Step 3: system-prompt.ts 작성**

`workers/kc-chatbot/src/lib/system-prompt.ts`:
```typescript
import { getKnowledgeBase } from "./kb-loader";

const RULES = `
You are the official AI assistant for the K-Culture Elite Program
(kcultureelite.com), a four-year degree program operated by Bada BLI and
Dongyang University.

# Scope
Answer ONLY questions related to:
- The K-Culture Elite Program (tracks, curriculum, faculty, admissions,
  scholarships, tuition, audition)
- Dongyang University as a partner institution (general overview, campus,
  entertainment-management department)
- Application process and logistics

If a question is off-topic, politely decline and redirect to relevant help.

# Language
Respond in the same language as the user's most recent message.

# Source attribution
- When citing program specifics: "The K-Culture Elite Program ..."
- When citing school specifics: "Dongyang University, our partner institution, ..."
- Never present school material as if it were K-Culture Elite Program material.

# Prohibited promises
- NEVER promise to send a brochure, PDF, or any downloadable document.
- NEVER say "I'll email you ...", "Here's a PDF ...", or similar.
- Instead, when a visitor shows concrete interest, offer ONE of:
  * "Would you like our admissions team to reach out with more details?
     Just share your name and email."
  * "Want to be notified when new program updates are announced?"
- Lead capture must feel optional, not gated. Always add wording like
  "(optional — feel free to keep chatting)".

# Escalation
For detailed personal inquiries (individual tuition discounts, contract
terms, application edge cases), direct the user to
global@badaglobal-bli.com or mention that "our admissions team" can follow up.

# Privacy
Do not ask for date of birth, passport number, phone number, or address.
These belong on the official Apply Now form. If a user volunteers them,
do not store or repeat them.

# Anti-hallucination
If the knowledge base does not contain specific numbers (admissions rates,
future deadlines, scholarship amounts not documented), say:
"Please contact our team at global@badaglobal-bli.com for exact details."
Do not invent figures.

# Tone
Warm, professional, concise. Use short paragraphs and bullet points when
helpful. Avoid promises ("you will definitely get in"), hype, and slang.
`.trim();

export function buildSystemPrompt(): string {
  return `${RULES}\n\n# Knowledge Base\n\n${getKnowledgeBase()}`;
}
```

- [ ] **Step 4: 타입 체크**

```bash
cd workers/kc-chatbot
npx tsc --noEmit
```
Expected: 에러 0. (`knowledge-base.md` import는 wrangler bundling이 해결 — 타입 선언 추가 필요 없으면 `declare module "*.md"` 타입이 필요)

만약 `Cannot find module '../../knowledge-base.md'` 오류가 나면:

`workers/kc-chatbot/src/types.d.ts` 생성:
```typescript
declare module "*.md" {
  const content: string;
  export default content;
}
```

다시 `npx tsc --noEmit` → 에러 0.

- [ ] **Step 5: 커밋**

```bash
cd /Users/jinhanjeong/Antigravity/kcultureelite
git add workers/kc-chatbot/src/lib/kb-loader.ts \
        workers/kc-chatbot/src/lib/system-prompt.ts \
        workers/kc-chatbot/wrangler.toml \
        workers/kc-chatbot/src/types.d.ts
git commit -m "feat: KB 로더 + 시스템 프롬프트 생성기"
```

---

### Task 13: anthropic 클라이언트 래퍼

**Files:**
- Test: `workers/kc-chatbot/src/lib/anthropic.test.ts`
- Create: `workers/kc-chatbot/src/lib/anthropic.ts`

Anthropic SDK는 `fetch` 기반이라 Worker에서 바로 동작. Prompt Caching을 위해 system 블록에 `cache_control: { type: "ephemeral" }` 지정.

- [ ] **Step 1: 테스트 작성 (모킹 기반)**

`workers/kc-chatbot/src/lib/anthropic.test.ts`:
```typescript
import { describe, it, expect, vi } from "vitest";
import { callClaude } from "./anthropic";

describe("callClaude", () => {
  it("passes system prompt with cache_control and returns reply text", async () => {
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      const body = JSON.parse((init?.body as string) ?? "{}");
      // 캐시 제어 확인
      expect(body.system[0].cache_control).toEqual({ type: "ephemeral" });
      expect(body.model).toContain("claude-haiku-4-5");
      return new Response(
        JSON.stringify({
          content: [{ type: "text", text: "Hello Sarah!" }],
          usage: { input_tokens: 10, output_tokens: 5, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    });

    const reply = await callClaude({
      apiKey: "test-key",
      systemPrompt: "SYS",
      messages: [{ role: "user", content: "Hi" }],
      maxTokens: 500,
      fetchImpl: fetchMock as any,
    });

    expect(reply.text).toBe("Hello Sarah!");
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("throws on non-200 response", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ error: "bad" }), { status: 500 }),
    );
    await expect(
      callClaude({
        apiKey: "k",
        systemPrompt: "s",
        messages: [{ role: "user", content: "q" }],
        maxTokens: 100,
        fetchImpl: fetchMock as any,
      }),
    ).rejects.toThrow(/Anthropic API error: 500/);
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

```bash
cd workers/kc-chatbot
npm test -- anthropic
```
Expected: FAIL.

- [ ] **Step 3: 구현**

`workers/kc-chatbot/src/lib/anthropic.ts`:
```typescript
export interface ClaudeMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ClaudeReply {
  text: string;
  inputTokens: number;
  outputTokens: number;
  cacheRead: number;
  cacheCreation: number;
}

export interface CallClaudeOpts {
  apiKey: string;
  systemPrompt: string;
  messages: ClaudeMessage[];
  maxTokens: number;
  fetchImpl?: typeof fetch;
}

const MODEL_ID = "claude-haiku-4-5-20251001";

export async function callClaude(opts: CallClaudeOpts): Promise<ClaudeReply> {
  const fetcher = opts.fetchImpl ?? fetch;
  const body = {
    model: MODEL_ID,
    max_tokens: opts.maxTokens,
    system: [
      {
        type: "text",
        text: opts.systemPrompt,
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: opts.messages,
  };

  const res = await fetcher("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": opts.apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Anthropic API error: ${res.status} ${text}`);
  }

  const json: any = await res.json();
  const text = (json.content ?? [])
    .filter((c: any) => c.type === "text")
    .map((c: any) => c.text)
    .join("");

  return {
    text,
    inputTokens: json.usage?.input_tokens ?? 0,
    outputTokens: json.usage?.output_tokens ?? 0,
    cacheRead: json.usage?.cache_read_input_tokens ?? 0,
    cacheCreation: json.usage?.cache_creation_input_tokens ?? 0,
  };
}
```

- [ ] **Step 4: 테스트 통과**

```bash
npm test -- anthropic
```
Expected: 2개 PASS.

- [ ] **Step 5: 커밋**

```bash
cd /Users/jinhanjeong/Antigravity/kcultureelite
git add workers/kc-chatbot/src/lib/anthropic.ts workers/kc-chatbot/src/lib/anthropic.test.ts
git commit -m "feat: Anthropic Claude Haiku 4.5 API 래퍼 + Prompt Caching (TDD)"
```

---

### Task 14: cost-tracker 모듈

**Files:**
- Test: `workers/kc-chatbot/src/lib/cost-tracker.test.ts`
- Create: `workers/kc-chatbot/src/lib/cost-tracker.ts`

Claude Haiku 4.5 단가 (2026-04 현재):
- Input $1/1M · Cache read $0.10/1M · Cache write $1.25/1M · Output $5/1M

- [ ] **Step 1: 테스트**

`workers/kc-chatbot/src/lib/cost-tracker.test.ts`:
```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { env } from "cloudflare:test";
import { addCost, checkBudget, estimateCost } from "./cost-tracker";

const e = env as unknown as { RATE_LIMIT: KVNamespace; MONTHLY_BUDGET_USD: string };

describe("estimateCost", () => {
  it("charges input, cache-read, and output at correct rates", () => {
    // 1M input, 1M cache read, 1M output
    const cost = estimateCost({
      inputTokens: 1_000_000,
      cacheRead: 1_000_000,
      cacheCreation: 0,
      outputTokens: 1_000_000,
    });
    // 1 + 0.10 + 0 + 5 = 6.10
    expect(cost).toBeCloseTo(6.1, 2);
  });
});

describe("budget tracking", () => {
  beforeEach(async () => {
    const keys = await e.RATE_LIMIT.list();
    for (const k of keys.keys) await e.RATE_LIMIT.delete(k.name);
  });

  it("allows requests under budget", async () => {
    await addCost(e as any, 5.0);
    expect(await checkBudget(e as any)).toBe(true);
  });

  it("blocks requests over budget", async () => {
    await addCost(e as any, 100.0);
    expect(await checkBudget(e as any)).toBe(false);
  });
});
```

- [ ] **Step 2: 실패 확인**

```bash
npm test -- cost-tracker
```
Expected: FAIL.

- [ ] **Step 3: 구현**

`workers/kc-chatbot/src/lib/cost-tracker.ts`:
```typescript
import type { Env } from "../types";

const RATES = {
  input: 1.0 / 1_000_000,
  cacheRead: 0.1 / 1_000_000,
  cacheCreation: 1.25 / 1_000_000,
  output: 5.0 / 1_000_000,
};

export interface Usage {
  inputTokens: number;
  cacheRead: number;
  cacheCreation: number;
  outputTokens: number;
}

export function estimateCost(u: Usage): number {
  return (
    u.inputTokens * RATES.input +
    u.cacheRead * RATES.cacheRead +
    u.cacheCreation * RATES.cacheCreation +
    u.outputTokens * RATES.output
  );
}

function monthKey(d: Date = new Date()): string {
  return `monthly_cost:${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export async function addCost(env: Env, usd: number): Promise<number> {
  const key = monthKey();
  const cur = parseFloat((await env.RATE_LIMIT.get(key)) ?? "0");
  const next = cur + usd;
  // 한 달 유지 (31 × 86400)
  await env.RATE_LIMIT.put(key, next.toString(), { expirationTtl: 2_678_400 });
  return next;
}

export async function checkBudget(env: Env): Promise<boolean> {
  const cur = parseFloat((await env.RATE_LIMIT.get(monthKey())) ?? "0");
  const cap = parseFloat(env.MONTHLY_BUDGET_USD);
  return cur < cap;
}
```

- [ ] **Step 4: 통과**

```bash
npm test -- cost-tracker
```
Expected: 3개 PASS.

- [ ] **Step 5: 커밋**

```bash
cd /Users/jinhanjeong/Antigravity/kcultureelite
git add workers/kc-chatbot/src/lib/cost-tracker.ts workers/kc-chatbot/src/lib/cost-tracker.test.ts
git commit -m "feat: 월 예산 추적 (Haiku 4.5 단가 기반, TDD)"
```

---

### Task 15: `/chat` 핸들러

**Files:**
- Create: `workers/kc-chatbot/src/handlers/chat.ts`

- [ ] **Step 1: 구현**

`workers/kc-chatbot/src/handlers/chat.ts`:
```typescript
import type { Env, ChatRequest, ChatResponse } from "../types";
import { hashIP, scrubPII } from "../lib/privacy";
import { checkRateLimit } from "../lib/rate-limit";
import { checkBudget, addCost, estimateCost } from "../lib/cost-tracker";
import { callClaude } from "../lib/anthropic";
import { buildSystemPrompt } from "../lib/system-prompt";

const LIMIT_MSG =
  "I've answered quite a few questions already today. For detailed inquiries, please email global@badaglobal-bli.com — our team will get back to you personally.";
const BUDGET_MSG =
  "Our assistant is resting for the month. Please email global@badaglobal-bli.com for any questions — we'll get right back to you.";

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
      "access-control-allow-origin": "*",
    },
  });
}

export async function handleChat(req: Request, env: Env): Promise<Response> {
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);
  if (!env.ANTHROPIC_API_KEY) return json({ error: "not configured" }, 500);

  let payload: ChatRequest;
  try {
    payload = (await req.json()) as ChatRequest;
  } catch {
    return json({ error: "invalid json" }, 400);
  }

  if (!Array.isArray(payload.messages) || payload.messages.length === 0) {
    return json({ error: "messages required" }, 400);
  }
  const latest = payload.messages[payload.messages.length - 1];
  if (!latest.content || latest.content.length > 2000) {
    return json({ error: "message length must be 1..2000" }, 400);
  }

  const ip = req.headers.get("cf-connecting-ip") ?? "0.0.0.0";
  const ipHash = await hashIP(ip, env.IP_HASH_SALT);

  const rl = await checkRateLimit(ipHash, env);
  if (!rl.allowed) {
    const reply: ChatResponse = { reply: LIMIT_MSG, language: "en" };
    return json(reply, 200);
  }
  if (!(await checkBudget(env))) {
    const reply: ChatResponse = { reply: BUDGET_MSG, language: "en" };
    return json(reply, 200);
  }

  // 대화 메시지 내 사용자 PII 스크러빙 (개인정보 저장 방지)
  const safeMessages = payload.messages.map((m) => ({
    role: m.role,
    content: scrubPII(m.content),
  }));

  const claude = await callClaude({
    apiKey: env.ANTHROPIC_API_KEY,
    systemPrompt: buildSystemPrompt(),
    messages: safeMessages,
    maxTokens: parseInt(env.MAX_OUTPUT_TOKENS, 10),
  });

  // 비용 기록 (best-effort, 실패해도 응답은 간다)
  try {
    await addCost(env, estimateCost(claude));
  } catch (e) {
    console.error("cost tracking failed", e);
  }

  // 익명 질문 로그 (답변은 저장하지 않음)
  try {
    await env.DB.prepare(
      "INSERT INTO questions_log (id, session_hash, question_text, kb_matched, language) VALUES (?, ?, ?, ?, ?)",
    )
      .bind(
        crypto.randomUUID(),
        ipHash.slice(0, 16), // 세션 단위 축약
        scrubPII(latest.content).slice(0, 500),
        1,
        payload.language_hint ?? null,
      )
      .run();
  } catch (e) {
    console.error("questions_log insert failed", e);
  }

  const response: ChatResponse = {
    reply: claude.text,
    language: payload.language_hint ?? "auto",
  };
  return json(response, 200);
}
```

- [ ] **Step 2: 타입 체크**

```bash
cd workers/kc-chatbot
npx tsc --noEmit
```
Expected: 에러 0.

- [ ] **Step 3: 커밋**

```bash
cd /Users/jinhanjeong/Antigravity/kcultureelite
git add workers/kc-chatbot/src/handlers/chat.ts
git commit -m "feat: /chat 핸들러 (rate limit + budget + PII 스크러빙 + 로그)"
```

---

### Task 16: `/lead` 핸들러

**Files:**
- Create: `workers/kc-chatbot/src/handlers/lead.ts`

- [ ] **Step 1: 구현**

`workers/kc-chatbot/src/handlers/lead.ts`:
```typescript
import type { Env, LeadRequest } from "../types";

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
      "access-control-allow-origin": "*",
    },
  });
}

const EMAIL_RE = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;

export async function handleLead(req: Request, env: Env): Promise<Response> {
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  let payload: LeadRequest;
  try {
    payload = (await req.json()) as LeadRequest;
  } catch {
    return json({ error: "invalid json" }, 400);
  }

  if (!EMAIL_RE.test(payload.email ?? "")) {
    return json({ error: "invalid email" }, 400);
  }
  if (!payload.name || payload.name.length > 120) {
    return json({ error: "name required (max 120 chars)" }, 400);
  }
  if (
    payload.consent_type !== "admissions_contact" &&
    payload.consent_type !== "updates_notification"
  ) {
    return json({ error: "invalid consent_type" }, 400);
  }

  const country = req.headers.get("cf-ipcountry") ?? null;
  const id = crypto.randomUUID();

  try {
    await env.DB.prepare(
      `INSERT INTO leads (id, email, name, interested_track, language_pref,
                          consent_type, country_code)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(email) DO UPDATE SET
         name = excluded.name,
         interested_track = COALESCE(excluded.interested_track, leads.interested_track),
         language_pref    = COALESCE(excluded.language_pref, leads.language_pref),
         consent_type     = excluded.consent_type`,
    )
      .bind(
        id,
        payload.email.toLowerCase(),
        payload.name.trim(),
        payload.interested_track ?? null,
        payload.language_pref ?? null,
        payload.consent_type,
        country,
      )
      .run();
  } catch (e) {
    console.error("lead insert failed", e);
    return json({ error: "storage error" }, 500);
  }

  return json({ ok: true }, 200);
}
```

- [ ] **Step 2: 타입 체크**

```bash
cd workers/kc-chatbot
npx tsc --noEmit
```
Expected: 에러 0.

- [ ] **Step 3: 커밋**

```bash
cd /Users/jinhanjeong/Antigravity/kcultureelite
git add workers/kc-chatbot/src/handlers/lead.ts
git commit -m "feat: /lead 핸들러 (email 검증 + UPSERT)"
```

---

### Task 17: `/health` 핸들러 + 라우터 + CORS

**Files:**
- Create: `workers/kc-chatbot/src/handlers/health.ts`
- Create: `workers/kc-chatbot/src/index.ts`

- [ ] **Step 1: health.ts 작성**

`workers/kc-chatbot/src/handlers/health.ts`:
```typescript
export function handleHealth(): Response {
  return new Response(JSON.stringify({ ok: true, ts: Date.now() }), {
    headers: { "content-type": "application/json" },
  });
}
```

- [ ] **Step 2: index.ts 작성**

`workers/kc-chatbot/src/index.ts`:
```typescript
import type { Env } from "./types";
import { handleChat } from "./handlers/chat";
import { handleLead } from "./handlers/lead";
import { handleHealth } from "./handlers/health";

const ALLOWED_ORIGINS = [
  "https://kcultureelite.com",
  "https://www.kcultureelite.com",
  "https://kcultureelite.pages.dev",
  "http://localhost:8765",
  "http://localhost:8787",
];

function cors(origin: string | null): HeadersInit {
  const allow =
    origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "access-control-allow-origin": allow,
    "access-control-allow-methods": "POST, GET, OPTIONS",
    "access-control-allow-headers": "content-type",
    "access-control-max-age": "86400",
  };
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const origin = req.headers.get("origin");
    if (req.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors(origin) });
    }
    const url = new URL(req.url);
    let res: Response;
    switch (url.pathname) {
      case "/chat":
        res = await handleChat(req, env);
        break;
      case "/lead":
        res = await handleLead(req, env);
        break;
      case "/health":
        res = handleHealth();
        break;
      default:
        res = new Response("not found", { status: 404 });
    }
    // CORS 헤더 덮어쓰기
    const h = new Headers(res.headers);
    for (const [k, v] of Object.entries(cors(origin))) h.set(k, v as string);
    return new Response(res.body, { status: res.status, headers: h });
  },
};
```

- [ ] **Step 3: 타입 체크**

```bash
cd workers/kc-chatbot
npx tsc --noEmit
```
Expected: 에러 0.

- [ ] **Step 4: 커밋**

```bash
cd /Users/jinhanjeong/Antigravity/kcultureelite
git add workers/kc-chatbot/src/handlers/health.ts workers/kc-chatbot/src/index.ts
git commit -m "feat: /health + 라우터 + CORS 미들웨어"
```

---

### Task 18: Worker 시크릿 등록 + 로컬 구동 검증

**Files:** (없음 — CLI 작업만)

- [ ] **Step 1: Anthropic 키를 Worker secret으로 저장**

```bash
cd workers/kc-chatbot
wrangler secret put ANTHROPIC_API_KEY
# 프롬프트가 뜨면 console.anthropic.com에서 발급한 키 값 붙여넣기
```
Expected: `✨ Success! Uploaded secret ANTHROPIC_API_KEY`.

- [ ] **Step 2: IP 해시 salt 저장**

```bash
wrangler secret put IP_HASH_SALT
# 강력한 랜덤 문자열 붙여넣기. 아래 명령으로 생성 가능:
# openssl rand -hex 32
```
Expected: `✨ Success!`.

- [ ] **Step 3: 로컬 dev 서버 구동**

```bash
npm run dev
```
브라우저에서 `http://localhost:8787/health` 열기. Expected: `{"ok":true,"ts":...}`.

- [ ] **Step 4: /chat 로컬 호출 테스트**

새 터미널에서:
```bash
curl -X POST http://localhost:8787/chat \
  -H "content-type: application/json" \
  -d '{"messages":[{"role":"user","content":"What tracks do you offer?"}]}'
```
Expected: `{"reply": "The K-Culture Elite Program offers 5 tracks: ..."}` 유사한 JSON.

실패 시 `wrangler dev` 콘솔에서 에러 메시지 확인. Anthropic 키 잘못 입력·모델명 미스 등 추적.

- [ ] **Step 5: /lead 로컬 호출 테스트**

```bash
curl -X POST http://localhost:8787/lead \
  -H "content-type: application/json" \
  -d '{"email":"test@example.com","name":"Test User","consent_type":"admissions_contact","interested_track":"K-Beauty Business"}'
```
Expected: `{"ok":true}`.

- [ ] **Step 6: D1 저장 확인**

```bash
wrangler d1 execute kc-db --local --command "SELECT email, name, interested_track FROM leads;"
```
Expected: `test@example.com | Test User | K-Beauty Business` 행.

- [ ] **Step 7: dev 서버 종료 + 정리**

로컬 테스트 레코드 삭제:
```bash
wrangler d1 execute kc-db --local --command "DELETE FROM leads; DELETE FROM questions_log;"
```

- [ ] **Step 8: 커밋할 파일 없음 — secret은 Cloudflare에만 저장됨**

---

### Task 19: Worker 배포

**Files:** (없음 — CLI 작업만)

- [ ] **Step 1: 원격 시크릿 등록 (production)**

```bash
cd workers/kc-chatbot
wrangler secret put ANTHROPIC_API_KEY   # 같은 값 입력 OK
wrangler secret put IP_HASH_SALT
```

- [ ] **Step 2: 배포**

```bash
npm run deploy
```
Expected: `Deployed kc-chatbot triggers ... https://kc-chatbot.<account>.workers.dev` 출력. URL 메모.

- [ ] **Step 3: 원격 health 확인**

```bash
curl https://kc-chatbot.<your-subdomain>.workers.dev/health
```
Expected: `{"ok":true,"ts":...}`.

- [ ] **Step 4: 원격 /chat 스모크 테스트**

```bash
curl -X POST https://kc-chatbot.<your-subdomain>.workers.dev/chat \
  -H "content-type: application/json" \
  -H "origin: https://kcultureelite.com" \
  -d '{"messages":[{"role":"user","content":"Tell me about the faculty."}]}'
```
Expected: 의미 있는 한 문단 답변.

- [ ] **Step 5: Worker URL을 기록**

`/tmp/kc-ids.txt` 에 추가:
```bash
echo "Worker URL: https://kc-chatbot.<your-subdomain>.workers.dev" >> /tmp/kc-ids.txt
cat /tmp/kc-ids.txt
```

---

## Day 3 — 프론트엔드 위젯 + E2E + 최종 배포

### Task 20: 챗봇 CSS

**Files:**
- Create: `assets/chatbot/chatbot.css`

- [ ] **Step 1: CSS 작성**

`assets/chatbot/chatbot.css`:
```css
/* K-Culture Elite Chatbot Widget */
:root {
  --kc-chat-bg: #111111;
  --kc-chat-border: rgba(168, 85, 247, 0.4);
  --kc-chat-accent: #a855f7;
  --kc-chat-accent-glow: #c084fc;
  --kc-chat-text: #e5e5e5;
  --kc-chat-muted: #8a8a8a;
  --kc-chat-user-bg: #a855f7;
  --kc-chat-assistant-bg: #1a1a1a;
}

.kc-chat-button {
  position: fixed;
  bottom: 24px;
  right: 24px;
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background: linear-gradient(135deg, #a855f7, #c084fc);
  box-shadow: 0 0 24px rgba(168, 85, 247, 0.5);
  border: none;
  cursor: pointer;
  color: #fff;
  font-size: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9998;
  transition: transform 0.2s ease;
}
.kc-chat-button:hover { transform: scale(1.06); }
.kc-chat-button[aria-expanded="true"] { display: none; }

.kc-chat-panel {
  position: fixed;
  bottom: 24px;
  right: 24px;
  width: min(360px, calc(100vw - 32px));
  height: min(540px, calc(100vh - 48px));
  background: var(--kc-chat-bg);
  border: 1px solid var(--kc-chat-border);
  border-radius: 16px;
  overflow: hidden;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.6);
  display: none;
  flex-direction: column;
  z-index: 9999;
  font-family: Inter, system-ui, sans-serif;
  color: var(--kc-chat-text);
}
.kc-chat-panel.kc-open { display: flex; }

.kc-chat-header {
  background: linear-gradient(135deg, #a855f7, #23508e);
  padding: 12px 16px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  color: #fff;
  font-weight: 600;
  font-size: 14px;
}
.kc-chat-close {
  background: none; border: none; color: #fff;
  font-size: 20px; cursor: pointer; padding: 0; line-height: 1;
}

.kc-chat-messages {
  flex: 1;
  padding: 12px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 8px;
  scroll-behavior: smooth;
}
.kc-chat-msg {
  max-width: 85%;
  padding: 8px 12px;
  border-radius: 10px;
  font-size: 14px;
  line-height: 1.5;
  white-space: pre-wrap;
  word-wrap: break-word;
}
.kc-chat-msg.user {
  background: var(--kc-chat-user-bg);
  color: #fff;
  align-self: flex-end;
}
.kc-chat-msg.assistant {
  background: var(--kc-chat-assistant-bg);
  color: var(--kc-chat-text);
  align-self: flex-start;
}
.kc-chat-msg.error { color: #ff7a7a; font-style: italic; }

.kc-chat-typing {
  color: var(--kc-chat-muted);
  font-size: 12px;
  font-style: italic;
  padding: 4px 8px;
}

.kc-chat-form {
  border-top: 1px solid #222;
  padding: 10px;
  display: flex;
  gap: 8px;
}
.kc-chat-input {
  flex: 1;
  background: #0a0a0a;
  border: 1px solid #333;
  border-radius: 8px;
  padding: 8px 10px;
  color: var(--kc-chat-text);
  font-size: 14px;
  font-family: inherit;
  resize: none;
  min-height: 36px;
  max-height: 120px;
}
.kc-chat-input:focus {
  outline: none;
  border-color: var(--kc-chat-accent);
}
.kc-chat-send {
  background: var(--kc-chat-accent);
  color: #fff;
  border: none;
  border-radius: 8px;
  width: 40px;
  cursor: pointer;
  font-size: 16px;
  transition: background 0.15s;
}
.kc-chat-send:hover { background: var(--kc-chat-accent-glow); }
.kc-chat-send:disabled { opacity: 0.4; cursor: not-allowed; }

.kc-chat-footer {
  padding: 6px 10px 10px;
  font-size: 10px;
  color: var(--kc-chat-muted);
  text-align: center;
}

@media (prefers-reduced-motion: reduce) {
  .kc-chat-button { transition: none; }
  .kc-chat-messages { scroll-behavior: auto; }
}

@media (max-width: 480px) {
  .kc-chat-panel {
    width: 100vw;
    height: 100vh;
    right: 0;
    bottom: 0;
    border-radius: 0;
  }
}
```

- [ ] **Step 2: 커밋**

```bash
cd /Users/jinhanjeong/Antigravity/kcultureelite
git add assets/chatbot/chatbot.css
git commit -m "feat: 챗봇 위젯 CSS (다크 테마 일관성)"
```

---

### Task 21: 챗봇 JS (위젯 로직)

**Files:**
- Create: `assets/chatbot/chatbot.js`

- [ ] **Step 1: 위젯 스크립트 작성**

`assets/chatbot/chatbot.js`:
```javascript
/**
 * K-Culture Elite Floating Chatbot Widget (Vanilla JS).
 * Config via <script src="chatbot.js" data-worker="https://kc-chatbot....workers.dev"></script>
 */
(function () {
  "use strict";

  const scriptEl = document.currentScript;
  const WORKER = scriptEl?.dataset.worker;
  if (!WORKER) {
    console.error("[chatbot] data-worker attribute missing on script tag");
    return;
  }

  const STORAGE_KEY = "kc-chat-history";
  const MAX_TURNS = 50;
  const WELCOME =
    "Hi! Ask me anything about the K-Culture Elite Program — in any language you prefer.";

  const state = {
    messages: loadHistory(),
    sending: false,
  };

  function loadHistory() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed.slice(-MAX_TURNS * 2);
    } catch {
      return [];
    }
  }
  function saveHistory() {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(state.messages.slice(-MAX_TURNS * 2)),
      );
    } catch {
      /* storage disabled */
    }
  }

  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  }

  // --- build DOM ---
  const btn = el("button", "kc-chat-button", "💬");
  btn.setAttribute("aria-label", "Open K-Culture AI Assistant");
  btn.setAttribute("aria-expanded", "false");

  const panel = el("div", "kc-chat-panel");
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-label", "K-Culture AI Assistant");

  const header = el("div", "kc-chat-header");
  header.appendChild(el("span", null, "🤖 K-Culture Assistant"));
  const closeBtn = el("button", "kc-chat-close", "×");
  closeBtn.setAttribute("aria-label", "Close chat");
  header.appendChild(closeBtn);

  const messagesEl = el("div", "kc-chat-messages");

  const form = el("form", "kc-chat-form");
  const input = el("textarea", "kc-chat-input");
  input.rows = 1;
  input.placeholder = "Ask a question…";
  input.maxLength = 2000;
  const sendBtn = el("button", "kc-chat-send", "→");
  sendBtn.type = "submit";
  form.append(input, sendBtn);

  const footer = el(
    "div",
    "kc-chat-footer",
    "Powered by Claude · Your chat stays in your browser",
  );

  panel.append(header, messagesEl, form, footer);
  document.body.append(btn, panel);

  // --- render ---
  function render() {
    messagesEl.innerHTML = "";
    if (state.messages.length === 0) {
      messagesEl.appendChild(el("div", "kc-chat-msg assistant", WELCOME));
    } else {
      state.messages.forEach((m) => {
        messagesEl.appendChild(
          el("div", `kc-chat-msg ${m.role}`, m.content),
        );
      });
    }
    if (state.sending) {
      messagesEl.appendChild(el("div", "kc-chat-typing", "Assistant is typing…"));
    }
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  // --- events ---
  btn.addEventListener("click", () => {
    panel.classList.add("kc-open");
    btn.setAttribute("aria-expanded", "true");
    input.focus();
    render();
  });
  closeBtn.addEventListener("click", () => {
    panel.classList.remove("kc-open");
    btn.setAttribute("aria-expanded", "false");
  });

  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      form.requestSubmit();
    }
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (state.sending) return;
    const text = input.value.trim();
    if (!text) return;
    state.messages.push({ role: "user", content: text });
    saveHistory();
    input.value = "";
    input.style.height = "auto";
    state.sending = true;
    sendBtn.disabled = true;
    render();

    try {
      const res = await fetch(`${WORKER}/chat`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          messages: state.messages.slice(-20),
          language_hint: navigator.language?.slice(0, 2) ?? "en",
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.reply) {
        throw new Error(data.error ?? "unknown error");
      }
      state.messages.push({ role: "assistant", content: data.reply });
      saveHistory();

      // Progressive Lead Capture: detect user email in latest message
      const lastUser = state.messages[state.messages.length - 2];
      const emailMatch = lastUser.content.match(
        /([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})/,
      );
      if (emailMatch) {
        const nameMatch = lastUser.content.match(
          /\bI['’]?m\s+([A-Z][A-Za-z'-]{1,30})/,
        );
        fetch(`${WORKER}/lead`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            email: emailMatch[1],
            name: nameMatch?.[1] ?? "(unknown)",
            consent_type: "admissions_contact",
            language_pref: navigator.language?.slice(0, 2) ?? "en",
          }),
        }).catch((err) => console.warn("[chatbot] lead capture failed", err));
      }
    } catch (err) {
      console.error(err);
      state.messages.push({
        role: "assistant",
        content:
          "Sorry, I had trouble reaching the assistant. Please try again or email global@badaglobal-bli.com.",
      });
    } finally {
      state.sending = false;
      sendBtn.disabled = false;
      render();
    }
  });

  // initial render on first open — nothing on boot
})();
```

- [ ] **Step 2: 커밋**

```bash
git add assets/chatbot/chatbot.js
git commit -m "feat: 챗봇 위젯 JS (localStorage + Progressive Lead Capture)"
```

---

### Task 22: index.html에 위젯 주입

**Files:**
- Modify: `index.html` (2곳)

- [ ] **Step 1: `<head>` 에 CSS 링크 추가**

`index.html` `<head>` 닫는 태그 바로 앞에 추가:
```html
<!-- K-Culture Assistant Chatbot Widget -->
<link rel="stylesheet" href="/assets/chatbot/chatbot.css" />
```

- [ ] **Step 2: `</body>` 직전에 스크립트 추가**

`</body>` 닫기 직전, **data-worker 값은 Task 19 배포 후 받은 Worker URL** 로 교체:
```html
<script
  src="/assets/chatbot/chatbot.js"
  data-worker="https://kc-chatbot.<your-subdomain>.workers.dev"
  defer
></script>
```

- [ ] **Step 3: 로컬 미리보기**

```bash
cd /Users/jinhanjeong/Antigravity/kcultureelite
python3 -m http.server 8765
```
`http://localhost:8765` 열기.

Expected: 우하단에 💬 플로팅 버튼. 클릭 시 다크 패널 열림. 환영 메시지 표시. 입력 후 Enter → 원격 Worker와 통신해 답변 표시.

- [ ] **Step 4: 콘솔 에러 확인**

브라우저 DevTools Console. Expected: 에러 없음. CORS 경고 없음.

- [ ] **Step 5: 커밋**

```bash
git add index.html
git commit -m "feat: index.html에 챗봇 위젯 주입"
```

---

### Task 23: E2E 테스트 (Playwright)

**Files:**
- Create: `playwright.config.ts`
- Create: `tests/e2e/chatbot.spec.ts`

- [ ] **Step 1: Playwright 설정**

`playwright.config.ts`:
```typescript
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  use: {
    baseURL: "http://localhost:8765",
    headless: true,
    screenshot: "only-on-failure",
  },
  webServer: {
    command: "python3 -m http.server 8765",
    url: "http://localhost:8765",
    reuseExistingServer: true,
    timeout: 10_000,
  },
});
```

- [ ] **Step 2: E2E 테스트 작성**

`tests/e2e/chatbot.spec.ts`:
```typescript
import { test, expect } from "@playwright/test";

test.describe("Chatbot widget", () => {
  test("floating button is visible", async ({ page }) => {
    await page.goto("/");
    const btn = page.locator(".kc-chat-button");
    await expect(btn).toBeVisible();
  });

  test("opens panel on click and shows welcome", async ({ page }) => {
    await page.goto("/");
    await page.locator(".kc-chat-button").click();
    await expect(page.locator(".kc-chat-panel")).toBeVisible();
    await expect(
      page.locator(".kc-chat-msg.assistant").first(),
    ).toContainText(/K-Culture Elite Program/);
  });

  test("submits a message and receives a reply", async ({ page }) => {
    await page.goto("/");
    await page.locator(".kc-chat-button").click();
    await page.locator(".kc-chat-input").fill("What tracks do you offer?");
    await page.locator(".kc-chat-send").click();
    // 어시스턴트 응답이 나타날 때까지 대기 (최대 20s — Claude 호출 지연 허용)
    await expect(page.locator(".kc-chat-msg.assistant").nth(1)).toBeVisible({
      timeout: 20_000,
    });
  });

  test("history persists across reload", async ({ page }) => {
    await page.goto("/");
    await page.locator(".kc-chat-button").click();
    await page.locator(".kc-chat-input").fill("Hello");
    await page.locator(".kc-chat-send").click();
    await expect(page.locator(".kc-chat-msg.user")).toBeVisible();
    await page.reload();
    await page.locator(".kc-chat-button").click();
    await expect(page.locator(".kc-chat-msg.user")).toContainText("Hello");
  });
});
```

- [ ] **Step 3: 테스트 실행**

```bash
npx playwright test
```
Expected: 4개 PASS. `history persists` 테스트는 페이지 새로고침 후 localStorage 복원 확인.

만약 3번째 테스트가 timeout으로 실패하면:
- Worker가 배포됐고 `data-worker`가 올바른 URL인지 확인
- Anthropic 키가 유효한지 `curl /health` 로 재확인
- `console.log`로 fetch 응답 디버그 추가 가능

- [ ] **Step 4: 커밋**

```bash
git add playwright.config.ts tests/e2e/chatbot.spec.ts
git commit -m "test: 챗봇 위젯 Playwright E2E"
```

---

### Task 24: Faculty CTA 제거 (spec Phase 1 마지막 단장)

**Files:**
- Modify: `index.html` (Faculty 섹션 하단 CTA 블록)

Spec에서 "Faculty CTA는 제거하여 중복 없이 단일 진입"이라고 정의. 플로팅 위젯이 유일한 챗봇 진입점이 되어야 함.

- [ ] **Step 1: CTA 블록 위치 확인**

```bash
grep -n "Ask our AI Assistant" index.html
```
Expected: 한 줄 매치. 해당 줄 번호 메모.

- [ ] **Step 2: CTA 블록 제거**

Faculty 섹션 하단의 `<div ...>...Ask our AI Assistant...</div>` 블록 전체를 삭제. (Faculty 섹션 자체는 유지, Flip Cards까지만 남김.)

실제 블록 구조는 이전 세션에서 추가된 플레이스홀더로, alert 호출하던 버튼 + 그 컨테이너 — 전부 제거.

- [ ] **Step 3: 로컬 확인**

`http://localhost:8765` 새로고침. Faculty 섹션이 Trainer Flip Cards에서 끝나고, Tracks 섹션으로 바로 연결되는지 확인. 플로팅 버튼만이 유일한 챗봇 진입점.

- [ ] **Step 4: 커밋**

```bash
git add index.html
git commit -m "refactor: Faculty CTA 제거 — 챗봇 단일 진입점(플로팅 위젯)으로 통일"
```

---

### Task 25: CLAUDE.md 업데이트

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: CLAUDE.md에 챗봇 섹션 추가**

`CLAUDE.md`의 "## 파일 구조" 바로 아래에 삽입:
```markdown
## 챗봇 (Phase 1 완료)

- Worker: `workers/kc-chatbot/` — 독립 npm 프로젝트
- 프론트: `assets/chatbot/chatbot.{css,js}` + `index.html` 주입
- KB 빌드: `scripts/extract-ppt.py`·`extract-pdf.py`·`crawl-dyu.py`·`build-kb.py`
- 설계 spec: `docs/superpowers/specs/2026-04-20-chatbot-design.md`
- 구현 plan: `docs/superpowers/plans/2026-04-20-chatbot-implementation.md`
- Worker URL: `https://kc-chatbot.<account>.workers.dev`
- D1 DB: `kc-db` (4 테이블: leads, questions_log, applications, payments)
- KV: `kc-rate-limit`
- Secret: `ANTHROPIC_API_KEY`, `IP_HASH_SALT` (Cloudflare Worker secrets)

**리드 조회 (Chris님 수동)**:
```bash
wrangler d1 execute kc-db --remote \
  --command "SELECT email, name, interested_track, first_seen_at FROM leads ORDER BY first_seen_at DESC LIMIT 50;"
```

**비용 조회**:
```bash
wrangler kv key get --binding=RATE_LIMIT "monthly_cost:202604"
```
```

- [ ] **Step 2: 커밋**

```bash
git add CLAUDE.md
git commit -m "docs: CLAUDE.md에 챗봇 Phase 1 운영 가이드 추가"
```

---

### Task 26: 프로덕션 배포 + 스모크

**Files:** (없음 — 배포 작업)

- [ ] **Step 1: 로컬 최종 체크**

```bash
cd /Users/jinhanjeong/Antigravity/kcultureelite
python3 -m http.server 8765 &
SERVER_PID=$!
sleep 2
npx playwright test
kill $SERVER_PID
```
Expected: 4/4 PASS.

- [ ] **Step 2: 원격 push (사용자 명시 승인 후)**

> ⚠️ **사용자 승인 확인**: 이 단계는 GitHub에 푸시 → Cloudflare Pages 자동 배포를 트리거합니다. Chris님이 "push 해도 됩니다"라고 답하기 전에는 실행하지 않습니다.

승인 후:
```bash
git push origin main
```
Cloudflare Pages 대시보드에서 배포 진행 상황 확인 (60~120초).

- [ ] **Step 3: 프로덕션 스모크**

`https://kcultureelite.com` 접속:
- 우하단 플로팅 버튼 표시
- 클릭 시 패널 열림
- "Tell me about the K-Pop Business track" 질문 → 의미 있는 답변 수신
- DevTools Network 탭에서 `/chat` POST 200 확인
- Console 에러 0

- [ ] **Step 4: 원격 DB 확인**

```bash
cd workers/kc-chatbot
wrangler d1 execute kc-db --remote --command "SELECT COUNT(*) AS n FROM questions_log;"
```
Expected: `n >= 1` (방금 던진 질문이 로그에 쌓였는지).

- [ ] **Step 5: CLAUDE.md에 배포 완료 표식 추가**

```bash
cd /Users/jinhanjeong/Antigravity/kcultureelite
```
`CLAUDE.md`의 **프로젝트 히스토리** 섹션 하단에 한 줄 추가:
```markdown
- **2026-04-2X**: 챗봇 Phase 1 배포 완료 (Cloudflare Worker + Claude Haiku 4.5 + D1)
```

```bash
git add CLAUDE.md
git commit -m "docs: 챗봇 Phase 1 배포 이력 기록"
git push origin main   # 사용자 승인 후
```

---

## Self-Review (작성자 점검)

**1. Spec 커버리지** — spec의 각 섹션이 plan의 어느 Task에 매핑되는가?

| Spec 섹션 | 구현 Task |
|-----------|-----------|
| §3 사용자 여정 | Task 15, 16, 21 |
| §5.1 Floating Widget | Task 20, 21, 22 |
| §5.2 Cloudflare Worker | Task 6, 15, 16, 17, 18, 19 |
| §5.3 지식베이스 | Task 1~4, 12 |
| §5.4 D1 DB | Task 5, 7 |
| §5.5 KV | Task 5, 10, 14 |
| §6 데이터 모델 | Task 7 |
| §7 시스템 프롬프트 | Task 12 |
| §8 Rate Limit & 비용 | Task 10, 14, 15 |
| §9 Privacy | Task 9, 15, 18 |
| §10 Phase 3 훅 | Task 7 (스키마만) |
| §11 구현 Day 1~3 | Day 1: Task 1~4, Day 2: Task 5~19, Day 3: Task 20~26 |
| §12 외부 서비스 | Prerequisites P1, P2 |

모든 spec 요구사항에 대응 Task 존재 → 갭 없음.

**2. Placeholder 스캔** — "TBD"/"TODO"/"implement later" 문자열 grep. 본 plan에 없음. `<붙여넣기>` 마커가 Task 5~6에 있지만 이는 "Task 5 결과를 Task 6에 반영"이라는 의도적 주입점이며 상세 지시어를 동반함 → 유효.

**3. 타입 일관성** — `Env`, `ChatRequest`, `ChatResponse`, `LeadRequest`, `RateLimitResult`가 Task 8에서 정의되고 Task 10, 13~16에서 일관된 이름으로 사용. `checkRateLimit`, `callClaude`, `buildSystemPrompt`, `detectLead` 등 함수명 plan 내 동일 철자 유지. OK.

**4. 모호성** — 각 Step이 실행 가능한 명령 또는 복붙 가능한 코드를 포함. 외부 설정값(D1 id, KV id, Worker URL)은 Step에서 명시적으로 "Task N 결과로 치환" 안내.

---

## 실행 방법 선택 (Execution Handoff)

Plan 완료, 파일 저장: `docs/superpowers/plans/2026-04-20-chatbot-implementation.md`

두 가지 실행 방식이 있어요:

**1. Subagent-Driven (권장)** — 제가 Task마다 새 서브에이전트를 띄워서 격리된 컨텍스트에서 TDD 사이클을 실행하고, Task 종료마다 제가 2단계 검토 후 Chris님께 진행 보고. 빠르고 실수 적음.

**2. Inline 실행** — 이 메인 세션에서 제가 순차 실행하되, 여러 Task 사이에 체크포인트(Chris님 확인)를 둠. 대화 맥락 유지되고 중간 개입 쉽지만, 컨텍스트 윈도우 부담↑.

어떤 방식으로 가시겠어요?
