# QuotaSwitch (cc-quotaswitch) — Phase 분리 계획

> 한 번에 다 만들면 복잡해져서 품질이 떨어집니다.
> Phase별로 나눠서 각각 "진짜 동작하는 제품"을 만듭니다.

---

## Phase 1: MVP (2~3주 예상)

### 목표 (2026-07-04 CLI 전환 반영)
계정 2개 이상을 등록하고 `quotaswitch`로 Claude Code를 실행하면(재시작 불필요), 할당량 소진·429 오류 시 자동으로 계정이 전환돼 작업이 끊기지 않는다.

### 기능
- [ ] `quotaswitch setup` — OAuth 로그인으로 계정 등록, CredentialRef를 OS 자격증명 저장소에 연결
- [ ] **`quotaswitch accounts`**(신규, 2026-07-04 재확인) — 계정 목록·라벨·**세션(5h)·주간(7d) 사용률·리셋 시각** 조회(claude-swap `--list`, teamclaude `session (5h) quota`/`weekly (7d) quota` 용어 벤치마킹)
- [ ] **`quotaswitch remove <라벨>`**(신규) — 삭제 확인 절차 + OS 자격증명 저장소 삭제 완료 검증(단순히 목록에서만 빼는 게 아니라 실제 토큰 삭제까지 확인)
- [ ] 로컬 프록시 서버(127.0.0.1 바인딩) 기동
- [ ] **`quotaswitch`(또는 `eval $(quotaswitch env) claude`)** — Claude Code를 프록시 환경변수가 이미 설정된 상태로 실행하는 핵심 진입점(teamclaude `run`/`env` 벤치마킹, 재시작 개념 자체가 없음)
- [ ] **포트 충돌 자동 처리**(신규, 04_PROJECT_SPEC.md "포트 충돌 처리" 참고) — 최초 설정 시 순차 자동 탐색(최대 10회), 런타임 재시도 시 backoff 후 자동 전환(환경변수를 CLI가 매번 다시 계산해 주입하므로, 마켓플레이스 방식과 달리 "재시작 필요" 안내 자체가 불필요 — 다음에 `quotaswitch`로 실행할 때 새 포트가 자동 반영됨)
- [ ] 할당량 기반 자동 전환(use-or-lose, teamclaude 로직 벤치마킹)
- [ ] 429 즉시 failover
- [ ] RotationEvent 감사 로그 기록(소유자 전용 파일 권한)
- [ ] **로컬 프록시 접근 토큰 검증** (신규 — 보안 검토로 추가, 127.0.0.1 바인딩만으로는 불충분)
- [ ] **OAuth `state` 파라미터 CSRF 방어 + 토큰 만료 자동 갱신** (신규 — 보안 검토로 추가)

### 데이터
- Account, CredentialRef, QuotaState, ProxyConfig, RotationEvent (전체 — MVP부터 감사 로그 필수)

### 인증
- OAuth(Claude Max 계정 로그인 흐름), 토큰은 OS 자격증명 저장소에만 저장(평문 파일 저장 금지)

### "진짜 제품" 체크리스트
- [ ] 실제 계정 2개로 할당량 소진 상황을 재현해 자동 전환 동작 확인(mock 데이터 X)
- [ ] 프록시가 `127.0.0.1` 외 주소에서 접근 불가함을 실제 네트워크 테스트로 확인
- [ ] 토큰이 디스크에 평문으로 남지 않는지 파일 시스템 실사 확인
- [ ] **계정 삭제 후 OS 자격증명 저장소를 직접 조회해 토큰이 실제로 남아있지 않은지 확인**(teamclaude가 명시하지 않은 부분을 QuotaSwitch는 검증 가능하게 만드는 게 목표)
- [ ] **계정이 1개뿐이거나 전환이 한 번도 안 일어난 상태에서도 `quotaswitch accounts`의 "마지막 사용 프로젝트"가 비어있지 않은지 확인**(2026-07-04 재점검으로 발견한 결함의 회귀 테스트 기준)
- [ ] **(2026-07-04 CLI 전환 반영)** Windows에서 `quotaswitch`로 Claude Code를 실행하면 재시작 없이 즉시 프록시가 개입하는지 수동 E2E 테스트 완료
- [ ] **README·가이드 문서 작성 완료** (04_PROJECT_SPEC.md "README·가이드 문서 요구사항" 섹션 기준 — 비개발자 눈높이, 이용약관 리스크 최상단 고지, 트러블슈팅·FAQ 포함)

### Phase 1 시작 프롬프트
```
이 PRD를 읽고 Phase 1을 구현해주세요.
@PRD-QuotaSwitch/01_PRD.md
@PRD-QuotaSwitch/02_DATA_MODEL.md
@PRD-QuotaSwitch/04_PROJECT_SPEC.md

Phase 1 범위 (2026-07-04 CLI 전환 반영):
- quotaswitch setup 계정 등록(OAuth) + OS 자격증명 저장소 연동
- quotaswitch accounts / remove 계정 관리 CRUD
- 로컬 프록시 서버(127.0.0.1 고정 바인딩)
- quotaswitch(또는 eval $(quotaswitch env) claude)로 Claude Code 실행 — 재시작 불필요한 핵심 진입점
- 할당량 기반 자동 전환 + 429 즉시 failover
- RotationEvent 감사 로그
- Claude Code 플러그인 마켓플레이스 구조는 만들지 말 것(Phase 3 선택 사항)

반드시 지켜야 할 것:
- 04_PROJECT_SPEC.md의 "절대 하지 마" 및 "보안 요구사항(OWASP ASVS 매핑)" 목록 준수
- OAuth 토큰을 평문 파일에 저장하지 말 것 (OS 자격증명 저장소 필수)
- 프록시를 0.0.0.0이 아닌 127.0.0.1에만 바인딩하고, 로컬 프록시 접근 토큰 없는 요청은 거부할 것
- OAuth state 파라미터 검증 없이 토큰 교환을 진행하지 말 것
- README 최상단에 "이용약관 검토 전 개인 책임 하에 사용" 고지 포함
```

