# ClaudeTower (claudetower) — 데이터 모델

> **[2026-07-15 결정] Account 모듈(Phase 2)은 보류 확정 — Anthropic 공식 이용약관 확인 결과
> 안전한 구현 방법이 없다(`.PRD/07_OAUTH_FLOW_SPEC.md §3` 참고). 아래 "Account 모듈 엔티티"
> 절과 `ActiveAccountHandle`은 설계 기록으로만 남는다 — 실제로 만들어지지 않는다. Display
> 모듈 엔티티(PlatformProfile/StatuslineConfig/Widget 등)만 실제로 존재하고 계속 쓰인다.

> **[2026-07-27 재개]** 위 보류 결정의 법적 근거는 그대로 유효하나, 사용자가 위험을
> 인지·수용한 뒤 하이브리드(OAuth+API키)로 재개를 확정했다(`07_OAUTH_FLOW_SPEC.md §5`,
> `CHECKPOINT.md` 트랙3 참고). 아래 Account 모듈 엔티티는 다시 유효한 설계다 — 다만
> 실제로 만들어지는 건 여전히 다음 세션(구현 세션)부터다.

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

**(2026-08-17 정정: 2026-08-17 PRD 준수 감사에서 실제 코드와 대조한 결과, 아래 4가지가
설계 문서와 다르게(의도적으로) 축소 구현되어 있음을 확인했다 — 실수 누락이 아니라 코드
주석이 사유까지 명시한 의도적 결정이며, 지금까지 이 문서에 반영되지 않아 정정한다.)**

- **`Widget.type`의 `pr` 값은 코드에 없다** — `src/display/config/widget-config.js:17`
  주석이 "git은 2026-08-03 Phase 3 신규(.PRD/01_PRD.md §3 'Git/PR 위젯 + 캐싱', PR 상태는
  제외)"라고 명시. **2026-09-01 정정**: 실제 `ALL_WIDGET_TYPES`(`widget-config.js:26`)는
  `['model','location','git','context','cost','rate_limit','active_account']` 7종이다
  — "6종뿐"이었던 이전 수치는 이 문단 바로 아래(2026-08-31, M62)에서 추가된
  `active_account`를 반영하지 못한 채 남아있던 오기. `pr` 값이 없다는 서술 자체는
  여전히 정확하다.
- ~~`active_account` 위젯은 아직 미구현이다~~ → **2026-08-31 구현 완료**: `src/display/widgets/
  active-account.js`(신규) — `src/shared/active-account-handle/read.js`를 통해서만
  `ActiveAccountHandle`을 읽는다(모듈 경계 규칙 그대로 준수, Account 엔티티 직접 참조 없음).
  `ALL_WIDGET_TYPES`/`WIDGET_LABELS`/`WIDGETS`/`WIDGET_DROP_PRIORITY` 4곳 전부 배선 완료.
  Account 모듈을 한 번도 켠 적 없는 사용자(핸들 파일 없음, 절대다수)에게는 항상 완전히
  비표시됨을 실제 CLI(`node bin/claudetower.js statusline`) 실행으로 직접 확인. `claudetower
  setup`의 대화형 질문 목록에서는 의도적으로 제외(Account가 Display 설치와 별개의 opt-in
  절차라는 원칙 유지) — 대신 `enabled_widgets`에 항상 조용히 포함되어, Account를 실제로
  쓰기 시작하면(`accounts switch`) 별도 설정 없이 자동으로 나타난다. 상세 근거는
  `CHECKPOINT.md` M62 참고.
- **PlatformProfile / QuickSetup 엔티티는 별도 데이터 구조로 구현되지 않았다** — Phase 1엔
  영속화가 필요하지 않다고 판단해(`src/display/config/widget-config.js` 주석 근거) 즉석
  판단값으로만 쓰이고 저장되지 않는다.
- **StatuslineConfig는 전체 필드가 아니라 `enabled_widgets`+`powerline_separator`만 있는
  플랫 `config.json`으로 축소 구현됐다** — `config_id`/`platform_id`(FK)/`project_override`/
  `padding`/`refresh_interval` 중 `refresh_interval`(별도 `config statusline-refresh` 명령)만
  구현되고 나머지는 없다(`src/display/config/widget-config.js:3-6`).

---

## Account 모듈 엔티티 (QuotaSwitch 원 설계 계승)

### Account / CredentialRef / QuotaState / ProxyConfig / RotationEvent
필드 정의는 QuotaSwitch 원본의 02_DATA_MODEL.md(`.PRD/.archive/QuotaSwitch원본/02_DATA_MODEL.md`)와 동일하다(토큰 만료 시각, 로컬 프록시 접근 토큰, `reeval_interval_ms`, `Account.last_project_path`/`last_used_at`(2026-07-04 결함 수정 — RotationEvent만으로는 전환이 없을 때 프로젝트 경로가 비는 문제 해결) 등 보안·teamclaude 재검토로 추가된 필드 포함) — 통합 과정에서 변경하지 않았다.

**2026-07-27 하이브리드 스키마 확인**: `Account.auth_type`(`oauth`/`api_key`) 필드가 이미
존재해 **스키마 변경이 불필요**하다는 것을 확인했다(재개 2라운드 teamclaude 실측 반영,
상세 근거는 `07_OAUTH_FLOW_SPEC.md §5-3` 참고 — 여기서는 중복 서술하지 않음).

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

- [x] ~~`ActiveAccountHandle` 파일도 다른 사용자가 못 읽게 권한 제한이 필요한지~~ →
  **2026-08-20 해소**: `active-account-state.json`(내부 활성 계정 포인터)·
  `active-account.json`(ActiveAccountHandle, Display 노출용)에 M30(RotationEvent 감사
  로그)과 동일한 소유자 전용 권한(Windows: `icacls`로 상속 ACE 제거 후 현재 사용자에게만
  전체 권한 부여, POSIX: `chmod 0o600`)을 실제로 구현·테스트·실측 확인했다
  (`src/accounts/accounts/active-account-state.js`, `src/shared/active-account-handle/write.js`).
  RotationEvent와의 차이점: 두 파일은 append가 아니라 매 쓰기마다 임시파일+`rename()`으로
  전체 교체되므로("최초 생성 시 1회만"이 아니라) 매 쓰기마다 임시 파일에 권한을 적용한다
  — 같은 볼륨 내 `rename()`은 원본(임시 파일)의 보안 속성을 그대로 옮기는 NTFS/POSIX 공통
  동작이라 최종 파일도 항상 소유자 전용 권한을 갖는다. 상세 근거는 `CHECKPOINT.md` M50 참고.
- [ ] `consent_text_version`이 바뀌면... 재동의를 요구할지 정책 필요 — **재개(2026-07-27)**:
  N/A(2026-07-15) 처리는 보류 결정에 근거했던 것이라 무효화, 구현 세션에서 재검토