# QuotaSwitch (cc-quotaswitch) — PRD (Product Requirements Document)

> 생성일: 2026-07-04
> 생성 도구: Show Me The PRD
> 리서치 근거: teamclaude(원본+포크) 실측 + claude-swap, ProxyPool Hub, ClaudeCodeMultiAccounts, caam, 공식 Agent Teams/Team Plan 리서치
> 관련 프로젝트: PulseLine(D:\AI_Dev_Work\2026y\26y_07m_04d_\.PRD\) — 상태표시줄 플러그인. 본 프로젝트는 아키텍처·보안 등급이 달라 의도적으로 분리됨(근거는 §1 참고)

---

## 1. 제품 개요

### 한 줄 요약
Claude Code 플러그인 마켓플레이스로 설치하는, 여러 개인 계정의 할당량이 소진될 때 자동으로 다음 계정으로 전환해주는 로컬 프록시 플러그인.

### 왜 PulseLine과 분리했는가
PulseLine(상태표시줄)은 "외부 API 호출 없음, 자격증명 다루지 않음"이 설계 원칙인 읽기 전용 렌더러다. QuotaSwitch는 정반대로 여러 계정의 OAuth 토큰을 저장·전환하는 **자격증명 브로커 + 상시 실행 프록시 서버**다. 두 도구를 한 플러그인으로 합치면 저위험 도구(상태표시줄)가 고위험 공격 표적(토큰 저장소)이 된다 — 이게 분리의 핵심 근거다.

### 해결하는 문제
Claude Max 등 구독 계정은 5시간/7일 단위 할당량이 있다. 여러 개인 계정을 갖고 있어도 한도에 걸릴 때마다 수동으로 로그아웃·재로그인하며 작업이 끊긴다. teamclaude가 이미 이 문제를 해결하지만(확인된 사실 — 실측), **Claude Code 마켓플레이스로 설치되지 않고 별도 npm 전역 설치가 필요**하다.

