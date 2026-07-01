# PulseLine (cc-pulseline) — 프로젝트 스펙

> AI가 코드를 짤 때 지켜야 할 규칙과 절대 하면 안 되는 것.
> 이 문서를 AI에게 항상 함께 공유하세요.

---

## 기술 스택

> **2026-07-04 재검토로 반영된 핵심 리스크 수정**: 애초 "Node.js 스크립트를 그대로 배포"하는 안은 "Claude Code 사용자는 Node.js가 있다"는 **검증 안 된 가정**에 기대고 있었다. 실측 결과 Claude Code는 2026-01-21(v2.1.15)부터 **Node.js가 전혀 필요 없는 네이티브 스탠드얼론 설치 프로그램을 공식 권장 경로로 전환**했고 npm 설치는 deprecated 상태다(확인된 사실 — Claude Code 공식 설치 문서). 즉 지금 시점 신규 사용자는 Node.js가 없을 가능성이 높다. 그대로 뒀다면 MVP 성공 기준 1번("Windows에서 정상 작동")이 설치 직후 조용히 깨지는 심각한 결함이었다. → **개발은 JavaScript 유지, 배포만 Node.js SEA(Single Executable Application)로 전환**해 해결한다(아래 표 반영).

| 영역 | 선택 | 이유 |
|------|------|------|
| 개발 언어 | JavaScript (Node.js API) | 사용자가 두 차례 확인 질문 모두에서 "범용적 사용을 위한 마켓플레이스+플러그인 형태"를 선택함(확인된 사실). Windows/Mac/Linux를 동일 코드로 다룰 수 있고, JSON 파싱이 내장돼 있어 cc-statusline이 겪는 "jq 미설치 시 기능 통째로 죽음" 문제(실사용 약점, 확인됨)가 원천적으로 없다 |
| **배포 바이너리** | **Node.js SEA(Single Executable Application)** — Node 22+ 안정화, 2026-01 `--build-sea` 플래그로 원스텝 빌드 지원(확인된 사실) | 사용자 PC에 Node.js 설치를 요구하지 않는다. claudeline(Go)·CCometixLine(Rust)이 이미 "런타임 설치 불필요한 단일 바이너리" 방식으로 배포 중이라는 걸 리서치로 확인했음 — 그 강점을 JS 개발 경험을 유지한 채 그대로 흡수 |
| 배포 방식 | Claude Code Plugin Marketplace (`.claude-plugin/marketplace.json` + `plugin.json`), 플러그인 안에 OS별 SEA 바이너리 3종(win/mac/linux) 동봉 | 사용자가 명시적으로 요구한 "마켓플레이스+플러그인 형태"에 직접 부합. claudeline이 이미 검증한 배포 패턴(`/plugin marketplace add` → `/plugin install` → `/설정명령`)을 벤치마킹하되, claudeline이 Windows/Linux를 "파일 기반 폴백"으로 취급한 약점은 3-OS 동일 SEA 빌드로 제거 |
| CI 빌드 | GitHub Actions 매트릭스 빌드 (linux/macos/windows 러너 각각) | SEA는 크로스 컴파일 시 코드캐시/스냅샷이 플랫폼에 종속돼 깨질 수 있다는 게 Node.js 공식 문서로 확인됨 — 반드시 각 OS 네이티브 러너에서 빌드해야 함(claudeline·CCometixLine도 동일 매트릭스 구조로 이미 검증된 패턴) |
| 설정 UI | 커스텀 슬래시 명령(`/pulseline:setup`) | Claude Code 공식 plugin-reference가 지원하는 커스텀 명령 메커니즘 사용. claudeline의 `/claudeline:setup`, cc-statusline의 `npx init` 패턴에서 "질문 몇 개로 끝"이라는 강점만 벤치마킹 |
| 캐싱(Phase 2) | 파일 기반 캐시, `session_id` 키 | 공식 문서가 PID 대신 session_id를 명시적으로 권장(문서 원문 확인됨) — 동시 세션 캐시 오염 방지 |
| 테스트 | Node.js 내장 test runner (`node --test`), SEA 빌드 산출물은 별도 스모크 테스트로 실행 확인 | 외부 테스트 프레임워크 의존성 최소화, mock stdin JSON으로 위젯 단위 테스트 + 빌드된 바이너리가 실제로 뜨는지 스모크 테스트 |
| 패키지 매니저 (개발용, 최종 확정) | npm | 리서치된 경쟁 도구(cc-statusline, ccusage)들이 npx(npm 기반)를 기본 경로로 쓰는 것과 동일한 관례. 최종 사용자는 SEA 배포로 npm조차 필요 없으므로 이 선택은 "개발 환경"에만 영향 |
| 최소 지원 Claude Code 버전 (최종 확정) | v2.1.153 이상 | 공식 문서가 명시한 `COLUMNS`/`LINES` 환경변수 지원 최소 버전(문서 원문 확인). 이보다 낮으면 터미널 폭 감지가 안 돼 위젯 레이아웃이 깨질 수 있어 이 버전을 최소 기준으로 명시 |

