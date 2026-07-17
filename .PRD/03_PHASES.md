# ClaudeTower (claudetower) — Phase 분리 계획

> **[2026-07-15 결정] Phase 2(Account 모듈)는 보류 확정 — Anthropic 공식 이용약관(구독제 OAuth
> 서드파티 사용 금지 + 자동화 접근 금지, `.PRD/07_OAUTH_FLOW_SPEC.md §3` 참고) 확인 결과 안전한
> 구현 방법이 없다.** ClaudeTower는 Display 전용 도구로 유지한다. Phase 2에 의존하는 Phase 3
> (계정 표시 연동 위젯 등)도 연쇄적으로 보류된다 — 아래 Phase 2·3 서술은 검토 기록으로만 남긴다.

> 한 번에 다 만들면 복잡해져서 품질이 떨어집니다.
> **이 프로젝트는 특히 중요합니다**: Phase 1에서 위험이 낮은 Display 모듈과 "모듈 격리 구조" 자체를 먼저 완성해 검증하고, 위험이 높은 Account 모듈은 그 안전한 기반 위에서 Phase 2에 추가합니다. 순서 자체가 안전장치입니다.

---

## Phase 1: MVP — Display 모듈 + 격리 구조 (2~3주 예상)

### 목표
플러그인을 설치하면 즉시 안전한 상태표시줄이 동작하고, Account 모듈이 나중에 추가될 자리(격리된 구조)가 미리 마련되어 있다.

### 기능 (2026-07-04 CLI 전환 반영, 2026-07-18 완료 확인)
- [x] 크로스플랫폼 자동 설치/감지 (Windows PowerShell 단독 환경 포함) → `install.ps1`은 순수
  PowerShell 문법(`irm .../install.ps1 | iex`)으로 작성돼 있어 Git Bash/WSL 없이도 동작,
  이 세션에서도 여러 차례 PowerShell 도구로 직접 실행해 확인
- [x] Node.js SEA 바이너리 빌드(linux/macos/windows, CI 매트릭스) → `.github/workflows/build.yml`
  `matrix.include`에 windows-latest·macos-latest·ubuntu-latest 3개 전부 존재, 최신 커밋까지
  `gh run watch`로 3플랫폼 전부 success 직접 확인(2026-07-16)
- [x] **CLI 설치 스크립트**(curl / PowerShell 원라이너) — `install.ps1`/`install.sh` 실측 동작
  확인(37행 기존 기록). `npm -g`만 이름 미확정으로 의도적 보류(계획적 제외, 결함 아님)
- [x] `claudetower setup` — 격리 환경에서 설치→상태확인→위젯 켜고끄기→해제 전체 lifecycle을
  실제 실행해 정상 동작 확인(2026-07-17 QA 세션, 실사용자 파일 무영향까지 mtime 대조로 증명)
- [x] **모듈 격리 구조 자체를 코드로 확정**: `.github/workflows/build.yml`의
  `verify-display-standalone` job(53행)이 매 push마다 `src/accounts/`를 삭제한 뒤
  `npm run verify` 통과를 증명 + `lint:boundary`(`scripts/check-module-boundary.js`)가
  Display 코드의 Account import를 정적으로 차단

### 데이터
- Display 모듈 전체 엔티티(PlatformProfile, StatuslineConfig, QuickSetup, Threshold, Widget, CacheEntry는 Phase 2)
- `ModuleActivationState`(값은 항상 false로 고정된 채로 존재만 함)

### 인증
- 없음(Display 모듈은 자격증명을 다루지 않음)

