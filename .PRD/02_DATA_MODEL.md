# ClaudeTower (claudetower) — 데이터 모델

> 이 문서는 Display 모듈(구 PulseLine)과 Account 모듈(구 QuotaSwitch)의 데이터를 하나로 정리하되, **모듈 경계를 명확히 표시**한다. 두 모듈의 데이터는 원칙적으로 서로 접근하지 않으며, 유일한 연결점은 `ActiveAccountHandle` 파일 하나뿐이다.

---

## 전체 구조

```
================== Display 모듈 (자격증명 접근 없음) ==================
[PlatformProfile] --1:1--> [StatuslineConfig] --1:N--> [Widget]
                                  ^                         |
                                  |                         v
                            [QuickSetup]              [Theme] (Phase 3)
[SessionSnapshot(Claude Code 제공)] --stdin JSON--> [Widget]이 값 읽어 렌더링
[CacheEntry] (Phase 2, session_id 기반 캐시)

                     |
                     | (단방향, 읽기 전용)
                     v
            [ActiveAccountHandle] <-- Account 모듈이 씀 (계정명만, 토큰 없음)
                     ^
                     | (단방향, 쓰기 전용)
                     |
================== Account 모듈 (자격증명 다룸, opt-in) ==================
[ModuleActivationState] --활성화 여부 게이트--> [ProxyConfig] --1:N--> [Account]
                                                                          |
                                                                          +--1:1--> [QuotaState]
                                                                          +--1:1--> [CredentialRef] --(참조만)--> OS 자격증명 저장소
                                                                          +--1:N--> [RotationEvent]
```

---

## 모듈 경계 규칙 (Must Have — 코드 리뷰 시 반드시 확인)

- Display 모듈의 어떤 코드도 `CredentialRef`, `Account`, `ProxyConfig` 엔티티를 import하거나 참조하지 않는다
- Account 모듈은 `ActiveAccountHandle` 파일에 **계정 라벨(label)만** 쓴다 — 토큰·만료시각 등 민감 정보는 절대 포함하지 않는다
- `ModuleActivationState`가 `enabled: false`인 동안에는 Account 모듈의 어떤 코드 경로도 실행되지 않는다(단순히 "기능을 숨기는" 게 아니라 "코드가 로드조차 되지 않는" 수준의 격리)

---

## Display 모듈 엔티티 (PulseLine 원 설계 계승)

### PlatformProfile / StatuslineConfig / QuickSetup / Threshold / Widget / CacheEntry / Theme
필드 정의는 PulseLine 원본의 02_DATA_MODEL.md(`.PRD/.archive/PulseLine원본/02_DATA_MODEL.md`)와 동일하다 — 통합 과정에서 이 부분은 변경하지 않았다(불필요한 재설계 방지). 차이점은 단 하나, Widget 타입에 `active_account`(신규, Phase 3)를 추가한다:

| 필드 | 설명 | 예시 | 필수 |
|------|------|------|------|
| widget_id | 고유 식별자 | wg-account | O |
| type | 위젯 종류(신규 값 추가) | active_account | O |
| source | 값을 읽어오는 곳 | `ActiveAccountHandle` 파일(자격증명 아님) | O |

---

## Account 모듈 엔티티 (QuotaSwitch 원 설계 계승)

### Account / CredentialRef / QuotaState / ProxyConfig / RotationEvent
필드 정의는 QuotaSwitch 원본의 02_DATA_MODEL.md(`.PRD/.archive/QuotaSwitch원본/02_DATA_MODEL.md`)와 동일하다(토큰 만료 시각, 로컬 프록시 접근 토큰, `reeval_interval_ms`, `Account.last_project_path`/`last_used_at`(2026-07-04 결함 수정 — RotationEvent만으로는 전환이 없을 때 프로젝트 경로가 비는 문제 해결) 등 보안·teamclaude 재검토로 추가된 필드 포함) — 통합 과정에서 변경하지 않았다.

### ModuleActivationState (신규 — 통합 과정에서 추가)
Account 모듈이 켜져 있는지, 사용자가 리스크 고지에 언제 동의했는지 기록.

| 필드 | 설명 | 예시 | 필수 |
|------|------|------|------|
| enabled | Account 모듈 활성화 여부 | false(기본값) | O |
| consent_given_at | 이용약관 리스크 고지 동의 시각 | 2026-07-04T10:00:00Z | X (동의 전 없음) |
| consent_text_version | 동의 당시 고지 문구 버전(추후 문구 변경 시 재동의 필요 여부 판단용) | v1 | X |

---

## 연결 엔티티

### ActiveAccountHandle (신규 — 통합 과정에서 추가)
Account 모듈이 Display 모듈에게 "지금 활성 계정이 뭔지"만 알려주는 단방향 파일. 이 파일이 두 모듈 사이의 **유일한** 연결점이다.

| 필드 | 설명 | 예시 | 필수 |
|------|------|------|------|
| account_label | 현재 활성 계정의 라벨(사람이 붙인 이름만, ID·토큰 없음) | "업무용" | O |
| updated_at | 마지막 갱신 시각 | 2026-07-04T14:58:00Z | O |

### 관계
- Display 모듈 내부 관계는 PulseLine과 동일(변경 없음)
- Account 모듈 내부 관계는 QuotaSwitch와 동일(변경 없음), 단 `ModuleActivationState.enabled`가 false면 아래의 모든 Account 엔티티 관련 로직이 실행되지 않음
- Display ↔ Account는 `ActiveAccountHandle` 파일 하나로만 연결(Account가 쓰기, Display가 읽기 — 역방향 없음)

---

## 왜 이 구조인가

- **위험 격리를 데이터 모델 레벨에서 강제**: Display 모듈 엔티티 정의 어디에도 Account 모듈 엔티티에 대한 외래키(FK)가 없다 — 이렇게 하면 개발자가 실수로 Display 코드에서 자격증명에 접근하는 코드를 짜는 것 자체가 데이터 모델과 충돌해 리뷰 단계에서 걸러진다
- **점진적 신뢰**: `ModuleActivationState`를 별도 엔티티로 분리한 이유 — Account 모듈의 "켜짐/꺼짐" 상태를 명시적으로 추적해야, "사용자가 동의한 적 없는데 계정 관련 코드가 돌고 있었다"는 상황을 원천적으로 방지할 수 있음
- **기존 설계 재사용**: PulseLine·QuotaSwitch 각각의 데이터 모델을 재설계하지 않고 그대로 가져온 이유 — 이미 여러 차례 검토를 거쳐 안정화된 구조를 불필요하게 다시 흔들지 않기 위함(Simplicity First 원칙)

---

## [NEEDS CLARIFICATION]

- [ ] `ActiveAccountHandle` 파일도 다른 사용자가 못 읽게 권한 제한이 필요한지(계정 라벨 자체는 민감도가 낮지만, 어떤 계정을 쓰는지가 노출되면 곤란한 사용자도 있을 수 있음)
- [ ] `consent_text_version`이 바뀌면(예: 리스크 고지 문구를 더 명확하게 개정) 기존에 동의한 사용자에게 재동의를 요구할지 정책 필요