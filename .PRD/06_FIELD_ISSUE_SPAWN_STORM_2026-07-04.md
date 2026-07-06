# 06. 현장 이슈 리포트 — 0x800700e8 프로세스 생성 실패 & statusLine 갱신 주기 조절 불가 (2026-07-04)

> 성격: 05번 문서와 같은 **실사용 문제 분석 + 개선 백로그**입니다. 05 이슈#5(statusLine 스폰 모델 비효율)의 **실증 사례**이자 후속 요구사항입니다.
> 근거: 2026-07-04 실사용 세션에서 **실측된 값**만 사용합니다. 확정된 것은 `[확인됨]`, 추정은 `[가능성]`으로 구분 표기합니다.
> 목적: (1) 사용자 PC에서 반복 발생한 0x800700e8 오류의 원인 기록, (2) ClaudeTower statusLine 갱신 주기를 사용자가 조절할 수 있게 만드는 개선 요구 정의.

---

## 0. 한눈 요약

| # | 이슈 | 심각도 | 상태 | 한 줄 |
|---|------|--------|------|-------|
| 1 | `0x800700e8` ("파이프를 닫는 중") 간헐 오류 반복 | MEDIUM | 원인 구조 확정 · 실패 순간의 개별 프로세스 포착은 미완 | 프로세스 생성 폭주 환경에서 cmd/git 스폰이 간헐적으로 실패 |
| 2 | statusLine `refreshInterval` 사용자 조절 불가 | **HIGH (P1)** | **미해결 — 조절 시도가 막힌 지점 미확정** | 1초 고정 스폰이 폭주의 상수 기여 요인인데 사용자가 바꿀 방법이 없음 |

> **관계**: 이슈#1은 ClaudeTower 단독 결함이 아니라 환경 전체(다중 세션 + MCP 함대 + 훅)의 문제다. 그러나 statusLine의 "매초 × 세션 수 × 83MB exe 스폰"은 그 환경에서 **유일하게 멈추지 않는 상수 부하**이므로, ClaudeTower가 제공할 수 있는 가장 확실한 완화 수단이 이슈#2(주기 조절 옵션)다.

---

## 1. 이슈#1 — `0x800700e8` 프로세스 생성 실패

### 1.1 증상 `[확인됨]`
Claude Code 사용 중 아래 오류가 반복 표기됨(사용자 표현 "계속 뜬다"):
```
'C:\WINDOWS\system32\cmd.exe /d /s /c "git rev-parse --show-toplevel"' 시작 시
2147942632 (0x800700e8) 오류 발생
```
- 오류가 표시되는 정확한 창(어느 세션/어느 UI 레이어)은 **미확정** — 사용자 확인 미수집.

### 1.2 오류 코드 해석 `[확인됨]`
- `0x800700e8` = HRESULT(Win32 오류 232, `ERROR_NO_DATA`) = **"파이프를 닫는 중입니다"**.
- git 명령의 **실행 결과 오류가 아니라**, cmd.exe 자식 프로세스를 **띄우는 단계에서 부모-자식 통신 파이프가 끊긴 것**.
- `cmd.exe /d /s /c "..."` 래핑 형태는 Node 계열 도구가 shell 경유로 spawn할 때의 전형적 시그니처. (VS Code 내장 Git은 git.exe를 직접 실행하므로 이 형태가 아님 — 흔한 인터넷 진단 "IDE Git 기능을 꺼라"가 이 케이스에 안 맞는 이유.)

### 1.3 반증된 통설 `[확인됨 — 실측 반박]`
| 통설 (외부 AI/검색 답변) | 이 PC 실측 결과 |
|---|---|
| "백신이 git을 차단, 확률 매우 높음" | 백신은 Windows Defender 단독(실시간 보호 ON). 동일 명령 단독 실행 시 **정상 작동**(exit 128, "저장소 아님" 정상 응답) → 상시 차단 아님. 기껏해야 증폭 요인 `[가능성]` |
| "git safe.directory 설정 필요" | safe.directory 문제는 git 자체의 "dubious ownership" **텍스트 오류**를 내지, 스폰 단계 파이프 오류(0x800700e8)를 내지 않음. 무관. (`safe.directory *` 전역 설정은 보안 완화라 비권장) |

### 1.4 진단 데이터 (2026-07-04 18:30 실측)

