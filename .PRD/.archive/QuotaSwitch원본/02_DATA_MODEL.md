# QuotaSwitch (cc-quotaswitch) — 데이터 모델

> 이 문서는 여러 계정을 자동 전환하는 프록시 플러그인이 다루는 핵심 데이터의 구조를 정의합니다.
> **원칙: OAuth 토큰 등 실제 비밀값은 이 모델에 절대 직접 저장하지 않는다.** 항상 OS 자격증명 저장소를 가리키는 "참조"만 다룬다.

---

## 전체 구조

```
[ProxyConfig] --1:N--> [Account] --1:1--> [QuotaState]
                            |
                            +--1:1--> [CredentialRef] --(가리킴, 저장 안 함)--> OS 자격증명 저장소(DPAPI/Keychain/libsecret)
                            |
                            +--1:N--> [RotationEvent] (from_account / to_account 로 참조)
```

---

## 엔티티 상세

### Account
등록된 Claude 계정 한 개. "이 계정으로 로그인했다"는 사실만 담고, 실제 토큰 값은 담지 않는다.

| 필드 | 설명 | 예시 | 필수 |
|------|------|------|------|
| account_id | 고유 식별자 | acc-001 | O |
| label | 사용자가 붙인 별명 | "업무용", "개인용" | O |
| auth_type | 인증 방식 | oauth / api_key | O |
| status | 현재 상태 | active / cooldown / disabled | O |
| created_at | 등록 시각 | 2026-07-04T10:00:00Z | O |
| last_project_path | (신규 — 결함 수정) 이 계정이 마지막으로 사용된 프로젝트 경로. `quotaswitch` CLI 실행마다(전환 여부와 무관하게) 매번 갱신 | D:/AI_Dev_Work/my-project | X |
| last_used_at | (신규) 마지막 사용 시각 | 2026-07-04T15:00:00Z | X |

### CredentialRef
Account가 실제 자격증명을 어디서 찾을지 가리키는 참조. **비밀값 자체는 여기 없음.**

| 필드 | 설명 | 예시 | 필수 |
|------|------|------|------|
| account_id | Account 참조 | (FK) | O |
| backend | 사용 중인 OS 저장소 종류 | windows_dpapi / macos_keychain / linux_libsecret / file_fallback_encrypted | O |
| external_ref | 저장소 내부에서 이 항목을 찾는 키 이름 | "cc-quotaswitch/acc-001" | O |
| token_expires_at | OAuth 토큰 만료 시각(신규 — 보안 검토로 추가, 만료 임박 시 자동 갱신 트리거) | 2026-07-04T18:00:00Z | O |
| last_refreshed_at | 마지막 토큰 갱신 시각 | 2026-07-04T10:00:00Z | X |

### QuotaState
계정별 현재 할당량 사용 현황. 프록시가 API 응답 헤더를 읽어 주기적으로 갱신.

| 필드 | 설명 | 예시 | 필수 |
|------|------|------|------|
| account_id | Account 참조 | (FK) | O |
| five_hour_used_pct | 5시간 윈도우 사용률(%) | 82.5 | O |
| seven_day_used_pct | 7일 윈도우 사용률(%) | 41.0 | O |
| five_hour_resets_at | 5시간 윈도우 리셋 시각 | 2026-07-04T15:00:00Z | O |
| seven_day_resets_at | 7일 윈도우 리셋 시각 | 2026-07-10T00:00:00Z | O |
| last_checked_at | 마지막 갱신 시각 | 2026-07-04T10:05:00Z | O |

### ProxyConfig
로컬 프록시 서버 자체의 설정. 계정과 무관하게 전역적으로 하나만 존재.

