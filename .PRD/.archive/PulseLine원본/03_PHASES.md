# PulseLine (cc-pulseline) — Phase 분리 계획

> 한 번에 다 만들면 복잡해져서 품질이 떨어집니다.
> Phase별로 나눠서 각각 "진짜 동작하는 제품"을 만듭니다.

---

## Phase 1: MVP (1~2주 예상)

### 목표
`/plugin install`로 설치하고 `/pulseline:setup` 한 번이면, Windows(PowerShell만 있어도)·Mac·Linux 어디서든 프로젝트 위치 + 컨텍스트/비용/rate limit 색상 경고가 상태표시줄에 뜬다.

### 기능
- [ ] 크로스플랫폼 자동 설치/감지 (Windows PowerShell 단독 환경도 지원)
- [ ] **Node.js SEA 바이너리 빌드 (linux/macos/windows 3종, CI 매트릭스)** — 2026-07-04 재검토로 추가된 MVP 필수 항목(사용자 PC에 Node.js 설치를 요구하지 않기 위함, 근거는 04_PROJECT_SPEC.md 기술 스택 표 상단 참고)
- [ ] 프로젝트 위치 위젯 (`workspace.current_dir` 즉시 파싱)
- [ ] 임계값 색상 경고 (context/cost/rate_limit_5h/rate_limit_7d)
- [ ] `/pulseline:setup` 대화형 설정 명령
- [ ] `.claude-plugin/plugin.json` + `marketplace.json` 기본 배포 구조 (SEA 바이너리 3종 동봉)

### 데이터
- PlatformProfile, StatuslineConfig, Threshold, QuickSetup, Widget(type=location만)

### 인증
- 해당 없음(로컬 stdin JSON만 사용, 외부 API 호출 없음 — claudeline이 의존하는 비공개 OAuth API는 MVP에서 배제)

### "진짜 제품" 체크리스트
- [ ] **Node.js가 설치되지 않은 순정 Windows(네이티브 설치자로 Claude Code만 깐 환경)에서 SEA 바이너리가 그대로 동작** — Claude Code 자체가 Node.js 없이 설치되는 시대(2026-01 확인)이므로 이 조건 자체가 회귀 테스트 기준
- [ ] Windows(Git Bash 미설치) 환경에서 실제로 설치~설정~렌더링까지 수동 테스트 완료
- [ ] mock stdin JSON(공식 문서 예제 스키마)으로 단위 테스트 통과
- [ ] 실제 GitHub 저장소에 마켓플레이스로 배포되어 `/plugin marketplace add`로 설치 가능
- [ ] 하드코딩된 예시 데이터가 아니라 실제 세션의 `context_window.used_percentage` 등 라이브 값으로 렌더링
- [ ] **README·가이드 문서 작성 완료** (04_PROJECT_SPEC.md "README·가이드 문서 요구사항" 섹션 기준 — 비개발자 눈높이, 트러블슈팅·FAQ 포함)

### Phase 1 시작 프롬프트
```
이 PRD를 읽고 Phase 1을 구현해주세요.
@PRD/01_PRD.md
@PRD/02_DATA_MODEL.md
@PRD/04_PROJECT_SPEC.md

Phase 1 범위:
- 크로스플랫폼 자동 설치/감지 (Windows PowerShell 단독 환경 포함)
- Node.js SEA 바이너리 빌드 (linux/macos/windows, GitHub Actions 매트릭스)
- 프로젝트 위치 위젯 (workspace.current_dir 즉시 파싱)
- 임계값 색상 경고 (context/cost/rate_limit_5h/rate_limit_7d)
- /pulseline:setup 대화형 설정 명령
- plugin.json + marketplace.json 배포 구조 (SEA 바이너리 3종 동봉)

반드시 지켜야 할 것:
- 04_PROJECT_SPEC.md의 "절대 하지 마" 목록 준수
- 외부 비공개 API 호출 금지 (공식 문서화된 stdin JSON 필드만 사용)
- Windows를 "파일 기반 폴백"이 아닌 1급 대상으로 테스트
- 사용자 PC에 Node.js가 설치돼 있다고 가정하지 말 것 (SEA 바이너리로 배포, `node script.js` 직접 실행 금지)
```

---

## Phase 2: 확장 (1주 예상)

### 전제 조건
- Phase 1이 실제 마켓플레이스에 배포되어 최소 1개 환경(Windows 권장)에서 검증된 상태

### 목표
Git 브랜치·PR 상태까지 보여주면서도, 큰 저장소에서 느려지지 않도록 캐싱을 적용한다.

### 기능
- [ ] Git 위젯 (브랜치, staged/modified 파일 수)
- [ ] PR 위젯 (`pr.number`, `pr.review_state`)
- [ ] CacheEntry 기반 5초 TTL 캐싱 (session_id 키)

### 추가 데이터
- Widget(type=git, pr), CacheEntry

### 통합 테스트
- Phase 1의 location/threshold 위젯이 Git 위젯 추가 후에도 여전히 정상 동작하는지 확인
- 대형 저장소(파일 수 많은 monorepo)에서 캐싱 적용 전/후 응답 시간 비교

---

## Phase 3: 고도화 (2주 예상)

### 전제 조건
- Phase 1 + 2가 안정적으로 운영 중이며 실사용 피드백 확보

### 목표
ccstatusline 수준의 Powerline 테마 커스터마이징과, 경쟁 도구 어디에도 없는 subagent statusline 차별화 기능을 추가한다.

### 기능
- [ ] Powerline 위젯 시스템 (추가/삭제/재정렬, TUI 또는 슬래시 명령 기반)
- [ ] 색상 테마 프리셋 (Theme 엔티티)
- [ ] `subagentStatusLine` 공식 설정 활용한 서브에이전트 상태 커스터마이징

### 주의사항
- `subagentStatusLine`은 공식 문서상 신뢰(trust) 게이트가 statusLine과 동일하게 적용됨 — 플러그인 배포 시 `disableAllHooks` 상태에서도 안전하게 동작하는지 별도 검증 필요
- Powerline 테마는 Nerd Font 미설치 환경(CCometixLine 리서치에서 확인된 제약)에서 깨질 수 있어 plain 모드 폴백 필수

---

## Phase 로드맵 요약

| Phase | 핵심 기능 | 상태 |
|-------|----------|------|
| Phase 1 (MVP) | 크로스플랫폼 설치 + 프로젝트 위치 + 임계값 경고 + 쉬운 설정 | 시작 전 |
| Phase 2 | Git/PR 위젯 + 캐싱 | Phase 1 완료 후 |
| Phase 3 | Powerline 테마 + Subagent statusline 커스터마이징 | Phase 2 완료 후 |