---

## 프로젝트 구조

```
cc-pulseline/
├── .claude-plugin/
│   ├── plugin.json          # 플러그인 메타데이터(name, version, author 등)
│   └── marketplace.json     # 마켓플레이스 카탈로그 항목
├── commands/
│   └── setup.md             # /pulseline:setup 슬래시 명령 정의
├── src/
│   ├── statusline.js        # 진입점 — stdin JSON 읽고 stdout으로 렌더링
│   ├── platform/            # PlatformProfile 감지 로직(os/shell/runtime)
│   ├── widgets/              # Widget 타입별 렌더러 (location, context, cost, rate_limit, git, pr)
│   ├── config/               # StatuslineConfig 읽기/쓰기, QuickSetup 로직
│   └── cache/                 # CacheEntry 파일 캐시(Phase 2)
├── test/                     # mock stdin JSON 기반 단위 테스트
├── README.md
└── package.json
```

---

## 보안 요구사항 (OWASP ASVS / Secure by Design 매핑)

> 보안은 선택 항목이 아니라 핵심 요구사항이다. PulseLine은 로그인·세션·DB가 없는 로컬 단일 사용자 CLI 도구이므로, 웹앱형 보안 항목(인증/인가, 세션, CORS) 상당수가 "생략"이 아니라 "구조적으로 해당 컴포넌트 자체가 없음"이다. 그 이유를 항목별로 명시하고, 실제로 공격 표면이 되는 항목(입력값 검증, 인젝션, 의존성)은 구체적 수용 기준을 둔다.

### 인증/인가 (ASVS V2/V4) — 해당 없음
로그인 기능·사용자 계정·관리자/일반 사용자 구분이 없다. Phase 1~2 범위에서 외부 인증을 도입하지 않는다(위 "절대 하지 마"의 비공개 API 금지 원칙과 동일 근거).

### 접근 통제 기준
- 로그인 필요 기능: 없음(전체 기능이 로그인 불필요)
- 역할 구분(관리자/일반/비로그인): 해당 없음 — 로컬 단일 사용자
- 서버/API/DB 접근 통제: 해당 없음(서버·API·DB 자체가 존재하지 않음)

### 입력값 검증 (ASVS V5) — Must Have
- Claude Code가 stdin으로 보내는 JSON은 **신뢰하지 않는 외부 입력**으로 취급한다. 모든 필드는 존재 여부·타입을 검증한 뒤 사용하고, 검증 실패는 위젯 단위로 격리해 전체 스크립트가 중단되지 않게 한다(기존 "항상 해" 원칙을 보안 요구사항으로 재확인)
- 수치 필드(`context_window.used_percentage` 등)는 파싱 실패·음수·범위 초과 시 안전한 기본값으로 폴백

### 인젝션 방지 (ASVS V5.3) — Must Have
- **명령어 주입 방지**: git 브랜치명 등 외부에서 온 문자열을 셸 명령 문자열에 결합하지 않는다. `child_process.execFile`(인자 배열 전달)만 사용하고 `exec`(셸 문자열 결합)은 금지 — 악의적 브랜치명(예: `` `; rm -rf ~` ``)으로 인한 명령어 주입을 차단하는 수용 기준
- **경로 조작**: `workspace.current_dir`는 표시 전용이며 파일 시스템 접근에 재사용하지 않는다 — 경로 탐색 공격 표면 자체가 없음
- SQL Injection·위험한 파일 업로드: 해당 없음 — DB·파일 업로드 기능 없음