| 필드 | 설명 | 예시 | 필수 |
|------|------|------|------|
| port | 로컬 리슨 포트 | 41411 | O |
| bind_address | 바인딩 주소(항상 로컬호스트 고정) | 127.0.0.1 | O |
| threshold_pct | 전환 임계값(%) | 98 | O |
| upstream_url | 실제 Anthropic API 주소 | https://api.anthropic.com | O |
| access_token | 로컬 프록시 접근 토큰(신규 — 보안 검토로 추가). 프로세스 재시작마다 새로 생성, 디스크 비저장 | (메모리/OS 저장소만, 예시 생략) | O |
| reeval_interval_ms | 계정 우선순위를 주기적으로 재평가하는 간격(신규 — teamclaude 실측 확인: `~/.config/teamclaude.json`의 `reevalIntervalMs`, 기본 5분/300000ms, 0이면 타이머 비활성화). 임계값 도달 즉시 전환과 별개로, 더 유리한 계정이 생겼는지 주기적으로 점검 | 300000 | O |
| port_retry_max | 포트 충돌 시 자동 탐색을 시도할 최대 횟수(신규 — 04_PROJECT_SPEC.md "포트 충돌 처리" 참고) | 10(최초 설정) / 20(런타임 재시작) | O |
| last_port_change_at | 포트가 마지막으로 자동 변경된 시각(신규). 이 값이 있으면 "재시작이 필요한 상태"임을 진단 명령이 판단하는 근거로 사용 | 2026-07-04T15:00:00Z | X |

### UsageHistory (Phase 3 부가 기능으로 격하 — 2026-07-04 재확인)
과거 여러 날의 사용 패턴을 돌아보기 위한 참고용 로컬 집계(ccusage 벤치마킹). **주의**: 이 엔티티는 사용자의 핵심 요청("현재 세션·주간 사용량")과는 다른 것이다. 재확인 결과 사용자가 원한 건 이미 존재하던 `QuotaState.five_hour_used_pct`/`seven_day_used_pct`(teamclaude의 "session (5h) quota"/"weekly (7d) quota"와 동일 개념)였다 — MVP 표시는 QuotaState만으로 충분하며, UsageHistory는 그 이상을 원하는 사용자를 위한 Phase 3 선택 기능으로 유지한다.

| 필드 | 설명 | 예시 | 필수 |
|------|------|------|------|
| account_id | Account 참조 | (FK) | O |
| date | 집계 기준 날짜(로컬 타임존, ccusage의 `--timezone` 옵션과 동일 사상) | 2026-07-04 | O |
| request_count | 그 날 이 계정으로 보낸 요청 수 | 42 | O |
| tokens_used | 그 날 사용된 토큰 수(입력+출력, 가능한 범위에서) | 128000 | X (API가 안 줄 수 있음) |
| week_start_date | 이 날짜가 속한 주의 시작일(주간 집계 조회용) | 2026-06-29 | O |

### RotationEvent
계정이 언제, 왜 전환됐는지 남기는 감사 로그. 자격증명을 다루는 도구이므로 필수 — 문제 발생 시 추적 가능해야 함. **2026-07-04 사용자 요청으로 `project_path` 필드 추가** — 계정별로 어떤 프로젝트에서 쓰였는지 추적하기 위함(아래 "왜 이 구조인가" 참고).

| 필드 | 설명 | 예시 | 필수 |
|------|------|------|------|
| event_id | 고유 식별자 | evt-001 | O |
| from_account_id | 전환 전 계정 | acc-001 | X (최초 선택 시 없음) |
| to_account_id | 전환 후 계정 | acc-002 | O |
| project_path | (신규) `quotaswitch` CLI 실행 시점의 작업 디렉토리 — **감사로그 맥락**(이 전환이 어느 프로젝트에서 일어났는지 기록). 실시간 "마지막 사용 프로젝트" 표시는 이 필드가 아니라 Account.last_project_path를 참조한다(아래 결함 수정 참고) | D:/AI_Dev_Work/my-project | X (CLI 경유 실행이 아니면 없음) |
| reason | 전환 사유 | quota_threshold / http_429_failover / manual | O |
| occurred_at | 발생 시각 | 2026-07-04T14:58:00Z | O |

