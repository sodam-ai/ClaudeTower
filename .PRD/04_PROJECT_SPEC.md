# ClaudeTower (claudetower) — 프로젝트 스펙

> **[2026-07-15 결정] Account 모듈(Phase 2)은 보류 확정 — Anthropic 공식 이용약관 확인 결과
> 안전한 구현 방법이 없다(`.PRD/07_OAUTH_FLOW_SPEC.md §3` 참고). `src/accounts/`·`test/accounts/`
> 코드는 삭제됐다(또는 삭제 진행 중). 아래 "프로젝트 구조"·"테스트 방법"의 accounts 관련 서술은
> 과거 설계 기록으로만 남긴다 — 실제 트리와 다를 수 있다.

> AI가 코드를 짤 때 지켜야 할 규칙과 절대 하면 안 되는 것.
> 이 문서를 AI에게 항상 함께 공유하세요.
> **이 프로젝트는 위험도가 다른 두 모듈(Display/Account)을 한 저장소에 담는다 — 모듈 경계를 지키는 것이 이 문서 전체에서 가장 중요한 규칙이다.**

---

## 기술 스택

| 영역 | 선택 | 이유 |
|------|------|------|
| 개발 언어 | JavaScript (Node.js API), 두 모듈 모두 동일 | PulseLine·QuotaSwitch 각각의 기존 근거를 계승 — Windows/Mac/Linux 동일 코드, JSON 내장 파싱 |
| 배포 바이너리 | Node.js SEA (Single Executable Application) | Claude Code가 2026-01부터 Node.js 없는 네이티브 설치를 권장 경로로 쓰므로(공식 문서 확인), 사용자 PC의 Node.js 설치 여부와 무관하게 동작해야 함(PulseLine 원 근거 계승) |
| **모듈 격리 구조** | `src/display/`(자격증명 접근 없음)와 `src/accounts/`(자격증명 다룸) 디렉토리 완전 분리, 빌드 시에도 별도 엔트리포인트 | 통합 과정에서 신규 결정 — 코드 레벨 분리 없이는 "위험 격리"가 문서상의 약속으로만 남고 실제로 강제되지 않음 |
| Account 모듈 프로세스 격리 | Account 모듈(프록시·자격증명 로직)은 Display 모듈과 별도 Node.js 프로세스로 실행 | 하나의 프로세스에 다 넣으면 메모리 상에서도 격리가 무의미해짐 — 프로세스 경계가 실질적인 보안 경계 |
| 배포 방식 | **독립 CLI(1순위)** + Claude Code Plugin Marketplace(3순위, 선택적 보조 채널) | 2026-07-04 재검토: teamclaude가 `eval $(teamclaude env) claude` 패턴으로 재시작 문제·인증 헤더 불확실성을 원천 제거한다는 걸 확인 — 마켓플레이스 방식보다 CLI가 "더 편하고 쉽고 강력하고 안전하고 문제없다"는 사용자 조건을 충족(01_PRD.md 근거 참고). 설치 1개라는 원 요구사항은 CLI 바이너리 하나로 오히려 더 잘 지켜짐 |
| CLI 실행 진입점 | `claudetower setup` / `claudetower accounts *` / `claudetower`(Claude Code를 프록시 환경으로 감싸 실행, teamclaude `run` 벤치마킹) | 계정 등록·조회·삭제·상태표시줄 설정을 모두 하나의 바이너리에서 처리, Claude Code 세션 여부와 무관하게 터미널에서 직접 실행 가능 |
| CI 빌드 | GitHub Actions 매트릭스(linux/macos/windows) | SEA 크로스 컴파일 제약(공식 문서 확인) — PulseLine·QuotaSwitch 원 근거 계승 |
| 자격증명 저장(Account 모듈만) | OS 네이티브 저장소 우선(Windows Credential Manager/DPAPI, macOS Keychain, Linux libsecret) | QuotaSwitch 원 근거 계승 — Display 모듈에는 해당 없음(자격증명 자체를 다루지 않음) |
| 캐싱(Display, Phase 3) | 파일 기반, session_id 키 | PulseLine 원 근거 계승 |
| 테스트 | Node.js 내장 test runner, Display/Account 모듈 별도 테스트 스위트 | 격리 검증을 위해 "Account 모듈 없이 Display 단독 테스트"가 항상 가능해야 함 |