**40초 실시간 프로세스 감시** (cmd.exe/git.exe/claudetower.exe 대상, 고유 228건 포착):
- `claude.exe` **13개** 동시 존재 `[확인됨]`:
  - 대화형 본체 3개 (powershell 부모 — 사용자 인지 창 수는 2개)
  - `--session-id` 부착 하위 인스턴스 5개 (부모=claude)
  - `--bg-pty-host` 백그라운드 도우미 5개 (**부모 이미 사망 = 고아**)
- MCP 서버 함대: 본체 8개가 **각각 12~15개** MCP 서버(cmd.exe+node 쌍)를 유지 — playwright, chrome-devtools, context7, railway, firebase, mongodb, data-agent-kit×2, toolbox×2, desktop-commander, kordoc, figma-talk 등 → **node.exe 총 260개**
- `claudetower.exe statusline` 스폰: 40초 동안 **35회+** 관찰 (세션별 refreshInterval 1초의 합산)
- 기타 동시 가동: 개발 서버 4개(next dev ×2, nest --watch, BizPick API), python 프로세스가 `claude.CMD -p`(헤드리스)를 반복 호출
- cmd.exe/git.exe 일부가 **명령줄을 판독하기도 전에 소멸**할 만큼 단명(수명 <0.1초, 샘플링 간격 미만) `[확인됨]` — 단, 그 개체가 `rev-parse`였는지는 **미확정** `[가능성]`

**시스템 자원** `[확인됨]`:
- 전체 프로세스 **1,157개** (일반 PC 200~300개 수준 대비 3~5배)
- claude+node RAM 합계 19GB / 시스템 RAM은 여유(24.5GB free / 63.2GB), CPU 12%
- → **RAM·CPU 고갈이 아니라 프로세스 생성 폭주(churn)가 본질**

### 1.5 근본 원인 분석
- `[확인됨]` 프로세스 생성 폭주 환경: 13개 claude 인스턴스 + 260개 node + 매초 statusLine 스폰(×세션 수) + 도구 호출마다 훅(node) 스폰 + 헤드리스 claude 반복 호출.
- `[가능성]` 이 폭주 속에서 자식 프로세스 시작 시 파이프 핸드셰이크가 간헐적으로 실패 → `ERROR_NO_DATA`. 실패하는 바로 그 순간의 개별 프로세스는 수명이 샘플링 간격보다 짧아 직접 포착하지 못함.
- `[확인됨]` ClaudeTower의 기여분: statusLine 1초 × 83MB exe × 세션 수 = **상시 스폰 부하**. 05 문서 이슈#1(설치 잠금 self-collision)과 **같은 뿌리** — "매초 대형 exe 스폰" 설계.
- 참고: 오류 자체는 비파괴적 — 실패한 git 확인은 다음 주기에 재시도되므로 데이터 손상 없음 `[확인됨: 재시도 구조]`. 다만 시스템이 스폰 한계선에서 돌고 있다는 경고 신호.

---

## 2. 이슈#2 — statusLine `refreshInterval` 사용자 조절 불가 (P1)

### 2.1 현황 `[확인됨]`
- `~/.claude/settings.json`에 설치 시 다음이 기록됨:
  ```json
  "statusLine": {
    "type": "command",
    "command": "\"C:/Users/PC/.claudetower/bin/claudetower.exe\" statusline",
    "refreshInterval": 1
  }
  ```
- 사용자가 1초 → 5초로 조절을 시도했으나 **실패("막혀서 조절 실패")**.

