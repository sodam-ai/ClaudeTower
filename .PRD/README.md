# ClaudeTower (claudetower) — 디자인 문서

> Show Me The PRD로 생성됨 (2026-07-04)
> **통합 이력**: PulseLine과 QuotaSwitch를 사용자 요청("설치·관리할 프로그램은 1개였으면 좋겠다")으로 하나의 플러그인(ClaudeTower)으로 통합. 원본 문서는 `.PRD/.archive/PulseLine원본/`·`.PRD/.archive/QuotaSwitch원본/`에 보존되어 있으며, 각 프로젝트의 리서치·보안·법률·README 요구사항은 모두 계승됨.

## 문서 구성

| 문서 | 내용 | 언제 읽나 |
|------|------|----------|
| [01_PRD.md](./01_PRD.md) | 왜 다시 합쳤는지, Display/Account 모듈 구분 | 프로젝트 시작 전 |
| [02_DATA_MODEL.md](./02_DATA_MODEL.md) | 두 모듈의 데이터 구조 + 모듈 경계 규칙 | 코드 설계할 때 |
| [03_PHASES.md](./03_PHASES.md) | Phase 1(Display+격리구조) → Phase 2(Account) → Phase 3(고도화) | 개발 순서 정할 때 |
| [04_PROJECT_SPEC.md](./04_PROJECT_SPEC.md) | 기술 스택, 보안·법률·README 요구사항 | AI에게 코드 시킬 때마다 |
| [05_FIELD_ISSUES_2026-07-04.md](./05_FIELD_ISSUES_2026-07-04.md) | (현장 이슈·설계문서 아님) 재설치 잠금 경합·npm shim·PATH·슬래시 명령 미등록 등 실사용 문제 분석 + 개선 백로그(P0~P3) | 개선/버그 수정 착수할 때 |
| [06_FIELD_ISSUE_SPAWN_STORM_2026-07-04.md](./06_FIELD_ISSUE_SPAWN_STORM_2026-07-04.md) | (현장 이슈 기록) 프로세스 폭주 이슈 분석 | 같은 부류 재발 시 |
| [07_OAUTH_FLOW_SPEC.md](./07_OAUTH_FLOW_SPEC.md) | Account 모듈 OAuth 흐름 조사 기록 — **결론: Anthropic 정책상 구현 불가로 Phase 2 보류 확정(2026-07-15)** | Phase 2 재검토 논의 시 |
| [08_ACCOUNTS_ENABLE_CONSENT_DRAFT.md](./08_ACCOUNTS_ENABLE_CONSENT_DRAFT.md) | 계정 동의 고지 문구 초안 — **사용되지 않음(Account 모듈 보류)** | Phase 2 재검토 논의 시 |

> **[2026-07-15]** 이 문서는 2026-07-04(프로젝트 생성일) 시점 상태다. 이후 열흘간의 실제
> 진행 상황·최신 결정은 이 문서가 아니라 저장소 루트의 `CHECKPOINT.md`가 항상 최신
> 출처(source of truth)다. 아래 "미결 사항"만 최신 상태로 갱신했고, 위쪽 역사적 서술
> (통합 이유·CRUD 추가 이력 등)은 그 시점 기록으로 그대로 둔다.

## 다음 단계

Phase 1을 시작하려면 [03_PHASES.md](./03_PHASES.md)의 "Phase 1 시작 프롬프트"를 그대로 사용하세요.

## 왜 다시 하나로 합쳤는가 (요약)

"PulseLine과 QuotaSwitch를 위험 등급이 달라 분리해야 한다"는 이전 권고의 근거는 여전히 유효하다. 다만 사용자가 "설치·관리할 프로그램이 1개였으면 좋겠다"는 실용적 요구를 명확히 했고, 이는 **기능 통합과 위험 통합을 분리해서 설계**하면 동시에 해결 가능한 문제라고 판단했다:
- 하나의 플러그인(사용자가 원하는 "1개")
- 그 안에 코드·권한이 완전히 격리된 두 모듈(이전 우려사항 유지) — Display는 기본 켜짐·위험 없음, Account는 opt-in·명시적 동의 필요

남아있는 근본 리스크(하나의 저장소·배포 파이프라인 공유로 인한 공급망 공격 표면)는 숨기지 않고 01_PRD.md·04_PROJECT_SPEC.md에 명시했다.

## 2026-07-04 계정 관리(CRUD) 명령어 신설

teamclaude·claude-swap 비교로 "라벨 수정 기능 부재"·"삭제 완전성 불확실"이라는 갭을 발견해 `/claudetower:accounts`(목록)·`/claudetower:account-remove`(삭제+검증)·`/claudetower:account-rename`(수정, 신규)·`/claudetower:account-purge`(전체초기화) 4개 명령을 Account 모듈에 추가. 모든 삭제 작업에 확인 절차와 삭제 후 검증을 Must Have로 명시(상세 근거는 QuotaSwitch README.md).