---

## 프로젝트 구조 (2026-07-04 CLI 전환 반영)

```
claudetower-cli/
├── bin/
│   └── claudetower.js                # CLI 진입점 — 서브커맨드 라우팅(setup/accounts/run 등)
├── src/
│   ├── display/                # ============ Display 모듈 (위험 없음) ============
│   │   ├── statusline.js        # settings.json에 등록되는 렌더러 — stdin JSON 읽고 렌더링
│   │   ├── platform/
│   │   ├── widgets/               # location, context, cost, rate_limit, active_account(Phase3)
│   │   ├── config/
│   │   └── cache/
│   ├── accounts/                # ============ Account 모듈 (자격증명 다룸, opt-in) ============
│   │   ├── proxy/
│   │   ├── accounts/
│   │   ├── rotation/
│   │   ├── credential-store/
│   │   └── audit/
│   └── shared/
│       └── active-account-handle.js   # ActiveAccountHandle 파일 읽기/쓰기 — Account는 쓰기 함수만, Display는 읽기 함수만 import
├── plugin/                        # Phase 3, 선택적 보조 채널 — CLI를 그대로 호출하는 얇은 래퍼
│   └── .claude-plugin/
│       ├── plugin.json
│       └── marketplace.json
├── test/
│   ├── display/                 # Account 모듈 없이도 통과해야 함
│   └── accounts/
├── README.md                     # 최상단에 "Account 모듈 = 선택 사항 + 리스크 고지" 명시
└── package.json
```

---

## 보안 요구사항 (OWASP ASVS / Secure by Design 매핑)

> 보안은 선택 항목이 아니라 핵심 요구사항이다. Display 모듈과 Account 모듈은 위험 등급이 다르므로 항목을 모듈별로 구분한다.

### 모듈 경계 보안 (신규 — Must Have, 이 프로젝트 고유)
- Display 모듈 코드는 어떤 상황에서도 `src/accounts/` 하위 모듈을 `require`/`import`하지 않는다 — 정적 분석(lint 규칙)으로 강제
- `ActiveAccountHandle`은 `src/shared/`에서 읽기 함수와 쓰기 함수를 물리적으로 분리된 export로 제공하고, Display는 읽기 함수만, Account는 쓰기 함수만 import 가능하게 한다
- `ModuleActivationState.enabled === false`일 때 Account 모듈 프로세스 자체가 기동되지 않는다(단순 조건문으로 기능을 숨기는 게 아니라 프로세스 스폰 자체를 안 함)

### 인증/인가 (ASVS V2/V4)
- Display 모듈: 해당 없음(로그인 기능 없음, PulseLine 원 판단 계승)
- Account 모듈(Must Have): Anthropic 공식 OAuth 흐름만 사용, `state` 파라미터 CSRF 검증, 로컬 프록시 접근 토큰 검증(127.0.0.1 바인딩만으로 접근 통제 끝났다고 가정하지 않음) — QuotaSwitch 원 요구사항 전체 계승

### 입력값 검증 (ASVS V5) — Must Have
- Display: stdin JSON을 신뢰하지 않는 입력으로 취급, 위젯 단위 격리(PulseLine 원 요구사항 계승)
- Account: 계정 label 등 사용자 입력값, API 응답 malformed 대응(QuotaSwitch 원 요구사항 계승)

### 인젝션 방지 (ASVS V5.3) — Must Have
- Display: git 브랜치명 등을 `child_process.execFile`(인자 배열)로만 처리, `exec` 금지(PulseLine 원 요구사항)
- Account: 헤더 인젝션(CRLF) 방지, 셸 명령은 `execFile`만(QuotaSwitch 원 요구사항)

