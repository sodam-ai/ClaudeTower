# ClaudeTower (claudetower) — PRD (Product Requirements Document)

> 생성일: 2026-07-04
> 생성 도구: Show Me The PRD
> 통합 이력: PulseLine과 QuotaSwitch를 사용자 요청으로 하나의 플러그인(ClaudeTower)으로 통합. 두 프로젝트의 원본 리서치·결정 사항은 `.PRD/.archive/PulseLine원본/`·`.PRD/.archive/QuotaSwitch원본/`에 보존되어 있으며, 모두 계승한다.

---

## 1. 제품 개요

### 한 줄 요약
Claude Code 상태표시줄(컨텍스트·비용·프로젝트 위치 표시)과 여러 계정 자동 전환 기능을 하나의 플러그인으로 설치하되, 내부적으로는 위험도가 다른 두 기능을 코드·권한 수준에서 분리한 Claude Code 플러그인.

### 왜 다시 하나로 합쳤는가 (그리고 이전 우려를 어떻게 해소했는가)
이전 PRD 검토에서 "PulseLine(자격증명 없는 읽기 전용 도구)과 QuotaSwitch(OAuth 토큰을 다루는 상시 프록시)는 위험 등급이 달라 분리해야 한다"고 강력 추천했다. 이 판단의 근거(위험 등급 차이)는 지금도 사실이다. 다만 사용자가 "설치·관리할 프로그램이 1개이길 원한다"는 실용적 요구를 명확히 했고, 이는 **"기능을 합치는 것"과 "위험을 합치는 것"을 분리해서 설계하면 동시에 만족시킬 수 있는 문제**라고 판단했다. 그래서 아래와 같이 결정한다:

- **하나의 플러그인(하나의 마켓플레이스 설치 항목, 하나의 저장소)** — 사용자가 원하는 "1개"
- **두 개의 격리된 내부 모듈** — 이전에 우려했던 위험 등급 차이를 코드·권한 수준에서 그대로 유지
  - **Display 모듈**(구 PulseLine): 기본 활성화, 자격증명 접근 권한 없음, stdin JSON만 읽는 읽기 전용 렌더러
  - **Account 모듈**(구 QuotaSwitch): 기본 비활성화, 명시적 opt-in(`/claudetower:enable-accounts`) 후에만 동작, OAuth 토큰·로컬 프록시를 다루는 별도 프로세스

### 남아있는 근본 리스크 (숨기지 않고 명시)
하나의 저장소·배포 파이프라인을 공유하므로, Account 모듈에서 취약점이 발견되면 Display 모듈까지 포함한 전체 플러그인을 재배포해야 한다(공급망 공격 표면이 완전히 0이 되지는 않음). 이는 "완전 분리"보다 구조적으로 더 위험하지만, "사용자가 하나만 설치·관리하고 싶다"는 요구와 "위험은 분리하고 싶다"는 요구 사이의 현실적 절충안이다.

### 핵심 가치
1. **설치 한 번으로 끝** — `claudetower` 독립 CLI 하나로 상태표시줄과 계정 전환 기능 모두에 접근 가능(계정 전환은 추가 동의 후 활성화)
2. **위험 격리** — Display 모듈은 Account 모듈의 자격증명 저장소에 코드 레벨로 접근 불가. 유일한 연결점은 "현재 활성 계정명"을 담은 읽기 전용 파일 하나뿐(Account 모듈이 쓰고, Display 모듈은 읽기만)
3. **점진적 신뢰** — 상태표시줄은 설치 즉시 안전하게 사용 가능, 계정 전환처럼 위험도 높은 기능은 사용자가 이해하고 동의한 뒤에만 켜짐
4. **재시작 없이 바로 작동** (2026-07-04 CLI 전환으로 확보) — Claude Code를 `claudetower` 경유로 실행하면 `ANTHROPIC_BASE_URL` 등 환경변수가 Claude Code 프로세스가 뜨기 전에 이미 설정되어 있어, 마켓플레이스 플러그인 방식에서 구조적으로 피할 수 없었던 "설정 후 1회 재시작" 자체가 필요 없음

### 2026-07-04 배포 방식 전환: 마켓플레이스 플러그인 → 독립 CLI (근거)

**결정**: 이 프로젝트를 Claude Code 플러그인이 아니라 **독립 CLI 도구**로 전환한다(마켓플레이스 설치 경로는 Phase 3에 "선택적 보조 채널"로만 남긴다).