### 비밀정보 관리 (ASVS V6/V9) — Must Have (Phase 3 외부 API 연동 시 적용)
- Phase 1~2는 외부 API를 호출하지 않으므로 비밀정보 자체가 없음
- Phase 3에서 외부 API가 추가되면: API 키·토큰을 코드·설정 파일·로그에 직접 쓰지 않고 환경변수 또는 OS 자격증명 저장소 사용, `.env`는 `.gitignore` 필수 등록(aurakit-security.md 원칙 재확인)

### 세션/토큰 관리 — 해당 없음
세션, JWT, 인증 코드, 초대 코드, 비밀번호 재설정 토큰, nonce 개념 자체가 없는 도구.

### 보안 설정 (ASVS V14) — Should Have
- 디버그 플래그(claudeline 벤치마킹, Phase 2 이후 검토)를 추가할 경우, 디버그 로그에 stdin JSON 원문을 그대로 덤프하지 않는다 — 프로젝트 경로 등 불필요한 정보 노출 방지
- CORS·쿠키·보안 헤더: 해당 없음 — HTTP 서버가 아닌 로컬 CLI 스크립트
- 디버그/운영 설정 분리: 배포되는 SEA 바이너리에는 디버그 로그가 기본 OFF, 명시적 플래그로만 활성화

### 의존성 보안 (ASVS V14.2) — Should Have
- CI에 `npm audit` 고위험 항목 검사 추가
- SEA 빌드에 포함되는 런타임 의존성을 최소화(목표: Node.js 내장 모듈만 사용 — 기존 기술 스택 선택과 일치)

### DB/스토리지 권한 (ASVS V12) — Could Have (Phase 2, CacheEntry부터 적용)
- CacheEntry(Phase 2) 파일이 다중 사용자 공유 디렉터리(`/tmp` 등)에 생성될 수 있으므로, 생성 시 소유자만 읽기 가능한 권한으로 제한(POSIX 0600, Windows ACL) — 같은 머신의 다른 사용자가 캐시 파일로 프로젝트 경로·git 상태를 엿보는 것 방지

---

## 법률·저작권·라이선스·상업적 사용 요구사항

> 아래는 법률 자문이 아니다. 확인된 사실과 확인이 필요한 사항을 구분해 표기하며, 불확실하거나 해석이 필요한 부분은 **[법무 검토 필요]**로 명시한다.

### 라이선스 (Must Have)
- 프로젝트 라이선스: MIT (01_PRD.md §7에서 확정된 사실). 저작권자 이름·연도는 **[결정 필요]** — 사용자 본인 명의 또는 조직명 중 선택
- LICENSE 파일은 OSI 공식 MIT 템플릿 원문을 그대로 사용하고 `[year] [copyright holder]` 자리만 채운다(임의로 문구를 가감하지 않는다)
- LICENSE 파일(저장소 루트) · README `license` 배지 · `package.json`의 `license` 필드 세 곳의 표기를 항상 일치시킨다 — 불일치는 사용자에게 어느 쪽이 진짜인지 알 수 없게 만드는 실질적 위험

### 외부 코드·아이디어 재사용 범위 (Must Have)
- ccstatusline·starship-claude·claudeline·cc-statusline·CCometixLine·ccusage는 **기능 아이디어·아키텍처 패턴만 참고(벤치마킹)했고 코드를 복사하지 않았다** — 지금까지의 PRD 작성 과정에 한정된 확인된 사실. 실제 구현 단계에서 이 도구들의 코드를 발췌·차용한다면 각 프로젝트의 라이선스가 요구하는 저작권 고지(NOTICE 등)를 반드시 지킨다 — 각 도구의 정확한 라이선스 원문·재배포 조건은 **[법무 검토 필요]**(구현 착수 전 재확인)
- RESEARCH_SOURCES.md에 담긴 Claude Code 공식 문서의 예제 코드를 참고용으로 인용하는 것은 통상적인 개발 문서 인용 범위로 보이나, Anthropic 문서 자체의 이용약관은 **[법무 검토 필요]**(확인 안 됨)