### 비밀정보 관리 (ASVS V6/V9) — Must Have
- Display: Phase 1~2는 비밀정보 없음, Phase 3 외부 API 연동 시 환경변수/OS 저장소 사용
- Account: OAuth 토큰·API 키를 코드/로그/Git에 절대 노출하지 않음, OS 자격증명 저장소만 사용, `.gitignore`로 로컬 설정·감사 로그 제외
  - **확인된 사실(2026-07-04 재검토)**: teamclaude는 `~/.config/teamclaude.json`에 `accessToken`·`refreshToken`·프록시 `apiKey`를 평문으로 저장한다(실측 확인) — 이 파일 유출 시 모든 계정이 즉시 탈취되는 구체적 실패 사례. Account 모듈이 OS 자격증명 저장소를 고집하는 이유가 가설이 아니라 실제 경쟁 도구의 증명된 약점임

### 세션/토큰 관리 (ASVS V3/V6) — Must Have (Account 모듈만 해당)
- 토큰 만료 시각 저장 + 자동 갱신, 로컬 프록시 접근 토큰은 프로세스 재시작마다 재생성(디스크 미저장), nonce/state 1회용

### 보안 설정 (ASVS V14) — Should Have
- 두 모듈 모두: 디버그 로그 기본 OFF, 활성화해도 토큰/민감정보 마스킹 유지
- Account: `Origin`/`Referer` 헤더 검사로 브라우저발 요청(DNS 리바인딩) 차단, CORS 응답 미노출

### 의존성 보안 (ASVS V14.2) — Should Have
- CI에 `npm audit` 고위험 항목 검사, Display 모듈은 런타임 의존성 0개 목표(Account 모듈은 OS 자격증명 라이브러리 필요)

### DB/스토리지 권한 (ASVS V12) — Must Have (Account), Could Have (Display)
- Display: CacheEntry(Phase 3) 파일 소유자 전용 권한
- Account: RotationEvent 감사 로그 소유자 전용 권한, CredentialRef는 OS 저장소의 기본 접근 제어를 신뢰(중복 암호화 안 함)

---

## 법률·저작권·라이선스·상업적 사용 요구사항

> 법률 자문이 아니다. 확인된 사실과 [법무 검토 필요]를 구분한다.

### 라이선스 (Must Have)
- **확정**: Apache License 2.0, 저작권자 "SoDam AI Studio", 연도 2026(2026-07-03 확정, 기존 "MIT 제안" 방향에서 최종 변경)
- LICENSE·README·package.json 세 곳 표기 일치(확인 완료)

### 외부 코드·아이디어 재사용 (Must Have)
- ccstatusline·starship-claude·claudeline·cc-statusline·CCometixLine·ccusage·teamclaude·claude-swap·caam은 **아이디어·패턴만 참고, 코드 미복사**(양 프로젝트 원 판단 계승) — 실제 차용 시 각 라이선스의 고지 의무 [법무 검토 필요]

### 상표권 (Should Have — [법무 검토 필요])
- "cc-" 접두사·"Claude" 언급이 Anthropic 상표 가이드라인에 저촉되지 않는지 확인 필요(양 프로젝트 공통 이슈)

### API 이용정책·상업적 사용 (Must Have — [법무 검토 필요] 다수)
- **핵심 리스크**: Account 모듈이 이 플러그인에 포함되는 이상, 여러 계정 자동 순환의 이용약관 충돌 가능성(QuotaSwitch 원 리스크)이 **플러그인 전체**에 적용된다 — Display 모듈만 쓰는 사용자에게도 이 리스크가 "잠재적으로 딸려온다"는 점을 README에서 명확히 구분 설명해야 함(신규 발견, 01_PRD.md §7과 연동)
- **2026-07-14 확인됨(더 이상 가능성이 아니라 확정된 충돌)**: `code.claude.com/docs/en/legal-and-compliance` 1차 출처 직접 확인 결과, Anthropic이 서드파티 도구의 Free/Pro/Max 구독 OAuth 자격증명 사용을 명시적으로 금지하고 2026-01-09부터 서버 측에서 기술적으로 차단 중임을 확인(복수 독립 소스 교차검증, 상세는 `.PRD/07_OAUTH_FLOW_SPEC.md §3-1`). Account 모듈을 현재 명세대로 구현하는 것은 권장하지 않음 — 사용자 결정 대기 중(CHECKPOINT.md 트랙3).
- MVP는 무료·개인 사용 목적으로만 배포, 상업적 판매·유료 서비스화·회사 납품은 Out of Scope(양 프로젝트 원 판단 계승, Account 모듈 포함으로 인해 플러그인 전체에 적용)