**근거(사용자 요청에 따른 재평가, 확인된 사실 기반)**:
1. teamclaude를 재조사한 결과, `eval $(teamclaude env) claude` 패턴이 실제로 사용된다는 걸 확인했다 — CLI가 프록시 접속 정보를 환경변수로 먼저 설정하고, 그 다음 Claude Code를 실행한다. 이러면 `ANTHROPIC_BASE_URL`이 Claude Code 프로세스 시작 전에 이미 반영돼 있어 **"1회 재시작 필요"라는 마켓플레이스 방식의 구조적 제약이 원천적으로 사라진다.**
2. 마켓플레이스 방식에서 계속 NEEDS CLARIFICATION으로 남아있던 "로컬 프록시 접근 토큰을 Claude Code가 커스텀 헤더로 실어 보내는지 불확실"이라는 리스크도 CLI 방식에서는 아예 발생하지 않는다 — CLI가 자기 자식 프로세스(Claude Code)의 요청 경로 전체를 직접 통제하기 때문에 Claude Code의 미문서화 동작에 의존할 필요가 없다.
3. teamclaude·claude-swap·caam·ccstatusline·cc-statusline·CCometixLine 등 리서치한 경쟁 도구 대부분이 애초에 독립 CLI(npm 전역 설치 또는 curl/PowerShell 원라이너)라는 것도 재확인된 사실 — 마켓플레이스 플러그인 방식(claudeline)은 오히려 소수 사례였다.
4. 계정 관리(`accounts`/`remove`/`rename`/`purge`)도 순수 터미널 명령으로 만들면 Claude Code 세션 여부와 무관하게 스크립팅·자동화·테스트가 쉬워진다.

**유지하는 것(원래 요구사항 존중)**: 사용자가 처음에 요구했던 "설치·관리할 프로그램은 1개"라는 원칙은 오히려 이 전환으로 더 잘 지켜진다 — Claude Code 플러그인 런타임에 종속되지 않는 단일 CLI 바이너리 하나가 Display·Account 두 기능을 모두 제공한다. Display 모듈은 원래도 Claude Code의 공식 `statusLine` 설정(`settings.json`)에 의존하므로 CLI든 플러그인이든 동작 방식 차이가 없다.
**포기하는 것(정직하게 명시)**: `/plugin install` 한 줄로 끝나는 마켓플레이스 발견성은 약해진다 — `npm install -g` 또는 설치 스크립트 실행이 필요. 이 격차는 Phase 3의 "선택적 마켓플레이스 래퍼"(플러그인이 내부적으로 CLI를 호출)로 보완할 수 있는지 별도 검토.

---

## 2. 사용자

### 주요 사용자
- **누구**: Claude Code를 매일 쓰는 개발자. 상태표시줄 개선만 원하는 사용자와, 여러 개인 계정을 자동 전환하고 싶은 사용자 둘 다를 하나의 설치로 포괄
- **상황**: Windows(PowerShell/Git Bash) 환경 우선 고려, 여러 프로젝트·여러 계정을 오가며 작업
- **목표**: 플러그인 하나만 설치·관리하고 싶고, 위험한 기능(계정 자동전환)은 원할 때만 켜고 싶음

### 사용자 시나리오 (2026-07-04 CLI 전환 반영)
1. 개발자가 설치 스크립트(`npm install -g claudetower-cli` 또는 curl/PowerShell 원라이너)로 CLI 설치 → `claudetower setup` 실행 → 상태표시줄(컨텍스트·비용·프로젝트 위치)이 즉시 반영됨(Display 모듈, 위험 없음, `settings.json`을 직접 갱신하므로 다음 상호작용부터 바로 표시)
2. 여러 계정을 자동 전환하고 싶어지면 `claudetower accounts enable` 실행 → 이용약관 리스크 고지에 동의 → 계정 등록(OAuth) → 이후 `claudetower`(또는 등록된 셸 별칭 `claude`)으로 실행하면 환경변수가 이미 설정된 채로 Claude Code가 뜸(재시작 개념 자체가 없음, Account 모듈)
3. 계정 전환이 필요 없어지면 `claudetower accounts disable`로 Account 모듈만 끌 수 있음(Display 모듈은 영향 없음)

---

## 3. 핵심 기능