### 상표권 (Should Have — [법무 검토 필요])
- 프로젝트명에 "cc-" 접두사·"Claude Code" 언급을 포함하는 것이 Anthropic의 상표·브랜드 가이드라인과 충돌하지 않는지 확인되지 않았다. ccstatusline·cc-statusline·claudeline 등 기존 커뮤니티 도구가 유사한 명명 관례를 이미 쓰고 있다는 건 리서치로 확인된 사실이지만, 이것이 "허용됨"을 보증하지는 않는다 — 배포 전 Anthropic 브랜드 가이드라인 확인 필요
- Anthropic 로고·아이콘을 플러그인 아이콘이나 홍보 자료에 무단 사용하지 않는다 (Must Have)

### 상업적 사용 범위 (Should Have)
- MIT 라이선스 기준으로는 수정·복제·포크·재배포·판매·서비스 운영·교육 자료 활용·회사/고객사 납품이 모두 허용된다(라이선스 조건 준수 전제) — 단 이는 "PulseLine 코드 자체"에 대한 것이고, Claude Code 플랫폼·마켓플레이스의 이용약관·개발자 정책은 별개 사안이다 **[법무 검토 필요]**
- 사용자가 별도로 확인해야 할 것: Claude Code 플러그인 마켓플레이스의 상업적 배포 허용 범위(공식/비공식 마켓플레이스 정책 차이)

### 예제 데이터·문서 (Must Have)
- README·가이드의 스크린샷·예제 stdin JSON에 실제 개인 프로젝트 경로·실명·사내 저장소 이름·비공개 API 정보가 포함되지 않도록 한다 — 항상 공식 문서의 mock 스키마(테스트 방법 섹션과 동일)만 예시로 사용

### AI 생성 콘텐츠 (Should Have)
- 이 PRD와 이후 생성될 코드는 AI(Claude)가 초안을 작성한다 — 최종 배포 전 사람이 검토해 기존 저작물과의 우연한 유사성, 저작권 침해 가능성이 없는지 확인하는 절차를 둔다(과장된 "AI가 생성했으니 문제없다"는 보장은 하지 않는다)

### README 필수 고지 (Must Have)
- README에 라이선스명·저작권자·허용/금지 범위를 비개발자도 이해할 수 있는 문장으로 명시(예: "이 코드는 자유롭게 고치고 팔아도 됩니다. 단, 원저작자 표시는 남겨야 합니다")
- "보증하지 않음(AS-IS, 책임 제한)" 문구를 MIT 표준 조항 그대로 두는 것 외에, 사람이 읽기 쉬운 말로 README에도 재진술

---

## 절대 하지 마 (DO NOT)