### 개인정보·민감정보 (Must Have)
- Account 모듈의 계정 라벨·감사 로그는 로컬에만 저장, 외부 전송 없음
- 예제 데이터(README·테스트)에 실제 이메일·사번·고객사명 등 식별 정보 미포함

---

## README·가이드 문서 요구사항 (구현 완료 후 반드시 작성)

> 대상 독자는 비개발자·코딩을 한 번도 안 해본 사람 기준. **이 프로젝트는 위험도가 다른 두 기능을 한 플러그인에 담으므로, "무엇이 안전하고 무엇에 동의가 필요한지"를 README 구조 자체로 분리해서 보여줘야 한다.**

### 문서 구조 요구사항 (Must Have, 신규)
- README를 "① 상태표시줄(항상 안전, 설치만 하면 끝)"과 "② 계정 자동전환(선택 사항, 리스크 있음, 동의 필요)" 두 섹션으로 명확히 분리 — 사용자가 ①만 읽고 설치해도 충분히 안전하게 쓸 수 있어야 함
- ② 섹션 최상단에 "이 기능은 여러분의 Claude 계정이 정지될 수도 있는 위험이 있습니다. 켜지 않아도 상태표시줄은 정상 작동합니다"를 굵은 글씨로 명시

### 포함해야 할 항목 (Must Have, 두 프로젝트 원 요구사항 통합)
1. 사전 준비물·필요 프로그램(Claude Code 버전, Node.js 불필요 명시, Account 기능은 계정 2개 이상 필요)
2. 다운로드·설치 방법(마켓플레이스, 캡처·번호매김)
3. 빠른 시작(① Display만 쓰는 5단계 이내 요약을 최상단에, ② Account까지 쓰는 경로는 별도 섹션)
4. 실행·사용·작동 방법, 명령어 목록(`claudetower setup`, `claudetower accounts enable/disable`, `claudetower accounts`(목록·상태, 세션(5h)·주간(7d) 사용률 기본 표시, `--history`는 Phase 3 부가 기능), `claudetower account-remove`(삭제, 완전삭제 검증), `claudetower account-rename`(라벨 수정), `claudetower account-purge`(전체 초기화), `claudetower config`(옵션 설정) — 상세 요구사항은 QuotaSwitch 04_PROJECT_SPEC.md "계정 관리(CRUD) 요구사항", "옵션 설정 요구사항", "계정별 사용량 표시 요구사항"(2026-07-04 재확인) 원 설계 참고)
5. 워크플로우 그림(① 설치→즉시 사용, ② 동의→등록→재시작→자동전환 — 두 그림 분리)
6. 보안·데이터 흐름 설명(① "아무것도 외부로 안 보냄", ② "계정 정보는 내 컴퓨터의 안전한 금고에만 저장, 어디로도 전송 안 됨" — 비유로 설명)
7. 아키텍처 개요(모듈이 분리되어 있다는 것을 비개발자도 알 수 있는 비유: "상태표시줄은 그냥 화면 보여주는 부분이고, 계정전환은 완전히 다른 방에서 따로 작동합니다")
8. 파일·문서 위치, 트러블슈팅, FAQ (아래 목록 반영)
9. 법률·저작권·라이선스·상업적 용도(비개발자용 문장으로)

### 예상 문제·위험 목록 (PulseLine·QuotaSwitch 각 원 목록 통합, Must Have)
- Display: 상태표시줄 미표시(권한/신뢰 미수락), Windows SmartScreen 경고, 글자 깨짐, 컨텍스트 퍼센트 불일치(정상), 설정 변경 후 즉시 미반영
- Account: 재시작 깜빡함, 포트 충돌, OAuth 브라우저 미자동 실행, 계정 중복 로그인 충돌, OS 자격증명 저장소 접근 실패, 보안 소프트웨어 차단, VPN 환경 미검증(정직하게 "이론상"으로 표기), **가장 심각 — 이용약관 위반 계정 정지 가능성**
- **신규(통합 특유)**: "상태표시줄만 쓰려고 설치했는데 계정 관련 권한을 요구한다"는 오해 — 설치 시점에는 Account 모듈이 전혀 활성화되지 않는다는 것을 FAQ 최상단에 배치