### "진짜 제품" 체크리스트
- [x] **Account 모듈 코드(`src/accounts/`)가 아예 존재하지 않아도(빈 디렉토리여도) Display 모듈이 완전히 독립적으로 동작함을 확인** → **2026-07-15 재확인**: `.github/workflows/build.yml`의 `verify-display-standalone` job이 매 push마다 `src/accounts/`를 지운 뒤 `npm run verify` 통과를 증명
- [ ] Node.js가 설치되지 않은 순정 Windows에서 SEA 바이너리가 그대로 동작 (CHECKPOINT.md 보류 백로그 — Windows 11 Home이라 Sandbox 불가, 별도 클린 환경 확보 시 재검토)
- [x] mock stdin JSON으로 단위 테스트 통과 → 167개 테스트 대부분이 mock stdin JSON 기반 위젯 테스트(`npm run test:display`로 상시 확인)
- [x] ~~CLI 설치 스크립트(npm -g/curl/PowerShell)로 실제 배포되어 설치 가능~~ → **2026-07-04 부분 확정**: `main` 브랜치 개설 + v0.1.9 GitHub Release로 curl/PowerShell 원라이너(`curl -fsSL .../main/install.sh | sh`, `irm .../main/install.ps1 | iex`)가 격리 환경에서 다운로드→설치→`--version` 응답까지 실측 확인됨. `npm install -g`는 프로젝트명이 아직 가제·상표 검토 전이라(01_PRD.md §7) 의도적으로 보류(마켓플레이스는 기존대로 Phase 3 선택 채널, 이번 확정과 무관)
- [x] ~~README·가이드 문서 작성 완료~~ → **2026-07-06 확인**: 04_PROJECT_SPEC.md Must Have 9개 항목 대조 완료(①/② 분리, 위험고지, FAQ·트러블슈팅·법률 모두 존재). 대조 중 실제 결함 발견: 명령어 목록이 PATH 미등록 상태(05번 문서 이슈#3, 아직 코드로는 미해결)를 반영 못 해 새 터미널에서 `claudetower` 명령이 안 먹히는 걸 README/GUIDE 어디도 경고하지 않았음 → README.md·README.en.md·GUIDE.md·GUIDE.en.md 4개 파일 모두 수정. **미완료로 남는 것**: GUIDE.pdf·GUIDE.en.pdf는 이번 .md 수정을 반영하지 못한 채 그대로임(재생성 필요, 이번 세션 범위 밖). 워크플로우 그림(①/② 시각 다이어그램)도 텍스트 설명만 있고 실제 그림은 없음(Should Have 수준으로 판단, 후속 과제).

### Phase 1 시작 프롬프트
```
이 PRD를 읽고 Phase 1을 구현해주세요.
@.PRD/01_PRD.md
@.PRD/02_DATA_MODEL.md
@.PRD/04_PROJECT_SPEC.md

Phase 1 범위:
- 크로스플랫폼 자동 설치/감지 + Node.js SEA 빌드
- CLI 설치 스크립트(npm -g / curl / PowerShell 원라이너) — Claude Code 플러그인 아님
- Display 모듈(프로젝트 위치, 임계값 색상 경고, `claudetower setup`)
- src/display/ 와 src/accounts/(빈 디렉토리) 격리 구조 확정
- ModuleActivationState를 항상 false로 고정한 채 구조만 마련

반드시 지켜야 할 것:
- 04_PROJECT_SPEC.md의 "절대 하지 마" 및 "보안 요구사항" 목록 준수
- Display 모듈 코드가 Account 모듈 엔티티(Account, CredentialRef 등)를 import하지 않을 것
- 사용자 PC에 Node.js가 설치돼 있다고 가정하지 말 것(SEA 배포)
- Claude Code 플러그인 마켓플레이스 구조(plugin.json 등)는 Phase 3까지 만들지 말 것(선택적 보조 채널이므로 MVP 범위 아님)
```

---

## Phase 2: Account 모듈 추가 (2~3주 예상)

### 전제 조건
- Phase 1의 Display 모듈과 격리 구조가 실사용으로 최소 1주 이상 안정 검증된 상태

### 목표
사용자가 명시적으로 동의한 경우에만, 여러 계정을 자동 전환하는 기능이 켜진다.

### 기능 (2026-07-04 CLI 전환 반영)
- [ ] `claudetower accounts enable` — 이용약관 리스크 고지 + 명시적 동의 절차
- [ ] 계정 등록(OAuth), OS 자격증명 저장소 연동, `claudetower accounts`/`remove`/`rename`/`purge` CRUD
- [ ] **`claudetower accounts`가 계정별 세션(5h)·주간(7d) 사용률·리셋 시각을 기본 표시**(2026-07-04 재확인 — teamclaude `session (5h) quota`/`weekly (7d) quota` 용어 채택, 공식 API 값이라 추가 조회 불필요. `--history`(로컬 집계, ccusage 벤치마킹)는 Phase 3 부가 기능으로 격하)
- [ ] **계정별 마지막 사용 프로젝트 경로 표시** — CLI 실행 시점 `process.cwd()`를 RotationEvent.project_path로 기록, 추가 탐색 없이 즉시 표시(Display 모듈을 거치지 않아 모듈 격리 유지)
- [ ] **`claudetower config`** — 전환 임계값·전략(`best`/`next-available`)·포트를 대화형/플래그로 조정, 값 검증 포함(claude-swap 벤치마킹)
- [ ] **`claudetower`(또는 `eval $(claudetower env) claude` 패턴) — Claude Code를 프록시 환경변수가 이미 설정된 상태로 실행하는 핵심 진입점**(재시작 개념 자체가 없는 구조, teamclaude `run` 벤치마킹)
- [ ] 로컬 프록시(127.0.0.1 고정, 로컬 접근 토큰 검증 — CLI가 직접 통제하므로 Claude Code 헤더 지원 여부와 무관), 할당량 기반 자동 전환, 429 failover
- [ ] `RotationEvent` 감사 로그
- [ ] `ActiveAccountHandle` 파일을 Account 모듈이 기록 시작

### 추가 데이터
- Account, CredentialRef, QuotaState, ProxyConfig, RotationEvent, ActiveAccountHandle

### 통합 테스트
- **Phase 1의 Display 모듈이 Account 모듈 활성화 전/후 모두 동일하게 동작하는지 확인** (Account 모듈이 Display에 부작용을 주지 않는지가 핵심 검증 포인트)
- 동의 절차 없이는 어떤 계정 관련 코드도 실행되지 않는지 재확인
- 실제 계정 2개로 자동 전환 E2E 테스트

---

## Phase 3: 고도화 및 연동 (2주 예상)

### 전제 조건
- Phase 1 + 2가 안정적으로 운영 중

### 목표
Display 모듈과 Account 모듈이 "현재 활성 계정 표시"로 자연스럽게 연동되고, 각자의 고급 기능이 추가된다.

### 기능 (2026-07-04 CLI 전환 반영)
- [ ] Display: Powerline 위젯 시스템, Git/PR 위젯, `active_account` 위젯(ActiveAccountHandle 읽기)
- [ ] Account: TUI 대시보드(계정 테이블·할당량 진행률·활동 로그, teamclaude 실측 키 조작 벤치마킹), **핫 리로드**(재시작 없이 계정 추가, teamclaude `R` 키 패턴), 수동 강제 전환, **영구 셸 별칭 등록(opt-in)** — `claude` 명령 자체를 `claudetower` 경유로 바꿔 `claudetower`이라 타이핑할 필요조차 없앰(기본 실행은 이미 Phase 2부터 `claudetower`이므로 이 단계는 "그마저도 생략"하는 선택 사항), sub-100ms 전환 최적화(caam 벤치마킹 — 토큰 파일 사전 준비 후 교체 방식)
- [ ] `subagentStatusLine` 커스터마이징(Display, 경쟁 도구 미제공 영역)
- [ ] `claudetower accounts --history`(신규, 격하) — 과거 여러 날의 사용 패턴 참고용 로컬 집계(ccusage 벤치마킹, UsageHistory 엔티티) — 2026-07-04 재확인으로 MVP에서 Phase 3 부가 기능으로 조정
- [ ] **선택적 마켓플레이스 래퍼**(신규) — `/claudetower:*` 슬래시 명령이 설치된 CLI를 그대로 호출하는 얇은 Claude Code 플러그인. 마켓플레이스 발견성을 원하는 사용자를 위한 보조 채널일 뿐, 핵심 로직은 CLI에 있음

### 주의사항
- `active_account` 위젯을 추가할 때도 Display 모듈이 `ActiveAccountHandle` 파일을 "읽기만" 하도록 — Account 모듈 내부 엔티티에 대한 직접 참조 절대 금지(02_DATA_MODEL.md 모듈 경계 규칙 재확인)

---

## Phase 로드맵 요약

| Phase | 핵심 기능 | 상태 |
|-------|----------|------|
| Phase 1 (MVP) | Display 모듈 + 격리 구조 확정 | 시작 전 |
| Phase 2 | Account 모듈(동의 기반 활성화) | Phase 1 완료 후 |
| Phase 3 | 고도화 + 계정 표시 연동 위젯 | Phase 2 완료 후 |