- [ ] 비공개/미문서화 API에 의존하지 마 (claudeline이 의존하는 `oauth-2025-04-20` 같은 베타 엔드포인트 금지 — 예고 없이 깨질 수 있음)
- [ ] Windows를 "나중에 폴백으로 지원"하는 방식으로 설계하지 마 — 처음부터 1급 대상으로 테스트할 것
- [ ] **사용자 PC에 Node.js가 설치돼 있다고 가정하지 마** — Claude Code가 2026-01부터 Node.js 없는 네이티브 설치를 공식 권장 경로로 쓰므로, 반드시 SEA로 빌드한 단일 실행파일을 배포할 것(순수 `node script.js` 실행 방식 금지)
- [ ] git 상태 조회 캐시 키에 프로세스 ID(`$$`, `os.getpid()`)를 쓰지 마 — 반드시 `session_id` 사용(공식 문서 권장사항)
- [ ] 0이 아닌 종료 코드를 내거나 stdout에 아무것도 출력하지 않는 상태로 배포하지 마 — 상태표시줄이 공백이 됨(공식 문서 troubleshooting에 명시된 실패 모드)
- [ ] 느린 작업(예: git diff)을 캐싱 없이 매 호출마다 실행하지 마 — 상태표시줄 업데이트가 완료될 때까지 UI가 막힘
- [ ] 브랜치명·커밋 메시지 등 외부 문자열을 `child_process.exec`(셸 문자열 결합)에 넣지 마 — 반드시 `execFile`(인자 배열)만 사용해 명령어 주입을 원천 차단할 것
- [ ] 경쟁 도구(ccstatusline 등)의 코드를 그대로 복사·붙여넣기 하지 마 — 아이디어·패턴 참고만 허용, 실제 코드 차용 시 반드시 원 라이선스의 고지 의무 확인 후 진행
- [ ] 라이선스 표기 없이(또는 LICENSE·README·package.json 표기가 서로 다른 채로) 배포하지 마
- [ ] API 키·토큰·비밀번호를 코드에 직접 쓰지 마 (MVP는 애초에 외부 인증이 필요 없는 구조이므로, Phase 3 이후 인증이 필요해지면 반드시 환경변수 사용)
- [ ] package.json의 기존 의존성 버전을 임의로 변경하지 마
- [ ] 목업 stdin JSON으로만 테스트하고 "완성"이라 하지 마 — 최소 1개 실제 OS(Windows PowerShell 단독 환경 권장)에서 실측 검증 필수

---

## 항상 해 (ALWAYS DO)

- [ ] 변경하기 전에 계획을 먼저 보여줘
- [ ] stdin JSON의 모든 필드는 `null`/누락 가능성을 전제로 폴백 처리 (공식 문서: `context_window.current_usage`는 `/compact` 직후 `null`)
- [ ] 각 위젯은 독립적으로 실패해도 나머지 위젯 렌더링에 영향 주지 않도록 격리(try/catch)
- [ ] 상태표시줄 스크립트는 100ms 미만 실행을 목표로 성능 측정
- [ ] Windows 경로는 슬래시(`/`)로 통일해서 `command` 문자열에 기록 (공식 문서: Git Bash가 백슬래시를 이스케이프 문자로 오인하는 문제 있음)
- [ ] 새 위젯 타입을 추가할 때는 02_DATA_MODEL.md의 Widget 엔티티 구조(type/position/enabled/source_field)를 그대로 따를 것

---

## 테스트 방법

```bash
# 로컬 실행 (mock 입력으로 수동 테스트)
echo '{"model":{"display_name":"Opus"},"workspace":{"current_dir":"/home/user/project"},"context_window":{"used_percentage":25},"session_id":"test-session"}' | node src/statusline.js

# 단위 테스트
node --test

# Windows PowerShell에서 수동 검증
powershell -NoProfile -Command "Get-Content mock.json | node src/statusline.js"
```

---

## 배포 방법

1. GitHub Actions 매트릭스 빌드(linux/macos/windows)로 SEA 바이너리 3종 생성 → GitHub 릴리스에 첨부
2. GitHub 저장소에 `.claude-plugin/marketplace.json`, `plugin.json` 커밋 (개인 저장소로 우선 출시 — 근거는 §7 참고)
3. 사용자는 `/plugin marketplace add {owner}/cc-pulseline` 로 마켓플레이스 등록
4. `/plugin install cc-pulseline@cc-pulseline` 로 설치 → 설치 스크립트가 OS 감지 후 해당 SEA 바이너리 다운로드
5. `/pulseline:setup` 실행 → `~/.claude/settings.json`(또는 프로젝트 로컬 `.claude/settings.json`)에 `statusLine.command` 자동 기록
6. 버전 업데이트는 `plugin.json`의 `version` 필드를 올리고 GitHub 릴리스 태그로 관리

> **Windows 코드서명 주의**: 미서명 SEA 바이너리는 Windows SmartScreen 경고가 뜬다(Node.js 공식 문서로 확인된 사실). Phase 1은 무료로 "SmartScreen 우회 방법" 안내 문서를 제공하고, EV/OV 코드서명 인증서 구매는 실사용자 피드백을 본 뒤 Phase 2 이후 예산 결정 사항으로 분리한다.

---

## 환경변수