### 예상 질문(FAQ) 목록 (통합, Must Have)
- "설치하면 자동으로 제 계정 정보를 가져가나요?" → 아니요, `/claudetower:enable-accounts`로 명시적으로 켜기 전까지 Account 관련 코드는 실행조차 되지 않음
- (이하 PulseLine·QuotaSwitch 원 FAQ 목록 전체 포함 — 각 04_PROJECT_SPEC.md 참고)

---

## 절대 하지 마 (DO NOT)

- [ ] Display 모듈 코드에서 `src/accounts/`를 import하지 마 (모듈 경계 위반, 이 프로젝트 최우선 규칙)
- [ ] `ModuleActivationState.enabled`가 false인데 Account 모듈 프로세스를 기동하지 마
- [ ] 브랜치명 등 외부 문자열을 `child_process.exec`(문자열 결합)에 넣지 마 — `execFile`만
- [ ] OAuth 토큰·API 키를 평문 파일·로그에 쓰지 마
- [ ] 프록시를 `0.0.0.0`에 바인딩하지 마, 로컬 접근 토큰 검증 없이 요청 처리하지 마
- [ ] OAuth `state` 검증 없이 토큰 교환 진행하지 마
- [ ] "Account 모듈을 켜지 않으면 안전하다"는 문서 설명 없이 배포하지 마
- [ ] MVP를 상업적 판매·유료 서비스·회사 납품 목적으로 배포하지 마
- [ ] 라이선스 표기 불일치 상태로 배포하지 마
- [ ] 경쟁 도구 코드를 그대로 복사하지 마

## 항상 해 (ALWAYS DO)

- [ ] 변경 전 계획을 먼저 보여줘
- [ ] Display/Account 모듈 테스트를 항상 분리해서 실행하고, Display 단독 테스트가 Account 모듈 없이도 통과하는지 확인
- [ ] stdin JSON, 계정 입력값 등 모든 외부 입력을 신뢰하지 않는 것으로 취급
- [ ] 재시작·동의 절차가 필요한 시점마다 근거와 함께 명확히 안내
- [ ] 계정 전환 시 RotationEvent 기록
- [ ] Windows 경로는 슬래시(`/`)로 통일

---

## 테스트 방법

```bash
# Display 모듈 단독 테스트 (Account 모듈 없이 통과해야 함)
node --test test/display

# Account 모듈 테스트 (mock 계정/할당량)
node --test test/accounts

# 모듈 격리 검증 (정적 분석)
grep -r "require.*accounts" src/display && echo "FAIL: 모듈 경계 위반" || echo "PASS"
```

---

## 배포 방법 (2026-07-04 CLI 전환 반영)

1. GitHub Actions 매트릭스 빌드(linux/macos/windows)로 SEA 바이너리 생성
2. **1순위 채널(독립 CLI)**: `npm install -g claudetower`(Node.js 있는 사용자, 패키지명은 `claudetower-cli`가 아니라 실제 package.json 기준 `claudetower`) 또는 curl(`curl -fsSL .../install.sh | sh`)·PowerShell(`irm .../install.ps1 | iex`) 설치 스크립트로 SEA 바이너리 직접 배치 — teamclaude·claude-swap·caam 등 리서치된 대다수 CLI 도구와 동일한 설치 UX
3. `claudetower setup` 실행 → Display 즉시 활성화, Account 모듈은 `claudetower accounts enable` 실행 전까지 비활성
4. **3순위 채널(선택적, Phase 3)**: `plugin/.claude-plugin/`의 얇은 래퍼를 마켓플레이스로 배포 — `/claudetower:*` 슬래시 명령이 내부적으로 설치된 CLI를 호출하는 방식. 마켓플레이스 발견성을 원하는 사용자를 위한 보조 경로일 뿐, 핵심 기능은 CLI 단독으로 완결됨

