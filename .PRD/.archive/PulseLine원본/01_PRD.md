# PulseLine (cc-pulseline) — PRD (Product Requirements Document)

> 생성일: 2026-07-04
> 생성 도구: Show Me The PRD
> 리서치 근거: RESEARCH_SOURCES.md, RESEARCH_SOURCES-ADD.md + 6개 경쟁 도구 실측(ccstatusline, starship-claude, claudeline, cc-statusline, CCometixLine, ccusage)

---

## 1. 제품 개요

### 한 줄 요약
Claude Code 플러그인 마켓플레이스에서 명령 한 줄로 설치하고, 슬래시 명령 한 번으로 설정을 끝내는 크로스플랫폼(Windows 1급 지원) 상태표시줄 플러그인. 현재 작업 중인 프로젝트 위치, 컨텍스트/비용/rate limit 임계값 경고를 지연 없이 보여준다.

### 해결하는 문제
공식 Claude Code statusline 문서(`RESEARCH_SOURCES.md`)와 6개 커뮤니티 도구 실측(`RESEARCH_SOURCES-ADD.md` 기반) 결과, 다음 3가지를 **동시에** 만족하는 도구가 없다는 게 확인된 사실이다:

| 요구조건 | ccstatusline | starship-claude | claudeline | cc-statusline | CCometixLine |
|---|---|---|---|---|---|
| 마켓플레이스/플러그인 설치 | ✗ (npx) | △ (플러그인 O, Starship 별도설치 필요) | ✓ | ✗ (npx) | ✗ (npm -g) |
| Windows 1급 지원 | △ (Node 기반이라 가능하나 명시 안 됨) | ✗ (tmux/터미널 제한) | ✗ (파일 기반 "폴백") | △ ("수동 설정 가능성 있음") | ✓ (Windows용 .exe 별도 배포) |
| 설정 난이도 낮음 | △ (TUI 필요) | ✓ (대화형 마법사) | ✓ (`/claudeline:setup`) | ✓ (`npx init`) | ✓ (대화형 TUI) |

→ **가설이 아니라 6개 도구를 직접 리서치(WebFetch)해서 확인한 사실**이다. claudeline이 가장 근접하지만 Windows/Linux는 "파일 기반 폴백"으로 macOS(Keychain) 대비 2등 시민이고, 비공개 베타 API(`oauth-2025-04-20`)에 의존해 예고 없이 깨질 위험이 있다.

### 핵심 가치
1. **마켓플레이스 설치 + Windows 1급 지원 동시 충족** — claudeline의 설치 UX(강점 계승)를 Node.js로 재구현해 Windows를 폴백이 아닌 기본 대상으로 설계(약점 제거)
2. **프로젝트 위치 즉시 표시** — 공식 문서가 이미 제공하는 `workspace.current_dir`/`workspace.project_dir` 필드를 추가 프로세스 호출 없이 그대로 파싱. 별도 파일시스템 탐색 X → 지연 0에 수렴
3. **슬래시 명령 기반 대화형 설정** — claudeline(`/claudeline:setup`)·cc-statusline(`npx init`)의 "질문 몇 개로 끝" 패턴을 벤치마킹하되 jq 의존성(cc-statusline의 약점) 제거

---

## 2. 사용자

### 주요 사용자
- **누구**: Claude Code를 매일 쓰는 개발자, 특히 Windows(PowerShell 기본 + Git Bash) 환경 사용자
- **상황**: 여러 프로젝트 폴더를 오가며 Claude Code 세션을 동시에 여러 개 열어두고 작업, 서브에이전트를 자주 사용
- **목표**: 상태표시줄만 보고 "지금 어느 프로젝트인지 / 컨텍스트·비용이 위험 수위인지"를 즉시 파악하고 싶음

### 사용자 시나리오
1. 개발자가 `/plugin install cc-pulseline@cc-pulseline` 로 설치하고
2. `/pulseline:setup` 실행 후 2~3개 질문에 답하면
3. 설정 파일이 자동 생성되고, 다음 상호작용부터 상태표시줄에 프로젝트 위치·컨텍스트 색상 바·비용이 바로 나타난다

---

## 3. 핵심 기능

| 기능 | 설명 | 우선순위 | 복잡도 |
|------|------|----------|--------|
| 크로스플랫폼 자동 설치/감지 | Windows(PowerShell/Git Bash)·Mac·Linux를 감지해 Node.js 런타임으로 통일 실행 | P1 (MVP) | 복잡 |
| 프로젝트 위치 위젯 | `workspace.current_dir` 즉시 파싱·표시(기본: 폴더명만, 옵션: 전체 경로) | P1 (MVP) | 간단 |
| 임계값 색상 경고 | context/cost/rate_limit_5h/rate_limit_7d 별 warn·critical 색상 자동 전환 | P1 (MVP) | 간단 |
| 슬래시 명령 대화형 설정 | `/pulseline:setup`으로 질문 응답만 하면 설정 자동 완료 | P1 (MVP) | 보통 |
| Git/PR 위젯 + 캐싱 | 브랜치·staged/modified·PR 상태, session_id 기반 5초 캐시 | P2 | 보통 |
| Powerline 위젯 시스템 + 테마 | 위젯 추가/삭제/재정렬, 색상 테마 프리셋 | P3 | 복잡 |
| Subagent statusline 커스터마이징 | 공식 `subagentStatusLine` 설정 활용 — 6개 경쟁 도구 중 아무도 다루지 않는 영역(확인됨) | P3 | 복잡 |