### 관계
- ProxyConfig 1개는 여러 Account를 관리(1:N) — 전역 설정 하나에 계정 여러 개
- Account 1개는 CredentialRef 1개, QuotaState 1개를 가짐(각각 1:1)
- Account 1개는 여러 RotationEvent에 from/to로 등장할 수 있음(1:N, 양방향 참조)

---

## 결함 수정: "마지막 사용 프로젝트"가 계속 비어있을 수 있었던 문제 (2026-07-04 재점검)

**발견된 결함**: 최초 설계는 `RotationEvent.project_path`만으로 "계정별 마지막 사용 프로젝트"를 보여주려 했으나, `RotationEvent`는 **계정이 전환될 때만** 생성되는 이벤트다. 계정이 1개뿐이거나, 등록한 지 얼마 안 돼 아직 할당량 임계값에 도달하지 않아 전환이 한 번도 안 일어났다면 `RotationEvent` 자체가 없어 프로젝트 경로를 표시할 방법이 없었다 — "빈틈"에 해당하는 실제 결함.

**수정**: `Account` 엔티티에 `last_project_path`·`last_used_at`을 추가하고, `quotaswitch` CLI가 실행될 **때마다**(전환 발생 여부와 무관하게) 현재 활성 계정의 이 필드를 갱신한다. `RotationEvent.project_path`는 감사로그 목적으로 그대로 유지하되, 실시간 표시(`quotaswitch accounts`)는 `Account.last_project_path`를 참조한다.

## project_path를 어떻게 얻는가 (ClaudeTower 모듈 격리 원칙과 충돌하지 않는 이유)

ClaudeTower 통합 설계에서 "Display 모듈이 알고 있는 정보(현재 프로젝트 경로)를 Account 모듈이 가져오려면 격리 원칙(Account→Display 단방향만 허용)을 깨야 하는가?"라는 질문이 생긴다. **답은 "아니오"** — `project_path`는 Display 모듈을 거치지 않고, **`quotaswitch` CLI 실행 시점의 `process.cwd()`(현재 작업 디렉토리)를 Account 모듈이 스스로 얻는다.** 사용자가 `quotaswitch`로 Claude Code를 실행하는 바로 그 순간 CLI 프로세스의 cwd가 곧 "지금 작업 중인 프로젝트 경로"이므로, Display 모듈의 정보에 의존할 필요가 없다. 모듈 경계는 그대로 유지된다.

## 왜 이 구조인가

- **보안 최우선**: CredentialRef가 "참조"만 갖고 실제 비밀값을 갖지 않는 건 aurakit-security.md의 "시크릿 하드코딩 금지" 원칙을 데이터 모델 레벨에서부터 강제하기 위함. 파일이 통째로 유출돼도 토큰 자체는 노출되지 않음(OS 저장소가 별도로 암호화)
- **감사 가능성**: RotationEvent를 처음부터 포함한 이유 — 이 도구는 사용자 모르게 계정을 바꾸는 도구이므로, "언제 왜 바뀌었는지" 추적 없이는 디버깅도 신뢰도 확보도 불가능. PulseLine(단순 표시 도구)과 달리 QuotaSwitch는 상태 변경을 일으키는 도구라 로그 엔티티가 필수
- **확장성**: QuotaState를 Account와 분리한 이유 — Phase 2 TUI 대시보드가 이 엔티티만 폴링하면 되고, Account 구조 자체를 건드릴 필요가 없음

---

## [NEEDS CLARIFICATION]

- [ ] RotationEvent 보관 기간(무제한 vs N일 후 자동 삭제) — 감사 목적과 로컬 저장 공간 사이 균형 필요
- [ ] file_fallback_encrypted 백엔드(OS 저장소를 못 쓰는 환경)의 암호화 방식 최종 확정 필요
