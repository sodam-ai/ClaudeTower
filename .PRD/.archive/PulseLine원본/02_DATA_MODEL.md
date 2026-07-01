# PulseLine (cc-pulseline) — 데이터 모델

> 이 문서는 상태표시줄 플러그인이 다루는 핵심 데이터의 구조를 정의합니다.
> 개발자가 아니어도 이해할 수 있는 "개념적 ERD"입니다.

---

## 전체 구조

```
[PlatformProfile] --1:1--> [StatuslineConfig] --1:N--> [Widget]
                                  ^                         |
                                  |                         v
                            [QuickSetup]              [Theme] (Phase 3, 참조)
                        (설정 마법사, 이 엔티티가
                         StatuslineConfig를 씀)

[SessionSnapshot]  (Claude Code가 stdin JSON으로 매 호출마다 제공 — 우리가 만드는 게 아니라 "읽기만" 함)
      |
      +--workspace.current_dir / workspace.project_dir--> [Widget:location] (MVP 기본 ON)
      +--context_window.used_percentage 등-------------->  [Threshold] 평가 -> 색상 결정
      +--session_id-------------------------------------->  [CacheEntry] (Phase 2, 캐시 키)
```

---

## 엔티티 상세

### PlatformProfile
설치 시 한 번 감지되는 실행 환경 정보. "이 컴퓨터가 Windows인지 Mac인지, 어떤 셸을 쓰는지"를 기억해 두는 카드.

| 필드 | 설명 | 예시 | 필수 |
|------|------|------|------|
| os_type | 운영체제 종류 | windows | O |
| shell_type | 감지된 셸 | powershell / gitbash / bash / zsh | O |
| script_runtime | 실행에 쓸 런타임(항상 node로 통일) | node | O |
| detected_at | 감지한 시각 | 2026-07-04T10:00:00Z | O |

### StatuslineConfig
사용자가 실제로 보게 될 상태표시줄의 설정값. "무엇을 보여줄지"를 담은 설정 카드.

| 필드 | 설명 | 예시 | 필수 |
|------|------|------|------|
| config_id | 고유 식별자 | cfg-abc123 | O |
| platform_id | PlatformProfile 참조 | (FK) | O |
| enabled_fields | 켜진 표시 항목 목록 | [model, location, cost, context] | O |
| project_override | 프로젝트별 설정 덮어쓰기 허용 여부 | true | X |
| padding | 좌우 여백(문자 수) | 2 | X |
| refresh_interval | 유휴 상태에서도 강제 갱신할 초 단위(선택) | 없음(이벤트 기반만) | X |

### QuickSetup
`/pulseline:setup` 슬래시 명령이 실행될 때 만들어지는 "설정 마법사" 세션. 이 세션이 끝나면 StatuslineConfig가 자동 저장된다.

| 필드 | 설명 | 예시 | 필수 |
|------|------|------|------|
| setup_id | 고유 식별자 | setup-001 | O |
| mode | 설정 진입 방식 | slash_command | O |
| entry_point | 실행 명령 이름 | /pulseline:setup | O |
| writes_to | 결과가 저장되는 대상 | StatuslineConfig(config_id) | O |
| last_run_at | 마지막 실행 시각 | 2026-07-04T10:05:00Z | X |

### Threshold
컨텍스트·비용·rate limit 값에 따라 색상을 언제 바꿀지 정하는 규칙. StatuslineConfig에 여러 개 딸려 있다.