### 핵심 가치 (2026-07-04 CLI 전환으로 개정)
1. **독립 CLI로 설치** — `npm install -g` 또는 curl/PowerShell 원라이너로 설치(teamclaude·claude-swap·caam 등 리서치된 대다수 경쟁 도구와 동일한 UX)
2. **할당량 자동 전환(use-or-lose)** — teamclaude의 검증된 스케줄링 로직을 그대로 계승(강점 유지)
3. **재시작 자체가 필요 없음**(구조적으로 해결, 이전엔 "마찰 최소화"가 최선이었으나 이제는 완전 제거) — teamclaude 재조사로 `eval $(teamclaude env) claude` 패턴을 확인: CLI가 Claude Code를 실행하기 **전에** 환경변수를 설정하므로, `ANTHROPIC_BASE_URL`이 프로세스 시작 시에만 읽힌다는 구조적 제약(공식 문서·GitHub 이슈 #8500으로 확인됨) 자체가 문제 되지 않음. `quotaswitch`(또는 `eval $(quotaswitch env) claude`)로 실행하는 것이 기본이자 유일한 방식이므로, 이전에 검토했던 "재시작 안내(기본)" vs "셸 wrapper(opt-in)" 이원화가 불필요해짐 — CLI 실행 자체가 wrapper 역할을 겸함

### 왜 마켓플레이스 플러그인 방식을 버렸는가 (2026-07-04 재검토)
이전에는 "마켓플레이스 설치 + 재시작 1회"를 최선으로 판단했으나, teamclaude가 실제로 `eval $(teamclaude env) claude` 방식을 쓴다는 걸 재확인한 결과 **재시작 자체가 불필요한 더 나은 아키텍처가 이미 존재**한다는 게 확인됐다. 또한 마켓플레이스 방식에서 계속 NEEDS CLARIFICATION으로 남았던 "로컬 프록시 접근 토큰을 Claude Code가 커스텀 헤더로 지원하는지 불확실"이라는 리스크도, CLI가 Claude Code의 실행 자체를 통제하므로 원천적으로 사라진다. 사용자가 "CLI가 더 편하고 쉽고 강력하고 안전하고 문제없으면 전환하라"고 명시적으로 조건부 지시했고, 위 근거들이 이 조건을 충족하므로 전환한다.

---

## 2. 사용자

### 주요 사용자
- **누구**: 개인이 소유한 Claude Max/API 계정을 2개 이상 갖고 있는 Claude Code 개발자 (본 프로젝트는 "혼자 쓰는 여러 개인 계정" 시나리오로 범위 고정 — 팀 공유 계정 풀은 명시적으로 Out of Scope, 근거는 §6)
- **상황**: 하루 중 여러 세션을 오가며 작업, 한 계정 할당량이 자주 소진됨
- **목표**: 할당량 소진으로 작업이 끊기지 않기를 원함

### 사용자 시나리오 (2026-07-04 CLI 전환 반영)
1. 개발자가 `npm install -g quotaswitch-cli`(또는 설치 스크립트) 설치 후
2. `quotaswitch setup`으로 계정 2~3개를 OAuth 로그인으로 등록하고
3. `quotaswitch`로 Claude Code를 실행하면(재시작 불필요, 환경변수가 이미 설정된 채로 뜸)
4. 이후 할당량이 임계값(기본 98%)에 닿을 때마다 자동으로 다음 계정으로 전환되며 작업이 끊기지 않는다

---

## 3. 핵심 기능

| 기능 | 설명 | 우선순위 | 복잡도 |
|------|------|----------|--------|
| 계정 등록(OAuth 로그인) | `quotaswitch setup`으로 계정 추가, 자격증명은 OS 자격증명 저장소에 암호화 저장 | P1 (MVP) | 복잡 |
| **계정 목록·상태 조회** (신규) | `quotaswitch accounts` — claude-swap의 `--list` 벤치마킹, 계정별 라벨·5h/7d 사용률·리셋 시각을 한눈에 표시 | P1 (MVP) | 간단 |
| **계정 삭제(완전 삭제 보장)** (신규) | `quotaswitch remove <라벨>` — 삭제 확인 절차 + OS 자격증명 저장소에서 실제로 지워졌는지 검증까지 수행(teamclaude의 "삭제가 완전한지 불명확"이라는 약점 개선) | P1 (MVP) | 보통 |
| **계정 라벨 수정** (신규) | `quotaswitch rename <기존라벨> <새라벨>` — teamclaude·claude-swap 둘 다 없는 기능(차별화 지점) | P2 | 간단 |
| **전체 초기화** (신규) | `quotaswitch purge` — claude-swap의 `--purge` 벤치마킹, 모든 계정·설정을 한 번에 삭제(재설치처럼 깨끗하게 시작하고 싶을 때) | P2 | 간단 |
| **설정(config) 명령** (신규) | `quotaswitch config` — 전환 임계값·전환 전략(claude-swap의 `best`/`next-available` 벤치마킹)·포트를 대화형 또는 플래그로 조정, 잘못된 값은 즉시 검증 거부 | P2 | 보통 |
| **계정별 세션(5h)·주간(7d) 사용량 조회** (재확인 — MVP로 재분류) | `quotaswitch accounts`가 기본 표시. teamclaude의 `session (5h) quota`/`weekly (7d) quota` 용어 채택, 공식 API 값이라 추가 조회 불필요 | P1 (MVP) | 간단 |
| 과거 사용 이력 참고 리포트 (Phase 3로 격하) | `quotaswitch accounts --history` — ccusage 벤치마킹, 로컬 집계 부가 기능(사용자가 실제 요청한 핵심 아님을 재확인) | P3 | 보통 |
| **계정별 프로젝트 경로 표시** (신규) | `quotaswitch accounts`에 "마지막으로 이 계정이 쓰인 프로젝트" 컬럼 추가 — CLI 실행 시점 cwd를 그대로 사용해 추가 탐색 없이 즉시 표시 | P2 | 간단 |
| 로컬 프록시 서버 | localhost 바인딩, Claude Code ↔ Anthropic API 사이에서 요청 중계 | P1 (MVP) | 복잡 |
| 할당량 기반 자동 전환 | use-or-lose 스케줄링(가장 빨리 리셋되는 계정 우선) — teamclaude 로직 벤치마킹 | P1 (MVP) | 보통 |
| 429 즉시 failover | 속도 제한 응답 시 다른 계정으로 즉시 재시도 | P1 (MVP) | 보통 |
| **`quotaswitch` 실행 진입점**(2026-07-04 CLI 전환, 재시작 안내를 대체) | 환경변수가 이미 설정된 상태로 Claude Code 실행 — `ANTHROPIC_BASE_URL`이 프로세스 시작 시에만 읽히는 구조적 제약을 CLI가 우회(teamclaude `run`/`env` 벤치마킹) | P1 (MVP) | 간단 |
| 영구 셸 별칭 등록(opt-in) | `claude` 명령 자체를 `quotaswitch` 경유로 바꿔 매번 타이핑조차 생략(기존 "셸 wrapper 모드"를 CLI 전환에 맞게 재정의) | P3 | 보통 |
| TUI 대시보드 | 실시간 할당량 진행률, 리셋 카운트다운 | P2 | 보통 |
| 수동 강제 전환 명령 | 자동 전환을 기다리지 않고 즉시 다른 계정으로 전환 — claude-swap 벤치마킹 | P2 | 간단 |
| sub-100ms 전환 최적화 | caam 벤치마킹, 전환 지연 최소화 | P3 | 복잡 |
| PulseLine 연동 위젯 | 현재 활성 계정명을 파일로 남겨 PulseLine이 읽어 상태표시줄에 표시(읽기 전용 — PulseLine 보안 원칙 위반 없음) | P3 | 간단 |

---

## 4. 사용자 흐름 (User Flow)

### 핵심 흐름 (2026-07-04 CLI 전환 반영)
```
CLI 설치 -> 계정 등록(quotaswitch setup) -> quotaswitch로 Claude Code 실행(재시작 불필요) -> 자동 전환 시작
```

### 상세 흐름
1. **설치**: `npm install -g quotaswitch-cli` 또는 curl/PowerShell 설치 스크립트(SEA 바이너리, Node.js 불필요)
2. **설정**: `quotaswitch setup` → OAuth 로그인 흐름으로 계정 추가(2개 이상 권장) → 프록시 서버를 백그라운드로 기동
3. **실행**: `quotaswitch`(또는 `eval $(quotaswitch env) claude`)로 Claude Code를 실행 — 프록시 주소가 환경변수로 이미 설정된 상태에서 Claude Code가 뜨므로 별도 재시작 개념이 없음
4. **자동 운영**: 이후 세션에서 할당량 임계값 도달 또는 429 발생 시 프록시가 자동으로 계정 전환, Claude Code 프로세스는 그대로 유지

---

## 5. 성공 기준

- [ ] 계정 2개 이상 등록 후 한 계정 할당량 소진 시 수동 개입 없이 자동 전환됨
- [ ] 429 오류 발생 시 사용자 체감 지연 없이(수 초 이내) 다른 계정으로 failover
- [ ] OAuth 토큰이 평문 파일에 저장되지 않음(OS 자격증명 저장소 사용 확인)
- [ ] 로컬 프록시가 `127.0.0.1`에만 바인딩되어 외부 네트워크에서 접근 불가함을 실측 검증
- [ ] **(2026-07-04 CLI 전환 반영)** `quotaswitch`로 Claude Code를 실행하면 재시작 없이 즉시 프록시가 개입함을 확인 가능한 진단 명령 제공(`quotaswitch status` 등)
- [ ] 로컬 프록시 접근 토큰 없이 보낸 요청은 거부됨 (127.0.0.1 바인딩만으로 접근 통제를 끝냈다고 가정하지 않음, 04_PROJECT_SPEC.md 보안 요구사항 기준)
- [ ] OAuth 로그인 흐름에서 `state` 파라미터 검증 없이는 토큰 교환이 진행되지 않음
- [ ] 기본 포트가 사용 중이어도 최초 설정이 실패하지 않고 자동으로 다른 포트를 찾아 완료됨(04_PROJECT_SPEC.md "포트 충돌 처리" 기준)

---

## 6. 안 만드는 것 (Out of Scope)

- **팀/조직 단위 계정 공유 풀** — 이유: 여러 사람이 계정을 공유하면 접근 제어·감사 로그·권한 분리가 필수가 되어 보안 설계가 완전히 달라짐. 사용자가 명시적으로 "혼자 쓰는 여러 개인 계정"을 선택함(확인됨)
- **Claude Code 외 다른 CLI(Codex, Gemini 등) 지원** — 이유: ProxyPool Hub가 이미 다루는 영역이며, 범위를 넓히면 Claude Code 전용 최적화(마켓플레이스 설치 등)의 이점이 희석됨
- **세션 상태/컨텍스트 자체의 계정 간 공유** — 이유: teamclaude 리서치에서도 확인되지 않은 기능이며, 원래 목적(할당량 자동 전환)을 벗어남
- **공식 Anthropic Team/Enterprise 플랜 대체** — 이유: 공식 플랜은 조직 과금·시트 관리가 목적이라 본 도구(개인 다중계정 로테이션)와 경쟁 관계가 아님. 다만 향후 Anthropic이 공식 멀티계정 전환 기능을 낼 경우 이 도구 자체가 무의미해질 리스크는 §7에 기록
- **상업적 판매·유료 서비스화·회사/고객사 납품** — 이유: 여러 계정 자동 순환이 이용약관과 충돌할 가능성이 아직 법무 검토 전인 상태에서, 이를 상업적으로 확장하면 리스크가 개인 사용 대비 크게 증폭됨. MVP는 무료·개인 사용 목적으로만 배포(04_PROJECT_SPEC.md 법률 요구사항 참고)
- **계정 그룹화·용도별 라우팅(예: "이 계정은 코딩 전용, 저 계정은 리서치 전용")** — 이유: teamclaude 재검토(2026-07-04)로 확인된 사실, teamclaude에도 이 기능이 없다("모든 요청은 현재 활성 계정을 통해서만 전달"). 원래 목적("할당량 소진 시 자동 전환")에는 불필요한 기능이라 추가하면 오버엔지니어링 — Simplicity First 원칙에 따라 범위 밖으로 유지

---

## 7. [NEEDS CLARIFICATION]

- [ ] **(중요, 법률 검토 필요)** 여러 구독 계정을 자동 순환시켜 할당량을 우회하는 방식이 Anthropic 이용약관과 충돌하는지 — 확인된 사실이 아니라 가설 단계. 실제 계약 조항 검토 없이 배포하면 계정 정지 리스크를 사용자가 떠안게 됨. **강력 권고: 이용약관 검토를 완료하기 전까지 "개인 책임 하에 사용" 고지를 README 최상단에 명시**
- [ ] OS별 자격증명 저장소 연동 라이브러리 선택 (Windows Credential Manager/DPAPI, macOS Keychain, Linux libsecret 각각 대응하는 Node.js 라이브러리 — 예: keytar 계열, 유지보수 상태 확인 필요)
- [x] ~~최초 1회 재시작 요구가 실제 사용자 경험상 수용 가능한 수준인지~~ → **2026-07-04 CLI 전환으로 해소**. teamclaude가 `eval $(teamclaude env) claude` 패턴으로 재시작을 원천적으로 피한다는 게 확인되어, 같은 구조를 채택함으로써 이 우려 자체가 사라짐
- [ ] **(신규)** `npm install -g` vs curl/PowerShell 설치 스크립트 중 기본 안내 방법 확정 — 전자는 Node.js 필요, 후자는 SEA 바이너리라 불필요(04_PROJECT_SPEC.md 기술스택과 연동해 최종 확정)
- [ ] 라이선스, 배포 채널(개인 마켓플레이스) — PulseLine과 동일 방향(MIT, 개인 저장소 우선) 적용을 제안하되 최종 확정 필요