### 2.2 조절이 막힌 지점 — 미확정, 조사 필요
- `[가능성 A]` SoDamHarness 가드 훅(PreToolUse)이 `.claudetower`/`settings.json` 관련 편집·명령을 차단. (과거 실측: 가드가 `.claudetower` 경로 명령을 deny한 사례 있음 — 05 문서 이슈#6과 동일 계열)
- `[가능성 B]` ClaudeTower 재설치/업데이트가 settings.json의 statusLine 블록을 **기본값으로 덮어씀** → 조절해도 원복.
- `[가능성 C]` 세션 캐시 — settings.json 변경이 열려 있는 세션에 미반영되어 "안 바뀐 것처럼" 보임.
- → **다음 조절 시도 때 실패 메시지/로그 원문을 확보**해서 A/B/C를 판별할 것.

### 2.3 개선 요구사항 (ClaudeTower 레포)

| ID | 요구 | 우선순위 |
|----|------|----------|
| ~~FR-1~~ ✅ | **갱신 주기 조절 명령 제공** — **2026-07-06 구현**: `claudetower config statusline-refresh <초>` 추가(`src/display/config-command.js`), settings.json의 `refreshInterval` 키만 원자적으로 수정. 단위테스트 + 실제 CLI 스모크 테스트로 확인 | **P1** |
| ~~FR-2~~ ✅ | **업데이트/재설치 시 사용자 설정 보존** — **2026-07-06 구현**: install.ps1이 아니라 `claudetower setup`(`setup-wizard.js`) 쪽에서 처리 — 재실행 시 기존 `refreshInterval`이 있으면 그대로 유지, 없을 때만 기본값 1 기록. 단위테스트로 확인 | **P1** (FR-1과 세트 — 보존 없으면 조절이 무의미) |
| ~~FR-3~~ ✅ | **기본값 재검토** — **2026-07-06 적용**: 신규 설치 기본값을 1초 → 3초로 변경(`setup-wizard.js`). 이 PC에 실제 3초를 적용해 부작용 없음을 먼저 확인한 뒤 기본값 자체를 바꿈. 테스트로 확인 완료 | P2 |
| (추가) | **FR-1을 채팅으로도** — 2026-07-06: `/claudetower-widgets` 스킬이 `config statusline-refresh`도 실행할 수 있도록 확장(`allowed-tools`에 `config *` 추가). 위젯 켜고 끄기와 동일하게 터미널 없이 자연어로 갱신 속도 조절 가능 | — |
| FR-4 | **스폰 모델 자체 개선**(중기): 매초 83MB exe 재실행 대신 상주(daemon)+캐시 응답 또는 경량 출력 모드. 05 이슈#5와 동일 항목 — 본 문서의 실측(40초에 35회+ 스폰, 폭주 환경 기여)이 실증 근거 추가. | P2~P3 |
| FR-5 | **조절 실패 지점 규명**: §2.2의 A/B/C 재현 실험 및 로그 확보. 원인이 ClaudeTower 외부(가드 훅)면 05 이슈#6에 교차 기록. | P1 조사 |

### 2.4 완료 기준 (done-when)
- [x] `claudetower config statusline-refresh 5` 실행 → settings.json의 `refreshInterval: 5` 반영 확인 — **2026-07-06**: 스크래치 settings.json으로 실제 CLI 실행해 확인(`[확인됨]`), 다른 키(`hooks`) 보존도 함께 확인
- [x] 재설치(setup 재실행) 후에도 `refreshInterval: 5` 유지 확인 — **2026-07-06**: 단위테스트로 확인(`[확인됨]`). 단, 실제 `irm install.ps1 | iex` 원라이너 재설치 경로까지 통째로 실측하지는 않음(install.ps1은 exe만 교체하고 refreshInterval을 건드리지 않으므로 로직상 영향 없음 — `[가능성]`으로 남김)
- [ ] 40초 프로세스 감시 재실행 → claudetower.exe 스폰 횟수가 세션 수 × 8회 이하로 감소 (기존: 세션 수 × 40회) — **미실측**: 이 값 적용 자체를 이 PC의 실제 설정에 반영해야 측정 가능, 이번 세션에서는 코드 구현까지만 진행
- [ ] 0x800700e8 재발 빈도 관찰 기록 (완전 소멸은 보장 못함 — 환경 요인이 남아 있으므로 정직하게 "감소"로 측정) — **미실측**, 장기간 관찰 필요

---

## 3. 환경 요인 메모 (ClaudeTower 밖 — 참고용)

이슈#1의 재현 환경에서 ClaudeTower 외 큰 축 두 가지 `[확인됨]`. ClaudeTower 결함이 아니므로 백로그가 아닌 사용자 운영 메모:
1. **잔류 claude 프로세스**: 창은 2~3개인데 `--bg-pty-host` 고아 5개 + `--session-id` 하위 5개가 상주. 세션 종료 시 정리되지 않는 Claude Code 쪽 동작.
2. **세션당 MCP 서버 12~15개 자동 로드**: 설치된 플러그인들이 세션(헤드리스 포함)마다 전량 스폰됨. 미사용 플러그인 비활성화가 node 260개를 수십 개 수준으로 줄이는 가장 큰 지렛대.