| 변수명 | 설명 | 어디서 발급 |
|--------|------|------------|
| 해당 없음(Phase 1~2) | MVP는 외부 API·인증을 사용하지 않음 — stdin JSON만으로 동작 | - |

> Phase 3에서 외부 API 연동이 추가될 경우 이 표를 갱신하고, 반드시 `.env.local`에 저장 + `.gitignore` 등록 규칙(aurakit-security.md)을 따를 것.

---

## README·가이드 문서 요구사항 (구현 완료 후 반드시 작성)

> 코드 구현과 별개로, 배포 전 아래 항목을 모두 담은 README와 가이드 문서를 작성해야 완료로 간주한다. 대상 독자는 **비개발자·코딩을 한 번도 안 해본 사람·컴퓨터/전자기기를 처음 다루는 사람**을 기준으로 하며, 개발자는 이보다 쉬운 문서를 이해하는 데 문제가 없으므로 항상 "가장 쉬운 눈높이"에 맞춘다.

### 포함해야 할 항목 (Must Have)
1. **사전 준비물·필요 프로그램**: Claude Code(v2.1.153 이상, 버전 확인 방법 포함), 운영체제별 최소 요구사항. "Node.js가 필요 없다"는 점을 명시적으로 강조(SEA 배포이므로 — 사용자가 오해해서 Node.js를 따로 설치하지 않도록)
2. **다운로드·설치 방법**: `/plugin marketplace add {owner}/cc-pulseline` → `/plugin install` 순서를 캡처·그림과 함께 번호 매겨 단계별로. "마켓플레이스"·"플러그인" 같은 용어가 처음 나올 때 괄호로 짧은 설명 추가(예: "마켓플레이스(플러그인을 모아둔 상점 같은 곳)")
3. **빠른 시작(Quick Start)**: 설치부터 첫 상태표시줄 표시까지 5단계 이내로 압축한 요약 섹션을 최상단에 배치(자세한 설명은 아래로)
4. **실행·사용·작동 방법**: `/pulseline:setup` 실행 화면 예시, 각 질문에 어떻게 답하면 되는지 예시 답변 포함
5. **명령어 목록**: `/pulseline:setup` 등 전체 슬래시 명령을 표로 정리(명령어 / 하는 일 / 예시)
6. **워크플로우**: 설치→설정→반영까지 그림(ASCII 다이어그램 또는 플로우차트)으로 시각화
7. **보안·데이터 흐름 설명**: "이 도구가 내 컴퓨터 밖으로 어떤 정보를 보내는가?"에 대한 답 — PulseLine은 외부로 아무것도 보내지 않는다는 점을 비개발자도 안심할 수 있는 말로 명시("여러분의 코드나 대화 내용을 어디로도 보내지 않습니다")
8. **아키텍처 개요**: 개발자용 상세 다이어그램은 별도 문서(예: `ARCHITECTURE.md`)로 분리하고, README에는 "한 문단 요약"만
9. **파일·문서 위치 안내**: 설정 파일이 실제로 어디에 저장되는지(`~/.claude/settings.json` 등 OS별 경로), "이 파일을 직접 열어봐도 되는지/안전한지" 안내
10. **문제 해결(트러블슈팅)**: 아래 "예상 문제 목록" 전체를 "증상 → 원인 → 해결 방법" 3단 구조로 수록
11. **FAQ**: 아래 "예상 질문 목록" 반영
12. **법률·저작권·라이선스·상업적 용도**: 위 "법률·저작권·라이선스·상업적 사용 요구사항" 섹션 내용을 비개발자용 문장으로 재진술

### 비개발자 눈높이 작성 기준 (Must Have)
- 전문 용어(stdin, JSON, 환경변수, 바이너리 등) 최초 등장 시 반드시 괄호 안에 일상 비유로 설명
- 모든 절차는 번호 매긴 단계로, 한 단계에 한 동작만
- 터미널/명령창을 한 번도 안 써본 사람을 가정해 "이 화면이 뭔지", "어디에 붙여넣는지"부터 설명
- 스크린샷 또는 ASCII 목업으로 "실제로 어떻게 보이는지" 시각 자료 포함
- "이해 안 되면 이 부분은 건너뛰어도 된다"는 안내를 심화 설명 앞에 표시해 부담을 줄임