| 필드 | 설명 | 예시 | 필수 |
|------|------|------|------|
| metric | 대상 지표 | context / cost / rate_limit_5h / rate_limit_7d | O |
| warn_at | 경고색으로 바뀌는 기준(%) | 70 | O |
| critical_at | 위험색으로 바뀌는 기준(%) | 90 | O |
| color_warn | 경고 색상 코드 | 노랑(\033[33m) | O |
| color_critical | 위험 색상 코드 | 빨강(\033[31m) | O |

### Widget
상태표시줄에 실제로 렌더링되는 표시 요소 하나하나. `location`(MVP 기본 포함)과 `git`/`pr`(Phase 2), `custom`(Phase 3)까지 같은 구조를 공유한다.

| 필드 | 설명 | 예시 | 필수 |
|------|------|------|------|
| widget_id | 고유 식별자 | wg-location | O |
| type | 위젯 종류 | location / model / context / git / pr / cost / rate_limit | O |
| position | 표시 순서(왼쪽부터) | 1 | O |
| enabled | 켜짐 여부 | true | O |
| source_field | SessionSnapshot에서 값을 가져올 필드 (location 위젯 예시) | workspace.current_dir | X (타입별 상이) |
| display_mode | 표시 방식 (location 위젯 예시) | dir_name_only(기본) / full_path | X |
| max_length | 표시 최대 길이 (location 위젯 예시) | 20 | X |

### CacheEntry (Phase 2)
git 상태처럼 조회가 느린 값을 잠깐 저장해 두는 임시 저장소. 공식 문서 권장대로 프로세스 ID가 아닌 `session_id`를 키로 쓴다(동시 세션끼리 캐시가 섞이지 않도록).

| 필드 | 설명 | 예시 | 필수 |
|------|------|------|------|
| session_id | Claude Code 세션 식별자(캐시 파일명에 사용) | abc123 | O |
| key | 캐시 항목 이름 | git_branch / git_staged / pr_status | O |
| value | 캐시된 값 | "main\|2\|0" | O |
| cached_at | 저장 시각 | 2026-07-04T10:00:05Z | O |
| ttl_sec | 유효 기간(초) | 5 | O |

### Theme (Phase 3)
Powerline 스타일 색상·구분자 테마. ccstatusline의 강점을 벤치마킹하는 확장 영역.

| 필드 | 설명 | 예시 | 필수 |
|------|------|------|------|
| theme_id | 고유 식별자 | theme-default | O |
| separator_style | 구분자 스타일 | powerline / plain | O |
| color_palette | 위젯별 색상 매핑(JSON) | {"model":"cyan","git":"green"} | O |

### 관계
- PlatformProfile 1개는 StatuslineConfig 1개를 가짐(1:1) — 설치 시점에 감지된 환경마다 설정 하나
- StatuslineConfig 1개는 여러 Widget을 가짐(1:N)
- QuickSetup은 StatuslineConfig를 "쓰는" 주체 — 별도 영구 데이터라기보다 설정 세션 로그에 가까움
- SessionSnapshot(외부 입력)은 저장되지 않고 매 호출마다 Widget이 값을 읽어가는 원천 데이터
- CacheEntry는 session_id로 구분되어 Widget(git/pr 타입)이 느린 조회를 피하도록 돕는 임시 저장소

---

## 왜 이 구조인가

- **MVP 최소성**: PlatformProfile·StatuslineConfig·Threshold·QuickSetup·Widget(location만) 5개 개념으로 시작 — 사용자가 요청한 "프로젝트 위치 감지"와 "쉬운 설정"을 정확히 이 5개로 커버
- **확장성**: Widget을 처음부터 `type` 필드로 일반화해 둬서 Phase 2(git/pr)·Phase 3(custom/theme)에서 새 엔티티를 만들지 않고 타입만 추가하면 됨 — claudeline·ccstatusline 리서치에서 확인된 "위젯 확장 시 구조 재설계" 문제를 사전에 방지
- **성능 반영**: CacheEntry가 `session_id`를 키로 쓰는 것은 공식 문서(`RESEARCH_SOURCES.md` 848~850행)가 명시적으로 권장하는 패턴을 그대로 채택한 것 — PID 기반 캐시는 매 호출마다 무효화된다는 게 문서에 확인된 사실
- **단순성**: SessionSnapshot을 별도 DB로 저장하지 않고 "매번 읽고 버리는" 구조로 설계 — 상태표시줄은 세션이 끝나면 값도 의미가 없으므로 영속 저장이 불필요(사용자 프라이버시 측면에서도 안전)

---

## [NEEDS CLARIFICATION]

- [x] ~~project_override 저장 위치~~ → **프로젝트 로컬 `.claude/settings.json`으로 확정**. 근거: 공식 문서(RESEARCH_SOURCES.md 50행)가 "사용자 설정 또는 프로젝트 설정에 statusLine 필드 추가"를 이미 공식 지원한다고 명시함 — 별도 전역 딕셔너리를 새로 설계하는 건 공식 메커니즘과 중복되는 불필요한 설계(단순성 원칙 위반이라 배제)
