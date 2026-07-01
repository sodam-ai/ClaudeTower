# PulseLine (cc-pulseline) — 디자인 문서

> **2026-07-04 업데이트: 이 프로젝트는 QuotaSwitch와 함께 [ClaudeTower](../../README.md)으로 통합되었습니다.** 실제 구현은 ClaudeTower 기준으로 진행하세요. 이 문서는 리서치·의사결정 근거 보존을 위해 삭제하지 않고 남겨둡니다.

> Show Me The PRD로 생성됨 (2026-07-04)
> 리서치 소스: RESEARCH_SOURCES.md, RESEARCH_SOURCES-ADD.md + ccstatusline/starship-claude/claudeline/cc-statusline/CCometixLine/ccusage 6개 도구 실측

## 문서 구성

| 문서 | 내용 | 언제 읽나 |
|------|------|----------|
| [01_PRD.md](./01_PRD.md) | 뭘 만드는지, 누가 쓰는지, 경쟁 도구 대비 차별점 | 프로젝트 시작 전 |
| [02_DATA_MODEL.md](./02_DATA_MODEL.md) | 설정·위젯·캐시 데이터 구조 | 코드 설계할 때 |
| [03_PHASES.md](./03_PHASES.md) | Phase 1(MVP)~3 단계별 계획 | 개발 순서 정할 때 |
| [04_PROJECT_SPEC.md](./04_PROJECT_SPEC.md) | 기술 스택, AI 행동 규칙 | AI에게 코드 시킬 때마다 |

## 다음 단계

Phase 1을 시작하려면 [03_PHASES.md](./03_PHASES.md)의 "Phase 1 시작 프롬프트"를 복사해서 그대로 사용하세요.

## 핵심 차별화 요약

기존 6개 도구(ccstatusline, starship-claude, claudeline, cc-statusline, CCometixLine, ccusage) 중 "마켓플레이스 설치 + Windows 1급 지원 + 쉬운 설정"을 동시에 만족하는 도구는 없다는 게 리서치로 확인됨. PulseLine은 claudeline의 설치 UX와 cc-statusline의 설정 간편함을 벤치마킹하되, JS로 개발하고 Node.js SEA 바이너리로 배포해 Windows를 폴백이 아닌 기본 대상으로 설계한다.

## 2026-07-04 재검토에서 발견한 핵심 리스크 (해결됨)

**문제**: Claude Code가 2026-01부터 Node.js 불필요한 네이티브 설치자를 공식 권장 경로로 전환(npm 설치는 deprecated). 애초 설계였던 "순수 Node.js 스크립트 배포"는 이 사실과 충돌해 MVP 성공 기준(Windows 정상 작동)이 조용히 깨질 위험이 있었음.
**해결**: 개발은 JavaScript 유지, 배포는 Node.js SEA(Single Executable Application, Node 22+ 안정화)로 전환 — 사용자 PC의 Node.js 설치 여부와 무관하게 동작. 상세 근거는 04_PROJECT_SPEC.md 기술 스택 표 상단 참고.

## 미결 사항 (해결된 항목은 취소선 문서에서 확인 가능)

- [x] 배포 채널 → 개인 마켓플레이스 우선 (01_PRD.md §7)
- [x] 라이선스 → MIT (01_PRD.md §7)
- [x] project_override 저장 위치 → 프로젝트 로컬 `.claude/settings.json` (02_DATA_MODEL.md)
- [x] 패키지 매니저 → npm (04_PROJECT_SPEC.md)
- [x] 최소 지원 Claude Code 버전 → v2.1.153+ (04_PROJECT_SPEC.md)
- [ ] 프로젝트 최종 이름 확정 ("PulseLine"은 가제) — 사용자 결정 필요, 01_PRD.md §7
- [ ] Windows 코드서명 인증서 구매 여부·예산 — 의도적 보류(실사용자 피드백 이후 결정), 04_PROJECT_SPEC.md
- [ ] SEA 빌드 파일 크기가 마켓플레이스 다운로드 경험에 문제 없는지 실측 필요 — 04_PROJECT_SPEC.md

## 2026-07-04 보안 요구사항 보강 (OWASP ASVS 매핑)

기존 목적·기능 범위·문서 구조는 그대로 두고, 04_PROJECT_SPEC.md에 ASVS 카테고리별 보안 요구사항 섹션을 추가. PulseLine은 로그인·세션·DB가 없는 로컬 단일 사용자 도구라 대부분 "해당 없음(이유 명시)"이지만, 실제 공격 표면인 두 가지는 Must Have로 명시: ① git 브랜치명 등 외부 문자열을 셸 명령에 문자열 결합으로 넣지 않기(명령어 주입 방지, `execFile`만 사용), ② stdin JSON을 신뢰하지 않는 입력으로 취급해 검증.

## 2026-07-04 법률·저작권·라이선스 요구사항 보강

04_PROJECT_SPEC.md에 라이선스(MIT)·저작권자 표기 일관성·외부 코드 재사용 범위·상표권·상업적 사용 범위·개인정보 관련 요구사항을 추가. 핵심 판단: 경쟁 도구(ccstatusline 등)는 "코드 복사가 아니라 아이디어만 참고"했음을 명시적으로 구분했고, "cc-" 접두사·"Claude Code" 언급의 상표 저촉 여부는 확인된 사실이 아니므로 [법무 검토 필요]로 분리했다(임의로 "문제없다"고 단정하지 않음).

## 2026-07-04 README·가이드 문서 요구사항 추가

04_PROJECT_SPEC.md에 "구현 완료 후 작성해야 할 README·가이드" 요구사항을 신설(설치·실행·명령어·워크플로우·보안·아키텍처·트러블슈팅·FAQ·법률 전 항목, 비개발자 눈높이 작성 기준 포함). Phase 1 "진짜 제품" 체크리스트에도 완료 조건으로 추가함 — 즉 README가 없으면 Phase 1이 끝난 게 아니다.