### 배포 현황 (2026-07-04 실측)

| 채널 | 상태 | 근거 |
|---|---|---|
| GitHub Release 직접 다운로드 | ✅ 가능 | `github.com/sodam-ai/ClaudeTower/releases`, 최신 `v0.1.9` |
| curl/PowerShell 원라이너 | ✅ 가능 | `main` 브랜치 개설(이전엔 브랜치 부재로 raw URL 404) + v0.1.9 릴리스. `irm .../main/install.ps1 \| iex`를 격리 환경에서 실행해 다운로드→설치→`--version` 응답까지 실측 |
| `npm install -g` | ⏸️ 의도적 보류 | 프로젝트명("claudetower")이 아직 가제이고 상표 저촉 여부가 `01_PRD.md §7` 기준 [법무 검토 필요] 상태. npm 패키지명은 사실상 영구 점유라 이름 확정 전 발행 안 함 |
| 마켓플레이스(Phase 3) | 미착수 | 원 계획대로 Phase 3까지 보류 |
| 기본 브랜치 | `main`(2026-07-04부터, 이전엔 `feat/phase1-mvp-skeleton`이 기본) |  |

---

## 환경변수

| 변수명 | 설명 |
|--------|------|
| `ANTHROPIC_BASE_URL` | Account 모듈 활성화 시에만 프록시가 자동 기록. Display 모듈만 쓰면 이 변수 자체가 설정되지 않음 |

> 계정별 OAuth 토큰은 환경변수가 아니라 OS 자격증명 저장소에 저장.

---

## [NEEDS CLARIFICATION]

- [x] ~~LICENSE 저작권자 이름·연도~~ → **2026-07-03 확정**: Apache License 2.0, 저작권자 "SoDam AI Studio", 2026년(라이선스 §"라이선스 (Must Have)" 참고)
- [x] ~~"cc-" 접두사·상표 저촉 여부~~ → **2026-07-15 조사 완료, 결정: 이름 유지(낮은 우선순위
  잔존 리스크로 기록)**. Anthropic 공식 Trademark Guidelines(`anthropic.com/legal/
  trademark-guidelines`, 1차 출처 직접 확인, 2024-08-01 발효) — "You may only use our
  trademarks as specifically permitted by us" — 허가제 구조라 "ClaudeTower"라는 이름이 이
  가이드라인 문언 기준으로는 안전을 보장받지 못함(이론적 리스크는 확인됨). 다만 실질 위험은
  낮게 평가: (1) 이 프로젝트가 참고한 경쟁 도구 다수(`teamclaude`/`claude-swap`/`ClaudeLine`/
  `starship-claude`/`CCometixLine`)도 이름에 "Claude"를 포함한 채 계속 운영 중 — 소규모
  커뮤니티 도구 이름까지 적극 단속하는 정황은 확인 안 됨. (2) 오늘 확인한 Anthropic의 실제
  집행 사례(OAuth 서버측 차단)는 약관 우회 사용에 대한 조치였지 이름 문제가 아니었음(종류가
  다른 리스크). (3) 비상업적 배포. (4) GUIDE.md에 이미 "Anthropic과 무관함" 비제휴 고지
  존재. **재검토 조건**: 프로젝트 사용자 규모가 크게 늘거나, Anthropic으로부터 직접 연락이
  오는 경우. 참고용 정리이며 법적 효력을 보장하지 않음 — 실제 확정 판단은 변호사 확인 권장.