## 2026-07-04 옵션 설정 + 계정별 세션/주간 사용량 + 프로젝트 경로 추가 (재확인 + 결함 수정 포함)

Account 모듈에 `config`(옵션 설정)·계정별 세션(5h)·주간(7d) 사용량 표시(teamclaude 용어 채택)·계정별 마지막 사용 프로젝트 경로 표시를 추가. 재점검 과정에서 두 가지를 바로잡았다: ① 사용자가 "일간"→"현재 세션"으로 표현을 정정해, 처음부터 있던 공식 5h/7d 필드로 충분함을 확인(별도 로컬 집계는 Phase 3 부가 기능으로 격하), ② "계정 전환이 없으면 프로젝트 경로가 계속 비어있는" 실제 결함을 발견해 `Account.last_project_path`가 CLI 실행마다 갱신되도록 수정. 상세 근거는 QuotaSwitch README.md 참고.

## 2026-07-04 배포 방식 전환: 마켓플레이스 플러그인 → 독립 CLI (가장 큰 변경)

사용자 요청("CLI가 더 편하고 쉽고 강력하고 안전하고 문제없으면 전환")에 따라 teamclaude의 `eval $(teamclaude env) claude` 패턴(환경변수를 Claude Code 실행 전에 셸에서 설정)을 확인 — 이 구조가 마켓플레이스 방식의 두 핵심 리스크("재시작 필요", "프록시 인증 헤더 지원 불확실")를 원천 제거함을 근거로 **ClaudeTower을 독립 CLI로 전환**(마켓플레이스는 Phase 3 선택적 보조 채널로 격하). Display·Account 모듈 격리 아키텍처는 그대로 유지 — 배포 방식만 바뀌었을 뿐 보안 설계는 영향받지 않음. 상세 근거는 QuotaSwitch README.md(Account 모듈 원 설계) 참고.

## 2026-07-04 teamclaude 재검토로 Account 모듈 4가지 보강

teamclaude 설정 파일을 실측해 **OAuth 토큰을 평문 저장한다는 실제 약점을 확인** — Account 모듈이 OS 자격증명 저장소를 쓰는 이유가 증명된 사실이 됨. 그 외 로컬 프록시 API 키 인증 방식 검증, 포트 충돌 정책 확정(단순 종료), 재평가 주기·핫 리로드·caam의 sub-100ms 메커니즘 반영, 계정 그룹화 기능은 teamclaude에도 없어 Out of Scope로 명시. 상세 근거는 QuotaSwitch README.md 참고(Account 모듈 설계의 원본).

## 기존 두 프로젝트와의 관계

- PulseLine·QuotaSwitch 문서는 삭제하지 않고 그대로 남겨둠(연구 기록·의사결정 근거로 보존)
- 실제 구현은 이 통합 프로젝트(ClaudeTower) 기준으로 진행
- 각 원본 폴더의 README에 "ClaudeTower으로 통합됨" 안내를 추가함

## 미결 사항 (2026-07-15 갱신 — 상세 근거는 `01_PRD.md §7`·`04_PROJECT_SPEC.md` NEEDS CLARIFICATION 참고)

- [ ] 프로젝트 최종 이름 확정("ClaudeTower"은 여전히 가제) — 단, 상표 리스크 조사는 완료됐고
  (`04_PROJECT_SPEC.md` NEEDS CLARIFICATION 참고) 지금은 이름을 그대로 유지하기로 결정함
- [x] ~~라이선스·저작권자~~ → **확정**: Apache License 2.0, "SoDam AI Studio"(2026-07-03).
  배포 채널은 curl/PowerShell 원라이너·GitHub Release로 이미 가능, `npm install -g`만
  이름 미확정으로 보류 중
- [x] ~~(최우선, 법무 검토 필요) Account 모듈 포함으로 인해 이용약관 리스크가 플러그인 전체에
  걸리는 문제~~ → **해소(2026-07-15)**: Account 모듈 자체를 영구 보류하기로 확정해, "켜지
  않으면 무관하다"를 설명할 필요조차 없어짐(켤 수 있는 기능 자체가 없음). 상세 근거는
  `07_OAUTH_FLOW_SPEC.md §3` 참고
- [x] ~~Display 모듈만 담은 경량판 별도 배포 여부~~ → **N/A**: Account 모듈이 없으므로
  ClaudeTower 자체가 이미 "경량판"
- [x] ~~로컬 프록시 접근 토큰 구현 방식 실측 필요~~ → **N/A**: 로컬 프록시 자체가 만들어지지
  않음(Account 모듈 보류)
- [x] ~~OS별 자격증명 저장소 라이브러리 선택~~ → **결정은 완료**(`@napi-rs/keyring`,
  2026-07-11)했으나 Account 모듈 보류로 실제 연동은 하지 않음. Windows 코드서명 인증서
  구매 여부는 Display 모듈에 여전히 유효한 미해결 항목(`04_PROJECT_SPEC.md` 참고)