---

## Phase 2: 확장 (1~2주 예상)

### 전제 조건
- Phase 1이 실사용 계정으로 최소 1주일 이상 안정 운영된 상태

### 목표
할당량 상황을 눈으로 확인하고, 필요할 때 수동으로도 전환할 수 있게 한다.

### 기능
- [ ] TUI 대시보드(실시간 할당량 진행률, 리셋 카운트다운, 계정 테이블, 활동 로그) — teamclaude 벤치마킹(실측 확인된 키 조작: `s` 계정전환, `a` 추가, `d` 삭제, `q` 종료, `j`/`k` 네비게이션)
- [ ] **핫 리로드**(신규, teamclaude 벤치마킹) — 프록시 서버 재시작 없이 새 계정을 추가·반영. TUI에서 `R` 키로 설정 재로드하는 teamclaude 패턴을 계승
- [ ] 수동 강제 전환 명령(`/quotaswitch:switch`) — claude-swap 벤치마킹
- [ ] **`/quotaswitch:rename <기존라벨> <새라벨>`**(신규) — 계정 라벨 수정, teamclaude·claude-swap 둘 다 없는 기능
- [ ] **`quotaswitch purge`**(신규, CLI 명령으로 수정) — claude-swap `--purge` 벤치마킹, 전체 계정·설정 일괄 삭제(확인 절차 필수)
- [ ] **`quotaswitch config`**(신규) — 전환 임계값·전략(`best`/`next-available`)·포트를 대화형/플래그로 조정, 값 검증 포함
- [ ] **계정별 마지막 사용 프로젝트 경로 표시**(신규, 결함 수정 반영) — CLI 실행마다 `Account.last_project_path`를 갱신(전환이 없어도 항상 채워짐), RotationEvent.project_path는 감사로그용으로 별도 유지
- [ ] PulseLine 연동: 현재 활성 계정명을 파일로 남겨 PulseLine이 읽어가도록 (읽기 전용 인터페이스, QuotaSwitch가 쓰기 전용으로 파일만 갱신)
- [ ] **영구 셸 별칭 등록(opt-in)**(2026-07-04 CLI 전환으로 재정의 — 기존 "셸 wrapper 모드"는 이미 Phase 1부터 `quotaswitch` 실행이 기본이라 필요성 자체가 사라짐. 이 항목은 그마저도 생략하고 싶은 사용자를 위해 `claude` 명령 자체를 `quotaswitch` 경유로 바꾸는 선택 사항) — teamclaude의 `server`→`run` 구조 벤치마킹
- [ ] **선택적 마켓플레이스 래퍼**(신규) — `/quotaswitch:*` 슬래시 명령이 설치된 CLI를 그대로 호출하는 얇은 Claude Code 플러그인(마켓플레이스 발견성을 원하는 사용자를 위한 보조 채널)

### 추가 데이터
- 기존 엔티티 재사용, 새 엔티티 없음(대시보드는 QuotaState/RotationEvent 조회만)

### 통합 테스트
- Phase 1의 자동 전환이 대시보드·수동 전환 추가 후에도 정상 동작하는지 확인
- PulseLine이 있는 환경/없는 환경 모두에서 QuotaSwitch가 정상 동작하는지(느슨한 결합 확인)

---

## Phase 3: 고도화 (2주 예상)

### 전제 조건
- Phase 1 + 2가 안정적으로 운영 중

### 목표
전환 지연을 최소화하고, 실패 계정을 더 똑똑하게 관리한다.

### 기능
- [ ] sub-100ms 전환 최적화 — caam 벤치마킹. **구체적 메커니즘(실측 확인)**: caam은 OAuth 재인증을 매번 하지 않고, 이미 인증 완료된 여러 계정의 토큰 파일을 로컬에 미리 준비해두고 "파일 교체"만으로 전환해 ~50ms를 달성함 — QuotaSwitch의 CredentialRef가 이미 여러 계정을 참조로 들고 있는 구조와 사상이 같으므로, OS 자격증명 저장소 조회 자체를 캐싱해 전환 시점에 추가 I/O를 최소화하는 방향으로 구현
- [ ] cooldown 로직 고도화(실패한 계정을 일정 시간 후보에서 제외)
- [ ] `quotaswitch accounts --history`(신규, 격하) — 과거 여러 날의 사용 패턴 참고용 로컬 집계(ccusage 벤치마킹, UsageHistory 엔티티) — 2026-07-04 재확인으로 MVP에서 Phase 3 부가 기능으로 조정

### 주의사항
- 성능 최적화가 보안 검증(자격증명 조회 경로 등)을 생략하는 방향으로 가지 않도록 주의

---

## Phase 로드맵 요약

| Phase | 핵심 기능 | 상태 |
|-------|----------|------|
| Phase 1 (MVP) | 계정 등록 + 프록시 + 자동 전환 + 감사 로그 | 시작 전 |
| Phase 2 | TUI 대시보드 + 수동 전환 + PulseLine 연동 | Phase 1 완료 후 |
| Phase 3 | 전환 속도 최적화 + cooldown 고도화 | Phase 2 완료 후 |