| 기능 | 소속 모듈 | 설명 | 우선순위 | 복잡도 |
|------|-----------|------|----------|--------|
| 크로스플랫폼 자동 설치/감지 | 공통 | Windows/Mac/Linux 감지, Node.js SEA 배포 | P1 (MVP) | 복잡 |
| 프로젝트 위치 위젯 | Display | `workspace.current_dir` 즉시 파싱·표시 | P1 (MVP) | 간단 |
| **사용 모델 위젯**(복원) | Display | `model.display_name` 표시 — PulseLine 원본 설계(`.archive/PulseLine원본/02_DATA_MODEL.md`)의 `enabled_fields` 기본값에 있었으나 ClaudeTower 통합 과정에서 누락됐던 것을 실사용 피드백으로 발견해 복원 | P1 (MVP) | 간단 |
| 임계값 색상 경고 | Display | context/cost/rate_limit 경고 색상 | P1 (MVP) | 간단 |
| 슬래시 명령 대화형 설정 | Display | `/claudetower:setup`으로 표시 항목 설정 | P1 (MVP) | 보통 |
| **모듈 격리 기반 구조** | 공통 | Display/Account 코드·권한 분리, 활성 계정명 단방향 파일 인터페이스 | P1 (MVP) | 복잡 |
| 계정 등록·활성화 동의 절차 | Account | `/claudetower:enable-accounts`, 이용약관 리스크 고지 후 동의 | P2 | 복잡 |
| 로컬 프록시·할당량 자동 전환 | Account | teamclaude 벤치마킹, OS 자격증명 저장소 연동 | P2 | 복잡 |
| **계정 관리 CRUD** (신규) | Account | 목록조회(`accounts`)·삭제(`remove`, 완전삭제 검증)·라벨수정(`rename`)·전체초기화(`purge`) — teamclaude·claude-swap 비교로 발견한 "수정 기능 부재"·"삭제 불확실성" 갭을 보완(QuotaSwitch 원 설계 계승) | P2 | 보통 |
| **옵션 설정 명령**(신규) | Account | `config` — 전환 임계값·전략(claude-swap `best`/`next-available` 벤치마킹)·포트를 대화형/플래그로, 값 검증 포함 | P2 | 보통 |
| **계정별 세션(5h)·주간(7d) 사용량**(재확인, MVP로 재분류) | Account | `accounts` 기본 표시 — teamclaude의 `session (5h) quota`/`weekly (7d) quota` 용어 채택, 공식 API 값이라 추가 조회 불필요(2026-07-04 재확인: 이전엔 로컬 집계로 오버엔지니어링했으나 이미 있던 QuotaState 필드로 충분함을 확인) | P1 (MVP) | 간단 |
| 과거 사용 이력 참고 리포트(격하) | Account | `accounts --history` — ccusage 벤치마킹, 로컬 집계 부가 기능 | P3 | 보통 |
| **계정별 프로젝트 경로 표시**(신규) | Account | CLI 실행 시점 cwd를 즉시 사용 — Display 모듈을 거치지 않아 모듈 격리 원칙 유지(QuotaSwitch 02_DATA_MODEL.md 참고) | P2 | 간단 |
| Git/PR 위젯 + 캐싱 | Display | 브랜치·PR 상태, session_id 캐싱 | P3 | 보통 |
| Powerline 위젯 시스템 + 테마 | Display | 위젯 커스터마이징 | P3 | 복잡 |
| TUI 대시보드·수동 전환·셸 wrapper | Account | teamclaude/claude-swap 벤치마킹 | P3 | 보통 |

---

## 4. 사용자 흐름 (User Flow)

### 핵심 흐름 (2026-07-04 CLI 전환 반영)
```
CLI 설치 -> claudetower setup(Display 즉시 활성화) -> (선택) claudetower accounts enable -> 동의+계정등록 -> claudetower(또는 별칭)으로 실행하면 즉시 반영, 재시작 불필요
```

### 상세 흐름
1. **설치**: `npm install -g claudetower-cli`(Node.js 있는 사용자) 또는 curl/PowerShell 설치 스크립트(SEA 바이너리, Node.js 불필요) — teamclaude·claude-swap·caam 등 리서치한 CLI 도구 대부분과 동일한 설치 UX
2. **Display 즉시 사용**: `claudetower setup`이 `settings.json`의 `statusLine` 필드를 직접 갱신 — 별도 재시작 없이 다음 상호작용부터 표시(위험 없는 기능이므로 진입 장벽 최소화)
3. **Account 선택적 활성화**: `claudetower accounts enable` → "이 기능은 이용약관 위반 가능성이 있고 여러 계정의 OAuth 토큰을 로컬에 저장합니다"라는 고지에 명시적 동의 → OAuth 로그인으로 계정 등록 → **재시작 안내 대신, "이제부터는 `claude`를 직접 실행하지 말고 `claudetower`으로 실행하세요"라는 안내**(또는 opt-in 시 셸 별칭 자동 등록으로 `claude` 자체가 wrapper가 되어 안내조차 불필요)
4. **연동**: Account 모듈이 활성 계정명을 로컬 파일에 기록 → Display 모듈이 그 파일을 읽어 상태표시줄에 "현재 계정" 위젯으로 표시(Phase 3)