- [x] ~~로컬 프록시 접근 토큰 실제 구현 방식~~ → **2026-07-04 CLI 전환으로 해결**. 마켓플레이스 방식에서는 "Claude Code가 커스텀 헤더를 지원하는지" 불확실했지만, CLI가 `eval $(claudetower env) claude` 패턴으로 Claude Code를 직접 실행하므로 CLI가 요청 경로 전체(프록시 주소, 접근 토큰 전달 방식)를 스스로 통제한다 — 더 이상 Claude Code의 미문서화 동작에 의존하지 않음
- [x] ~~프록시 포트 충돌 정책~~ → **2026-07-04 사용자 요청으로 자동 재시도+포트 변경 채택**(이전 teamclaude 단순종료 방식은 폐기). 최초 설정은 순차 자동 탐색으로 완전 자동화, 런타임 재시작 시엔 backoff 후 자동 전환하되 "재시작 필요"를 안내(ANTHROPIC_BASE_URL이 프로세스 시작 시에만 읽히는 구조적 제약 때문에 완전 무중단은 불가능 — 상세 근거·정책은 QuotaSwitch 04_PROJECT_SPEC.md "포트 충돌 처리" 섹션, ClaudeTower Account 모듈도 동일 적용)
- [x] ~~OS별 자격증명 저장소 라이브러리 최종 선택~~ → **2026-07-11 확정**: `@napi-rs/keyring`(Rust 기반, keyring-rs 바인딩). 근거: `keytar`(atom/node-keytar)는 2022-12 아카이브로 사실상 죽음, 활성 포크 `@github/keytar`도 구식 C++ 애드온이라 Linux에서 여전히 `libsecret` 외부 시스템 의존성이 필요해 01_PRD.md 핵심가치("설치 한 번으로 끝")와 충돌. `@napi-rs/keyring`은 Windows Credential Manager/DPAPI·macOS Keychain·Linux Secret Service를 전부 지원하면서 Linux libsecret 의존성이 없고(자체 완결), 최근까지 활발히 유지보수되며 Azure SDK·Microsoft Authentication Library가 keytar에서 이 라이브러리로 이전 중임을 확인(WebSearch 근거). `cross-keychain`(이 라이브러리를 감싸는 추상화 계층)은 YAGNI로 채택하지 않음. **`npm install`은 아직 하지 않음** — M6 게이트(2026-07-14까지 Phase 2 실동작 착수 보류) 준수 중이므로 결정만 기록하고 실제 설치·연동은 게이트 이후로 미룸. 결정 근거와 인터페이스 스텁은 `src/accounts/credential-store/index.js` 참고.
- [x] ~~Windows 코드서명 인증서 구매 여부~~ → **2026-07-17 조사 완료, 결론: 지금은 구매하지
  않는다(재검토 조건 명확화)**. 원래 "실사용자 피드백 이후로 보류"였고 2026-07-17에 사용자
  1명이 실제 설치·사용을 확인해 그 조건 자체는 기술적으로 충족됐지만, 실제 조사 결과 지금
  사는 건 돈 낭비 위험이 크다는 걸 확인함: (1) **2024년 이후로는 EV 인증서도 더 이상 즉시
  SmartScreen 신뢰를 주지 않는다** — OV·EV 둘 다 다운로드 볼륨(보통 수백~수천 건, 2~8주)에
  따라 서서히 신뢰도가 쌓이는 방식으로 바뀜(WebSearch 근거, Microsoft Learn/커뮤니티 다수
  소스 교차확인). (2) ClaudeTower의 실사용자는 현재 사실상 1명이라, 지금 인증서를 사도
  SmartScreen 경고가 사라질 만큼의 설치량에 도달하기까지 오래 걸리거나 아예 도달하지 못할
  가능성이 높음. (3) 대안으로 Microsoft의 신규 서비스 Trusted Signing(현재 명칭 Azure
  Artifact Signing, $9.99/월부터)이 기존 OV(연 $200~300대)보다 저렴하지만 개인 개발자는
  미국·캐나다 거주자만 현재 가입 가능(정부 발급 신분증+생체 인증 필요) — 거주국 확인 안
  됨. (4) 2026-03-01부터 인증서 최대 유효기간이 39개월에서 460일로 줄어(CA/Browser Forum
  Ballot CSC-31) 다년 할인도 사라짐 — 지금 사도 곧 재발급해야 함. **재검토 조건 갱신**: "실
  사용자 피드백 존재" → "**설치량이 SmartScreen 신뢰도가 실제로 쌓일 만큼(수백 건 단위)으로
  늘어날 때**"로 구체화. 그때까지는 README/GUIDE의 기존 "추가 정보→실행" 우회 안내로 대응.
- [ ] Display 모듈만 담은 경량판을 별도 배포할지 여부(01_PRD.md §7 연동)