### 예상 문제·불편·위험·오류·변수·충돌·실패 목록 (README 트러블슈팅에 반드시 반영, Must Have)
- **설치 후 상태표시줄이 안 보임**: 워크스페이스 신뢰(trust) 프롬프트 미수락, `disableAllHooks` 설정, 스크립트 실행 권한 누락(공식 문서 트러블슈팅과 동일 원인)
- **Windows에서 "이 앱을 실행할 수 없습니다" 또는 SmartScreen 경고**: 미서명 바이너리이기 때문 — 왜 뜨는지, 안전한지 어떻게 확인하는지, 우회 방법을 단계별로
- **글자가 깨지거나 이상한 기호가 보임**: 터미널이 이모지·색상·Nerd Font·OSC8 하이퍼링크를 지원하지 않는 경우(Phase 3 파워라인 테마 한정) — 지원 터미널 목록과 대체(plain 모드) 안내
- **컨텍스트 퍼센트가 `/context` 명령 결과와 다르게 보임**: 계산 시점 차이로 인한 정상 현상(공식 문서에 이미 명시된 사실) — "버그가 아닙니다"를 명확히
- **설정을 바꿨는데 바로 안 바뀜**: Claude Code와의 다음 상호작용 전까지 반영 안 되는 게 정상(공식 문서 확인 사실)
- **여러 프로젝트를 동시에 열어놨을 때 캐시가 꼬이는 것처럼 보임**: session_id 기반 캐시라 실제로는 안 꼬이지만, "왜 안전한지" 설명 필요
- **업데이트 후 기존 설정이 사라진 것처럼 보임**: 설정 파일 마이그레이션 정책 명시(향후 버전에서 다뤄야 할 사항, 지금은 [NEEDS CLARIFICATION])
- **회사·학교 등 관리된 PC에서 설치가 막힘**: 관리자 권한 필요 여부, IT 부서에 문의해야 하는 상황 안내

### 예상 질문(FAQ) 목록 (Must Have, 최소 이 항목들 포함)
- "이거 설치하면 내 코드나 대화 내용이 어디로 전송되나요?" → 안 됨, 왜 안전한지
- "돈이 드나요?" → 무료, MIT 라이선스가 뭔지 한 줄 설명
- "Node.js를 따로 설치해야 하나요?" → 아니요
- "지워도 원래대로 돌아가나요?" → 삭제 방법과 원상복구 여부
- "Mac에서도 되나요? 리눅스는요?" → 지원 OS 명시
- "회사 프로젝트에 써도 되나요? 팔아도 되나요?" → 라이선스 기준으로 답 (§ 법률 섹션 연동)

---

## [NEEDS CLARIFICATION]

- [x] ~~패키지 매니저 통일 여부~~ → npm으로 확정(위 기술 스택 표 참고)
- [x] ~~최소 지원 Claude Code 버전~~ → v2.1.153 이상으로 확정(위 기술 스택 표 참고)
- [ ] Windows 코드서명 인증서 구매 여부 및 예산 — Phase 1은 무료 우회 안내로 시작, 확정은 실사용자 피드백 이후로 보류(의도적 보류, 근거는 위 "배포 방법" 참고)
- [ ] SEA 빌드 크기 최적화 필요 여부 — Node.js 런타임 전체가 바이너리에 포함되므로 파일 크기가 커질 수 있음(수십 MB 단위 예상). 마켓플레이스 다운로드 경험에 문제 없는지 실측 필요
- [ ] **(신규, 법무 검토 필요)** LICENSE 파일의 저작권자 이름·연도 확정
- [ ] **(신규, 법무 검토 필요)** "cc-" 접두사·"Claude Code" 언급을 프로젝트명·설명에 쓰는 것이 Anthropic 상표·브랜드 가이드라인에 저촉되지 않는지 확인
- [ ] **(신규, 법무 검토 필요)** Claude Code 플러그인 마켓플레이스의 상업적 배포 허용 범위(공식/비공식 마켓플레이스 정책)