---

## 5. 성공 기준

- [ ] Display 모듈은 Account 모듈을 활성화하지 않아도 완전히 독립적으로 동작함(Account 관련 코드가 아예 로드되지 않음을 실측 확인)
- [ ] Account 모듈 활성화 전에는 OAuth 관련 코드·자격증명 저장소 접근이 전혀 일어나지 않음
- [ ] `claudetower accounts enable` 동의 절차 없이는 계정 등록이 시작되지 않음
- [ ] Windows(PowerShell만 있는 환경)에서 Display 모듈이 폴백 없이 정상 작동
- [ ] Account 모듈 활성화 후 자동 전환·429 failover가 실제 계정으로 검증됨
- [ ] 로컬 프록시 접근 토큰 없이 보낸 요청은 거부됨(127.0.0.1 바인딩만으로 접근 통제 끝났다고 가정하지 않음)
- [ ] **(신규)** `claudetower`(또는 등록된 셸 별칭)으로 Claude Code를 실행하면 별도 재시작 없이 즉시 프록시가 개입함 — 이전 마켓플레이스 방식의 "1회 재시작 필요"가 재현되지 않는지 실측 검증
- [ ] **(신규, 부분 확정)** Node.js가 설치되지 않은 환경에서도 CLI 설치 스크립트(SEA 바이너리)로 정상 설치·실행됨 — **2026-07-04**: 설치 스크립트 자체(다운로드→고정 위치 설치→실행)는 실측 확인됨(`04_PROJECT_SPEC.md` "배포 방법" 참고). 다만 이 실측은 Node.js가 이미 설치된 개발 PC에서 진행됐고, **"Node.js가 정말 없는" 환경(클린 VM/새 사용자 계정)에서의 실측은 아직 없음** — PATH에서 node만 제거한 시뮬레이션까지만 완료. 체크박스는 이 gap이 해소된 뒤에 닫는다

---

## 6. 안 만드는 것 (Out of Scope)

- **팀/조직 단위 계정 공유 풀** — 이유: 개인이 혼자 쓰는 여러 계정 시나리오로 범위 고정(QuotaSwitch 원 결정 계승)
- **Claude Code 외 다른 CLI 지원** — 이유: Claude Code 마켓플레이스 설치라는 핵심 가치 희석 방지(원 결정 계승)
- **상업적 판매·유료 서비스화·회사 납품** — 이유: Account 모듈의 이용약관 리스크가 법무 검토 전 상태에서 상업적 확장은 리스크를 증폭시킴(원 결정 계승, Display 모듈만 있어도 이 제약은 전체 플러그인에 적용 — Account 모듈이 포함된 이상 상업적 배포 전체가 막힘)
- **Powerline 테마·Git/PR 위젯** — 이유: Phase 1은 "격리 구조가 실제로 안전하게 작동하는지" 검증이 최우선, 부가 기능은 Phase 3로 연기
- **계정 그룹화·용도별 라우팅** — 이유: teamclaude 재검토(2026-07-04)로 확인된 사실, teamclaude에도 이 기능이 없다("모든 요청은 현재 활성 계정을 통해서만 전달"). 원래 목적(할당량 소진 시 자동 전환)에는 불필요해 추가하면 오버엔지니어링(QuotaSwitch 원 판단 계승)

---

## 7. [NEEDS CLARIFICATION]

- [ ] 프로젝트 최종 이름 확정 ("ClaudeTower/claudetower"은 가제 — 상태 모니터링과 계정 제어를 한 곳에서 다룬다는 의미로 제안)
- [x] ~~라이선스·저작권자~~ → **2026-07-03 확정**: Apache License 2.0, 저작권자 "SoDam AI Studio"(PulseLine/QuotaSwitch 원 제안이었던 MIT에서 최종 변경, 상세는 `04_PROJECT_SPEC.md` "라이선스" 참고)
- [ ] 배포 채널(개인 마켓플레이스 우선) — 원 결정 계승 제안
- [ ] **(최우선, 법무 검토 필요)** 여러 계정 자동 순환이 Anthropic 이용약관과 충돌하는지 — Account 모듈이 이 플러그인에 포함되는 이상, Display 모듈만 쓰려는 사용자도 "이 플러그인 전체"가 이 리스크와 연관된 것처럼 보일 수 있음. README에서 "Account 모듈을 켜지 않으면 이 리스크와 무관하다"는 점을 명확히 구분해서 설명해야 함(신규 발견 사항)
- [ ] Display 모듈만 쓰고 싶은 사용자를 위해 "Account 모듈 코드 자체가 포함되지 않은 경량판"을 별도로 배포할지 여부(선택적 확장 논의)