---

## 4. 사용자 흐름 (User Flow)

### 핵심 흐름
```
설치(/plugin marketplace add) -> 활성화(/plugin install) -> 설정(/pulseline:setup) -> 즉시 반영
```

### 상세 흐름
1. **설치**: `/plugin marketplace add {owner}/cc-pulseline` → `/plugin install cc-pulseline@cc-pulseline`
2. **설정**: `/pulseline:setup` 실행 → "어떤 항목을 보여줄까요?" 등 2~3개 질문(AskUserQuestion 스타일) → PlatformProfile 자동 감지 + StatuslineConfig 파일 생성
3. **반영**: 다음 어시스턴트 메시지부터 상태표시줄에 즉시 표시(공식 문서: 새 메시지 후/컴팩트 후/권한모드 변경 시 갱신, 300ms 디바운스)

---

## 5. 성공 기준

- [ ] Windows(PowerShell만 있고 Git Bash가 없는 환경)에서도 폴백 없이 정상 작동 (claudeline 대비 핵심 차별점 검증)
- [ ] 설치~설정 완료까지 슬래시 명령 3개 이하, 3분 이내
- [ ] 상태표시줄 스크립트 실행 100ms 미만 (cc-statusline이 실측한 벤치마크 기준선)
- [ ] 프로젝트 위치가 추가 프로세스 호출 없이(stdin JSON 파싱만으로) 표시됨
- [ ] context 70%/90%, rate limit 임계값에서 색상이 자동 전환됨(공식 예제의 70/90 기준 계승)
- [ ] 악의적인 git 브랜치명(예: 셸 메타문자 포함)을 넣어도 명령어 주입 없이 안전하게 표시되거나 무시됨(04_PROJECT_SPEC.md 보안 요구사항 기준)

---

## 6. 안 만드는 것 (Out of Scope)

> 이 목록에 있는 건 Phase 1에서 만들지 않습니다.

- **Powerline 위젯/테마 커스터마이징 UI** — 이유: MVP는 "설치 쉬움 + Windows 지원"이라는 핵심 가치 검증이 우선. ccstatusline이 이미 이 영역의 강자이므로 서두를 필요 없음 (Phase 3)
- **Git/PR 상태 위젯** — 이유: 캐싱 설계(CacheEntry, session_id TTL)까지 얽혀 있어 MVP 범위를 벗어남 (Phase 2)
- **macOS Keychain/OAuth 기반 구독 사용량 조회(claudeline 방식)** — 이유: 비공개 베타 API(`oauth-2025-04-20`)에 의존하는 구조는 예고 없이 깨질 위험이 있다고 claudeline 리서치에서 확인됨. MVP는 공식 문서화된 stdin JSON 필드(`rate_limits.*`)만 사용해 안정성 확보
- **Subagent statusline 커스터마이징** — 이유: 차별화 포인트이지만 공식 `subagentStatusLine` 스펙 검증에 별도 시간이 필요해 MVP 이후로 연기 (Phase 3)

---

## 7. [NEEDS CLARIFICATION]

- [x] ~~배포 채널~~ → **개인 GitHub 마켓플레이스로 우선 출시, 실사용 검증 후 공식 제출은 별도 검토**. 근거: claudeline·cc-statusline·CCometixLine 모두 공식 마켓플레이스가 아닌 개인/조직 저장소로 시작해 성장한 패턴(리서치로 확인된 사실). 공식 제출은 심사 절차가 있어 MVP 출시 속도와 충돌
- [x] ~~라이선스~~ → **MIT로 확정**. 근거: 리서치한 도구 중 확인 가능했던 claudeline이 MIT를 명시했고, 개인 배포 플러그인 규모에서 Apache-2.0의 특허 조항은 과도함(일반적 OSS 관례 — 이 부분은 이 리포 고유 사실이 아니라 업계 관행 기반 판단임을 밝힘)
- [ ] 프로젝트 최종 이름 확정 (현재 "PulseLine / cc-pulseline"은 가제) — 사용자 결정 필요
- [ ] **(신규) Windows 코드서명 인증서 구매 여부** — 04_PROJECT_SPEC.md에 상세 근거 정리. 미서명 SEA 바이너리는 Windows SmartScreen 경고가 뜨는 게 확인된 사실이라, MVP는 무료 우회 안내로 시작하고 인증서 구매는 실사용자 피드백 이후로 의도적 보류
