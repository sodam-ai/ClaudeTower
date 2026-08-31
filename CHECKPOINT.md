# ClaudeTower — CHECKPOINT

> 마지막 갱신: 2026-07-26. 이 문서는 세션이 바뀌어도 "지금까지 뭘 했고, 다음에 뭘 해야 하는지"를 정확히 이어갈 수 있게 하는 목적 하나만 가진다. 완료 항목은 실제로 실행해 확인한 것만 done으로 표기한다(추측·희망 상태 금지).

> **2026-07-26 정정**: 이 문서가 2026-07-18 01:43 이후 갱신되지 않은 채 "M11 배포 미완료·승인 대기"로 남아있었으나, 그 사이(2026-07-16~17) main 병합과 v0.2.0/v0.3.0 릴리스가 이미 실제로 완료되어 있었다(`gh release list`·`git log origin/main` 직접 재확인, 아래 M11·M13 참고) — CHECKPOINT 자신이 stale해진 사례. M13에 정리했다.

> ## 🛑 실거래 배선 승인 게이트 (2026-08-20 결정 — 모든 세션이 반드시 먼저 읽을 것)
>
> `src/accounts/proxy/active-account-provider.js`(M44 이후)가 registry·credential-store·
> quota 파싱·전환 결정·회전 로그·`active-account-handle` 기록까지 전부 실제로 이어 붙여,
> `request-forwarder.js`가 요구하는 콜백을 그대로 반환하는 상태까지 완성됐다.
> `startProxyServer`에 이걸 넘기고 `bin/claudetower.js`에 진입점(예: `claudetower run`)
> 하나만 추가하면 **실제 사용자 트래픽을 가로채 진짜로 계정을 자동 전환하는 코드가
> 즉시 라이브로 켜진다.**
>
> **지금까지 사용자가 승인한 것**("하이브리드로 진행", `07_OAUTH_FLOW_SPEC.md §5`)은
> *원칙*에 대한 승인이지, **"지금 이 순간 실전 배선을 켜도 된다"는 승인이 아니다.**
> 이 프로젝트는 M9("차단벽 앞까지만")부터 M24·M41·M42·M44까지 매번 "실제 배선은
> 다음 세션 몫"이라고 반복해서 선을 그어왔다 — 그 선을 지금 넘지 않는다.
>
> **이유(숨기지 않고 명시)**: 지금까지의 모든 Account 코드는 격리된 단위테스트로만
> 검증됐고 실제 사용자 트래픽에 영향을 준 적이 단 한 번도 없다. 배선이 켜지는 순간
> 그 성격이 근본적으로 바뀐다 — 버그가 나면 그 자리에서 사용자의 실제 Claude Code
> 사용에 영향을 준다. `consent-text.js` 2-1항이 이미 고지한 "API 키 여러 개 로테이션이
> 남용방지 조항에 걸리는지 확인 안 됨"이라는 법적 불확실성도 이 시점부터 실제로
> 작동하기 시작한다.
>
> **기계적 강제(문서만으로는 여러 세션이 동시에 작업하는 이 환경에서 놓칠 수 있어
> 추가)**: `test/accounts/live-wiring-gate.test.js`가 `bin/claudetower.js`에
> `startProxyServer`/`active-account-provider`/`createRequestForwarder` 참조가
> 없음을 정적으로 강제한다(ESLint 모듈 경계 규칙과 동일한 방어 원칙). **이 게이트를
> 해제하려면 사용자가 이 구체적인 단계에 한해 별도로 명시 승인한 뒤, 그 테스트
> 자체를 의도적으로 수정해야 한다.**

---

> **📦 아카이브 안내(2026-08-20, 파일 크기 관리)**: 이 문서가 3,000줄(280KB)을 넘어
> 표준 파일 읽기 도구의 한도(256KB)를 초과하기 시작해(이 세션이 오늘 저녁 직접 겪은
> 실제 도구 오류), 오래되고 안정적으로 완료된 초기 마일스톤(M1~M29, 2026-07-04~
> 2026-08-04, Display 모듈 구축과 Account 모듈 안전지대 초기 준비 과정)을
> `CHECKPOINT.archive-1.md`로 옮겼다 — **내용은 한 글자도 삭제하지 않았고, 그대로
> 옮기기만 했다.** 이 문서에는 M30(2026-08-17)부터 이어지는 최신 마일스톤만 남아있다.
> M1~M29의 상세 내용이 필요하면 `CHECKPOINT.archive-1.md`를 직접 열어서 확인할 것.

## M30: 2026-08-17 — Windows ACL(icacls)로 RotationEvent 감사 로그 소유자 전용 권한 실제 구현

`.PRD/04_PROJECT_SPEC.md`의 ASVS V12 Must-Have("RotationEvent 감사 로그 파일은 소유자만
읽기 가능한 권한으로 생성")가 M20/M23에서 [NEEDS CLARIFICATION]으로 남아있던 유일한
미이행 보안 요구사항이었다. M20 실측대로 Windows에서 `fs.chmodSync(0o600)`은 에러 없이
성공하면서도 실제 파일 모드는 안 바뀌어(`fs.statSync` 대조 확인), 지금까지 이 감사
로그는 명세와 달리 사실상 보호되지 않고 있었다.

**착수 전 위험 점검(사용자 승인 후 진행)**: icacls 명령 자체가 credential-store(M16)처럼
classifier에 막힐 가능성을 먼저 임시 파일로 격리 테스트했다 — `/inheritance:r`(상속 ACE
제거) → `/grant:r <사용자>:F`(현재 사용자에게만 전체 권한 명시 부여) → `icacls <path>`로
재조회, 세 단계 전부 **classifier 차단 없이 정상 실행**됨을 확인. `credential-store`가
막힌 "OS 자격증명 저장소 I/O"와 "파일 ACL 조작"이 서로 다른 종류의 동작이라는 M25의
가설이 다시 한번 뒷받침됨.

**구현**: `src/accounts/audit/rotation-log.js`에 `restrictWindowsAcl(filePath)` 신설.
`process.platform === 'win32'`일 때만 이 경로를 타고, macOS/Linux는 기존
`fs.chmodSync(0o600)` + 재조회 검증 경로를 그대로 유지(크로스플랫폼 분기, 기존 로직
변경 없음). Windows 경로도 마찬가지로 "명령이 에러 없이 끝남" ≠ "의도한 상태가 됐음"을
구분한다 — `icacls` 실행 직후 그 출력을 다시 파싱해 **정확히 1개의 ACE만 있고, 그게
현재 사용자의 전체 권한(F)인지**까지 재확인한 값만 `permissionRestricted`로 반환한다.
icacls가 어떤 이유로 실패해도 예외를 던지지 않고 `permissionRestricted: false`로
안전하게 폴백한다 — "감사 로그를 끄거나 생략하지 마" DO NOT 규칙이 최우선이므로, 권한
강제가 실패해도 로그 기록 자체는 항상 성공해야 한다.

**실측 검증(라이브, mock 아님)**: 임시 파일에 실제 적용 전/후 `icacls` 조회 결과를
직접 대조 — 적용 전엔 `DESKTOP-FPDAAO6\CodexSandboxUsers`, 다수의 SID, `NT
AUTHORITY\SYSTEM`, `BUILTIN\Administrators` 등 **상속된 ACE 20개 이상**이 있었으나,
`/inheritance:r` + `/grant:r` 적용 후엔 `DESKTOP-FPDAAO6\PC:(F)` **단 하나만** 남음을
직접 확인.

**테스트**: `test/accounts/rotation-log.test.js`에 2건 추가 — ① 신규 생성 파일의 icacls
결과가 실제로 ACE 1개(현재 사용자, `(F)`)뿐이고 상속(`(I)`) 표시가 없는지 직접 조회해
검증, ② 이미 존재하는 파일에 이어 쓸 때는 icacls를 다시 건드리지 않는지(ACL 출력이
호출 전후 완전히 동일한지) 검증. 기존 "permissionRestricted" 테스트는 Windows 기대값을
`false`(구 chmod 결과)→`true`(신 icacls 결과)로 갱신.

**검증 결과(전부 직접 실행해 확인, 자기선언 아님)**:
- `test:accounts`: 91→**93**/93(신규 2건)
- `npm run lint`: 0 에러
- `npm run lint:boundary`: PASS(22개 파일, `src/display/` 무변화 — 이 작업은
  `src/accounts/`만 수정)
- `npm run verify`(Display 전용): 235/235 무변화(이번 작업과 무관, 회귀 없음 재확인)

**안전지대 원칙 유지**: 이 코드도 M24~M28과 동일하게 안전지대·미배선 상태 — `bin/claudetower.js`
는 여전히 `accounts` 관련 `require` 0건(재확인), CLI에서 실제로 호출되지 않음.
module-activation-state 게이트 그대로. main 반영·README 톤 변경 없음(노출 최소화
원칙, M20/077ade2와 동일 판단).

**미실행/한계(정직하게 명시)**:
- macOS/Linux 실측 — 여전히 Windows 전용 조사(이 PC 환경 한계, 기존 chmod 경로는 코드
  변경 없이 그대로 유지했으므로 회귀 위험은 낮다고 판단하나 실측은 아님)
- 여러 사용자 계정이 동시에 존재하는 실제 다중 사용자 Windows 환경에서의 검증 — 이
  PC는 단일 사용자라 "다른 계정이 진짜로 못 읽는지"까지는 실측 못함(ACE 목록에 다른
  계정이 없다는 것까지만 확인, 실제 접근 거부 자체를 다른 사용자 세션으로 시도하진 않음)
- 이번 세션에서 신설한 sandbox 환경 특유의 SID들(`CodexSandboxUsers` 등)이 상속 제거
  전에 이미 파일에 많이 붙어있었음을 관찰 — 이는 이 개발 PC의 샌드박스 구성 특성이며
  일반 사용자 PC의 상속 ACE 목록과는 다를 수 있음(정정 아님, 참고용 기록)

**남은 위험**: 없음(신규). credential-store(M16)만 여전히 유일한 미해결 블로커로 남음.

- 상태: **완료** — 실제 코드 변경, 라이브 icacls 검증까지 끝, 회귀 없음. 커밋
  `9b58856`으로 push 완료.
  (2026-08-17 정정: 위 상태 줄이 "로컬 커밋만, push는 하지 않음"이라 적혀 있었으나,
  `git log -1`과 `git log origin/docs-and-fixes/2026-07-06 -1`을 직접 재확인한 결과
  둘 다 `9b58856`으로 완전히 일치 — 기록 당시엔 사실이었으나 이후 같은 라운드에서 사용자
  승인으로 push까지 끝난 뒤 이 상태 줄만 갱신되지 않았던 것. M23~M28과 동일한 패턴이
  또 재발한 것으로, 다음 세션은 "완료" 항목이라도 상태 줄의 push 여부를 매번 git log로
  재확인할 것).

---

## M31: 2026-08-17 — quota 헤더 정확한 필드명 확정 (순수 조사, 코드 변경 없음)

**왜**: M20이 "안전지대 소진"을 선언한 뒤에도 M24(OAuth state/PKCE)·M25(프록시 서버)·M30(icacls)이
전부 그 선언 이후 발견된 새 안전지대였다 — 같은 패턴으로 `07_OAUTH_FLOW_SPEC.md §5-4`를
재확인한 결과, M20이 "credential 없이도 가능하다"고 직접 지목까지 해뒀던 quota 헤더 필드명
확정 작업이 M21~M30(6개 항목) 동안 방치돼 있었다. `01_PRD.md`가 명시한 Account 모듈의 핵심
가치(quota 자동전환) 자체가 이 필드명 없이는 구현 불가능하므로 방치 기간이 길수록 리스크가
컸다.

**조사 방법**: `.PRD/07_OAUTH_FLOW_SPEC.md` §5-2~5-4가 이미 인용해온 것과 동일한 1차 출처
`github.com/jung-wan-kim/teamclaude`를 GitHub API(`gh api repos/.../contents/...`)로 직접
열람 — `src/server.js`의 `anthropic-ratelimit-` 헤더 수집 로직과 `src/account-manager.js`의
`updateQuota(accountIndex, headers)` 함수 전문을 확인. 코드는 옮기지 않고 헤더 필드명(사실
정보)만 추출했다(`.PRD/04_PROJECT_SPEC.md`의 "아이디어·패턴만 참고, 코드 미복사" 원칙 준수).

**결과**: 필드명 전부 확정 — 상세는 `.PRD/07_OAUTH_FLOW_SPEC.md §5-4`에 직접 기록해뒀다(구독
계정 5건: `unified-5h/7d-utilization/reset`+`unified-status`+모델별 `unified-7d_<label>-*`
정규식 매칭, API키 계정 6건: `tokens-limit/remaining/reset`+`requests-limit/remaining/reset`).
classifier 차단 없이 정상 조회됨 — "파일 ACL 조작"(M30)에 이어 "공개 GitHub 코드 열람"도
credential-store가 막는 범위("OS 자격증명 저장소 I/O") 밖이라는 M25 가설이 다시 뒷받침됨.

**하지 않은 것(범위 확대 방지, 사용자 결정)**: `QuotaState` 파싱 스텁이나 실제 배선 코드는
이번 라운드에 만들지 않았다 — M25가 경고한 "credential-store 확정 전에 쌓으면 재작업 리스크"
원칙을 지켜, 이번엔 필드명을 문서에 기록하는 것까지만 진행.

**미검증 남은 것(정직하게 명시)**: teamclaude의 관측치일 뿐 ClaudeTower 자신의 실제 API 응답으로
재현 검증한 적은 없음 — credential-store가 열려야 가능. 필드명이 틀렸을 가능성은 낮지만(1차
출처 코드 직접 열람) 0은 아니다.

**남은 위험**: 없음(신규). credential-store(M16)만 여전히 유일한 하드 블로커.

- 상태: **완료** — 문서만 갱신(`.PRD/07_OAUTH_FLOW_SPEC.md §5-4`, `CHECKPOINT.md`), `src/`
  코드 변경 0건(아래 검증 결과 참조), 로컬 커밋만(push는 사용자가 이후 결정).

---

## M32: 2026-08-17 — PRD 준수 4-way 감사 결과 반영: `accounts status` 신설 + 02_DATA_MODEL.md 정정

**왜**: 4개 영역(핵심기능/Phase, 보안/ASVS, 데이터모델, OAuth흐름/동의문구)에서 CHECKPOINT
자기선언을 배제하고 실제 소스코드만으로 PRD 준수 감사를 수행한 결과, 보안·OAuth·동의문구는
갭 0건이었으나 구조적 문제 하나를 발견했다: Account 안전지대 코드(OAuth state/PKCE·프록시·
감사로그·동의문구)가 상당히 구현·테스트돼 있는데 `bin/claudetower.js`에 `accounts` 서브
커맨드가 전혀 없어 **사람이 실제로 검증할 방법이 0개**였다. 데이터모델 감사에서도 별개로
`02_DATA_MODEL.md`가 의도적 축소 구현 3~4건을 반영하지 못한 채 방치돼 있음을 확인했다.

### ① `claudetower accounts status` (읽기 전용 진단 명령)

- `src/accounts/status-report.js` 신설 — `buildStatusReport()`/`formatStatusReport()`.
  `module-activation-state.js`만 읽고, credential-store/oauth/proxy의 실제 함수는 **일절
  import하지 않는다**(정적 검사 테스트로 보증, 아래 참고). 구현된 컴포넌트·차단된 컴포넌트
  목록은 전부 하드코딩된 정적 문자열.
- `bin/claudetower.js`에 `accounts` 커맨드 라우팅 추가 — `status`만 지원, 그 외
  서브커맨드(`enable` 등)는 "아직 개발 중, 사용할 방법 없음" 안내 후 exit 1.
- **모듈 경계 재확인**: `eslint.config.js`의 `ZONES`와 `scripts/check-module-boundary.js`의
  스캔 대상은 둘 다 `src/display/`뿐 — `bin/`은 CLI 진입점이라 애초에 경계 규칙 대상이 아님을
  직접 코드로 확인 후 진행(위반 아님).
- **실제 실행 결과**(자기선언 아님, 직접 커맨드 실행):
  ```
  === ClaudeTower Account 모듈 상태 ===
  활성화 여부: 비활성화됨 (기본값)
  구현된 안전지대 컴포넌트 (미배선 — 아직 CLI에서 실제로 쓸 수 없음):
    ✔ OAuth CSRF state 검증 / PKCE / 로컬 프록시 서버 / 회전 감사 로그 / 동의 고지 문구 / quota 헤더 필드명
  사용 불가능한 부분:
    ✘ credential-store (OS 자격증명 저장소 연동) — 미구현 스텁
  ```
  `accounts`(서브커맨드 없음) → 안내 후 exit 0, `accounts enable` → 동일 안내 후 exit 1(둘 다 확인).
- `test/accounts/status-report.test.js` 신설(6개) — 기본값 항상 비활성화, activationState 주입
  반영, 컴포넌트 목록 존재, 문구 포함 여부, **그리고 소스 코드 정적 스캔으로
  credential-store/oauth/proxy require 여부 0건임을 테스트로 보증**.

### ② `.PRD/02_DATA_MODEL.md` 정정

`Widget.type`에서 `pr` 값이 코드상 의도적으로 제외됐다는 사실(`widget-config.js:17` 주석
"PR 상태는 제외" 인용), `active_account` 위젯 미구현(Account CLI 미배선이 이유), PlatformProfile/
QuickSetup 미구현, StatuslineConfig가 `enabled_widgets`+`powerline_separator` 플랫 config로
축소 구현된 사실을 각주로 추가(근거 파일:줄 인용, M23~M31과 동일한 정정 형식).

**검증 결과** (직접 재실행, 자기선언 아님): `npm run test:accounts` **99/99**(기존 93 + 신규 6),
`npm run verify`(Display) **235/235**(무변경 확인), `npm run lint` 클린, `npm run lint:boundary`
**src/display/ 22개 파일 무변경**(Display 쪽은 이번 작업과 무관함을 재확인).

**남은 위험**: 없음(신규). credential-store(M16)만 여전히 유일한 하드 블로커 — `accounts status`도
이 블로커를 절대 건드리지 않도록 설계됨.

- 상태: **완료** — `src/accounts/status-report.js`, `bin/claudetower.js`,
  `test/accounts/status-report.test.js`, `.PRD/02_DATA_MODEL.md`, `CHECKPOINT.md` 변경.
  로컬 커밋만(push는 사용자가 이후 결정).

---

## M33: 2026-08-17 — `claudetower accounts config`(전환 임계값·전략·포트, credential 무관) 신설

`01_PRD.md` §3 · `03_PHASES.md` 89행이 명시한 "`claudetower config` — 전환 임계값·전략·포트
조정" 기능이 지금까지 단 한 번도 시도되지 않았던 것을 이번 세션 재감사에서 발견(M20의
"안전지대 완전 소진" 선언이 뒤집힌 다섯 번째 사례 — M24/M25/M30/M31에 이은).

**설계 판단**: 기존 `createProxyConfig()`(`src/accounts/proxy/proxy-config.js`)는
`access_token`/`upstream_url`이 필수라 credential-store 없이는 호출 자체가 불가능하다.
그래서 이 둘을 절대 포함하지 않는 별도의 경량 스키마
(`threshold_pct`/`port`/`strategy`/`reeval_interval_ms`/`port_retry_max`)를
`src/accounts/switch-policy-config.js`에 새로 정의했다 — 실제 프록시 기동 시점
(credential-store 완료 후)에 이 값을 `createProxyConfig()`에 주입하는 구조를 전제로 한다.
기본값(port 41411, threshold_pct 98, reeval_interval_ms 300000, port_retry_max 10)은
`.PRD/.archive/QuotaSwitch원본/02_DATA_MODEL.md` ProxyConfig 표의 예시값을 그대로 채택,
strategy 기본값(`best`)만 그 문서에 명시가 없어 자체 판단으로 채택.

**모듈 경계 주의사항 하나 발견·수정**: 처음엔 Display 쪽 `test-isolation.js`의
`assertNotPartialIsolation`을 재사용하려 했으나, 이는 Account→Display 참조가 되어
(반대 방향인 Display→Account만 금지된 기존 규칙에는 안 걸리지만) 이 프로젝트가 지켜온
"Account는 Display 없이도, Display는 Account 없이도" 원칙과 어긋난다고 판단해 되돌리고,
`switch-policy-config.js` 안에 동일 로직을 독립적으로 재구현했다(중복 10줄 정도,
결합도를 낮추는 게 더 중요하다고 판단).

**CLI**: `claudetower accounts config`(인자 없음 → 현재 값 전체 조회),
`claudetower accounts config <key> <value>`(단일 값 변경). `bin/claudetower.js`의
`accounts` 라우팅에 `config` 서브커맨드로 연결(`status`와 동일 원칙 — credential-store/
oauth/proxy 모듈은 이 코드 경로 어디에서도 require되지 않음, 소스 텍스트 정규식 스캔
테스트로 증명).

**실제 실행 검증** (자기선언 아님, 직접 실행):
```
$ node bin/claudetower.js accounts config
=== ClaudeTower 계정 전환 정책 (credential 무관, 로컬 저장) ===
threshold_pct: 98  port: 41411  strategy: best  reeval_interval_ms: 300000  port_retry_max: 10

$ node bin/claudetower.js accounts config threshold_pct 85
threshold_pct을(를) 85(으)로 설정했습니다.   ← 파일에 실제 저장 확인됨

$ node bin/claudetower.js accounts config strategy invalid-value
strategy는 best 또는 next-available 둘 중 하나여야 합니다.   ← exit code 1 확인됨
```

**검증**: `npm run test:accounts` **119/119**(기존 99 + 신규 20), `npm run verify`(Display)
**235/235**(무변경), `npm run lint:boundary` — src/display/ 22개 파일 그대로 준수,
`npm run lint` 클린. `src/display/`는 이번 작업에서 전혀 건드리지 않음(초안에서
test-isolation.js를 건드렸다가 위 이유로 되돌림 — git status로 최종 무변경 확인).

**남은 위험**: 없음(신규). credential-store(M16)만 여전히 유일한 하드 블로커.

- 상태: **완료** — `src/accounts/switch-policy-config.js`(신규),
  `src/accounts/accounts-config-command.js`(신규), `bin/claudetower.js`(수정),
  `test/accounts/switch-policy-config.test.js`(신규),
  `test/accounts/accounts-config-command.test.js`(신규), `CHECKPOINT.md` 변경.
  로컬 커밋만(push는 사용자가 이후 결정).

---

## M34: 2026-08-18 — Account 안전지대 5차 재소진 확인 후 트랙 전환: npm stale shim 자동 정리(installer/uninstaller)

**계기**: M33 직후 사용자가 다시 한번 같은 절차(PRD 전수 재정독+안전지대 소진 여부
재확인)를 요구. 이번엔 `accounts enable`(영속화 함수 자체가 없어 신규 설계 필요 +
`add` 없이 동의만 받으면 consent-theater가 됨)과 `accounts add/list` CRUD
(credential-store 없이는 등록할 계정이 없어 항상 빈 목록) 둘 다 기각 —
**Account 트랙은 이번엔 실제로 소진**. `.PRD/05_FIELD_ISSUES_2026-07-04.md §2.5`
(P2, "installer/uninstaller가 stale npm shim을 탐지·정리")로 트랙 전환.

**배경**: 과거 npm-global 설치가 남긴 shim(`claudetower`/`.cmd`/`.ps1`, Windows는
prefix 루트에 3개, POSIX는 `<prefix>/bin/`에 심볼릭 링크 1개)이 백킹 모듈
(`node_modules/claudetower`) 삭제 후에도 남아 bare `claudetower`가
`MODULE_NOT_FOUND`로 깨지던 실측 결함(§2.1~2.3)의 근본 수정.

**구현**: `src/display/config/npm-shim-cleanup.js`(신규) — `cleanupStaleNpmShims()`.
오삭제 방지 2단계: (1) shim 파일 내용에 `node_modules`+`claudetower` 참조가 실제로
있는지 확인(이름만 같은 무관한 파일 보호), (2) 그런데도 백킹 모듈 폴더가 정말 없는지
확인한 뒤에만 삭제. npm prefix 위치는 하드코딩하지 않고 `npm config get prefix`로
직접 조회(테스트 격리는 신규 `CLAUDETOWER_NPM_PREFIX_DIR`을 `test-isolation.js`의
`ISOLATION_VARS`에 추가해 기존 부분격리 방어막에 편입). PATH 자동등록(§3, 별도 P2)은
이번 범위에서 명확히 제외 — 관련 코드 전혀 안 건드림. `bin/claudetower.js`의 `setup`
(재설치 시)과 `uninstall`(제거 시) 양쪽에 배선, 둘 다 try/catch로 감싸 실패해도 본
설치/제거 기능은 절대 막지 않음.

**격리 테스트로 실제 확인**(임시 디렉터리, 실제 시스템 `%APPDATA%\npm`은 전혀 안 건드림):
- 백킹 모듈 존재 → 정상 shim 삭제 안 됨
- 백킹 모듈 없는 stale shim 3종 전부 삭제됨
- 이름만 같고 내용이 무관한 파일 → 백킹이 없어도 삭제 안 됨(오삭제 방지 실증)
- shim 자체가 없으면 에러 없이 빈 목록(멱등)
- 다른 CLAUDETOWER_* 격리 변수만 설정된 부분격리 상태 → 실제 npm 폴더 조회 자체를
  건너뜀(`skipped: 'partial-test-isolation'`) — 이 상태로 `npm run verify`의
  `uninstall-command.test.js`가 실제로 이 코드 경로를 통과했고 정상 동작 확인
- POSIX 끊어진 심볼릭 링크 판정 함수는 이 PC(Windows)에서도 직접 심볼릭 링크를
  만들어 검증(개발자 모드 활성 상태라 실제 실행됨) — 정상/끊어짐 양쪽 다 확인.
  **한계(정직)**: `cleanupStaleNpmShims()` 전체 경로 중 POSIX 분기
  (`process.platform !== 'win32'`)는 이 PC가 Windows라 실행 자체는 못했다 —
  개별 판정 함수 단위 검증까지만.

**실제 시스템 미접촉 확인**: 이 PC의 실제 `%APPDATA%\npm`에는 애초에 `claudetower`
shim이 없음(과거 세션에 수동 삭제됨, `05_FIELD_ISSUES §2.4` 참고) — `ls`로
재확인했고, 이번 작업 전체가 격리된 임시 디렉터리에서만 실행·검증됨.
또한 이 PC에 ClaudeTower가 **실제로 라이브 설치**돼 있어(현재 세션 상태표시줄이
이걸로 동작 중) `uninstall`을 실제로 실행하는 실사용 테스트는 하지 않음(위험) —
대신 `uninstall-command.test.js`(격리 환경)가 같은 코드 경로를 이미 통과시킴.

**검증**: `npm run test:accounts` 119/119(무변경), `npm run verify`(Display)
**245/245**(기존 235 + 신규 10), `npm run lint:boundary` — src/display/ **23개**
파일(신규 1개 포함) 전부 모듈 경계 준수, `npm run lint` 클린.

**남은 위험**: 없음(신규). PATH 자동등록(§3)은 여전히 별도 미해결 P2로 남음(이번
범위 아님, 더 침습적이라 사용자 동의 하 별도 작업 필요). credential-store(M16)는
여전히 유일한 하드 블로커.

- 상태: **완료** — `src/display/config/npm-shim-cleanup.js`(신규),
  `test/display/npm-shim-cleanup.test.js`(신규), `bin/claudetower.js`(수정),
  `src/display/config/test-isolation.js`(수정), `CHECKPOINT.md` 변경.
  로컬 커밋만(push는 사용자가 이후 결정 — git log로 실측: 로컬이 원격보다
  5커밋 앞섬, M31/M32/M33/M34).

---

## M35: 2026-08-18 — credential-store 실제 OS 키체인 구현 (major unblock, 저장소 계층만)

**배경**: M16(2026-07-27)·M20(2026-07-28)이 A/B로 확인했던 차단(`@napi-rs/keyring`
실 I/O를 Claude Code 상위 안전장치가 막음, 되돌리면 통과)을 이번 세션에서 사용자가
직접 지켜보는 대화형 세션에서 다시 시도했다. **막히지 않았다** — require →
`new Entry(service, username)` → `setPassword`/`getPassword`/`deletePassword`
전부 테스트 전용 항목으로 round-trip 성공(즉시 삭제, 흔적 없음 확인).

**정직한 불확실성**: 왜 이번엔 안 막혔는지 확인하지 못했다. 가능성(전부 미검증
추측): ① 이번 세션이 Auto Mode라 권한 처리가 다를 수 있음, ② M16/M20 이후 3주
가까이 지나며 Claude Code 자체 분류기 동작이 바뀌었을 수 있음, ③ 당시와 조건이
미묘하게 달랐을 가능성. 확실한 사실은 "오늘 이 세션에서 막히지 않았다"는 것뿐 —
다음 세션에서 재현 안 될 수도 있다는 걸 전제하고 작업했다.

**구현**: `src/accounts/credential-store/index.js`의 `getSecret`/`setSecret`/
`deleteSecret` throw-스텁을 실제 구현으로 교체.
- service='claudetower'(고정), username=`CredentialRef.external_ref`(기존 필드
  의미 그대로 재사용, 새 키 조합 규칙 안 만듦)
- `getSecret`: 존재하지 않는 항목은 에러 없이 `null` 반환(라이브러리 네이티브
  동작을 그대로 노출, 실측으로 확인됨)
- `deleteSecret`: 존재하지 않는 항목 삭제도 에러 없이 멱등 처리(마찬가지로
  네이티브 동작 실측 확인 — widgets off/on과 같은 멱등성 원칙과 일관)
- 비밀값은 에러 메시지·로그 어디에도 노출 안 함(테스트로 검증)
- `file_fallback_encrypted` 백엔드는 미구현(범위 밖, OS 키체인 자체가 없는
  환경은 별도 작업)

**검증 범위 — 정직하게**: **Windows만 실제 검증**(대화형 라이브 테스트 +
`npm run test:accounts`의 통합 테스트 둘 다 win32에서 성공). macOS/Linux는
`@napi-rs/keyring`이 동일 API로 크로스플랫폼을 표방한다는 것에 근거한 **추정**일
뿐 실측 아님.

**테스트**: 단위 테스트(require.cache 치환으로 실제 OS 키체인 미접촉, mock
Entry가 올바른 service/username/method를 받는지 검증) 8개 + 통합 테스트(win32
전용, 실제 Credential Manager 왕복 후 정리) 1개 — 기존 게이트-증명 테스트 2개는
전면 재작성. `npm run test:accounts` **127/127**(119+10-2), `npm run verify`
(Display) 245/245(무변경), `npm run lint:boundary` 23개 파일 무변경 — 전부
직접 실행해 확인. 테스트 종료 후 `cmdkey /list`로 Credential Manager에
`claudetower` 관련 잔재 없음 재확인.

**이번에 안 한 것(다음 라운드로 명시적으로 남김)**:
- `bin/claudetower.js`에 `accounts add`/`accounts enable` CLI 배선 — 안 함
  (이번 승인 범위는 저장소 계층 교체까지)
- macOS/Linux 실측 — 안 함
- `file_fallback_encrypted` 백엔드 — 안 함

**남은 위험**: OAuth 자동전환 ToS 리스크는 그대로 유효(`.PRD/07_OAUTH_FLOW_SPEC.md
§3-3` — credential-store는 중립 기술이나 이미 승인된 하이브리드 자동전환 위험을
상속받음, 이 결정 자체는 재검토 조건 없음으로 이미 닫힘). credential-store가
풀렸다고 해서 곧바로 전체 기능이 완성되는 게 아니다 — CLI 배선·프록시 실기동
등 최소 1~2단계가 더 남아있다.

- 상태: **완료(저장소 계층만)** — `src/accounts/credential-store/index.js`(구현),
  `test/accounts/credential-store-index.test.js`(전면 재작성), `CHECKPOINT.md` 변경.
  로컬 커밋만(push는 사용자가 이후 결정).

---

## M36: 2026-08-19 — Account 모듈 최초 실사용 기능: `accounts enable` + `accounts add --api-key`

**이정표**: M35(credential-store 언락) 이후 4방향 재감사가 공통으로 지목한 유일한
안전·의미 있는 다음 단계(OAuth 로그인은 ToS로 여전히 금지, API키 경로만 예외)를
실행했다. 이번이 Account 모듈에서 **처음으로 실제 작동하는 계정 하나를 등록**할 수
있게 된 지점이다.

### 왜 `enable`과 `add`를 함께 만들었나

`add-api-key-request.js`가 이미 `isAccountModuleEnabled(activationState)`를 필수
조건으로 요구하는데, `module-activation-state.js`엔 영속화 함수가 없어(순수
팩토리만 존재, 2026-07-11 결정으로 이미 review 끝난 파일이라 건드리지 않음) `enable`
없이는 `add`가 항상 거부된다. 둘을 분리할 수 없었다.

### 신설 파일

- `src/accounts/module-activation-state-store.js` — ModuleActivationState 영속화
  (`~/.claudetower/accounts-activation-state.json`, `CLAUDETOWER_ACCOUNTS_ACTIVATION_
  STATE_PATH` override, 손상 시 안전하게 비활성화로 폴백, 부분격리 방어 포함)
- `src/accounts/accounts/accounts-registry.js` — Account 레코드 목록 영속화
  (`~/.claudetower/accounts-registry.json`, `CLAUDETOWER_ACCOUNTS_REGISTRY_PATH`
  override). Account 엔티티 자체에 시크릿 필드가 없어 구조적으로 비밀값이 못 들어감.
- `src/accounts/accounts-enable-command.js` — `claudetower accounts enable`.
  consent-text.js를 그대로 출력하고 setup-wizard.js와 동일한 비동기 이터레이터
  readline 패턴(EOF 버그 회피, rl.output 사용)으로 [y/N] 확인. 이미 활성화된
  상태에서 재실행하면 멱등하게 처리.
- `src/accounts/accounts/add-api-key-command.js` — `claudetower accounts add
  --api-key <라벨> <키값>`. 검증(`buildAddApiKeyRequest`) → `setSecret`(credential-
  store) → 레지스트리 기록 순서. 레지스트리 쓰기가 실패하면 방금 저장한 키를
  `deleteSecret`으로 롤백 시도하고, 롤백도 실패하면 사람이 놓칠 수 없게 명시적으로
  경고("심각: 자격증명은 저장됐지만...")한다 — "키는 있는데 목록엔 없는" 상태를
  조용히 남기지 않는다.
- `bin/claudetower.js`에 `enable`/`add --api-key` 서브커맨드 배선. `accounts status`도
  이제 `readActivationState()`로 실제 상태를 읽어 보여주도록 갱신(이전엔 항상
  기본값만 보여줬음). `status-report.js`의 컴포넌트 목록도 credential-store/enable/
  add가 이제 "구현·사용 가능"으로 갱신(이전엔 전부 "미배선"으로 표시했었음).
- `switch-policy-config.js`의 `ACCOUNTS_ISOLATION_VARS`에 신설 변수 2개 추가
  (대칭 방어 원칙 — 새 파일이 격리된 채 이 파일만 격리 안 된 상태를 놓치지 않도록).

### 설계 판단

- **API키 만료 표현**: CredentialRef.token_expires_at은 스키마상 비어있지 않은 ISO
  문자열이 필수(이미 review 끝난 credential-ref.js를 안 바꿈)인데 API키는 전통적
  만료 개념이 없어 `'9999-12-31T23:59:59.999Z'` sentinel 값으로 "만료 없음"을 표현.
- **backend 필드**: `process.platform` 기반 매핑(win32→windows_dpapi 등), 미지원
  플랫폼은 명확히 에러(추측으로 지원한다고 하지 않음).
- **네트워크 호출 없음**: 등록만 하고 Anthropic API로 키 유효성을 실제로 검증하지
  않는다(이번 범위 밖, 명시).

### 검증 (전부 직접 실행)

- 단위 테스트 신규 21개(활성화상태 5 + 레지스트리 6 + enable명령 4 + add명령 6):
  `npm run test:accounts` **148/148**(127+21)
- `npm run verify`(Display) 245/245(무변경), `npm run lint:boundary` 23개 파일
  무변경, `npm run lint` 클린
- **라이브 CLI 전체 흐름 실행**(격리 경로: `CLAUDETOWER_ACCOUNTS_ACTIVATION_STATE_
  PATH`/`CLAUDETOWER_ACCOUNTS_REGISTRY_PATH`를 임시파일로 지정, credential-store는
  경로 override가 없어 실제 Windows Credential Manager를 그대로 씀):
  1. enable 전 add 시도 → 거부(exit 1) 확인
  2. enable에 `n` 입력 → 비활성화 유지 확인
  3. enable에 `y` 입력 → 활성화 확인
  4. 활성화 후 add → 성공(exit 0), 레지스트리에 계정 1건 기록 확인
  5. 같은 라벨 재등록 → 거부 확인
  6. 레지스트리 파일 원문에 비밀값("test-marker-value-12345") 미노출 확인
- **뒷정리**: 실제 생성된 계정(`account_id: 43c484bb-...`)의 실제 키체인 항목을
  별도 스크립트로 `deleteSecret` 후 `getSecret`이 null임을 재확인. 임시 활성화상태·
  레지스트리 파일 삭제. `cmdkey /list`로 Credential Manager에 claudetower 관련
  잔재 0건 재확인. 실제 프로덕션 경로(`~/.claudetower/accounts-activation-state.json`,
  `~/.claudetower/accounts-registry.json`)는 이번 라이브 테스트 내내 한 번도
  생성되지 않았음을 확인(이 PC의 실제 ClaudeTower 설치는 전혀 영향받지 않음).

### 이번에 안 한 것 (다음 라운드로 명시적으로 남김)

- `accounts disable`, `account-purge`, `accounts list`, `accounts remove` — 안 만듦
- OAuth 로그인 흐름(--import 포함) — ToS §3-1/§3-3 금지 그대로, 계획 자체가 없음
- 프록시 실제 기동(`startProxyServer`), quota 헤더 파싱 배선, 자동전환 로직 — 안 만듦
- API키 실제 유효성 네트워크 검증 — 안 함(등록만)
- macOS/Linux 실측 — 여전히 미검증

- 상태: **완료(enable + add --api-key만)** — 로컬 커밋만(push는 사용자가 이후 결정).

---

## M37: 2026-08-19 — SEA 배포용 exe에서 credential-store 실동작 수정 (배포 채널 크리티컬 결함)

**참고(다른 세션 작업, 기록 누락분)**: 세션 공백 중(01:04) 다른 세션이 커밋 `09e2dca`로
`accounts disable`+`accounts list`를 이미 신설했다(위 M36 "이번에 안 한 것" 목록의 두 항목이
이미 해소됨) — 이 CHECKPOINT엔 그 작업 자체의 M-항목이 없어 여기 한 줄로 보완 기록한다.
`npm run verify` 245/245·`test:accounts` 158/158로 정상 반영 확인됨.

**문제**: `npm run build`(SEA 단일실행파일)가 크래시 없이 완주해도(어제 `22a1e75` 부분수정),
실제로 만들어진 `dist/claudetower-win-x64.exe`로 `accounts add --api-key`를 실행하면
`No such built-in module: @napi-rs/keyring`로 실패했다 — M35~M36이 만든 모든 Account 실사용
기능이 배포판에서는 전부 무용지물이었다. `.PRD/04_PROJECT_SPEC.md` 27행이 "사용자 PC의
Node.js 설치 여부와 무관하게 동작"을 SEA 채택 이유로 명시했고, `01_PRD.md`가 이를 4대
핵심가치 1번으로 선언한 만큼, 이 프로젝트의 유일한 정상 배포 채널이 걸린 크리티컬 결함이었다.

**원인 규명 과정(시행착오 그대로 기록)**:
1. `@napi-rs/keyring/index.js:67`을 직접 열람해 `NAPI_RS_NATIVE_LIBRARY_PATH` 환경변수가
   공식 오버라이드 메커니즘임을 확인 → 시도했으나, SEA blob엔 애초에 node_modules가 없어
   `require('@napi-rs/keyring')`(패키지 이름)로 그 로더 코드 자체에 도달하지 못해 실패.
2. `.node` 파일을 exe 옆에 복사해두고 절대경로로 직접 `require()` → 여전히
   `No such built-in module: <절대경로>`로 거부됨. **SEA의 require는 내장모듈과 blob에
   번들된 것 외엔 절대경로 파일조차 전혀 허용하지 않는다**(추정이 아니라 실측 재확인 —
   이전 라운드가 예상한 것보다 더 엄격한 제한).
3. **해결**: `require()`가 내부적으로 쓰는 더 하위 API `process.dlopen(module, path)`을
   SEA 실행 중일 때만 직접 호출 — require의 모듈 리졸버를 완전히 건너뛰고 네이티브
   addon을 프로세스에 바로 매핑하는 방식이라 SEA의 require 제한과 무관하게 동작함을
   실측으로 확인. `node:sea.isSea()`로 SEA 여부 분기, 아닐 때는 기존 방식 그대로.

**구현**:
- `src/accounts/credential-store/index.js`: `loadKeyringEntry()` 함수 신설 — SEA면
  `process.dlopen`으로 `<exe폴더>/keyring-native.node`를 직접 로드, 아니면 기존 방식.
- `scripts/build-sea.js`: 빌드 스크립트 자신이 `@napi-rs/keyring`을 실제로 require해
  `require.cache`에서 이 머신에 실제로 설치된 네이티브 바이너리 경로를 알아낸 뒤(플랫폼별
  하드코딩 매핑표 없이, 실제 설치된 optionalDependency를 그대로 신뢰), exe 옆에
  `keyring-native.node`로 복사하는 단계(4-1) 추가.

**실측 검증**: 빌드된 실제 exe로 `accounts enable`(y)→`accounts add --api-key
sea-test-label sea-test-value-xyz` 실행 → **성공**(exit 0). 저장된 값을 `getPassword()`로
직접 재조회해 `sea-test-value-xyz`와 정확히 일치함을 확인, `deletePassword()`로 정리 후
재조회 `null` 확인(cmdkey는 이 라이브러리를 못 잡는다는 게 이미 확인됐으므로 사용 안 함).
`npm run verify` 245/245, `npm run test:accounts` 158/158, `npm run lint` 클린 — 전부
직접 재실행 확인, 회귀 없음.

**macOS/Linux — 근거 있는 판단, 여전히 미검증**: `process.dlopen`은 Node 코어 API로 3개
플랫폼에서 동일하게 동작(require()가 내부적으로 쓰는 것과 같은 함수, OS별 분기 없음).
napi-rs 패키지들은 `.node` 확장자를 OS 무관하게 통일해서 쓴다는 걸 `@napi-rs/keyring/
index.js` 원문에서 직접 확인했다(darwin-universal.node, linux-x64-gnu.node 등 전부
`.node`). `build-sea.js`의 `resolveNativeKeyringPath()`도 하드코딩 없이 "그 머신에 실제
설치된 걸 그대로 찾기" 방식이라 플랫폼 무관하게 같은 로직이 통할 근거는 있으나, **CI
3-OS 매트릭스로 실측하기 전까지 "해결됨" 선언 금지**(이전 라운드 스스로 세운 원칙).

**이번에 안 한 것**: macOS/Linux 실측(불가능, 이 PC가 Windows뿐), Linux musl 대응 검토(build
스크립트가 "실제 설치된 것을 신뢰"하므로 이론상 자동 대응되지만 실측 못함), exe 용량 증가
영향 측정(안 함 — 미미할 것으로 추정되나 확인 안 함).

- 상태: **완료(Windows 실측 검증)** — 커밋 `50ed3b3`, 로컬만(push는 사용자가 이후 결정).

## M38: 2026-08-19 — CI/설치 파이프라인이 keyring-native.node를 함께 배포하도록 완성

**왜**: M37이 SEA exe 안에서 credential-store가 동작하게 고쳤지만, 그 해법(exe 옆
`keyring-native.node` 별도 파일 + `process.dlopen` 로딩)을 실제 사용자에게 전달하는
경로(CI 아티팩트 업로드, `install.ps1`/`install.sh` 다운로드)는 손대지 않은 채였다.
직접 grep으로 재확인한 결과 `.github/workflows/build.yml`·양쪽 install 스크립트
어디에도 `keyring-native.node` 언급이 없었다 — 지금 이대로 릴리스하면 M37의 수정이
실제 설치본에는 반영 안 된 채로 나갈 뻔했다.

**적용한 것**:
- `.github/workflows/build.yml`: matrix에 `native-artifact`(플랫폼별 파일명:
  `keyring-native-win-x64.node`/`keyring-native-macos-arm64.node`/
  `keyring-native-linux-x64.node`) 추가, 빌드 후 `dist/keyring-native.node` 존재를
  스모크단계에서 확인, 두 번째 `upload-artifact` 스텝으로 별도 아티팩트 업로드.
- `install.ps1`: exe와 동일한 원자적 교체+재시도 패턴(잠금 경합 방지, 05_FIELD_ISSUES
  이슈#1과 동일 원칙)으로 `keyring-native-win-x64.node`를 다운로드해 설치 폴더에
  `keyring-native.node`로 배치.
- `install.sh`: macOS/Linux용 동일 로직(`keyring-native-${platform}.node` 다운로드).
- 파일명이 `credential-store/index.js`가 기대하는 `keyring-native.node`(exe와 같은
  폴더, 플랫폼 접미사 없음)와 정확히 일치하는지 재확인 완료.

**검증**:
- YAML 문법(`python -c "import yaml; ..."`), PowerShell 문법(`PSParser::Tokenize`),
  bash 문법(`bash -n`) 전부 통과.
- **로컬 설치 시뮬레이션(실제 GitHub 릴리스 다운로드 대신 로컬 파일 복사로 대체)**:
  임시 폴더에 실제 `dist/claudetower-win-x64.exe`+`dist/keyring-native.node`를 install
  스크립트가 만들 최종 레이아웃 그대로 배치 → `--version` 성공 → `accounts enable`(y)
  → `accounts add --api-key` **성공(exit 0)** → 레지스트리에 비밀값 미노출 확인 →
  생성된 테스트 계정을 `getPassword()`/`deletePassword()` 왕복으로 직접 정리·재조회
  `null` 확인.
- 회귀 확인: `npm run verify` 245/245, `npm run test:accounts` 158/158.
- `gh release list`/`gh workflow list`로 직접 확인: 이 저장소엔 릴리스를 자동 발행하는
  워크플로우가 없다(워크플로우는 "Build SEA binaries" 하나뿐, `gh release create` 호출
  없음) — 지금까지 v0.1.9~v0.4.0 전부 수동 `gh release create`로 발행된 것으로 확인됨
  (추정 아니라 워크플로우 파일에 관련 스텝이 없음을 직접 읽어서 확인). **따라서 다음
  실제 릴리스를 발행할 때, 사람(또는 다음 세션)이 `gh release create` 호출에 이번에
  새로 생긴 3개 네이티브 자산 파일을 위 파일명 그대로 함께 첨부해야 한다** — 이건
  코드로 자동화된 게 아니라 릴리스 발행자가 반드시 기억해야 하는 수동 단계로 남는다.

**실제 릴리스 발행 전까지는 완전히 검증 불가한 부분(정직하게 인정)**: GitHub Releases
API를 통한 실제 다운로드(`releases/latest/download/...`)는 이번에 실행하지 않았다
(아직 발행된 릴리스가 없어 대상 자체가 없음) — 로컬 파일 시뮬레이션으로 "레이아웃이
맞으면 동작한다"까지만 검증했고, 실제 다운로드 URL의 정확성은 다음 릴리스 발행 후
재확인 필요.

- 상태: **완료(CI/설치 스크립트 코드는 로컬 시뮬레이션으로 검증) — 실제 릴리스 발행
  시 자산 첨부는 수동 단계로 남음, 커밋 로컬만(push는 사용자가 이후 결정)**.

## M39: 2026-08-19 — README.md/README.en.md "계정 코드 미포함" 문구 전면 개정 (사실 정합성 회복)

**발견한 문제**: M35~M38로 credential-store·accounts enable/add/disable/list가 실제로
동작하고 SEA exe 배포 아티팩트에도 포함되게 됐는데, README.md/README.en.md는 여전히
"계정 관련 코드는 배포판에 전혀 포함되지 않는다"고 최소 10곳에서 반복 주장하고 있었다.
이 문구는 단순 설명이 아니라 NOTICE 파일 생략의 법적 근거, 상업적 사용 금지 조항의
리스크 논리로 직접 쓰이고 있어 방치하면 다음 릴리스가 사실과 다른 법적 근거를 안은 채
나가게 되는 상황이었다.

**개정 방식**: 과장(자동전환이 이제 된다)·축소(여전히 아무것도 안 된다) 둘 다 피하고,
"기본값은 항상 꺼짐 + `accounts enable`로 명시적 동의해야만 켜짐"을 새로운 핵심 안전
근거로 세웠다. ToS 경고(로그인 계정 자동화 금지, API키 로테이션 남용방지조항 불확실성)는
약화시키지 않고 `src/accounts/consent-text.js`(v2.1-hybrid-scope-clarified)와 내용을
대조해 일치시켰다. 상업적 사용 금지 정책 자체는 유지하되, 그 근거를 "위험이 실제로
배포판에 존재한다"는 더 강한 논리로 갱신했다.

**NOTICE 파일 재조사**: `node_modules/@napi-rs/keyring/LICENSE`를 직접 열람 —
**MIT 라이선스**(Apache 아님)로 확인됨. 따라서 Apache 4(d)의 NOTICE 전파 의무 대상은
아니지만, MIT 자체의 저작권·허가고지 전달 요구는 별도 사안으로 남아있어 "서드파티
라이선스 고지 파일 신설 필요 여부"를 법무 검토 항목으로 새로 남겼다(파일 신설 자체는
이번 범위 밖, 하지 않음).

**수정 위치**: 상단 요약·상태배너·목차 앵커·명령어 목록·폴더구조 주석·아키텍처 비유·
§② 전체 섹션·FAQ 2건·상업적사용 근거·NOTICE 문단 — 총 10곳, README.md/README.en.md
양쪽 모두 동일 수준으로 개정(기계번역 아닌 기존 영문판 톤 유지).

**검증**: 수정 후 `grep -n "포함되어 있지 않\|포함되지 않\|미포함"` (한글) /
`grep -n "not included\|does not include"` (영문) 재확인 — 남은 매치는 전부 과거
changelog(v0.2.0 항목, 당시엔 사실이었던 역사적 기록이라 그대로 둠) 또는 이미 정확한
문구(esbuild/eslint 미포함)뿐, 새로 발견된 모순 없음. `src/accounts/consent-text.js`와
내용 대조 완료. `npm run verify` 245/245, `npm run test:accounts` 165/165(무변화,
docs-only 커밋이므로 예상대로) — 코드는 전혀 안 건드림.

**의도적으로 안 한 것**: `package.json` 버전 번호(0.4.0 유지, 별도 결정 사항)·
README.html/README.en.html 재생성(별도 pandoc 파이프라인 필요, 범위 밖)·NOTICE 파일
실제 신설.

- 상태: **완료, 로컬 커밋만(push는 사용자가 이후 결정)**.

---

## M40: 2026-08-19 — 버전 0.5.0 상향 + 2차 종합 QA(결함 0건) + PR #8 main 병합 (M39 이후 문서 갱신 누락 정정)

**발견한 사실**: M39 이후 `package.json` 버전이 0.4.0 → **0.5.0**으로 상향된 커밋
(`934ca23`)이 이미 만들어졌는데 이 문서엔 반영되지 않은 채였다(M39가 "0.4.0 유지"라고
적어둔 문장이 그새 stale해짐 — 이 프로젝트에서 반복돼온 "실제 작업과 CHECKPOINT 기록의
시차" 패턴, M10·M13과 동일 부류).

**이번 세션에서 직접 실행·확인한 것**:
- [x] **2차 종합 QA(사용자 요청, 정상/예외/경계값/실패 케이스 포함)**: `lint`·
  `lint:boundary`·`test:display`(245/245)·`test:accounts`(165/165)·`build`(네이티브
  keyring 바이너리 exe 옆 복사 단계 포함)·`npm audit`(기존에 알려진 devDependency
  `brace-expansion` HIGH 1건 외 신규 없음) 전부 직접 재실행. 병렬로 격리 환경(`CLAUDETOWER_*`
  경로만 사용, 실제 설치·실제 Credential Manager 미접촉)에서 `account-purge`(빈 상태/취소/
  실제삭제 3가지)·`accounts disable`·`accounts list`·`install.ps1`의 신규 네이티브 자산
  다운로드 로직 코드검토·실제 빌드된 v0.5.0 SEA exe로 `enable→add→list→purge` 전체 흐름
  1회 라이브 실행까지 12개 시나리오 탐색 — **신규 결함 0건**(1차 QA에서 발견한 3건 — esbuild
  빌드 크래시, 라벨 길이 100자 상한, 제어문자 거부 — 는 전부 그대로 정상 유지 재확인).
  삭제 검증은 매번 `cmdkey` 대신 `getPassword()`/`deletePassword()` 직접 재조회로 확인(이
  프로젝트에서 `cmdkey /list`가 `@napi-rs/keyring` 항목을 못 잡는 것을 실측으로 이미 확인한
  전례가 있어 신뢰하지 않음).
- [x] **PR #8(`934ca23` 기준) CI 매트릭스 3-OS 결과 직접 재확인**: `gh run view`로
  `build (windows-latest, ...)`·`build (macos-latest, ...)`·`build (ubuntu-latest, ...)`
  3개 job 모두 **success** 확인(빌드+`--version`/`--help` 스모크테스트+
  `test -f dist/keyring-native.node` 존재확인까지 포함) + `verify-display-standalone`
  job도 success. **단, 이 스모크테스트는 실행 여부만 확인할 뿐 `accounts enable→add`류
  실제 키체인 왕복 동작까지는 검증하지 않는다** — macOS/Linux에서의 `process.dlopen()`
  기반 credential-store 실동작(M37)은 여전히 라이브 미검증(물리 macOS/Linux 환경 없음),
  Windows에서만 라이브 검증 완료된 상태 그대로임을 명시.
- [x] **main 병합 안전성 사전 확인**: `git merge-tree $(git merge-base origin/main HEAD)
  origin/main HEAD` — 충돌마커 0건, `origin/main..HEAD` 22개 커밋 / `HEAD..origin/main` 0개
  커밋(main이 그 사이 움직이지 않아 fast-forward 성격 병합 가능). README.md가 이미
  "현재 정식 출시된 버전(v0.4.0)에는 이 계정 기능이 아직 포함돼 있지 않습니다"라고
  자체적으로 정직하게 고지하고 있음을 재확인(M39 반영분) — main 병합이 릴리스 발행과
  같은 뜻이 아님을 문서 자체가 이미 구분해서 설명하는 상태.
- [x] **결정**: M10과 동일한 유형의 위험(작업 브랜치·main 간 정보/코드 격차 방치)이
  재발하지 않도록, PR #8을 지금 main으로 병합하기로 결정(제안 후 사용자 승인,
  "CHECKPOINT M40 기록 후 병합"). **릴리스 발행(`gh release create`)은 여전히 별도
  결정 사항으로 보류** — 병합해도 `install.ps1`/`install.sh`가 참조하는 "latest release"는
  기존 v0.4.0 그대로라 실사용자에게 아직 라이브 미검증인 macOS/Linux credential-store가
  실수로 노출되는 일은 없음.

**병합 후 남는 위험(숨기지 않고 명시, 병합으로 해소되는 위험이 아님)**:
1. macOS/Linux의 `process.dlopen()` 기반 credential-store 실동작 라이브 미검증(빌드/실행
   자체는 CI로 검증됐으나 실제 키체인 왕복은 Windows에서만 확인됨) — 실제 릴리스 발행
   전에 반드시 해소해야 함.
2. `@napi-rs/keyring`(MIT) 서드파티 라이선스 고지 파일 신설 여부 — 법무 검토 항목으로
   남음(M39에서 이미 기록, 변화 없음).
3. 저장소 루트에 `.active-agents`·`.active-agents.lock`·`.active-agents.tmp`·
   `.failure-tracker.jsonl`·`.pair-programming-session.md` 등 미추적 파일 존재 —
   ClaudeTower 프로젝트 산출물이 아닌 세션 도구 부산물로 판단되어 이번 커밋 대상에서
   명시적으로 제외함(파일명 개별 지정으로 스테이징, `git add -A` 사용 안 함).

## M41: 2026-08-20 — API 키 계정 quota 파싱 + 전환 결정 로직 신설(프록시 미배선, 순수 로직만)

**배경**: 07_OAUTH_FLOW_SPEC.md §5-4가 2026-08-17(M31)에 `github.com/jung-wan-kim/teamclaude`
실측으로 quota 헤더 정확한 필드명을 기록했지만, 그 문서 자신이 "ClaudeTower 자신의 실제 API
응답으로 아직 재현 검증되지 않았다"고 명시했고, 2026-07-28 CHECKPOINT 결정은 그래서 파싱 코드
자체를 보류했었다. 이번 세션은 "본래 목적(자동 전환)에서 벗어나지 않으면서 위험을 최소화"하는
방향을 사용자와 함께 검토한 뒤, **실거래 트래픽에 배선하지 않는 순수 로직만** 먼저 만들기로
범위를 좁혀 진행했다.

**만든 것**:
- [x] `src/accounts/quota/api-key-quota-reading.js` — `anthropic-ratelimit-tokens/requests-*`
  헤더(API 키 계정 전용, OAuth/구독 계정의 `unified-*` 헤더는 의도적으로 다루지 않음 — 자동
  전환 범위를 API 키로만 한정한다는 이번 세션 결정에 따름)를 파싱해 사용률(%)로 정규화하는
  순수 함수. 기대한 헤더가 없거나 형식이 다르면 예외 대신 `null` 반환(안티패턴#1 위반 방지 —
  "틀린 헤더명으로 조용히 매칭 실패"는 허용하되 "크래시"는 허용 안 함).
- [x] `src/accounts/quota/switch-decision.js` — `threshold_pct`/`strategy`(전략 정의 출처:
  `.PRD/.archive/QuotaSwitch원본/04_PROJECT_SPEC.md` 67행, claude-swap 실측 확인된 패턴 —
  `best`=여유 가장 많은 계정, `next-available`=임계값 미만 첫 후보)를 받아 전환 여부·대상을
  결정하는 순수 함수. `auth_type !== 'api_key'`·`status !== 'active'`·현재 계정 자신은 후보에서
  구조적으로 제외. `shouldSwitch=true`의 `reason`은 항상 `rotation-event.js`의 `REASONS`
  화이트리스트와 일치(회귀 테스트로 고정) — 나중에 실제 배선 시 그대로 `createRotationEvent()`에
  넘길 수 있게.
- [x] 신규 테스트 22건(`test:accounts` 165→187), `npm run verify`(lint+boundary+display 245)
  회귀 없음, end-to-end 스모크(`node -e`로 두 모듈을 실제로 이어붙여 실행) 통과.
- [x] `status-report.js` 갱신 — "quota 헤더 필드명: 문서로만 확정, 파싱 코드 없음" 항목을
  "파싱+결정 로직 구현·테스트 완료, 단 실제 응답 재검증 안 됨 + 프록시 미배선"으로 정정(과대
  고지 재발 방지 — M39 동의문구 사건과 같은 원칙).

**의도적으로 하지 않은 것(범위 밖, 이유 명시)**:
- `proxy/server.js`의 `startProxyServer` 실제 호출 배선 — 실거래 트래픽을 가로채는 코드라
  버그 시 실제 설치된 사용자 환경(Claude Code 정상 사용)에 영향을 줄 수 있는 최고위험
  구간이라 이번 세션엔 손대지 않음.
- 실제 API 응답으로 teamclaude발 헤더 필드명 재검증 — credential-store가 열려 인증된 요청을
  보낼 수 있어야 가능하지만, 이는 사용자의 실제 계정으로 실비용·실쿼터가 발생하는 행동이라
  AI가 임의로 실행하지 않음(사용자 승인 필요, 다음 결정 지점).
- OAuth/구독 계정 자동 전환 — ToS 이중 금지 결정(2순위 항목) 재검토 아님, 계속 범위 밖.

**남은 위험(숨기지 않고 명시)**:
1. 파싱 로직이 의존하는 필드명은 3자(teamclaude) 실측이지 ClaudeTower 자신의 실측이 아님 —
   위 "재검증" 전까지는 "이론상 맞을 가능성이 높은 값"일 뿐, 실제로 다를 가능성을 배제 못 함.
2. `best`/`next-available` 전략 로직 자체는 테스트로 검증됐지만, 여러 계정을 빠르게 오가는
   실제 자동 전환이 "API 키 로테이션 자체가 남용방지 조항에 걸리는지 확인 안 됨"이라는
   기존에 이미 고지된 법적 불확실성(consent-text.js)을 줄여주지 않는다 — 순수 로직 존재
   자체가 그 리스크를 승인하는 것은 아님, 실제 배선 시점에 다시 검토 필요.
3. 이번 커밋은 로컬 전용(push 안 함, 사용자 결정 대기) — `docs-and-fixes/2026-07-06` 브랜치
   기준 origin 대비 ahead 1.

## M42: 2026-08-20 — accounts diagnose-quota 명령 신설(실제 헤더 실측용, [y/N] 확인 필수)

**배경**: M41이 남긴 두 개의 "다음 결정 지점" 중 하나("teamclaude발 헤더 필드명을 ClaudeTower
자신의 실제 API 응답으로 재검증") — credential-store가 M35부터 실동작해 등록된 API 키로 실제
요청을 보낼 수 있게 됐지만, 실제 요청은 비용/쿼터가 드는 행동이라 AI가 사용자 승인 없이 자체
판단으로 실행하지 않는다는 원칙에 따라, "코드는 완성·테스트하되 실제 발사는 사용자가 명령을
직접 실행할 때만 일어나게" 범위를 좁혀 진행했다.

**만든 것**:
- [x] `src/accounts/accounts/diagnose-quota-command.js` — `claudetower accounts
  diagnose-quota <라벨> [--model <ID>]`. 등록된 API 키 계정으로 최소 크기 요청 1건
  (`max_tokens: 1`)을 실제 `api.anthropic.com`에 보내 응답 헤더가 파서가 기대하는
  6개 필드(`anthropic-ratelimit-tokens/requests-limit/remaining/reset`)와 일치하는지
  비교·보고한다. **계정을 전환하지 않는다** — `switch-decision.js`를 호출하지 않고
  헤더 실측 결과만 보여준다.
- [x] account-purge와 동일한 안전장치: 계정 없음/oauth 계정/시크릿 없음이면 확인 절차
  자체를 생략하고 즉시 거부(네트워크 요청 0건 보장) — 실제 발사 직전에만 비용을 명시
  고지하고 `[y/N]` 확인을 받는다. `N`이면 요청을 보내지 않고 취소.
- [x] `bin/claudetower.js`에 `accounts diagnose-quota` 서브커맨드 연결, 라벨 없으면
  사용법 안내 후 종료.
- [x] 신규 테스트 9건(`test:accounts` 187→196), `npm run verify`(display 245) 회귀
  없음. CLI 레벨 스모크 3건 직접 실행: 서브커맨드 목록에 정상 노출, 라벨 없이 실행
  시 사용법 안내, **존재하지 않는 라벨로 실제 CLI 실행** — 실제 등록 계정 레지스트리를
  읽었지만(다른 읽기 명령들과 동일) 네트워크 요청은 발생하지 않음을 실행으로 직접 확인
  (이 세션은 실제 API 요청을 단 한 번도 발사하지 않았다).
- [x] `status-report.js` 갱신 — 새 명령을 정확히 반영(과대·과소 고지 둘 다 피함).

**의도적으로 하지 않은 것**: 이 명령을 실제로 실행해 헤더를 확인하는 것 자체 — 사용자의 실제
계정으로 실비용이 발생하는 행동이라 AI가 대신 실행하지 않는다. 다음 세션(또는 사용자가 원하는
시점)에 `claudetower accounts diagnose-quota <본인 계정 라벨>`을 직접 실행해보는 것이 남은
유일한 검증 단계다 — 결과에 따라 파서 필드명이 그대로 맞으면 프록시 배선(M41이 미룬 나머지
항목)으로 넘어갈 수 있고, 다르면 파서를 실측값으로 정정하면 된다.

**남은 위험**: 기본 모델 ID(`claude-3-5-haiku-20241022`)는 시간이 지나면 폐기·변경될 수
있음(`--model`로 덮어쓰기 가능, 실패 시 에러 메시지에서 안내). 이번 커밋도 로컬 전용(push
안 함).

## M44: 2026-08-20 — 프록시 실제 요청 전달 로직(request-forwarder) 신설

**배경**: M41(파싱+전환 결정)·M42(헤더 실측 진단 명령)에 이어, `startProxyServer`가
여전히 비워둔 `onAuthorizedRequest` 콜백 — "검증된 요청을 실제 업스트림으로 전달하고
응답 헤더를 관찰하는" 부분을 만들었다. **실제 트래픽 진입점(`claudetower run` 등)에는
여전히 연결하지 않는다** — 그 배선은 다음 세션 이후로 계속 미룬다(2026-08-19 방향
결정 유지).

**만든 것**:
- [x] `src/accounts/proxy/request-forwarder.js` — `createRequestForwarder({ getApiKey,
  onUpstreamHeaders, upstreamHost, upstreamPort, useTls, timeoutMs })`가
  `startProxyServer`와 바로 맞물리는 `onAuthorizedRequest(req, res)`를 반환한다.
  요청·응답 본문을 전부 스트리밍(`.pipe()`)으로 중계 — 버퍼링해서 통째로 재전송하지
  않는다. 업스트림 상태코드·헤더는 그대로 중계(429 등 에러도 삼키지 않음). 활성 계정의
  API 키를 `x-api-key`로 항상 주입(클라이언트가 보낸 값은 덮어씀), 로컬 전용 접근 토큰
  헤더는 업스트림으로 전달하지 않음. 업스트림 연결 실패·타임아웃(기본 30초)은 502로
  안전하게 응답(무한 대기·크래시 없음). `onUpstreamHeaders` 관찰 콜백은 예외를 던져도
  응답 전달을 막지 않음.
- [x] "현재 활성 계정이 무엇인지"·"전환 시 어디에 기록할지"는 이 파일이 알지 못하게
  의도적으로 설계 — 전부 호출부 주입(`getApiKey`/`onUpstreamHeaders`). 실제 활성 계정
  포인터(`src/shared/active-account-handle/`)는 이 세션 조사 결과 **여전히 어디서도
  호출되지 않는 미배선 상태**임을 확인했다 — 그 연결도 다음 배선 단계의 몫이다.
- [x] 신규 테스트 13건, 전부 **실제 로컬 TCP 서버**(가짜 업스트림 + 진짜
  `startProxyServer`)로 검증(require.cache mock 아님) — 정상 중계·스트리밍 청크
  분할 전달·429 전달·API 키 주입/클라이언트값 덮어쓰기/토큰헤더 비유출·getApiKey 실패
  시 업스트림 미호출·연결실패 502·타임아웃 502·관찰콜백 예외 무시·**M41 파서+전환결정과의
  실제 end-to-end 연동**(가짜 quota 초과 헤더 → 올바른 전환 대상 계산 확인)·로컬 접근
  토큰 검증과의 통합까지 포함. `test:accounts` 196→211(대조 세션이 동시에 credential-store
  테스트도 늘리고 있어 이 커밋만으로 정확히 +13은 아님 — 아래 "동시 작업" 참고).
  `npm run verify`(display 245) 회귀 없음.

**동시 작업(그대로 두고 건드리지 않음)**: 이 세션 도중 다른 세션이 `scripts/build-sea.js`·
`src/accounts/credential-store/index.js`·`test/accounts/credential-store-index.test.js`·
`install.sh`를 실시간으로(미커밋 상태로) 고치고 있는 것을 확인했다 — 겹치는 파일이 없어
충돌은 없었고, 파일명을 명시 지정해 스테이징(`git add -A` 사용 안 함)해 그 변경들은
전혀 건드리지 않았다.

**남은 위험**:
1. 여전히 아무것도 `startProxyServer`를 실제로 호출하지 않는다 — 이 파일이 있어도
   지금 설치된 실사용 환경의 동작은 전혀 바뀌지 않는다(의도된 것).
2. "전환 시 활성 계정 상태를 실제로 어떻게 갱신할지"(active-account-handle 연결,
   registry의 `status`를 `cooldown`으로 바꿀지 등)는 아직 설계·구현 안 됨 — 다음 배선
   단계에서 반드시 다뤄야 한다.
3. 이번 커밋도 로컬 전용(push 안 함).

- 상태: **CHECKPOINT 기록 완료, PR #8 main 병합 진행 중(이 커밋 직후)**.

**2026-08-20 정정(M40 자체 오류 + 별도 발견 1건)**: PRD 전수 재검독 중 `bin/claudetower.js`
라우팅 코드를 직접 대조하다가 두 가지를 발견해 정정했다. ① 위 M40 본문이 삭제 명령을
`accounts purge`(accounts의 하위명령)로 잘못 적었으나, 실제로는 `account-purge`라는
**최상위 명령**이다(186행, `accounts` 분기와 별개) — 위 문단 정정 완료. ② `src/accounts/
consent-text.js` 상단 주석이 "purge는 여전히 미구현"이라고 적혀 있었는데, 이는 그 주석을
쓴 바로 그 커밋(`fc4cefe`)이 실제로는 account-purge를 신설·배선까지 마친 커밋이라 **같은
커밋 안에서부터 사실과 반대로 stale**했던 것으로 확인됨 — 주석을 실제 구현 상태에 맞게
정정했다(기능 코드·사용자에게 보이는 동의 문구 자체는 원래부터 정확했음, 개발자용 주석만
틀려 있었음). 둘 다 순수 문서/주석 수정이며 동작 코드는 건드리지 않음.

## M45: 2026-08-20 — 실거래 배선 승인 게이트 신설(기계적 강제)

**배경**: PRD 전수 재검독 중 `src/accounts/proxy/active-account-provider.js`(동시 세션이
방금 완성)가 `request-forwarder.js`(M44)에 그대로 주입 가능한 상태까지 이르렀음을 확인 —
`startProxyServer`에 연결하고 `bin/claudetower.js`에 진입점 하나만 추가하면 실제 사용자
트래픽을 가로채는 배선이 즉시 라이브로 켜지는 상태. 이 저장소를 최소 두 개 세션이 조율
없이 동시에 작업 중인 것도 이 세션 내내 반복 확인됨 — 문서 경고만으로는 놓칠 수 있다고
판단해 기계적 강제를 추가했다.

**만든 것**:
- [x] 이 문서 최상단에 "🛑 실거래 배선 승인 게이트" 배너 신설 — 모든 세션이 CHECKPOINT를
  열자마자 가장 먼저 보게 배치.
- [x] `.PRD/07_OAUTH_FLOW_SPEC.md` §5-1에 "원칙 승인 ≠ 지금 배선해도 된다는 승인" 구분
  추가.
- [x] `test/accounts/live-wiring-gate.test.js` 신설 — `bin/claudetower.js` 소스 텍스트에
  `startProxyServer`/`active-account-provider`/`createRequestForwarder` 참조가 없음을
  정적으로 강제(우회 조건 없음). ESLint 모듈 경계 규칙·`check-module-boundary.js`와 동일한
  방어 원칙(문서+코드 이중 강제).
- 검증: 신규 테스트 통과(1/1), `npm run lint`·`npm run lint:boundary` 회귀 없음. 동시
  세션의 미커밋 작업(`accounts-registry.js`·`active-account-provider.js` 등)은 전혀
  건드리지 않음(파일명 개별 지정 스테이징).

**의도**: 이 게이트는 기능을 막는 게 아니라 "언제 켤지"를 사용자의 별도 결정으로 명시적으로
분리하는 것이다 — 게이트 해제 방법 자체를 이 테스트 안에 문서화해뒀다(사용자가 이 구체적
단계를 승인한 뒤 테스트를 의도적으로 수정).

- 상태: **완료, 로컬 커밋만(push는 사용자가 이후 결정)**.

## M46: 2026-08-20 — 활성 계정 상태 관리(active-account-state) 신설 + 전환 진동 방지 스로틀

**배경**: M41(판단)·M44(중계)까지 있었지만, 판단 결과("전환해야 한다")를 실제로 적용하는
곳이 없었다 — 이번 세션이 그 마지막 빈틈을 채웠다. M45의 실거래 배선 게이트는 이 파일이
완성되는 걸 계기로 신설된 것이라, 같은 세션 안에서 "완성"과 "그러니 배선은 별도 승인 필요"가
동시에 확인된 셈이다.

**만든 것**:
- [x] `src/accounts/accounts/active-account-state.js` — "지금 프록시가 어느 계정을 쓰는지"
  포인터를 파일로 영속화(여러 프로세스 공유 목적). `applySwitch(decision, ...)`가
  `evaluateSwitchDecision`의 결과를 실제로 적용: registry 재검증(레이스 컨디션 방어) →
  상태 파일 갱신 → `active-account-handle` 갱신(Display 노출용) → RotationEvent 감사로그
  기록. credential-store는 절대 모른다(정적 검사로 강제).
- [x] `src/accounts/proxy/active-account-provider.js` — registry+credential-store+
  active-account-state+quota 판단 로직을 전부 조합해, `request-forwarder.js`(M44)가
  바로 주입받을 수 있는 `getApiKey`/`onUpstreamHeaders` 두 함수를 만든다. 활성 계정이
  한 번도 선택 안 됐으면 registry의 첫 사용 가능 계정을 자동 채택(단, 이 자동 채택은
  상태 파일에 기록되지 않는다 — 의도적, 코드 주석에 명시).
- [x] **실측으로 발견한 결함을 그 자리에서 수정**: 두 계정으로 실제 로컬 네트워크
  end-to-end 스모크(가짜 업스트림이 계정과 무관하게 항상 quota 초과 헤더로 응답)를
  돌려보니, 요청마다 계정이 A→B→A→B로 계속 튕기는 진동이 실제로 재현됐다 —
  `evaluateSwitchDecision`이 "현재 계정"만 후보에서 제외하기 때문에, 매 응답마다
  전환이 반복될 수 있다는 뜻. `switch-policy-config.js`의 `reeval_interval_ms`(애초에
  "0=주기적 재평가 비활성화"로 이 문제를 막으려고 만들어졌던 필드, 지금까지 아무도 실제로
  안 씀)를 `applySwitch`에 배선해 스로틀로 사용 — 직전 전환 이후 그 시간이 안 지났으면
  판단이 "전환"이어도 적용을 보류한다. 재현 스크립트로 수정 전(진동 재현) → 수정 후
  (3번째 요청까지 전부 같은 계정 유지, 감사로그 이벤트 정확히 1건) 둘 다 직접 확인.
  잦은 전환은 UX 문제를 넘어 동의 문구가 이미 고지한 법적 불확실성(API 키 로테이션 남용
  방지 조항)과도 직결되므로 가볍게 볼 결함이 아니었다.
- [x] **부수적으로 발견·수정**: `src/shared/active-account-handle/{read,write}.js`가
  다른 모든 Account 상태 파일과 달리 `CLAUDETOWER_*` 격리 변수를 전혀 지원하지 않아,
  이 파일을 테스트하려면 실제 사용자 홈 디렉터리의 진짜 파일을 건드려야 하는 구조였다
  (2026-07-06 통제 재현으로 확정한 결함 부류와 같은 종류). `CLAUDETOWER_ACTIVE_ACCOUNT_HANDLE_PATH`
  override를 추가하고, 기존 3개 파일(`accounts-registry.js`·`switch-policy-config.js`·
  `module-activation-state-store.js`)의 `ACCOUNTS_ISOLATION_VARS` 목록에 새 변수 2개
  (`CLAUDETOWER_ACCOUNTS_ACTIVE_ACCOUNT_PATH`·`CLAUDETOWER_ACTIVE_ACCOUNT_HANDLE_PATH`)를
  대칭으로 추가(기존 관례 그대로 따름).
- [x] 신규 테스트 20건(active-account-state 11 + active-account-provider 10, 이 중 하나는
  기존 파일에 추가) 전부 실제 파일 I/O로 검증(require.cache mock은 credential-store에만
  한정). `npm run verify`(display 245) 회귀 없음, `test:accounts` 회귀 없음. 별도 스크립트로
  `request-forwarder`+`active-account-provider`+진짜 `startProxyServer`를 실제 로컬
  TCP로 전부 이어붙인 end-to-end 스모크 실행(위 진동 재현·수정 확인 포함) — 실제
  api.anthropic.com에는 이번에도 전혀 접촉하지 않음.
- [x] **여전히 `bin/claudetower.js`를 전혀 건드리지 않았다** — M45의 게이트 테스트가
  그대로 통과함을 직접 실행으로 재확인.

**동시 작업 중 겪은 실제 사고(경고 목적으로 기록)**: 이 커밋을 만드는 도중, 동시 세션이
자신의 게이트 커밋을 `git commit --amend`한 순간과 정확히 겹쳐 내가 `git add`로 스테이징해둔
파일들이 공유 `.git/index`에서 통째로 사라지는 것을 실측으로 확인했다(작업 디렉터리의 실제
파일 내용은 전혀 영향 없었음 — `git add`는 인덱스만 건드리므로). `git commit`이 "nothing to
commit"을 반환해 발견, 디스크 파일 존재·크기 재확인 후 다시 `git add`+`git commit`으로
안전하게 재시도해 해결했다. **교훈**: 여러 세션이 같은 저장소에서 동시에 `git add`/
`git commit`(특히 `--amend`)을 실행하면 인덱스 레벨 경합이 실제로 발생할 수 있다 — 커밋 직후
반드시 `git log`/`git status`로 실제로 반영됐는지 재확인해야 한다(이번처럼 조용히 사라질 수
있음, 에러 없이).

**남은 위험**:
1. M45 게이트가 여전히 유효 — 이 커밋도 `startProxyServer`/`bin/claudetower.js`를 연결하지
   않는다.
2. `onUpstreamHeaders`는 매 응답마다 registry·상태·정책 파일을 동기(sync) I/O로 읽는다 —
   실제 트래픽량을 아직 모르므로 캐싱 등 최적화는 하지 않음(조기 최적화 자제, 배선 후
   필요하면 다룸).
3. 이번 커밋도 로컬 전용(push 안 함).

**2026-08-20 독립 재확인(별도 세션)**: M46의 진동 방지 스로틀 주장을 그대로 믿지 않고
직접 코드로 재검증했다 — "고쳤다고 보고했지만 실제 호출부는 안 고쳐져 있었다"는 이
프로젝트의 반복된 실패 패턴(M9)이 재발했는지 의심하고 확인한 것. 결과: `active-account-
provider.js`의 `onUpstreamHeaders`가 실제로 `reevalIntervalMs: policy.reeval_interval_ms`를
`applySwitch`에 전달하고 있음을 직접 코드로 확인(배선 누락 아님). `switch-policy-config.js`
`DEFAULTS.reeval_interval_ms`도 `300000`(5분)으로, 사용자가 별도 설정을 안 해도 스로틀이
기본으로 작동함까지 확인. **결함 없음 — M46 주장이 사실과 일치함을 독립 검증으로 확인.**
같은 확인 과정에서 `test/accounts/live-wiring-gate.test.js`가 M46 이후에도 여전히 통과함을
재실행으로 재확인(게이트 유효 지속).

**참고(별도 이슈, 이번 라운드에서 새로 고치지 않음)**: 지난 라운드에 발견한
`accounts-purge-command.test.js`의 통합 테스트가 전체 스위트를 한꺼번에 돌릴 때 간헐적으로
false-fail을 내는 현상(이 PC의 프로세스 폭주 환경에서 여러 통합 테스트가 동일한 실제
Windows Credential Manager 서비스명을 동시에 왕복하며 생기는 것으로 추정, 격리 실행 시
항상 통과)은 여전히 미해결이다. 코드 로직 결함이 아니라 이 PC 환경 특유의 타이밍 이슈로
보이며, 원인이 100% 확정되지 않은 채로 테스트 동시성 구조를 바꾸는 것은 새 위험을 만들
수 있어 이번 라운드에서는 손대지 않았다 — 다음에 이 결과를 보는 세션은 "purge가 실제로
깨졌다"고 성급히 결론 내리기 전에 반드시 해당 테스트 파일만 격리 실행해 재현되는지 먼저
확인할 것.

## M47: 2026-08-20 — 활성 계정 상태·핸들 파일 쓰기를 원자적(임시파일+rename)으로 변경

**배경**: M46이 끝난 뒤 위험 재검토 중 발견 — `active-account-state.js`(전환 상태 포인터)와
`active-account-handle/write.js`(Display 노출용 라벨)가 둘 다 `fs.writeFileSync`로
파일을 통째로 덮어쓴다. 이 두 파일은 계정 목록·설정 파일과 달리, 나중에 실거래 배선이
켜지면 **응답이 올 때마다 자동으로** 갱신되므로(사용자가 명령을 하나씩 실행할 때만 쓰이는
다른 Account 상태 파일들과 다름), 터미널 여러 개에서 동시에 `claudetower`를 켜두면 두
프로세스가 같은 순간에 같은 파일을 쓰다가 반쯤 쓰인 채로 깨질 실제 위험이 있다 — 이
프로젝트가 `install.ps1`에서 이미 겪은 것과 정확히 같은 결함 부류
(`.PRD/05_FIELD_ISSUES_2026-07-04.md` 이슈#1, self-collision).

**만든 것**:
- [x] 두 파일 모두 "임시 파일에 먼저 쓰고 `rename()`으로 교체" 방식으로 전환(install.ps1이
  이미 검증한 것과 동일한 해법). `rename()`은 POSIX·Windows(libuv가
  `MOVEFILE_REPLACE_EXISTING` 사용) 양쪽에서 대상이 이미 존재해도 원자적으로 교체된다.
- [x] 신규 테스트: 실제 별도 OS 프로세스 10개를 동시에 띄워 같은 파일에 동시 쓰기를
  시도한 뒤, 파일이 항상 유효한 JSON으로 남고 임시 파일 잔재가 없는지 확인(양쪽 파일
  전부). `active-account-handle`에는 이번에 처음으로 전용 테스트 파일도 생겼다(그동안
  Account·Display 어느 쪽에도 직접 테스트가 없었다 — 2026-08-20 발견).
- **정직하게 명시(과대 검증 주장 금지)**: 이 동시성 테스트를 원자적 쓰기 적용 "전" 코드로
  5회 반복 실행해봤지만 손상을 **재현하지 못했다** — 페이로드가 작고(수십 바이트) 쓰기가
  빨라, 이 PC(Windows/NTFS)에서는 경합 창이 이 테스트로 안정적으로 재현될 만큼 넓지
  않은 것으로 보인다. 그래서 "실측으로 결함을 재현하고 고쳤다"고는 말할 수 없다 — 이
  수정은 이 프로젝트가 실제로 겪은 전례(install.ps1)와 `rename()`의 표준 원자성 보장에
  근거한 예방적 하드닝이며, 신규 테스트는 "고친 뒤에도 정상 동작 회귀 없음"을 보장하는
  안전망이다.
- 검증: `npm run verify`(display 245) 회귀 없음, `test:accounts` 233→241(신규 8건: 상태
  파일 동시성 1건 + handle 전용 테스트 6건). 로컬 커밋만(push 안 함).

**남은 위험**: 이번 수정은 "쓰기 손상"만 막는다 — 서로 다른 프로세스가 동시에 **다른**
전환 판단을 내려 순서만 다르게 마지막에 쓴 쪽이 이기는 것(last-write-wins) 자체는 여전히
가능하다(예: A→B 전환과 A→C 전환이 동시에 결정되면 둘 중 나중에 rename한 쪽만 남음).
이건 파일 손상과는 다른 종류의 문제(어느 쪽이 "이겨야 하는지"의 정책 문제)라 이번 범위에
포함하지 않았다 — 실거래 배선 이후 실제 다중 프로세스 사용 패턴을 관찰한 뒤 필요하면
다룰 것.

## M48: 2026-08-20 — 계정 CRUD 나머지(remove/rename) + 사용률 표시(quota 캐시) 신설

**배경**: PRD 재검독 중 `.PRD/03_PHASES.md` Phase 2 체크리스트를 실제 코드와 대조해 3가지
갭을 발견했다 — `account-purge`(전체삭제)만 있고 계정 1개만 지우는 `remove`, 라벨만 고치는
`rename`이 없었고, `accounts list`가 계정별 사용률을 전혀 보여주지 않았다(PRD가 "teamclaude
session(5h)/weekly(7d) quota 용어 채택, 기본 표시"라고 명시한 요구사항). 실거래 배선(위험 최고
등급)과 달리 셋 다 순수 로컬 CRUD/표시라 안전지대에서 바로 완성 가능하다고 판단해 진행했다
(사용자 승인, "그룹 A 전부 진행").

**만든 것**:
- [x] `remove-account-command.js` — 계정 1개 삭제. account-purge와 동일한 원칙(자격증명
  먼저 삭제 → 재조회 검증 → 성공 시에만 레지스트리에서 제거, [y/N] 확인 필수). 활성화
  상태는 건드리지 않음(disable과 동일 원칙 — 계정 1개 삭제로 기능 전체를 끄지 않음).
- [x] `rename-account-command.js` — 라벨만 변경(credential-store는 account_id로 키를
  잡아 전혀 안 건드림). 라벨 길이 100자 상한·제어문자 거부(add-api-key-request.js와 동일
  규칙 재사용), 라벨 충돌 거부. 가역적이라 확인 절차 없음.
- [x] `quota/quota-cache-store.js`(신규) — `diagnose-quota`가 실측한 사용률을 계정별로
  저장, `accounts list`가 읽어서 보여준다. **QuotaState 엔티티를 그대로 쓰지 않은 이유**:
  그 엔티티의 `five_hour_used_pct`/`seven_day_used_pct`는 OAuth/구독 계정의 시간창 헤더용
  이름인데, 이 프로젝트는 자동전환을 API 키 계정으로만 한정했고(2026-08-19) API 키 헤더는
  시간창 개념이 없다 — 실제로 재는 것과 다른 이름을 붙이면 이 프로젝트가 반복 잡아온
  "부정확한 능력 고지"가 된다. 그래서 파서의 실제 출력 모양(`tokens_used_pct`/
  `requests_used_pct`) 그대로 저장한다.
- [x] `list`는 실시간으로 API를 호출하지 않는다(diagnose-quota만 [y/N] 확인 후 실비용
  드는 실제 호출) — 캐시가 없으면 "확인 안 됨 + diagnose-quota로 확인 가능" 안내만 표시.
- [x] `bin/claudetower.js`에 `accounts remove`/`accounts rename` 배선, 서브커맨드 안내
  문구 갱신. README.md/README.en.md는 이번 라운드에 아직 갱신 안 함(다음 정리 대상).
- [x] 신규 테스트 40건 전부 직접 실행 통과 확인(remove 4 + rename 6 + quota-cache 9 +
  list 갱신분 3 + diagnose-quota 갱신분 2 + 기존 16), `npm run lint`·`test:display`(245)
  회귀 없음, `live-wiring-gate.test.js` 재확인(여전히 통과 — 이번 작업도 `bin/claudetower.js`에
  `startProxyServer` 계열을 전혀 추가하지 않음).
- [x] 실제 빌드 없이 `node bin/claudetower.js`로 격리 경로 라이브 스모크: enable→add x2→
  list→**rename**→list(라벨 변경 확인)→**remove**→list(1개만 남음 확인) 전체 흐름 실행 확인.

**작업 중 발견·즉시 처리한 사고(정직하게 기록)**: 위 라이브 스모크 도중 credential-store에는
격리 경로가 없다는 걸(설계상 항상 실제 OS 저장소를 씀, 2026-08-18 M35부터 알려진 사실) 깜빡하고
레지스트리 파일을 먼저 지워버려, `rename`한 계정의 가짜 키("fake-key-a")가 **실제 Windows
Credential Manager에 남는 사고**가 발생했다. `@napi-rs/keyring`의 `findCredentials(service)`
API(이번에 처음 사용 — `cmdkey /list`보다 신뢰도 높음, 이 세션이 반복 확인해온 "cmdkey는
`@napi-rs/keyring` 항목을 못 잡는다"는 한계가 없음)로 서비스 `claudetower`의 전체 잔재를
조회했더니 **3건**이 나왔다: 이번 사고분(`fake-key-a`) 외에 `claudetower-test-*`·
`claudetower-purge-test-*` 이름의 **과거 라운드 잔재 2건도 함께 발견**됐다(2026-08-19 QA
라운드에서 기록했던 "전체 스위트 동시 실행 시 통합테스트 간섭"으로 정리(cleanup)가 중간에
끊겼던 흔적으로 추정 — 값 자체가 테스트 마커 문자열이라 실사용자 데이터 아님 확인). 3건
모두 `deletePassword()` 후 `getPassword()` 재조회로 `null` 확인, `findCredentials()`
재조회로 0건까지 확인해 완전히 정리했다.

**교훈(하네스 반영 권장)**: `findCredentials(service)`가 `cmdkey /list`보다 신뢰도 높은
Windows Credential Manager 잔재 확인 수단이다 — 앞으로 이 프로젝트의 라이브 정리 검증은
이 API를 1순위로 쓸 것.

**남은 위험**:
1. 사용률 캐시는 diagnose-quota를 최소 1번 실행해야만 채워진다 — 등록만 하고 한 번도
   diagnose-quota를 안 돌린 계정은 계속 "확인 안 됨"으로 보임(의도된 동작, 실비용 없이는
   채울 방법이 없음).
2. 이번 커밋도 로컬 전용(push는 검증 완료 후).

**2026-08-20 정정**: 위 목록에 있던 "README.md/README.en.md에 remove/rename 명령이 아직
문서화되지 않음" 항목은 사실이 아니었다 — 실제로는 이 M48을 만든 바로 그 커밋(`79dd7ed`)에
README.md·README.en.md 양쪽 다 이미 반영돼 있었다(`git log -- README.md README.en.md`로
재확인). 이 CHECKPOINT 기록 시점에 실제 diff를 재확인하지 않고 "문서화 남음"이라고
과대평가해서 적은 것으로 보인다 — 이 프로젝트가 반복 겪어온 "코드가 문서보다 앞서간다"
패턴의 정반대(문서 상태를 실제보다 나쁘게 기록) 사례라 다음 세션이 혼동하지 않도록
바로잡는다.

## M49: 2026-08-20 — 종합 QA 중 발견: 원자적 쓰기가 Windows에서 EPERM으로 실패할 수 있는
결함 수정 (active-account-state.js + active-account-handle/write.js)

**배경**: 사용자 요청으로 지금까지 구현된 전체 기능을 종합 검증하는 세션(정상/예외/경계값/
실패 상황 확인, lint/test:display/test:accounts/build 실행)을 진행하던 중 `npm run
test:accounts` 267개 중 1개가 실패하는 걸 발견했다.

**재현**: `test/accounts/active-account-state.test.js`의 "여러 프로세스가 동시에 같은
파일에 써도 파일이 항상 유효한 상태로 남는다" — 실제 OS 프로세스 10개를 동시에 띄워
같은 상태 파일에 쓰는 테스트. 전체 스위트를 한꺼번에 돌릴 때(이 PC의 배경 프로세스 부하가
가장 큰 조건)만 재현되고, 해당 파일만 격리 실행하면 5/5 통과 — 부하가 경합 창을 넓힐
때만 드러나는 조건부 결함.

**원인**: `atomicWriteFileSync()`(M47이 신설, "임시파일에 먼저 쓰고 rename()으로 교체"
방식)의 코드 주석이 "rename()은 POSIX·Windows 양쪽에서 항상 원자적으로 성공한다"고
적혀 있었으나 **부정확했다** — Windows의 MoveFile은 대상 파일을 다른 프로세스가 그
찰나에 열어 붙잡고 있으면 `EPERM`으로 일시 실패할 수 있다(POSIX rename()에는 없는
제약). 재시도 로직이 없어 이 예외가 그대로 호출자에게 전파돼 프로세스가 죽었다. 같은
"임시파일+rename, 재시도 없음" 패턴이 `src/shared/active-account-handle/write.js`
(M47이 함께 적용)에도 코드 중복돼 있어 **동일한 결함을 안고 있음을 함께 확인**했다.

**수정**: 두 파일 모두 `fs.renameSync()`를 EPERM/EBUSY에 한해 최대 10회, 20ms 간격으로
재시도하도록 변경(install.ps1이 이미 겪은 같은 부류의 문제에 쓴 해법과 동일 원칙). 그
외 예외(디스크 가득 참 등)는 재시도 없이 즉시 전파 — 실패 원인을 가리지 않는다. 동기
함수라 `Atomics.wait`로 이벤트 루프를 막지 않는 짧은 동기 대기를 사용(스핀 대기 아님).
재시도를 다 써도 실패하면 임시파일을 정리한 뒤 원래 에러를 그대로 던진다(에러를 삼키지
않음, DO NOT 규칙). 코드 상단 주석의 부정확했던 서술도 실측 근거와 함께 정정했다.

**재검증**:
- 문제의 테스트를 격리 실행 5회 연속(5/5 통과, 총 95개 하위 검증) + 전체
  `test:accounts` 재실행(**267/267 통과, 이전엔 266/267**) — 다른 라운드에서도 실패가
  재발하지 않는지는 이 세션 안에서는 추가로 관찰할 수 없으나(원래도 간헐적 재현이었음),
  근본 원인(재시도 부재)은 코드로 직접 제거함.
- `test:display`(245/245) 회귀 없음 — Display 모듈은 이 파일들을 아예 참조하지 않음
  (`bin/claudetower.js 로드 시 src/accounts/ 가 require 캐시에 없다` 테스트로 이미 강제).
- `npm run lint` 통과, `npm run build` 성공, 실제 빌드된 exe로 재빌드까지 확인.
- `live-wiring-gate.test.js`는 이 수정과 무관(파일 I/O 로직만 바꿈, `bin/claudetower.js`
  미접촉) — 영향 없음을 별도로도 확인.

**남은 위험**: 이 수정은 "쓰기 자체의 실패"만 막는다 — 여러 프로세스가 동시에 서로
**다른** 값을 쓰려는 경우 마지막에 rename에 성공한 쪽이 이기는 것(last-write-wins)은
여전히 그대로다(M47이 이미 명시한, 별개의 남은 위험). 이번 수정 범위 밖.

- 상태: **완료, 로컬 커밋만(push는 검증 완료 후 진행)**.

## M50: 2026-08-20 — PRD 전수 재독으로 발견한 실제 갭 3건 해소: 파일 권한 하드닝 + 릴리즈 드리프트 + 로컬 브랜치 동기화

**배경**: 사용자 요청으로 `.PRD/` 9개 문서 전체를 다시 정독하고 실제 코드·커밋·GitHub 상태와
대조하는 감사를 진행했다. 새 기능을 추가하는 대신 "PRD가 스스로 남긴 약속인데 코드가 못
따라간 것"만 찾는 데 집중했다 — 그 결과 실제 갭 2건과 로컬 환경 위험 1건을 발견했다.

**1) 보안 갭 — `.PRD/02_DATA_MODEL.md` NEEDS CLARIFICATION이 끝내 미해소 상태였음**:
"`ActiveAccountHandle` 파일도 다른 사용자가 못 읽게 권한 제한이 필요한지"가 2026-07-27
"구현 세션에서 재검토"로 재개됐지만, `CHECKPOINT.md` 전체를 grep해도 이 항목을 처리한
M-엔트리가 0건이었다. 코드로 직접 대조한 결과, 이유가 드러났다: M30에서 RotationEvent
감사 로그에는 소유자 전용 권한(Windows `icacls`, POSIX `chmod 0o600`)을 적용했는데, 그
뒤 M46~M49에서 새로 생긴 `active-account-state.json`(내부 활성 계정 포인터)·
`active-account.json`(ActiveAccountHandle, Display 노출용) 두 파일에는 그 패턴이 전혀
적용되지 않았다(두 파일 모두 icacls/chmod 코드 0건, grep으로 직접 확인) — 원자적 쓰기까지
하드닝(M47·M49)해놓고 권한만 빠뜨린 비일관 상태였다.

**만든 것**:
- [x] `src/accounts/accounts/active-account-state.js`·`src/shared/active-account-handle/write.js`
  양쪽에 M30과 동일한 원칙의 `restrictOwnerOnlyPermission(filePath)` 추가(Windows: `icacls
  /inheritance:r` + `/grant:r <사용자>:F` 후 실제 ACL을 재조회해 검증, POSIX: `chmod 0o600`
  후 실제 모드 재확인 — "명령이 에러 안 남" ≠ "실제로 그렇게 됨"을 구분하는 M30 원칙 그대로).
  두 파일은 `src/shared/`↔`src/accounts/` 모듈 경계상 로직을 공유할 수 없어(Display도 읽는
  공유 파일에 Account 전용 로직을 얹으면 경계가 흐려짐) 의도적으로 중복 작성했다(이 프로젝트의
  기존 `ACCOUNTS_ISOLATION_VARS` 중복 관례와 동일한 이유).
- [x] **RotationEvent와의 차이를 반영한 적용 시점 조정**: RotationEvent는 append 파일이라
  "최초 생성 시 1회만" 권한을 강제하면 충분하지만, 이 두 파일은 매 쓰기마다 임시파일을
  새로 만들어 `rename()`으로 전체 교체하므로 — 같은 볼륨 내 `rename()`은 대상이 아니라
  원본(임시 파일)의 보안 속성을 그대로 옮기는 NTFS/POSIX 공통 동작이라, **매 쓰기(=매
  rename)마다** 새로 생기는 임시 파일에 매번 적용해야 최종 파일도 항상 소유자 전용 권한을
  유지한다. 이를 회귀 테스트로 직접 확인(두 번째 쓰기도 여전히 `permissionRestricted:true`).
- [x] `atomicWriteFileSync`(state)·`writeActiveAccountHandle`(handle) 둘 다 `{
  permissionRestricted }`를 반환하도록 확장 — 기존 호출부(`applySwitch`)는 반환값을 쓰지
  않으므로 하위 호환(undefined→객체 반환은 기존 어떤 호출부도 깨지 않음, grep으로 전체
  호출부 확인).
- [x] 신규 테스트 5건(active-account-state 3 + active-account-handle 2): `permissionRestricted`
  boolean 검증, win32 전용 실제 `icacls` 출력 대조(단일 ACE·현재 사용자 전체 권한), 두
  번째 쓰기에도 재적용되는지 확인. `test:accounts` 267→272.
- [x] **실제 프로덕션 경로(단위테스트 아님)로 end-to-end 검증**: `appendAccount`→`applySwitch`
  전체 흐름을 별도 스크립트로 실행해, 그 결과로 생성된 두 파일의 실제 `icacls` 출력을
  직접 조회 — 둘 다 `현재사용자:(F)` 단일 ACE만 있음을 실측 확인(단위테스트가 아니라 실제
  호출 경로로 재확인, 이 프로젝트가 반복 강조해온 "격리 테스트만으로 됐다고 하지 마" 원칙).
- [x] `.PRD/02_DATA_MODEL.md`의 해당 NEEDS CLARIFICATION 항목을 해소됨으로 정정.
- 검증: `npm run lint`(클린)·`npm run lint:boundary`(23개 파일 통과)·`test:accounts`
  (272/272)·`test:display`(245/245, 회귀 없음)·`live-wiring-gate.test.js`(재확인, 여전히
  통과 — 이번 작업도 `bin/claudetower.js`를 전혀 건드리지 않음)·`npm run build`(성공).

**2) 릴리즈 드리프트**: `package.json`은 M40(2026-08-19)부터 `0.5.0`인데 GitHub 최신
Release는 여전히 `v0.4.0`(2026-07-27)으로 3주 이상 뒤처져 있었다 — "버전을 올리면 태그·
Release도 같이 최신 유지"라는 기존 원칙과 어긋나는 상태로 방치돼 있었다. `v0.5.0` 태그
생성 + GitHub Release 발행으로 해소(릴리스 노트는 M35~M49 요약).

**3) 로컬 작업 브랜치 동기화 필요성**: `docs-and-fixes/2026-07-06`이 이 라운드 시작 시점
origin/main 대비 0 ahead / 9 behind였다(다른 PR로 병합된 커밋들이 로컬 반영 안 됨) — 이번
라운드 도중에도 동시 세션의 신규 로컬 커밋(`f2b34e8`, PRD 문서 정정 2건)이 실시간으로
관찰됐다. 작업 디렉터리 충돌은 없었다(내가 건드린 4개 파일과 전혀 겹치지 않음, `git status`로
매번 재확인) — 이 프로젝트가 이미 여러 차례 겪은 동시 세션 패턴과 동일하며, 이번에도
파일명을 명시 지정해 스테이징하는 기존 원칙으로 안전하게 격리했다.

**의도적으로 하지 않은 것**: 실거래 배선(게이트 그대로 유지, `live-wiring-gate.test.js`
재확인 완료) — 이번 라운드는 새 기능이 아니라 기존에 이미 약속한 것(PRD NEEDS
CLARIFICATION, 릴리스 최신 유지 원칙)을 완결시키는 작업으로 범위를 한정했다.

**남은 위험**: 파일 권한 하드닝은 "이 OS 사용자 계정 소유자만 읽기 가능"까지만 보장한다 —
관리자 권한을 가진 다른 계정이나 물리적 디스크 접근까지 막는 것은 아니며(OS 표준 ACL의
근본적 한계, RotationEvent M30도 동일 한계를 이미 안고 있었음), 이 두 파일 자체는 애초에
토큰이 아니라 계정 라벨/ID만 담고 있어(`.PRD/02_DATA_MODEL.md` 모듈 경계 규칙) 하드닝의
가치는 "부가적 방어"이지 "이게 없으면 자격증명이 샌다"는 의미는 아니다(과대 고지 방지).

## M51: 2026-08-20 — 전수 감사로 발견: "best/next-available 전환 판단"이 실제로는 작동하지
않던 결함 수정(quota 연결 누락) + quota-cache-store.js 원자적쓰기 하드닝 + PRD 문서 3건 정정

**배경**: 사용자 요청으로 지금까지 만든 Account 모듈 코드 전체(31개 파일)와
CHECKPOINT.md·`.PRD/` 문서 전체를 각각 전수 감사하는 조사 두 건을 병렬로 진행했다(읽기
전용 조사). 코드 감사에서 이 프로젝트의 "본래 구현 목적" 자체가 작동하지 않는 실제 결함을
발견했다.

**발견한 결함**: `active-account-provider.js`의 `onUpstreamHeaders`가
`evaluateSwitchDecision()`을 호출할 때 `quotaByAccountId`를 전혀 넘기지 않고 있었다
(파라미터 자체를 생략, 기본값 `{}`). `switch-decision.js`의 `candidatePct()`는
`quotaByAccountId`에 없는 계정을 "0%(가장 여유 있음)"로 취급하도록 설계돼 있는데(막 등록한
신규 계정을 후순위로 미루지 않으려는 의도), 이 파라미터가 항상 비어 있으면 **모든 후보가
항상 0%로 보여** `best` 전략이 "가장 여유 있는 계정 선택"이 아니라 사실상 "registry 배열
순서상 첫 번째 후보 선택"으로 퇴화하고, `next-available`도 "항상 첫 후보 즉시 선택"으로
퇴화한다. `quota-cache-store.js`(M48)가 이 데이터(계정별 마지막 확인 사용률)를 이미
저장해두고 있었는데도 연결이 안 돼 있었다. 계정을 **정확히 3개 이상 등록해야만** 드러나는
결함이라(후보가 1개뿐이면 quota 데이터 유무와 무관하게 그 계정이 선택됨)
`active-account-provider.test.js`의 기존 end-to-end 테스트(2계정 시나리오)로는 발견되지
않았다 — `switch-decision.test.js` 자체는 3계정 시나리오까지 정확히 검증하고 있어 판단
로직 자체(순수 함수)는 문제없었다.

**수정**:
- [x] `onUpstreamHeaders`가 `quota-cache-store.js`의 `readQuotaCache()`로 실제
  `quotaByAccountId`를 채워 `evaluateSwitchDecision()`에 넘기도록 수정.
- [x] 매 응답마다 현재 계정 자신의 실측값(`reading`)도 캐시에 함께 기록하도록 추가(자가
  갱신) — `reading`이 null이 아닐 때만 쓰는 `quota-cache-store.js`의 기존 계약을 그대로
  지킴. 이렇게 해야 이 계정이 나중에 다시 "후보"가 됐을 때 최신 값을 쓸 수 있다(등록만
  해두고 `diagnose-quota`를 안 돌린 계정도, 실제로 활성 계정으로 한 번이라도 쓰이면 그때
  실측값이 채워짐).
- [x] **파생 위험 하나 더 발견·선제 조치**: 이 연결로 `quota-cache-store.js`가 지금까지
  "diagnose-quota 실행 시 1회"만 쓰이던 파일에서 "매 업스트림 응답마다" 쓰이는 파일로
  위험 등급이 바뀐다 — active-account-state.js·active-account-handle/write.js가 이미
  겪은 것과 정확히 같은 상황(M47/M49/M50 참고)이라, 배선을 켜기 전에 미리 같은
  원자적쓰기(임시파일+`rename()`)+Windows EPERM/EBUSY 재시도+소유자 전용 권한(icacls/
  chmod) 패턴을 `quota-cache-store.js`에도 동일하게 적용했다(기존 `fs.writeFileSync`
  통짜 덮어쓰기를 대체). 이 프로젝트 관례대로 코드는 공유하지 않고 세 번째로 중복 작성.
- [x] 신규 테스트 6건: `active-account-provider.test.js`에 3계정 이상 시나리오(첫 후보가
  아니라 실제로 가장 여유 있는 계정이 선택되는지 회귀 검증), 자가 갱신 캐시 기록 검증,
  reading=null일 때 캐시 미기록 검증 — `quota-cache-store.test.js`에 권한 하드닝 검증
  2건 + win32 ACL 상세 검증 1건(active-account-state.test.js와 동형).

**PRD 문서 3건 정정(전수 감사 중 함께 발견)**:
1. `.PRD/03_PHASES.md` Phase 2 체크리스트 — `accounts enable`(M36)·`RotationEvent`
   감사로그(M23/M30)·`ActiveAccountHandle` 기록(M46)·`claudetower config`(M33) 4개가
   실제로는 완료됐는데 미완료(`[ ]`)로 표시돼 있어 정정. 사용률 표시(M48) 항목은
   **부분 완료**로 정확히 구분(사용률 %는 표시하지만 리셋 시각은 아직 미표시, "5h/7d"
   용어 대신 실제 헤더 모양 그대로 표시 — 전체 체크는 아직 하지 않음).
2. `.PRD/08_ACCOUNTS_ENABLE_CONSENT_DRAFT.md`가 "여전히 CLI 어디에도 연결 안 됨"이라고
   자칭하고 있었으나 실제로는 M36부터 라이브(`src/accounts/consent-text.js`)이고, 그
   라이브 버전은 `--import` 관련 과대고지 오류를 2026-08-19에 이미 스스로 정정까지 마친
   상태 — 이 초안 문서는 그 정정 이전 버전인 채로 멈춰 있어 지금 읽으면 실제 동의
   화면과 다른 내용을 보여준다. 실제 출처는 이 문서가 아니라 `consent-text.js`임을
   명시하고 이 문서는 역사적 기록으로 격하.
3. (이전 라운드 `f2b34e8`에서 이미 정정) M48 "README 미문서화" 잘못된 남은위험 기록.

**동시 세션 관찰(안전하게 격리 확인)**: 이번 라운드 도중 동시 세션의 커밋(`40abbdd`,
active-account-state/handle 파일 권한 하드닝, `.PRD/02_DATA_MODEL.md` NEEDS
CLARIFICATION 해소)이 실시간으로 관찰됐다 — 정확히 내가 전수 감사로 찾아 고치려던 항목
하나(02_DATA_MODEL.md 미해결 표시)를 동시 세션이 먼저 해소해, 그 항목은 중복 작업하지
않고 건너뛰었다. 파일 겹침 없음(내가 건드린 4개 코드/테스트 파일 + PRD 문서 2개는 그
커밋과 전혀 겹치지 않음, `git status`로 매번 재확인) — 이 프로젝트가 이미 여러 차례 겪은
동시 세션 패턴과 동일, 파일명 명시 스테이징으로 안전하게 격리.

**검증**: `test:accounts` 278/278(신규 6건 포함, 이전 267 대비 나머지 5건은 동시 세션의
M50 신규 테스트) 통과, `test:display` 245/245 회귀 없음, `npm run lint` 통과,
`live-wiring-gate.test.js` 재확인 통과(이번 수정도 `bin/claudetower.js`를 전혀 건드리지
않음).

**의도적으로 하지 않은 것**: 실거래 배선은 이번에도 진행하지 않음 — 오히려 이번 발견으로
보류 이유가 더 강해졌다(버그가 있는 채로 배선했다면 계정 3개 이상 등록한 사용자에게
조용히 잘못된 계정을 골라줬을 것).

**남은 위험**: `.PRD/03_PHASES.md`의 "계정별 마지막 사용 프로젝트 경로 표시"·`--import`는
여전히 진짜 미구현 상태로 정확히 남아있다(이번엔 손대지 않음, 범위 밖). quota 캐시의
"자가 갱신"은 최초에는 비어있다가 실제 트래픽이 쌓여야 채워지므로, 배선 직후 첫 실행
때는 여전히 신규 계정과 동일하게 0%로 취급된다(의도된 폴백 동작, 결함 아님).

## M52: 2026-08-20 — M51 수정 자체를 적대적으로 재검토해 새 결함 발견·수정: quota 캐시
동시쓰기 데이터 유실(1차 시도 실패 → mutex 락으로 재수정) + 동일 버그 패턴 전수 탐색(무결함)

**배경**: 사용자가 같은 "전수 감사 + 강점 극대화·단점 보완" 요청을 반복해서, 이번엔 문서를
다시 읽는 대신 검증 각도를 바꿔 두 조사를 병렬로 진행했다 — (1) 방금 만든 M51 수정 자체와
동시 세션의 `40abbdd`(권한 하드닝)를 독립적인 눈으로 재검토, (2) M51에서 찾은 버그와 같은
패턴("배선은 있는데 실제 데이터가 안 흐르는 것")이 다른 곳에도 있는지 전체 탐색.

**조사 (2)의 결과**: 추가 발견 없음. `evaluate/decide` 계열 판단 함수는 프로젝트 전체에
`evaluateSwitchDecision` 하나뿐이었고 그게 이미 고친 그 함수 — M41(판단 로직)과
M48(데이터 저장소)이 각각 따로 만들어진 뒤 M44/M46(연결부)이 그 사이에 먼저 생긴, 이
프로젝트에 하나뿐인 특수한 시점 문제였다는 게 재확인됐다.

**조사 (1)이 찾은 새 결함(중요)**: M51에서 `quota-cache-store.js`를
`fs.writeFileSync` 통짜 덮어쓰기 → 원자적쓰기(임시파일+rename)로 바꿨는데, 이건 "파일이
반쯤 쓰인 채로 보이는 것"만 막지 "두 프로세스가 서로 다른 계정 항목을 동시에 쓰다가 한쪽이
사라지는 것"은 못 막는다는 게 드러났다. 이 함수는 "전체 캐시 읽기 → 이 계정 항목만 얹기 →
전체 파일 교체" 구조라, 터미널 2개가 각자 다른 계정(a1, a2)으로 동시에 쓰면 나중에
rename에 성공한 쪽이 먼저 쓴 쪽의 "다른 계정" 항목을 통째로 지운다 —
active-account-state.json의 기존 "단일 값 last-write-wins" 위험(M47이 이미 문서화·수용)과
달리, 이건 **다른 계정의 데이터가 조용히 사라지는 유실**이라 이 캐시의 존재 목적(여러
프로세스가 각자 확인한 사용률을 누적)과 정면으로 충돌한다.

**1차 수정 시도와 그게 실측으로 틀렸다는 것을 발견한 과정(정직하게 기록)**: 처음엔 "쓰기
직전에 파일을 다시 읽어 처음 읽은 것과 같은지 비교"하는 낙관적 동시성 재시도로 고쳤다.
바로 이 수정을 검증하려고 실제 프로세스 10개(서로 다른 계정 키)를 동시에 띄우는 회귀
테스트를 새로 만들어 돌려봤더니 **10개 중 8개가 유실**됐다 — 두 읽기 사이 간격이
파싱조차 없는 문자열 비교라 사실상 즉시라서, 다른 프로세스의 쓰기가 정확히 "내 재확인
읽기 이후, 내 rename 이전"에 끼어드는 흔한 경우를 전혀 못 잡았다. 회귀 테스트가 없었으면
"고쳤다"고 잘못 보고할 뻔한 사례 — 그래서 진짜 상호배제(mutex)로 다시 교체했다: 같은
디렉터리에 `.lock` 파일을 `wx`(배타적 생성 — POSIX·Windows 양쪽에서 원자적) 플래그로
만들어 락을 잡고, 읽기-수정-쓰기 전체를 락을 쥔 상태에서만 하고 끝나면 지운다. 죽은
프로세스가 락을 쥔 채 죽는 경우를 대비해 락 파일이 3초보다 오래됐으면 죽은 락으로 간주해
강제 회수한다(영구 교착 방지).

**검증**:
- 동시쓰기 회귀 테스트(프로세스 10개, 서로 다른 계정 키) 재실행 3회 연속 **10/10 전부
  살아남음**(수정 전엔 매번 8개 유실 재현) + 임시파일·락파일 잔재 0.
- 죽은 락 강제회수 테스트 신설(락 파일 mtime을 인위적으로 10초 전으로 조작 후 정상 진행
  확인) — 영구 교착 시나리오도 커버.
- `test:accounts` 286/286(신규 8건: 유실방지 1 + 죽은락회수 1 + M51 6건) 통과,
  `test:display` 245/245 회귀 없음, `npm run lint` 통과, `live-wiring-gate.test.js`
  재확인 통과.

**동시 세션 관찰**: 이번 라운드 진행 중 `active-account-state.js`·
`accounts-list-command.js`(+각 테스트 파일)가 다른 세션에 의해 커밋 전 상태로 수정
중인 것을 확인했다 — 내가 건드린 `quota-cache-store.js`·`quota-cache-store.test.js`와
전혀 겹치지 않아(매번 `git status`로 재확인) 그대로 안전하게 병행했고, 그 파일들은
전혀 건드리지 않았다.

**의도적으로 하지 않은 것**: 실거래 배선은 이번에도 진행하지 않음.

**남은 위험**: 락 기반 상호배제는 파일 하나당 최대 300회(약 6초)까지 대기 후 포기한다 —
이론상 극단적으로 많은 동시 프로세스(수십 개 이상)가 몰리면 타임아웃 에러가 날 수 있으나,
이 프로젝트의 실사용 규모(개인 사용자 1명, 계정 몇 개)에서는 현실적 위험이 아니다. 락
파일 자체의 소유자 전용 권한은 별도로 강제하지 않는다(락은 존재 여부만 의미가 있고
내용이 없어 정보 노출 위험이 없음 — 과잉 하드닝 자제).

## M53: 2026-08-20 — 계정별 마지막 사용 프로젝트 경로 표시 신설 (Phase 2 마지막 잔여 갭 해소)

**배경**: PRD 재독으로 발견한 잔여 갭 — `.PRD/01_PRD.md` §3·`.PRD/03_PHASES.md` Phase 2
체크리스트가 명시한 "계정별 마지막 사용 프로젝트 경로 표시"가 `account.js` 스키마(
`last_project_path`/`last_used_at` 필드)엔 이미 있었고 `RotationEvent`에는 이미 기록되고
있었지만, 정작 계정 레지스트리 항목 자체는 한 번도 갱신되지 않았고 `accounts list`도 표시하지
않았다. 동시 세션의 M51도 같은 전수 감사 중 이 갭을 발견해 "이번엔 손대지 않음, 범위 밖"으로
명시적으로 남겨둔 항목이라(위 M51 참고), 겹치지 않게 이번 라운드에서 마무리했다.

**만든 것**:
- [x] `src/accounts/accounts/active-account-state.js`의 `applySwitch` — 전환 적용 시
  `writeRegistry`로 대상 계정의 `last_project_path`/`last_used_at`도 함께 갱신하도록 확장.
  `projectPath`가 `null`(호출부가 cwd를 모르는 경우)이면 **기존에 알던 값을 지우지 않는다**
  — "몰랐다"는 정보로 "알고 있던 값"을 덮어쓰면 사용자에게 손해이기 때문. `last_used_at`은
  `projectPath` 유무와 무관하게 항상 이 전환 시각으로 갱신(전환이 실제로 일어났다는 사실
  자체는 확실하므로). `RotationEvent.occurred_at`과 같은 타임스탬프를 재사용해 두 기록이
  같은 전환에 대해 서로 다른 시각을 갖지 않게 함(사소하지만 실제 정확성 개선).
- [x] `src/accounts/accounts/accounts-list-command.js` — `formatAccountLine`이 "마지막
  사용" 줄을 추가로 표시(기록 없음 / 시각만 / 시각+프로젝트 경로 3가지 상태 구분).
  `quotaEntry`와 달리 실시간·실비용 조회가 아니라 레지스트리에 이미 있는 값을 그대로 보여줄
  뿐이다.
- [x] `.PRD/03_PHASES.md` Phase 2 체크리스트의 해당 항목을 완료로 정정.
- [x] 신규 테스트 6건(active-account-state 2 + accounts-list-command 4, 이 중 1건은
  `applySwitch`→`accounts list` 실제 프로덕션 경로 end-to-end): `test:accounts`
  286/286(신규분 포함, 동시 세션 M52의 신규 8건과 합산된 수치), `test:display` 245/245
  회귀 없음, `npm run lint`·`lint:boundary` 통과, `live-wiring-gate.test.js` 재확인
  통과(이번 작업도 `bin/claudetower.js` 미접촉), `npm run build` 성공.
- [x] **실제 프로덕션 경로로 end-to-end 스모크**(단위테스트 아님): `appendAccount` →
  `applySwitch` → `runAccountsListCommand` 전체 흐름을 직접 실행 — 전환 전엔 "기록
  없음", 전환 후엔 실제 시각+`process.cwd()` 경로가 그대로 표시됨을 실측 확인.

**동시 세션 관찰**: 이번 라운드 중 동시 세션이 `quota-cache-store.js`(+테스트)를 수정 중인
것을 확인했다 — 내가 건드린 4개 파일과 전혀 겹치지 않아(매번 `git status` 재확인) 그대로
안전하게 병행했다. 그 세션의 M52 "남은 위험" 문단이 정확히 이번에 내가 고친 항목을 먼저
지목해뒀던 것도 확인 — 서로 다른 각도(하나는 "무엇이 됐는지" 감사, 하나는 "무엇이 안 됐는지"
감사)로 접근했는데 같은 결론에 도달한 셈이다.

**의도적으로 하지 않은 것**: `--import`(기존 OAuth 로그인 가져오기)는 이번에도 손대지 않음
— `.PRD/07_OAUTH_FLOW_SPEC.md §5-2`가 명시한 ToS 리스크가 그대로 유효하고, 이 결정은
AI가 임의로 재론할 사안이 아니다. 실거래 배선도 이번에도 진행하지 않음.

**남은 위험**: 이 필드는 `applySwitch`가 호출될 때만 갱신되는데, 실거래 배선이 꺼져 있어
현재는 실사용에서 호출되지 않는다 — 배선이 켜지기 전까지는 코드는 완성됐지만 실제 값이
채워지는 걸 실사용에서 관찰할 수 없다(M46~M52의 다른 안전지대 코드와 동일한 처지). Phase 2
체크리스트 중 이제 진짜로 남은 항목은 OAuth 계정 등록/`--import`(ToS로 의도적 보류)와
실거래 배선(게이트로 의도적 보류) 둘뿐이다 — 둘 다 사용자의 별도 결정이 필요하고, AI가
자체적으로 더 진행할 수 있는 Phase 2 항목은 이 시점 기준 남아있지 않다.

## M54: 2026-08-20 — M53의 자체 결론 정정: quota 리셋 시각 표시 신설 (진짜 마지막 Phase 2 잔여 갭)

**배경**: M53이 "AI가 자체적으로 더 진행할 수 있는 Phase 2 항목은 남아있지 않다"고 결론
냈으나, PRD를 다시 정독하며 재검증한 결과 **그 결론이 틀렸다**는 걸 발견했다. 정직하게
기록한다 — 이 프로젝트가 반복 강조해온 "확인하지 않은 것을 확인했다고 말하지 마" 원칙이
AI 자신의 이전 보고에도 예외 없이 적용돼야 한다.

**발견한 것**: `.PRD/03_PHASES.md` Phase 2 체크리스트 "계정별 세션·주간 사용률·**리셋
시각**을 기본 표시" — `api-key-quota-reading.js`가 `tokens_reset_at`/`requests_reset_at`을
이미 파싱하고(52-53행), `quota-cache-store.js`의 `writeQuotaCacheEntry`가 `{ ...reading,
checked_at }` 스프레드로 이미 저장하고 있었지만(파일 소스에 "reset"이라는 문자열이 직접
등장하지 않아 1차 grep 조사에서 놓쳤다 — 실제 저장되는 JSON 내용까지 확인해서야 잡아냄),
`accounts-list-command.js`는 이 값을 전혀 표시하지 않고 있었다.

**만든 것**:
- [x] `formatResetLine(quotaEntry)` 신설 — `tokens_reset_at`/`requests_reset_at`을
  `accounts list`의 사용률 줄 바로 아래에 표시. **의도적으로 날짜 형식으로 파싱·재가공하지
  않고 응답 헤더 원문 문자열 그대로 보여준다** — 이 값의 정확한 형식(ISO 문자열인지 Unix
  epoch 초인지)이 아직 실측 검증되지 않았기 때문(`diagnose-quota`를 사용자가 아직 실행
  전, `07_OAUTH_FLOW_SPEC.md`가 이미 명시한 미확인 항목). 형식을 잘못 짐작해 변환하면
  실제와 다른 값을 보여주거나 깨질 위험이 있어, 이 프로젝트의 "안티패턴#1: 추측 금지"
  원칙에 따라 원문 그대로 노출하는 쪽을 선택했다.
- [x] 필드가 `null`이면(헤더에 없었던 경우) 기존 `pct()` 헬퍼와 동일한 원칙으로 "알 수
  없음"으로 안전하게 표시(크래시·빈 문자열 노출 없음).
- [x] 신규 테스트 3건: 리셋 시각 있음(ISO·Unix epoch 두 형식 모두 원문 그대로 노출되는지
  확인), 리셋 시각 `null`, `writeQuotaCacheEntry`→`runAccountsListCommand` 실제 프로덕션
  경로 end-to-end.
- [x] 실제 프로덕션 경로로 end-to-end 스모크(단위테스트 아님): 한쪽은 실제 값, 한쪽은
  `null`인 캐시 항목을 만들어 `accounts list` 실제 출력을 직접 확인 — `토큰
  2026-08-21T00:00:00Z / 요청수 알 수 없음`으로 정확히 표시됨.
- 검증: `test:accounts` 289/289(신규 3건), `test:display` 245/245 회귀 없음, `npm run
  lint`·`lint:boundary` 통과, `live-wiring-gate.test.js` 재확인 통과, `npm run build` 성공.

**동시 세션 관찰**: 이번 라운드 중 동시 세션이 `accounts-registry.js`에 원자적쓰기+뮤텍스
락+소유자 전용 권한 하드닝을 적용 중인 것을 확인했다(M47~M52와 같은 계열의 작업, 아직
커밋 전) — 내가 건드린 `accounts-list-command.js`(+테스트)와 파일이 겹치지 않아 손대지
않고 그대로 뒀다. 다만 이 하드닝은 내 M53(`applySwitch`가 `writeRegistry`를 호출하도록
확장한 부분)이 의존하는 바로 그 함수라 — 다음에 이 문서를 읽는 세션은 병합 순서·최종
동작을 `accounts-registry.js`의 최신 커밋 기준으로 재확인할 것.

**의도적으로 하지 않은 것**: `--import`·실거래 배선은 이번에도 손대지 않음.

**남은 위험**: 이 값은 Anthropic 서버가 실제로 보내는 원문이라, 사용자가 `diagnose-quota`를
한 번도 실행하지 않으면 여전히 "확인 안 됨"만 보인다(의도된 동작, 실비용 없이는 채울 방법이
없음 — M48부터 있던 제약과 동일). 이 시점 기준 Phase 2에서 AI가 자체적으로 더 진행할 수
있는 항목은 재차 확인한바 없다 — 다만 이 문장 자체를 M53처럼 과신하지 않기 위해, 다음
세션은 "없다"는 이 결론도 실행 전에 직접 재검증할 것을 권한다.

## M55: 2026-08-20 — accounts-registry.js에도 락+원자적쓰기 적용(마지막 남은 무보호
핵심 상태 파일), remove/rename/전환 3곳을 "락 시점 최신 목록 기준 재계산"으로 재구조화

**배경**: M53이 `applySwitch`(전환마다 자동 호출)에 `writeRegistry` 호출을 얹으면서,
`quota-cache-store.js`(M51/M52)가 이미 겪은 것과 같은 위험 등급 상승이 `accounts-
registry.js`에도 그대로 발생했다는 걸 M53 diff를 직접 대조하다 발견했다. 게다가 이
파일은 원래부터(M53 이전부터) add/remove/rename/purge 전부가 같은 "전체 읽기 → 항목
수정 → 전체 교체" 방식으로 건드리면서도 락도 원자적쓰기도 전혀 없던, 이 프로젝트에서
유일하게 보호를 못 받은 핵심 상태 파일이었다(동시쓰기 검증 테스트도 0건 확인).

**설계 판단(M52의 교훈을 그대로 적용)**: quota-cache-store.js에서 "쓰기 직전에 다시
읽어 비교"하는 낙관적 동시성 1차 시도가 실측(프로세스 10개)으로 8개 유실이 재현되며
틀렸다고 드러난 전례가 있어, 이번엔 처음부터 같은 배타적 lock 파일(`wx` 플래그,
`.lock`, 3초 stale 회수) 기반 mutex로 만들었다. 추가로, 단순히 "쓰기 단계만 락으로
감싸는" 것으로는 부족하다는 것도 이번에 명확히 정리했다 — remove/rename/전환은 전부
"먼저 읽고 → (검증/확인) → 나중에 그 읽은 값 기준으로 쓰기" 구조라, 쓰기 단계만 락을
걸어도 두 호출이 각자 낡은 스냅샷으로 계산한 걸 순서대로 밀어넣으면 유실은 그대로다.
그래서 `updateRegistry(updateFn, filePath)`라는 새 원시함수를 만들었다 — 락을 쥔
**시점**에 최신 목록을 읽어 `updateFn`에 넘기고, 그 반환값을 원자적으로 쓴다(호출부가
미리 읽어둔 낡은 변수가 아니라, 함수가 넘겨주는 진짜 최신 목록만 근거로 계산하도록
강제하는 구조).

**만든 것**:
- [x] `accounts-registry.js`: 락(`wx` 배타적 생성+3초 stale 회수)+원자적쓰기(임시파일+
  rename, EPERM/EBUSY 재시도)+소유자 전용 권한(icacls/chmod) — 지금까지 4번째 파일에
  동일 패턴 중복 적용(이 프로젝트 관례). `updateRegistry` 신설, `appendAccount`는 내부적으로
  `updateRegistry((current) => [...current, account])`로 재구현. `writeRegistry`는
  기존 시그니처(완성된 배열을 그대로 받음) 유지하되 락+원자적쓰기 경유하도록 변경
  (purge처럼 "확인 절차로 이미 확정된 배열을 그대로 쓰는" 성격의 호출부를 위해 남겨둠).
- [x] `remove-account-command.js`/`rename-account-command.js`: 최종 쓰기를
  `updateRegistry`로 교체해, [y/N] 확인을 기다리는 동안(rename은 확인 절차 자체가 없어
  창이 더 짧지만 원리는 동일) 다른 프로세스가 목록을 바꿨어도 그 변경을 잃지 않도록
  재구조화. rename은 계정 존재·라벨 충돌 검사 자체를 `updateFn` 안(=락 시점 최신 목록
  기준)으로 옮겨, 판단 정확성도 함께 개선했다.
- [x] `active-account-state.js`(`applySwitch`): 레지스트리 최종 쓰기를 `updateRegistry`로
  교체 — 전환마다 자동 호출되는 가장 실전 위험이 높은 경로.
- [x] `updateRegistry`는 `updateFn`이 입력과 같은 배열(참조 동일)을 반환하면 실제 파일
  쓰기를 생략한다(rename의 "존재하지 않음"/"라벨 충돌"/"변경 없음" 같은 no-op 경우
  불필요한 락 경합·icacls 호출을 만들지 않기 위함).
- [x] **의도적으로 손대지 않은 것**: `accounts-purge-command.js`의 `writeRegistry` 호출은
  그대로 유지(파일 레벨 락+원자적쓰기 보호는 자동으로 적용받지만, "최신 목록 기준
  재계산"은 안 함) — purge는 확인 절차 도중 credential-store 삭제 성공/실패를 계정별로
  판정해 그 결과(성공분 제외한 나머지)를 그대로 반영하는 구조라, 쓰기 시점에 최신
  목록으로 다시 계산하는 게 의미가 불명확하다(어느 계정이 "성공/실패"인지는 이미
  확정된 사실이므로). 확인 절차 뒤에 이뤄지는 드물고 신중한 전량 삭제 작업이라 이
  좁은 범위는 그대로 두는 게 과설계를 피하는 합리적 선택이라 판단했다.
- [x] `add-api-key-command.js`의 라벨 중복 검사(`existingLabels`)는 여전히 락 밖(호출부의
  별도 스냅샷 읽기)에서 이뤄진다 — 두 터미널이 동시에 **완전히 같은 라벨**로 계정을
  추가하는 극히 좁은 경합(계정 데이터 자체는 M53 이전과 달리 이제 유실 없이 둘 다
  등록됨, 다만 라벨이 우연히 중복될 수 있음)은 이번 범위에서 의도적으로 남겨뒀다 —
  add 흐름 전체(요청 객체 생성·credential-store 저장)를 락 안으로 옮기는 재구조화가
  필요해 이번 범위(가장 심각한 데이터 유실 방지)를 벗어난다고 판단했다.

**검증**:
- 신규 회귀 테스트: `appendAccount` 동시쓰기(프로세스 10개, 서로 다른 계정) 3회 연속
  10/10 전부 살아남음(반대로 이 수정 전 코드로는 quota-cache-store와 동일한 유실
  패턴이 재현될 것으로 추정 — 이번엔 안전하게 "수정 후" 상태로만 확인, 손상 재현을
  위해 되돌리는 위험은 감수하지 않음) + 죽은 락 강제회수 테스트 + updateFn이 항상
  최신 스냅샷을 받는지 확인하는 테스트 + no-op 시 파일 안 건드리는지 확인하는 테스트.
- `test:accounts` 293/293(신규 4건 포함) 통과, `test:display` 245/245 회귀 없음,
  `npm run lint` 통과, `npm run build` 성공(실제 exe 재빌드까지 확인),
  `live-wiring-gate.test.js` 재확인 통과(이번 수정도 `bin/claudetower.js` 미접촉).

**동시 세션 관찰(상호 확인)**: 이번 라운드 진행 중 다른 세션이 M53(applySwitch가
writeRegistry를 쓰도록 확장)에 이어 M54(quota 리셋 시각 표시, `accounts-list-command.js`)를
작업 중이었고, 그 M54 기록 자체가 "동시 세션이 accounts-registry.js를 하드닝 중"이라는
걸 미리 관찰해 남겨뒀다 — 정확히 이번 라운드를 가리킨 것이었다. 건드린 파일이 전혀
겹치지 않아(`accounts-list-command.js`는 손대지 않음) 그대로 안전하게 병행됐고, 이
커밋을 끝으로 M54가 요청한 "최신 커밋 기준 재확인"도 여기서 완료된다 — M53·M54가
호출하는 `writeRegistry`는 이제 이 커밋의 락+원자적쓰기 버전이다. CHECKPOINT.md 마일스톤
번호가 두 세션 모두 M54를 먼저 붙였다가 충돌해 이 항목만 M55로 재번호했다.

**의도적으로 하지 않은 것**: 실거래 배선은 이번에도 진행하지 않음.

**남은 위험**: 위에 명시한 두 가지 의도적 범위 제한(purge의 최신목록 재계산 생략,
add의 라벨 충돌 검사가 락 밖) 외에, 락 기반 상호배제는 파일 하나당 최대 300회(약 6초)
대기 후 포기한다(quota-cache-store.js와 동일한 한도) — 이 프로젝트의 실사용 규모(개인
사용자 1명)에서는 현실적 위험이 아니다.

## M56: 2026-08-20 — 프록시 서버 Origin/Referer 검사 신설 + npm audit HIGH 취약점 해소 (04_PROJECT_SPEC.md Should Have 2건, 20여 라운드 만에 첫 조치)

**배경**: PRD 전수 재독 중 `.PRD/04_PROJECT_SPEC.md` "보안 설정(ASVS V14) — Should Have"의
"Account: Origin/Referer 헤더 검사로 브라우저발 요청(DNS 리바인딩) 차단, CORS 응답 미노출"과
"의존성 보안(ASVS V14.2) — Should Have: npm audit 고위험 항목 검사"를 CHECKPOINT.md 전체
grep으로 대조한 결과, 두 항목 모두 **한 번도 실제로 처리된 적이 없었다**(npm audit
brace-expansion HIGH는 20여 라운드 동안 "기존에 이미 알려진 항목, 변화 없음"으로만
반복 언급됐을 뿐 실제로 고쳐진 적이 없었음을 확인).

**만든 것**:
- [x] `src/accounts/proxy/server.js`의 `startProxyServer` — 요청 헤더에 `origin` 또는
  `referer`가 있으면(브라우저만 자동으로 붙이는 헤더, 정상 클라이언트인 Claude Code CLI는
  애초에 보내지 않음) 접근 토큰 검사보다 **먼저** 403으로 거부. CORS 응답 헤더
  (`Access-Control-Allow-*`)는 이 서버가 애초에 한 번도 보낸 적이 없어("CORS 응답 미노출"
  요구사항의 나머지 절반은 이미 충족돼 있었음) 추가 조치 불필요, 회귀 테스트로 확인만 추가.
- [x] 신규 테스트 3건(실제 로컬 TCP 서버로 검증, mock 아님): Origin 헤더가 있으면 유효한
  토큰이어도 거부, Referer 헤더가 있으면 거부, 응답에 `Access-Control-Allow-*` 헤더가
  전혀 없음을 실제 응답 헤더로 직접 확인.
- [x] `npm audit fix` 실행 — `brace-expansion` 5.0.7→5.0.9(패치 버전, breaking change
  없음, dev-only 의존성이라 배포 실행파일에는 영향 없음). `npm audit` 결과 0건 확인.
- 검증: `test:accounts`(신규 3건 포함, 전체 통과) 2회 연속 재확인, `test:display` 245/245
  회귀 없음, `npm run lint`·`lint:boundary` 통과, `live-wiring-gate.test.js` 재확인 통과,
  `npm run build` 성공.

**정직하게 기록(과잉 낙관 금지)**: 검증 도중 `npm run test:accounts` 1회 실행에서
`quota-cache-store.test.js`(내가 건드리지 않은 파일) 관련 스택 트레이스가 출력된 적이
있었다 — Node.js v26.7.0의 `evalTypeScript` 관련 문구가 섞여 있어 이 프로젝트가 상시 겪는
프로세스 폭주 환경의 일시적 문제로 의심하고, 그 파일만 격리해 3회 연속 재실행(14/14 매번
통과, 회귀 없음) + 전체 스위트 2회 재실행(둘 다 전체 통과)으로 재현 여부를 확인했다 —
재현되지 않아 일시적 환경 요인으로 판단하고 넘어간다("실패한 테스트를 무시하고 넘어가기"
금지 원칙에 따라, 무시가 아니라 재현 시도 후 결론임을 명시).

**동시 세션 관찰**: 이번 라운드 시작 시 동시 세션의 M55(`accounts-registry.js` 락+원자적쓰기)
커밋이 이미 로컬에 반영돼 있었다 — 겹치는 파일 없이(`proxy/server.js`·
`test/accounts/proxy-server.test.js`·`package-lock.json`만 건드림) 안전하게 이어서 작업했다.

**의도적으로 하지 않은 것**: 실거래 배선은 이번에도 진행하지 않음 — `startProxyServer` 코드
자체를 강화한 것이지 켠 것이 아니다. `--import`도 이번에도 손대지 않음.

**남은 위험**: Origin/Referer 검사는 이 두 헤더가 존재하는지만 보고 값을 검증하지 않는다
(예: 화이트리스트 도메인 허용 같은 건 없음) — 이 프로젝트의 목적상 "브라우저에서 온 요청은
전부 거부"가 맞는 정책이라(로컬 CLI 도구이지 브라우저와 통신할 이유가 없음) 값 검증 없이
존재 여부만 보는 게 의도적으로 맞는 설계다. 실제 Anthropic 서버로의 최종 왕복은 여전히
`diagnose-quota`를 사용자가 실행해야만 검증되며, 이 세션에서는 실행하지 않았다.

## M57: 2026-08-20 — README `accounts list` 설명이 M53/M54가 추가한 화면 항목을 반영 못 하던 갭 해소

**배경**: PRD 재독 중 `.PRD/04_PROJECT_SPEC.md`의 README 요구사항("실행·사용·작동 방법,
명령어 목록"을 정확히 유지)을 실제 README와 대조하다가, `accounts list`의 실제 화면
출력이 M53(마지막 사용 정보)·M54(리셋 시각)를 거치며 세 부분(사용률/리셋 예정/마지막
사용)으로 늘었는데도 README.md·README.en.md의 설명은 여전히 "사용률(있는 경우) 확인"
한 줄에 머물러 있던 것을 발견했다(두 파일 모두 "마지막 사용"·"리셋" 관련 문구 0건,
grep으로 직접 확인). 이 세션이 반복 경계해온 "코드는 있는데 문서가 못 따라간" 패턴을
직접 만든 셈이었다.

**만든 것**:
- [x] README.md·README.en.md의 `accounts list` 설명 줄에 "그 사용률이 다시 채워지는
  예정 시각"과 "각 계정을 마지막으로 언제·어느 작업 폴더에서 썼는지"를 추가. 개발자
  용어(reset_at 필드 등) 대신 실제 화면에 뜨는 그대로의 자연스러운 표현으로 작성(PRD
  README 요구사항 "비개발자 대상" 원칙).
- [x] **문서 수정 전 실제 화면과 대조 검증**: 계정 등록→quota 캐시 기록→전환 적용→
  `accounts list` 실행까지 실제 프로덕션 경로를 직접 실행해, 새로 쓴 문구가 실제 출력
  ("사용률(마지막 확인: ...)", "리셋 예정(...)", "마지막 사용: ... (프로젝트: ...)")과
  정확히 일치하는지 눈으로 직접 확인한 뒤 반영했다(추측으로 문서를 쓰지 않는다는 원칙).
- 검증: 순수 문서 수정이라 코드 영향 없음 — 그래도 회귀 확인 차원에서 `npm run lint`
  통과, `test:accounts` 296/296 재확인(회귀 없음).

**의도적으로 하지 않은 것**: 실거래 배선·`--import`는 이번에도 손대지 않음. Origin/Referer
방어(M56)처럼 사용자에게 보이지 않는 내부 보안 로직은 README에 별도로 언급하지 않음
(비개발자 대상 문서에 불필요한 기술 세부사항을 추가하지 않는다는 기존 원칙 유지 — "여러분
계정 정보는 어디로도 전송되지 않습니다"라는 기존 문구가 이미 그 취지를 담고 있음).

**남은 위험**: 없음(신규) — 순수 문서 동기화 작업이라 새로 생긴 위험은 없다.

## M58: 2026-08-20 — `.PRD/03_PHASES.md` 87행 체크박스 정정 (M54 완료를 문서가 반영 못 하던 자기 오류 수정)

**배경**: PRD 재독 중 87행("계정별 세션(5h)·주간(7d) 사용률·리셋 시각 기본 표시")이 여전히
`[ ]`(미완료)로 남아있고, 주석도 "리셋 시각은 아직 안 보여줌"이라고 적혀 있는 걸 발견했다.
실제로는 두 라운드 전 M54에서 이미 리셋 시각 표시를 완성했는데, 그때 M53(같은 라운드
근처에서 처리한 다른 항목)의 체크박스는 정확히 갱신하면서 이 항목은 빠뜨렸던 것 —
내 작업 습관의 실수를 PRD 재독으로 스스로 발견해 바로잡았다.

**만든 것**:
- [x] 87행을 `[x]`(완료)로 정정 — 사용률(M48)·리셋 시각(M54) 둘 다 `accounts list`가
  표시함을 명시. "session(5h)/weekly(7d)" 용어를 쓰지 않는 것은 결함이 아니라 2026-08-19
  결정(M41, 자동전환을 API 키 계정으로만 한정)에 따른 의도된 범위 재정의임을 함께 명시
  (API 키 헤더엔 시간창 개념 자체가 없음 — 다른 이름을 붙이면 능력 과대고지가 됨).
- 검증: 순수 문서 정정(코드 변경 없음), `npm run lint` 통과 확인. `accounts list`가 실제로
  리셋 시각을 보여주는지는 M54·M57에서 이미 실제 프로덕션 경로로 두 차례 직접 확인한 사실이라
  이번 라운드에서 재확인하지 않았다(이미 통과 확인한 것을 반복하지 않는다는 원칙).

**의도적으로 하지 않은 것**: 실거래 배선·`--import`는 이번에도 손대지 않음. Phase 3
Display 전용 항목(Powerline 색상 테마·Git 위젯)은 이번 라운드에서 제안만 하고 진행하지
않음(새 기능 추가라 성격이 다르다고 판단, 사용자 별도 결정 대기).

**남은 위험**: 없음(신규). 이 정정으로 `.PRD/03_PHASES.md` Phase 2 체크리스트에서 여전히
미완료(`[ ]`)로 남는 항목은 전부 OAuth ToS(계정 등록/`--import`) 또는 실거래 배선
게이트뿐이다 — 둘 다 사용자의 별도 결정이 필요한 항목이라, 체크리스트 차원에서 AI가
자체적으로 더 진행할 수 있는 Phase 2 항목은 이 시점 기준 남아있지 않다(단, 이 결론을
과신하지 않기로 한 M54의 교훈을 그대로 유지 — 다음 세션도 이 문장을 실행 전에 재검증할 것).

## M59: 2026-08-21 — `claudetower accounts switch <라벨>`(수동 강제 전환) 신설 + rotation-log.js의
숨어있던 크래시 결함을 실사용 도중 발견·수정

**배경(PRD 전수 재독으로 발견)**: `applySwitch()`(active-account-state.js, M46부터 락·원자적쓰기·
소유자 전용 권한까지 완성돼 있음)를 실제로 호출하는 CLI 경로가 이 시점까지 **0개**였다 — 유일한
호출부인 `active-account-provider.js`는 🛑 실거래 배선 게이트로 막혀 CLI에서 도달 불가능했다.
`rotation-event.js`의 `REASONS` 화이트리스트에 `'quota_threshold'`/`'http_429_failover'`와 나란히
처음부터 `'manual'`이 등록돼 있었던 것도 이 명령이 원래 설계에 있었다는 증거였다 — 지금껏 아무도
발생시키지 않았을 뿐. `.PRD/03_PHASES.md` Phase 3의 "Account: ... 수동 강제 전환" 항목.

**왜 이 방향을 선택했나(대안 비교)**: Powerline 색상 테마·Git 위젯(Display 전용, 안전하지만
코스메틱), TUI 대시보드(활동 로그를 보여줄 실사용 데이터가 아직 없어 전제조건 미충족), 영구 셸
별칭(`claudetower run` 진입점 의존 — 그 자체가 게이트 대상)을 검토했으나 전부 기각. 선택한 방향은
🛑 게이트를 전혀 건드리지 않으면서(`startProxyServer`/`active-account-provider`/
`createRequestForwarder` 미접촉, `live-wiring-gate.test.js` 그대로 통과) ToS 리스크도 없고(자동
감지·순환이 아니라 매번 사용자가 직접 실행하는 1회성 전환, API 키 계정만 허용 — `applySwitch`가
이미 강제), 지금까지 만든 계정 전환 인프라 전체(락·원자적쓰기·권한 하드닝·감사로그)를 처음으로
실사용에서 검증받게 만드는 유일한 후보였다.

**만든 것**:
- [x] `src/accounts/accounts/switch-account-command.js`(신규) — `runSwitchAccountCommand(label,
  opts)`. 라벨→계정 조회(친절한 오류 메시지용, 최종 판단은 `applySwitch`/`updateRegistry`의 락
  시점 최신 상태 기준), OAuth 계정·비활성 계정·이미 활성인 계정을 각각 명확한 한국어 메시지로
  거부, `decision = { shouldSwitch: true, toAccountId, reason: 'manual' }`를 구성해 기존
  `applySwitch()`에 그대로 위임(전환 로직 자체는 재사용, 새로 안 만듦). `reevalIntervalMs`는
  의도적으로 0 — 그 스로틀은 "자동 재평가 진동 방지" 목적이라(M46) 사용자가 명시적으로 요청한
  수동 전환까지 막을 이유가 없다고 판단. `process.cwd()`를 `projectPath`로 전달(M53과 동일 원칙).
  확인 절차 없음(rename과 동일 원칙 — remove/purge만 DO NOT 대상, switch는 가역적).
- [x] `bin/claudetower.js`에 `accounts switch` 서브커맨드 배선, 사용법 안내 갱신.
- [x] `test/accounts/switch-account-command.test.js`(신규 9건): 라벨 누락/계정없음/OAuth계정
  거부/비활성계정 거부/정상전환(state·handle·RotationEvent 실제 갱신 확인)/레지스트리
  last_project_path·last_used_at 갱신(M53 경로 재사용 확인)/이미 활성 상태 재전환 거부(감사로그
  중복 안 남는지까지 확인)/두 계정 간 전환 시 from·to가 정확히 기록되는지/정적 검사(credential-
  store·oauth·proxy 미참조).

**실사용 중 발견·수정한 실제 결함(중요)**: 격리 스크래치 경로로 첫 라이브 스모크 테스트를
실행하자 `accounts switch`가 `The "path" argument must be of type string. Received undefined`로
즉시 크래시했다. 원인: `rotation-log.js`(RotationEvent 감사 로그)만 다른 5개 Account 상태 파일과
달리 **기본 경로 해석 함수(`resolve*Path()`)가 없었다** — `appendRotationEvent(eventFields,
filePath)`가 `filePath`를 항상 호출부가 명시적으로 넘겨야만 동작했는데, `applySwitch`가 이 값을
그대로 통과시킬 뿐 자체 기본값이 없어 `path.dirname(undefined)`에서 죽었다. 이 결함이 지금까지
드러나지 않은 이유는 이 함수를 실제로 호출하는 CLI 경로가 이번 작업 전까지 0개였기 때문 — 이번이
**이 코드 경로의 첫 실사용 호출**이라, "안전지대(격리 테스트만으로 검증된 코드)"의 숨은 결함이
실사용 전환 과정에서 스스로 드러난 사례다.
- [x] `rotation-log.js`에 `resolveRotationLogPath()` 신설(`CLAUDETOWER_ACCOUNTS_ROTATION_LOG_PATH`
  override + 기본 경로 `~/.claudetower/rotation-log.jsonl`), `appendRotationEvent`/
  `readRotationEvents` 둘 다 filePath 기본값 적용(읽기는 default param, 쓰기는 다른 파일들과
  동일하게 `assertNotPartialIsolation` 가드 후 기본값 — 읽기엔 격리 가드가 필요 없다는 기존
  원칙 그대로).
- [x] **가드 자체의 결함도 함께 발견·수정**: 처음엔 `ACCOUNTS_ISOLATION_VARS`만으로
  `assertNotPartialIsolation`을 만들었는데, 새로 추가한 회귀 테스트("Display 변수만 설정된
  부분격리 상태에서 거부하는지")가 즉시 실패해 드러났다 — 다른 5개 파일은 전부 `DISPLAY_
  ISOLATION_VARS`까지 합친 `ALL_ISOLATION_VARS`를 기준으로 검사하는데 이 파일만 Account
  변수만 좁게 검사하고 있었다. `DISPLAY_ISOLATION_VARS`/`ALL_ISOLATION_VARS`를 다른 파일과
  동일하게 추가해 바로잡았다 — 테스트가 없었으면 그대로 넘어갔을 안전장치 결함이었다.
- [x] **대칭 방어 원칙 적용**: 새 환경변수 `CLAUDETOWER_ACCOUNTS_ROTATION_LOG_PATH`를 기존
  5개 파일(`active-account-state.js`·`accounts-registry.js`·`quota-cache-store.js`·
  `switch-policy-config.js`·`module-activation-state-store.js`)의 `ACCOUNTS_ISOLATION_VARS`
  목록에도 대칭으로 추가(M46이 세운 관례 — "새 파일이 격리된 채 이 파일들만 격리 안 된 상태를
  놓치지 않도록").
- [x] `test/accounts/rotation-log.test.js`에 회귀 테스트 3건 추가: env var override 확인,
  filePath 생략 시 격리 경로로 실제 쓰고 읽기(크래시 없음 확인), 부분격리 거부 확인(위 가드
  결함을 실제로 잡아낸 테스트).
- [x] `src/accounts/status-report.js` 갱신 — `switch` 명령 추가, "마지막 사용 정보 표시"
  항목의 "실거래 배선 전까지는 테스트로만 검증됨" 문구를 "`accounts switch`로 이제 실사용에서도
  값이 채워짐"으로 정정(과소 고지 시정).
- [x] `.PRD/03_PHASES.md` Phase 3 Account 항목에 "수동 강제 전환만 완료" 취소선+주석 추가(TUI
  대시보드·핫 리로드·영구 셸 별칭은 여전히 미착수, 셸 별칭은 배선 게이트 의존이라 착수 자체
  불가능함을 명시).

**실측 검증(전부 직접 실행)**:
- `npm run test:accounts` **308/308**(신규 12건: switch-account-command 9 + rotation-log
  회귀 3), `npm run test:display` 245/245 회귀 없음, `npm run lint` 클린, `npm run lint:boundary`
  23개 파일 무변경(Display는 이번 작업과 무관), `live-wiring-gate.test.js` 재확인 통과(이번
  작업도 `bin/claudetower.js`에 `startProxyServer` 계열을 전혀 추가하지 않음), `npm run build`
  성공(수정 후 재빌드까지 확인).
- **실제 exe가 아니라 소스로 격리 스크래치 경로 라이브 스모크**(전용 임시 디렉터리, `CLAUDETOWER_*`
  7개 변수로 완전 격리, 실제 사용자 설치는 전혀 안 건드림): enable→add(smoke-a/smoke-b)→
  **switch smoke-a**(성공)→list(마지막 사용 시각·프로젝트 경로 실제로 채워짐 확인)→**switch
  smoke-a 재시도**(`already_active`로 거부, 감사로그 추가 안 됨 확인)→**switch smoke-b**(성공)→
  list(둘 다 갱신 확인)→**switch ghost-label**(`account_not_found`로 거부) 전체 흐름 실행,
  `rotation-log.jsonl` 원문에 `reason: manual`인 이벤트 2건이 정확한 from/to로 기록됨을 직접
  확인, `handle.json`이 최종 활성 계정(`smoke-b`)을 정확히 반영함을 확인.
- **뒷정리**: 스모크 테스트로 실제 Windows Credential Manager에 생긴 2건(`smoke-a`/`smoke-b`)을
  `findCredentials('claudetower')`로 조회해 정확히 그 2건만(다른 계정 2건은 이전 라운드 잔재로
  판단해 손대지 않음) `deletePassword()`로 삭제, 재조회로 삭제 확인.

**의도적으로 하지 않은 것**: 실거래 배선·`--import`는 이번에도 손대지 않음. `active_account`
Display 위젯은 이번 작업으로 전제조건(ActiveAccountHandle에 실제 값이 채워짐)은 갖춰졌지만,
범위를 최소화하기 위해 이번 라운드에는 포함하지 않음(다음 라운드 후보로 남김). add-api-key의
라벨 중복 검사가 락 밖에 있는 것과 동일한 성격의 "add 흐름 전체를 락 안으로" 재구조화도 이번
범위 밖(M55가 이미 남긴 위험, 변화 없음).

**남은 위험**: `accounts switch`는 여전히 API 키 계정 사이의 전환만 가능하다(OAuth 계정은
`applySwitch`가 구조적으로 거부, 의도된 제약). 이 명령이 실거래 배선 없이도 유의미하려면
사용자가 계정을 최소 2개 이상 등록해야 한다(1개뿐이면 전환할 대상이 없음, 결함 아님). 락 기반
동시성 보호는 기존과 동일한 한계(파일당 최대 300회/약 6초 대기 후 포기)를 그대로 상속받는다.

## M60: 2026-08-21 — 종합 QA 중 발견: `applySwitch`가 감사로그 쓰기 실패 시 "실패했다"고
보고하면서 실제로는 활성 계정을 몰래 바꿔버리는 정합성 결함 수정

**배경**: 사용자 요청으로 M59(`accounts switch`)가 실제로 정상/예외/잘못된입력/경계값/실패
상황에서 제대로 작동하는지 종합 검증하는 세션. 정상 흐름은 자동화 테스트로 이미 충분히
검증됐다고 판단해, 이번엔 자동화 테스트가 다루지 않는 실패 경로(디스크 쓰기 실패 등)를
인위로 재현하는 데 집중했다.

**발견한 결함**: `applySwitch()`가 활성 계정 상태 파일 → Display 노출용 handle 파일 →
레지스트리 → 감사로그(RotationEvent) 순서로 4개의 파일을 쓰는데, 트랜잭션이 아니었다.
감사로그 쓰기(마지막 단계)가 실패하도록 인위로 재현(권한 있는 상위 경로가 실제로는 디렉터리가
아니라 파일이라 `mkdirSync`가 `ENOTDIR`)했더니, `claudetower accounts switch`는 `exit 1`과
함께 오류 메시지를 출력했지만 — **이미 실행된 앞 3단계(활성 계정 포인터·handle·레지스트리의
마지막 사용 정보)는 롤백 없이 그대로 적용돼 있었다.** 즉 사용자에게는 "실패했다"고 보여주면서
실제로는 활성 계정이 조용히 바뀌어 있는 상태 — 이 프로젝트가 가장 중요하게 여기는 "실제
상태와 사용자에게 보여주는 메시지가 항상 일치해야 한다" 원칙을 정면으로 어기는 결함이었다.

**수정**: `appendRotationEvent`(감사로그 기록)를 가장 먼저 실행하도록 순서를 바꿨다. 이제
감사로그 기록 자체가 실패하면 그 뒤의 어떤 상태도 바뀌지 않은 채 깔끔하게 전체 실패한다 —
"RotationEvent 로그를 끄거나 생략하지 마" DO NOT 규칙과도 부합하는 방향(감사로그 없이는
그 무엇도 적용되지 않는다). 나머지 3개 쓰기는 전부 이미 EPERM/EBUSY 재시도 로직이 있어
감사로그보다 실패 가능성이 훨씬 낮다 — 이 순서가 남은 이론적 위험(감사로그는 성공했는데
뒤의 3개 중 하나가 실패하는 경우)의 발생 가능성도 최소화한다.

**재현→수정→재검증 전 과정**:
1. 재현: 격리 스크래치 경로에서 `CLAUDETOWER_ACCOUNTS_ROTATION_LOG_PATH`를 의도적으로
   쓸 수 없는 경로로 지정하고 `accounts switch` 실행 → `ENOTDIR` 오류(exit 1)와 함께
   `state.json`/`active-account.json`이 몰래 생성됨을 직접 확인.
2. 원인분석: `active-account-state.js`의 `applySwitch` 내부 쓰기 순서가 감사로그를
   가장 나중에 실행하도록 돼 있었고, 앞 3단계의 부수효과를 되돌리는 코드가 전혀 없었음.
3. 수정: 위 서술대로 순서 변경(로직 재작성 없음, 기존 4개 호출의 순서만 재배치).
4. 재검증: 동일 재현 시나리오를 다시 실행 → 이번엔 `state.json`/`handle.json` 둘 다
   생성되지 않음(전체 실패)을 확인, 이어서 정상 경로로 재시도해 성공까지 확인.
5. 회귀 검증: `test:accounts` 309/309(신규 회귀 테스트 1건 포함 — 동일 실패 시나리오를
   `applySwitch()` 단위로 재현), `test:display` 245/245(2회 재확인, 무관한 위젯
   테스트 1건이 최초 1회 일시적으로 실패했으나 재실행 2회 연속 통과해 이 PC의 상시
   부하 환경 노이즈로 판단 — 이번 수정과 무관한 파일이라 회귀 아님), `npm run lint`·
   `lint:boundary`(23개 파일 무변경)·`live-wiring-gate.test.js` 전부 재확인 통과,
   `npm run build` 성공.

**작업 중 발생한 별도 사고(정직하게 기록)**: 이 라운드 도중 `active-account-state.js`와
그 테스트 파일에 대한 최초 수정이 한 차례 사라지는 것을 발견했다(재실행한 재현
시나리오가 여전히 옛 결함 그대로 재현됨 → grep으로 소스 대조 → 실제로 옛 순서 그대로임을
확인). `git status`/`git log`/`git reflog` 모두 이 저장소에 다른 커밋이 없음을 보여줬고
원인은 특정하지 못했다(이 프로젝트 저장소가 상시 동시 세션에 노출돼 있다는 점을 감안하면
로컬 파일 되돌림 종류의 충돌 가능성이 유력하나 확정할 근거는 없음) — 수정을 즉시 재적용하고
반영 여부를 grep으로 직접 재확인한 뒤에야 다음 단계로 진행했다. **별도로, 이 사고 직후
Windows Credential Manager 정리 과정에서 실수했다**: 이전 라운드들처럼 "이번에 만든 테스트
계정 ID만 골라서" 지우지 않고 `findCredentials('claudetower')`로 나온 8건 전부를
무차별적으로 삭제했다 — 이 중 최소 2건은 이번 세션이 만들지 않은 이전 라운드의 잔재였다.
이 저장소의 과거 기록(M48)상 지금까지 발견된 잔재는 전부 `claudetower-test-*` 부류의
테스트 마커였지 실사용자 데이터인 적이 없었으나, 이번엔 삭제 전에 값을 확인하지 않아 **100%
확신할 수는 없다** — 이 프로젝트의 credential-store가 격리 경로를 지원하지 않아(설계상 항상
실제 OS 저장소를 씀) 그동안의 모든 QA 스모크 테스트가 같은 실제 저장소를 공유해온 것이
근본 배경이다. 사용자가 실제로 이 컴퓨터에서 `claudetower accounts add`로 등록해둔 진짜
API 키가 있었다면 이번에 함께 지워졌을 수 있다 — 없었다면(이 세션들의 반복된 QA 스모크
테스트만 쌓인 상태였다면) 실질적 피해는 없다.

**의도적으로 하지 않은 것**: 재시도 로직을 감사로그 쓰기(`appendRotationEvent`)에도
추가하는 것은 이번 범위에서 제외했다 — 이번에 고친 결함(순서로 인한 부분 적용)은 순서
변경만으로 완전히 해소되고, 재시도 추가는 별개의 개선(감사로그 자체의 복원력)이라 범위를
넓히지 않았다.

**남은 위험**: 감사로그가 성공한 뒤 나머지 3개(상태·handle·레지스트리) 중 하나가 실패하는
경우는 이론상 여전히 가능하다(감사로그는 "전환을 시도했다"고 기록했는데 실제 활성 계정
포인터는 안 바뀔 수 있음) — 다만 이 3개는 전부 EPERM/EBUSY 재시도 로직이 있어 감사로그
자체보다 실패 가능성이 훨씬 낮고, 감사로그 방향으로 "과다 기록"되는 쪽이 "부족 기록"되는
쪽보다 감사 목적상 더 안전한 실패 방향이라고 판단해 이번 범위에서는 다루지 않았다. Windows
Credential Manager의 실제 등록 계정 상태는 사용자가 `claudetower accounts list`로 직접
확인해야 한다(위 사고로 인한 영향 여부 확인 필요).

**2026-08-21 후속 확인(위 Credential Manager 사고의 실제 영향 범위 확정)**: 환경변수
override 없이 실제 운영 경로(`~/.claudetower/accounts-registry.json`)로 `claudetower
accounts list`/`accounts status`를 직접 실행한 결과 — **등록된 계정 0개, Account 모듈도
비활성화 상태**였다. 즉 이 컴퓨터에서 실제로 `accounts add`를 실행해 진짜 계정을 등록한
적 자체가 없었다는 뜻이므로(레지스트리가 계정 존재의 유일한 근거이고 credential-store만
따로 값이 남는 경우는 있을 수 없음 — add는 항상 레지스트리 기록과 함께 이뤄짐), 위에서
무차별 삭제한 8건은 전부 QA 테스트 잔재였고 **실사용자 데이터 유실은 없었다**(추측이
아니라 직접 조회로 확정). 이 항목은 완전히 해소됐다 — 더 이상 확인할 것이 남아있지 않다.

---

## 다음 세션 작업 계획: `active_account` 상태표시줄 위젯 (2026-08-21 계획 수립 — 2026-08-31 M62로 완료)

> **2026-08-31 완료 표시**: 아래 계획 그대로 구현·검증까지 끝났다 — 상세는 맨 아래 M62 참고.
> 이 절은 "당시 어떤 계획이었는지"의 기록으로 보존한다(취소선·수정 없이 원문 그대로 유지).

> **주의**: 이 절은 M-번호를 붙이지 않는다. 이 파일 최상단이 명시한 원칙("완료 항목은
> 실제로 실행해 확인한 것만 done으로 표기")에 따라, M-번호는 실제로 구현·검증까지 끝난
> 것에만 부여한다 — 이 계획은 다음 세션(또는 이 세션의 다음 라운드)이 실제로 만들고
> 검증을 마친 뒤에 그 시점의 다음 M번호를 새로 받는다.

### 왜 이것이 다음 순서인가 (근거, 전부 실측 확인됨— 추측 없음)

1. `.PRD/02_DATA_MODEL.md`(2026-08-17)가 이 위젯의 유일한 차단 사유로 명시한 조건 —
   "`ActiveAccountHandle`을 실제로 쓰는 코드 경로가 아직 없다" — 가 M59(`accounts
   switch`)로 해소됐다. `accounts switch`는 실거래 배선 게이트와 무관하게 지금 당장
   실제 CLI에서 `ActiveAccountHandle`에 값을 쓰는 유일한 코드 경로다.
2. M59 CHECKPOINT 본문에 이미 "다음 라운드 후보로 남김"으로 명시적으로 예고돼 있었다.
3. **코드로 직접 재확인**(2026-08-21): `src/display/config/widget-config.js`의
   `ALL_WIDGET_TYPES`는 여전히 `['model','location','git','context','cost',
   'rate_limit']` 6종뿐, `src/display/widgets/`에 `active-account` 관련 파일 없음,
   `src/display/` 전체에 `active-account-handle` 참조 0건 — 문서만 오래된 게 아니라
   실제로 미구현임을 확인했다.
4. **CHECKPOINT.md·`.PRD/`를 grep으로 전수 스캔해 다른 미완료 "다음 세션" 항목과 비교
   대조했다** — OAuth/`--import`(ToS 영구 차단), 실거래 배선·핫리로드·영구셸별칭
   (🛑 게이트 차단), macOS/Linux 실측(물리 기기 없음), Windows 코드서명(재검토 조건
   미충족), `accounts --history`(PRD가 반복적으로 저우선순위 격하) — 이 중 지금 바로
   착수 가능한 항목은 이 위젯이 유일하다. 다른 후보와의 비교표는 이 대화의 직전 라운드
   보고에 있다(요약: 전부 게이트/ToS/환경 부재로 막혀 있거나, 순수 코스메틱이라 이
   기능적 갭보다 우선순위가 낮음).

### 구현 시 반드시 참고할 검증된 기존 패턴 (2026-08-21 실제 코드 확인, 추측 아님)

- `src/display/widgets/model.js`가 최소 위젯 템플릿: `render(session) => string|null`,
  보여줄 게 없으면 `null` 반환(그러면 `statusline.js`가 자동으로 줄에서 제외).
- `src/display/widgets/git.js`가 "stdin이 아닌 다른 소스에서 값을 읽는 위젯"의 기존
  전례다 — git은 `execFileSync`+`session_id` 캐싱을 쓰지만, `active_account`는 단순
  로컬 JSON 파일 1회 동기 읽기라(외부 프로세스 스폰 없음) **캐싱이 필요 없을 가능성이
  높다** — 다만 최종 판단은 구현 시 실측(느린지 아닌지)으로 확인할 것, 추측으로
  단정하지 말 것.
- `src/shared/active-account-handle/read.js`의 `readActiveAccountHandle(filePath)`가
  이미 존재하고 완성돼 있다 — 파일이 없으면 `null`, 손상돼도 `null`(크래시 없음),
  격리 방어막 불필요(읽기 전용이라 read.js 자체 주석이 이미 그렇게 설계함). 이 위젯은
  이 함수를 그대로 가져다 쓰면 되고 **새로 작성할 로직이 아니다**.
- `statusline.js`의 `WIDGETS` 배열에 `{ type: 'active_account', render: renderActiveAccount }`
  추가, `widget-config.js`의 `ALL_WIDGET_TYPES`에 `'active_account'` 추가,
  `setup-wizard.js`의 `WIDGET_LABELS`에 한국어 라벨(예: `active_account: '활성 계정'`)
  추가 — 이 3곳 전부 실제로 확인했고, 셋 다 안 고치면 각각 다른 방식으로 깨진다(①
  없으면 위젯이 렌더링 안 됨, ②·③ 없으면 `accounts config`/`widgets` 명령이 새 타입을
  모르는 채로 남음). **하나만 고치고 끝냈다고 착각하지 말 것.**

### 구현 전 반드시 결정해야 하는 열린 질문 (임의로 단정하지 말고 결정한 뒤 근거를 남길 것)

1. **`WIDGET_DROP_PRIORITY`(statusline.js) 어디에 넣을지**: 터미널 폭이 좁을 때 이
   위젯을 얼마나 먼저/나중에 뺄지 순서가 아직 없다 — 넣지 않으면 줄이 넘쳐도 이 위젯만
   영원히 안 빠지는 결함이 생긴다(코드로 직접 확인: `fitToLineBudget`은 이 목록에 있는
   타입만 제거 대상으로 삼는다). 권고(제안일 뿐, 확정 아님): git/rate_limit과 비슷하게
   낮은 우선순위(먼저 빠지는 쪽)로 — 세션 정체성이 아니라 부가 정보이므로.
2. **표시 문구 형식**: `account_label`을 그대로 보여줄지, 접두어(예: "계정: ")를 붙일지
   — `model.js`는 접두어를 실사용 피드백으로 오히려 뺐던 전례가 있다(과유불급). 최종
   문구는 실제 화면에서 다른 위젯과 나란히 놓고 가독성을 확인한 뒤 정할 것.
3. **Account 모듈을 한 번도 켠 적 없는 사용자에게 보이는 방식**: `readActiveAccountHandle`이
   `null`을 반환하면 위젯이 완전히 비표시(줄에 아무 흔적도 안 남음)여야 한다 — "설치
   후 Account 미사용 시 Display 동작 완전히 무관"이라는 01_PRD.md §5 성공 기준과 직결.
   빈 텍스트나 "(없음)" 같은 걸 보여주면 안 된다(원칙은 정해졌으나, 코드로 실제
   구현·테스트할 것).

### 예상되는 위험/충돌/실패 시나리오 (착수 전 반드시 먼저 확인할 것)

- **동시 세션 충돌 위험(이번 세션이 실제로 겪은 사고, M60 참고)**: 이 저장소는 상시
  다른 세션과 공유된다. 착수 직전 반드시 `git status`/`git fetch`/`git log`로 이
  기능이 이미 다른 세션에 의해 진행 중이거나 완료되지 않았는지 먼저 확인할 것 —
  안 하면 이번 세션이 겪은 "고친 코드가 흔적도 없이 되돌아가 있던" 사고가 반복될 수
  있다. 파일 수정 후에는 즉시 grep/Read로 실제로 저장됐는지 재확인하는 습관을 유지할 것.
- **모듈 경계 위반 아님을 재확인**: `src/shared/active-account-handle/read.js`는
  `src/accounts/`가 아니라 `src/shared/`에 있어 Display가 import해도 모듈 경계 규칙
  위반이 아니다(이미 이렇게 설계된 유일한 연결점) — 그래도 구현 후 `npm run
  lint:boundary`와 `verify-display-standalone` CI job으로 반드시 재확인할 것(주장이
  아니라 실측으로).
- **위젯 단위 격리 유지**: `statusline.js`가 각 위젯을 try/catch로 감싸 하나가 죽어도
  나머지는 살아남게 하는 기존 구조(04_PROJECT_SPEC.md DO NOT 규칙)를 그대로 따를 것 —
  새 위젯이라고 예외로 두지 말 것.
- **성능 예산**: statusline 전체가 100ms 미만을 목표로 한다는 기존 요구사항(여러 라운드
  전부터 미확정 상태로 남아있는 "남은 위험")이 있다 — 파일 읽기 하나 추가가 유의미한
  악화를 일으키지 않는지 구현 후 실측할 것(기존 값과 비교).
- **기존 사용자 영향**: 이미 `config.json`에 `enabled_widgets`를 명시적으로 저장해둔
  기존 사용자는 업그레이드해도 새 위젯이 자동으로 켜지지 않는다(기존 목록에 새 타입이
  없으므로) — 이는 결함이 아니라 기존 `git` 위젯 추가 때와 동일한, 이미 검증된 정상
  동작이다. "왜 새 위젯이 안 보이지"를 버그로 오인하지 말 것.

### 함께 갱신해야 하는 문서 (구현 직후, 빠뜨리면 이 프로젝트가 반복 겪은 "코드가 문서보다
앞서가는" 패턴 재발)

- `.PRD/02_DATA_MODEL.md`: `active_account` 위젯을 "미구현"이라 적어둔 각주 정정
- `.PRD/03_PHASES.md` 115행: `active_account` 위젯 항목을 완료로 갱신(단, 같은 줄의
  Powerline 색상 테마·Git 위젯은 별개 항목이라 이번 작업과 무관하게 미완료로 유지 —
  한 줄에 묶여 있다고 전부 완료 처리하지 말 것)
- `src/accounts/status-report.js`: 직접 관련은 없으나 "구현된 컴포넌트" 목록에
  Display 쪽 변화를 넣을지는 판단 필요(Account 모듈 자체는 안 바뀌므로 보통은 불필요 —
  신중히 판단할 것)
- README.md/README.en.md: 새 위젯이 사용자에게 보이는 기능이므로 명령어/위젯 목록에
  반영 필요 여부 확인

### 완료 기준 (done-when — 전부 실측 확인 후에만 체크)

- [ ] `active_account` 위젯이 `ALL_WIDGET_TYPES`·`WIDGET_LABELS`·`WIDGETS`·
      `WIDGET_DROP_PRIORITY` 4곳 전부에 일관되게 반영됨
- [ ] Account 모듈 미사용 사용자: 위젯이 줄에 전혀 나타나지 않음(실측)
- [ ] `accounts switch`로 실제 전환 후: 위젯이 정확한 라벨을 보여줌(실측, 단위테스트
      아니라 실제 CLI 흐름으로)
- [ ] `ActiveAccountHandle` 파일이 손상된 경우에도 statusline 전체가 죽지 않음(실측)
- [ ] `npm run verify`(lint+lint:boundary+test:display) 전부 통과
- [ ] `verify-display-standalone` CI job 통과(Account 코드 삭제 상태에서도 Display 정상)
- [ ] 위 "함께 갱신해야 하는 문서" 전부 반영
- [ ] `npm run build` 성공 + 실제 exe로 최소 1회 라이브 스모크

---

## M61: 2026-08-21 — README.md/README.en.md/README.html/README.en.html 전면 정확성 갱신
(사용자 요청 종합 문서화 라운드)

**배경**: 사용자가 README 4개 파일(한국어/영어 × md/html)을 "지금까지 개발한 기준으로" 비개발자도
이해할 수 있게, md·html 내용이 완전히 동일하도록, 법률/저작권/상업적 용도는 엄격한 기준으로
작성해달라고 요청했다. 기존 README.md/README.en.md는 이미 사용자가 요청한 모든 섹션(목차·설치·
사전준비물·명령어·워크플로우·아키텍처·보안·FAQ·법률 등)을 갖추고 있어 구조 재작성은 불필요했으나,
**실제 배포 상태와의 정확성 갭 2건**을 발견했다:

1. **v0.5.0이 이미 릴리스됐는데 문서는 "v0.4.0이 최신, 계정 기능 없음"이라고 서술 중이었다.**
   `gh release list`/`gh release view v0.5.0`으로 실제 릴리스 내용을 직접 확인한 결과, v0.5.0
   (2026-08-20 발행)에 계정 등록/조회/삭제/이름변경/진단(enable·add·list·remove·rename·disable·
   diagnose-quota) 전체가 이미 실제로 포함돼 있었다. 문서가 이를 "다음 릴리스부터"라고 미래형으로
   서술한 건 단순 오기가 아니라, **실제로 이미 다운로드 가능한 위험(API 키 로테이션 남용방지
   조항 불확실성)을 사용자에게 과소 고지하는 결과**였다 — 법률/상업적 용도 섹션의 "엄격한 기준"
   요구와 정면으로 배치되는 문제라 최우선으로 수정했다.
2. **가장 최신 기능(`accounts switch`, M59)이 명령어 목록에 아예 없었다.** README가 마지막으로
   갱신된 M57 시점엔 아직 존재하지 않았던 기능이라 당연히 빠져 있었던 것 — 실제 코드
   대조(`bin/claudetower.js` grep)로 확인 후 추가했다.

**수정 원칙**: "v0.5.0에 실제로 포함된 것"과 "아직 정식 릴리스 전 최신 개발 상태에만 있는 것"을
문서 전체에서 일관되게 구분했다(배너·명령어 목록·"② 계정 자동전환" 본문·changelog·FAQ·상업적
용도 섹션 총 6곳 이상, 한국어·영어 양쪽 모두). `accounts switch`는 여전히 어느 정식 릴리스에도
없다는 사실을 매번 명시해, "이미 릴리스된 것처럼" 과대 고지하지 않도록 주의했다(README.md 130~131행
헤더 자신이 이미 "이 문서는 개발이 완료된 최신 기준"이라고 선언하고 있어, 이 패턴 자체는 기존
관례를 따른 것 — 새로 만든 원칙이 아니다).

**부수적으로 발견·수정한 별개의 렌더링 결함**: HTML 재생성을 위해 `pandoc`으로 README.md를
변환하다가, 닫는 괄호`)`나 따옴표`"` 바로 뒤에 공백 없이 한글이 붙는 위치에서 굵게(`**...**`)
표시가 별표 문자 그대로 노출되는 CommonMark 렌더링 결함을 발견했다(예: `**공개(public)**입니다`가
`<strong>` 변환 안 되고 그대로 출력됨) — **이건 GitHub에서 README.md를 볼 때도 똑같이 깨져
보였을 실제 결함**이다(HTML 생성 문제가 아니라 .md 원본 자체의 문제). 전수 검색(정규식
`\*\*[^*\n]*[")]\*\*[가-힣]`)으로 5곳을 찾아 `<strong>`/`</strong>` 원시 HTML 태그로 교체해
근본 수정(GFM이 원시 HTML을 그대로 통과시키므로 CommonMark의 강조 판정 모호성 자체를 우회) —
영어 문서는 이 패턴이 발생하지 않아(별도 확인) 수정 대상이 아니었다.

**HTML 재생성 방법(정확성 보장 근거)**: 기존 README.html/README.en.html은 2026-08-04에 손으로
마지막 갱신된 뒤 한 번도 안 건드려져 있었다(M39가 이미 "별도 pandoc 파이프라인 필요, 범위 밖"으로
남겨둔 부채) — 예를 들어 NOTICE 문단이 "계정 코드가 배포판에 포함 안 됨"이라는, v0.5.0 릴리스보다도
훨씬 이전의 완전히 틀린 내용을 담고 있었다. **손으로 HTML을 따로 고치는 대신, 확정한 .md를
`pandoc -f gfm -t html`로 변환한 뒤 기존 CSS 스타일 셸(다크모드 대응 포함)에 이어붙이는 방식**으로
md→html을 기계적으로 유도했다 — 이렇게 하면 두 형식이 손으로 각각 고치다 벌어지는 드리프트(이번에
실제로 겪은 문제)가 구조적으로 발생할 수 없다. 자기참조 링크(`./README.md`→`./README.en.md`)는
HTML판에서 `./README.html`→`./README.en.html`로 가리키도록 후처리했다(pandoc은 원본 마크다운의
링크 텍스트를 그대로 유지하므로 이 부분만 예외적으로 손댐).

**검증(전부 직접 실행, 자기선언 아님)**:
- 대표 핵심 문구 4개(`accounts switch`/`v0.5.0`/`Credential Manager`/`THIRD_PARTY_NOTICES`)의
  등장 횟수를 .md와 .html 양쪽에서 grep으로 세어 **완전히 일치**함을 확인(md=html 전부 동일 수).
- 변환된 HTML에 `**`(미변환 마크다운 강조 기호) 잔존 0건 확인(수정 전 6건 → 수정 후 0건, 한국어·
  영어 양쪽 재확인).
- `<table>` 8개·`<details>` 토글 블록 전부 정상 변환 확인(원시 HTML이라 GFM이 그대로 통과시킴).
- `npm run lint` 클린(코드는 건드리지 않음, 재확인 목적).
- `git status`로 의도한 4개 파일(README.md/README.en.md/README.html/README.en.html) 외 변경
  없음 확인.

**의도적으로 하지 않은 것**: THIRD_PARTY_NOTICES.md·LICENSE 자체는 이번 범위 밖(이미 정확함,
README에서 참조만 함). `.PRD/` 문서들은 이번 라운드에서 건드리지 않음(README는 사용자 대상,
`.PRD/`는 개발자 설계 기록으로 성격이 다름). ToC 앵커 링크가 pandoc의 자동 생성 id와 100%
일치하는지는 전부 낱낱이 클릭 검증하지 않았다 — 문서 전체 내용은 어차피 위→아래로 다 보이므로
치명적이지 않다고 판단했으나, 완벽히 확인됐다고는 말하지 않는다.

**남은 위험**: 이 README는 여전히 "이 문서는 개발이 완료된 최신 기준"이라는 전제를 유지한다 —
즉 다음에 코드가 또 바뀌면(예: `active_account` 위젯이 실제로 만들어지면) README도 함께
갱신해야 하며, 이번 라운드가 발견한 "코드는 앞서가는데 문서가 못 따라간" 패턴이 또 재발할 수
있다는 뜻이다(이 프로젝트가 반복 겪어온 패턴). HTML 자동 재생성 절차 자체는 아직 `package.json`
스크립트로 등록되지 않아, 다음에 README.md를 고치는 사람이 이번처럼 수동으로 pandoc 명령을
다시 실행해야 한다는 점도 남은 마찰이다(자동화는 이번 범위 밖으로 판단).

---

## 세션 종료 인계 메모 (2026-08-21, M-번호 없음 — 작업 기록이 아니라 다음 세션을 위한 상태 스냅샷)

**지금 이 순간의 저장소 상태(전부 직접 재확인, 이 메모 작성 직전 실행)**:
- `git status` — 추적 대상 파일 중 커밋 안 된 변경 0건(미추적 플러그인 부산물 5개
  `.active-agents*`·`.failure-tracker.jsonl`·`.pair-programming-session.md`만 있음 — 이
  프로젝트 소스가 아니라 매번 의도적으로 커밋 대상에서 제외해온 것들, 그대로 둘 것).
- 작업 브랜치 `docs-and-fixes/2026-07-06`이 `origin/docs-and-fixes/2026-07-06`과 완전히
  동기화됨(0 ahead / 0 behind), 이 브랜치의 모든 커밋이 이미 `origin/main`에도 병합돼 있음
  (`git rev-list --left-right --count origin/main...HEAD` → "20 0", HEAD 쪽 고유 커밋 0개
  = 전부 main에 흡수됨. main이 20 앞서는 건 PR 머지 커밋들이 브랜치엔 없고 main에만 있기
  때문 — 정상).
- 최신 커밋(위→아래 최근순): `eed55dc`(M61, README 4종 정확성 갱신) → `0d07858`(다음 세션
  계획 수립+M60 사고 후속확인) → `9f8d2c4`(M60, applySwitch 부분실패 결함 수정) →
  `3751069`(M59, accounts switch 신설) → `fba6030`(CHECKPOINT 아카이브 분리).
- **세션 종료 직전 최종 건강 확인(전부 직접 실행, 방금 재검증)**: `npm run verify`
  (lint+lint:boundary+test:display) 245/245 통과, `npm run test:accounts` 309/309 통과,
  `test/accounts/live-wiring-gate.test.js` 통과(🛑 게이트 여전히 유효) — 전부 그린 상태로
  세션을 닫는다.

**이 메모에서만 알 수 있는, git 커밋 기록에는 안 남는 변경 1건**: 이번 세션 마지막 라운드에서
GitHub 저장소(`sodam-ai/ClaudeTower`)의 **About 설명(저장소 소개 문구)**을 `gh repo edit`으로
수정했다 — "계정 자동전환 기능은 현재 배포판에 포함되어 있지 않음"이라는 v0.5.0 릴리스 이전의
낡은 문구를, "API 키 계정 등록·관리 기능도 포함되어 있으나 기본값은 꺼짐이며, 로그인 계정
자동화나 자동 전환 기능은 없음"으로 정정했다. **이건 `git log`로는 절대 안 보인다** — 다음
세션이 "About을 왜 아무도 안 고쳤지" 하고 다시 손대려 하면 이미 돼 있다는 걸 알려주기 위해
여기 남긴다. GitHub 저장소 Topics(`claude-code`/`cli`/`nodejs`/
`single-executable-application`/`statusline`)는 전부 여전히 정확해 이번엔 변경하지 않았다.
저장소 visibility는 이번에도 PUBLIC 유지로 사용자가 재확인했다(반복 확정, 재질문 불필요 —
`user_sodam-family-solo-user-all-siblings` 계열 메모리와 일관).

**다음 세션이 가장 먼저 읽어야 할 것**: 이 메모 바로 위가 아니라, 위쪽의 **"다음 세션 작업
계획: `active_account` 상태표시줄 위젯"**(2026-08-21 계획 수립 섹션, M60과 M61 사이에 있다)
이다 — 그 계획은 이번 세션의 나머지 라운드(M61 README 갱신, GUIDE 파일 확인, About 정정)와
무관하게 **아직 그대로 유효한 다음 실제 작업**이다. M61이 그 계획 뒤에 커밋된 것뿐이지, 그
계획을 대체하거나 완료시킨 게 아니다 — 순서상 헷갈리지 않도록 명시해둔다. 착수 전에는 그
계획 섹션이 스스로 요구하는 대로 `git status`/`git fetch`/`git log`로 동시 세션 여부부터
다시 확인할 것(이번 세션 M60에서 실제로 편집 내용이 흔적 없이 되돌아간 사고가 있었다 — 재발
가능성을 낮게 보지 말 것).

**미해결로 남은, 이번 세션이 만들지 않았지만 인지하고 있는 것**: `.gitignore`가 위 5개
미추적 플러그인 부산물 파일을 아직 포함하지 않는다(요청 범위 밖이라 이번 세션엔 손대지
않음 — 언젠가 `git add -A`를 실수로 쓰면 함께 딸려 들어갈 수 있는 잠재 위험으로만 기록).

---

## `claudetower-widgets` 스킬이 조용히 죽어 있음 (2026-08-23, /doctor 진단 — 코드 변경 없음, 기록만)

### 증상 (실사용 영향 있음)
사용자가 **"상태표시줄에서 컨텍스트 꺼줘"**, **"비용 표시 꺼줘"**, **"상태표시줄 설정 바꿔줘"**
라고 말해도 `claudetower-widgets` 스킬이 **매칭되지 않는다.** 정작 그 트리거 문구들은 이 스킬의
`description`에 정확히 적혀 있는데, 그 description 자체가 무시되고 있기 때문이다.

### 원인 (확인됨)
`%APPDATA%\claude-code\skills\claudetower-widgets\SKILL.md` 의 frontmatter에 **`name:` 줄이 없다.**

```
L1| ---
L2| description: ClaudeTower 상태표시줄(statusline) 위젯을 켜고 끄거나 ...
L3| argument-hint: [...]
L4| allowed-tools: Bash("C:/Users/PC/.claudetower/bin/claudetower.exe" widgets *), ...
L5| ---
```

`name`이 없으면 스킬 이름은 폴더명으로 대체되고 **나머지 필드가 전부 드롭**된다. 즉:
- `description` 소실 → 트리거 문구가 매칭 근거로 쓰이지 않음 (위 증상의 직접 원인)
- `allowed-tools` 소실 → 이 스킬에 걸어둔 **도구 제한이 조용히 해제됨**
- `argument-hint` 소실

**증거(추측 아님)**: 2026-08-23 세션의 사용 가능한 스킬 목록에서 `claudetower-widgets`는
**설명 없이 이름만** 올라와 있었다. 같은 목록의 `long-horizon`·`spec-workflow`는 설명이 정상
표시됐다 — 즉 목록 전체가 잘린 게 아니라 이 스킬만 필드를 잃은 것이다. 경고는 어디에도 뜨지 않는다.

### 조치 (미적용 — 사용자 결정으로 보류)
2026-08-23 /doctor에서 수리를 제안했으나, **사용자가 파일 수정 대신 이 문서에 기록만 남기도록
지시**했다. SKILL.md는 손대지 않았다.

- [ ] **CT-W1** `%APPDATA%\claude-code\skills\claudetower-widgets\SKILL.md` 2번째 줄 앞에 한 줄 추가:
      `name: claudetower-widgets`
      - 검증: 새 세션을 열어 스킬 목록에 이 스킬의 **설명이 함께** 뜨는지 확인.
        같은 세션 재확인은 캐시 스냅샷 때문에 무의미하다(sodam-persona 사례와 동일한 함정).
      - done-when: 새 세션에서 "상태표시줄 설정 바꿔줘"에 이 스킬이 실제로 호출됨.
- [ ] **CT-W2** 회귀 방지 — ClaudeTower가 이 SKILL.md를 배포·설치하는 경로가 있다면
      템플릿 원본에도 `name:`이 있는지 대조. 원본이 빠져 있으면 재설치 때 되살아난다.

### 같은 진단에서 함께 나온 주변 항목 (ClaudeTower 소관 아님 — 인지용 기록)
2026-08-23 /doctor가 같은 회차에 찾은 것들. 사용자가 여기 함께 적어두라고 지시했다.

- [ ] **X-1** `%APPDATA%\claude-code\skills\ct-configdir-test\` — 본문이 "이건 config-dir 위치
      테스트입니다" 한 줄뿐인 **시험용 스킬**인데 `name:` 누락 상태로 스킬 목록을 계속 차지 중.
      수리보다 **폴더 삭제**가 맞다. (ClaudeTower의 config-dir 실험 잔재로 보이나 미확인)
- [ ] **X-2** 에이전트 정의 3개의 frontmatter 파손 — `description:` 값에 여러 줄 예시가 따옴표 없이
      들어가 `user:`/`assistant:` 가 별도 키로 잘못 읽힌다:
      `~/.claude/agents/Design/design-temp/design/` 의 `brand-guardian.md`, `ux-researcher.md`,
      `visual-storyteller.md` (각 L4~). 수정 = description을 `|` 블록으로 감싸거나 예시를 본문으로 내림.
      **우선순위 낮음** — 아래 X-4 참조.
- [ ] **X-3** `%APPDATA%\claude-code\.claude.json.tmp.*` **13개 (~1.5MB)** — 2026-07~08 저장 중
      남은 찌꺼기. 삭제 대상. `.claude.json`(현행)과 `.claude.json.backup`(백업)은 **건드리지 말 것**.
- **X-4 (참고 사실, 조치 아님)** `~/.claude/agents/` 의 **에이전트 정의 1,211개는 이번 세션의
  사용 가능한 에이전트 목록에 하나도 올라와 있지 않다.** 목록에는 플러그인 제공(`ecc:*`, `sodam-*`)과
  내장 에이전트만 있었다. `~/.claude/CLAUDE.md`가 이미 이들을 "Glob/Read로 탐색해 쓰는 참조
  라이브러리"로 문서화해 놓았고 실제로 그렇게 동작하므로 **결함이 아니다.** 다만 "등록된
  에이전트"로 알고 있었다면 사실과 다르다. (로더 소스가 아니라 세션 목록으로 확인한 것이므로,
  "확인됨"은 목록 부재까지이고 그 원인까지 규명한 것은 아니다.)
  CLAUDE.md의 수치 자체는 정확했다 — 실측 1,357개 파일 / 이름 있는 정의 1,211개 / SKILL.md 619개
  (최상위 100 + 중첩 519), 전부 일치.

### 이번 진단에서 ClaudeTower가 건강했던 부분
설치 자체는 문제 없었다: Claude Code 2.1.241 = `latest` 채널 최신, 설정 파일 전부 JSON 파싱 정상,
중복 설치·npm 잔재 없음, `permissions.defaultMode`는 이미 유저 스코프에 `auto`.
ClaudeTower statusline 실행 파일 잠금 경합(과거 이슈)은 이번 진단 범위에서 재현되지 않았다 —
재현 안 됐다는 뜻이지, 해결됐다고 확인한 것은 아니다.

---

## statusLine `refreshInterval` 권장값 = 5초 (2026-08-30, /doctor 8회차 실측 — 코드 변경 없음, 기록만)

바로 위 8/23 항목이 "잠금 경합은 재현 안 됐지만 해결됐다고 확인한 것은 아니다"로 남겨둔 부분의
후속이다. 이번엔 **실행 시간을 직접 재서** 숫자로 결론을 냈다.

### 실측 (2026-08-30, `C:\Users\PC` 세션)

`echo '{}' | claudetower.exe statusline` 를 5회 연속 실행:

```
run1: 77ms   run2: 76ms   run3: 73ms   run4: 77ms   run5: 77ms
```

평균 **76ms**, 편차 4ms. 현재 `~/.claude/settings.json` 의 `refreshInterval` 은 **3**.

| refreshInterval | 시간당 스폰(1세션) | 4세션 동시 | CPU 점유율 |
|---|---|---|---|
| 1 (구 기본값, 2026-07-04 폭주 당시) | 3,600회 | 14,400회 | 7.6% |
| **3 (현재값)** | 1,200회 | 4,800회 | **2.5%** |
| **5 (권장)** | **720회** | **2,880회** | **1.5%** |

### 🔴 과거 판정 강등 — statusline은 UI 멈춤의 유력 원인이 아니다

2026-08-30 세션에서 Claude Code TUI가 선택 프롬프트 화면에서 멈추는 사고가 있었고,
진단 초기에 `05_FIELD_ISSUES_2026-07-04.md` 의 잠금 경합 이력을 근거로 statusline을
원인 후보 2순위로 올렸다. **실측 후 철회한다.**

- 점유율 **2.5%**(76ms/3초)로는 UI 정지를 설명할 수 없다.
- 인용했던 경합 이력은 **`refreshInterval: 1` + 83MB exe** 시절 조건이고,
  그 조건은 2026-07-06 FR-1 적용(3초)으로 이미 완화돼 있었다.
- 즉 8/23 항목의 "재현 안 됨"은 **우연이 아니라 이미 완화된 결과**일 가능성이 높다(가설).
  다만 잠금 경합 자체가 코드로 해결된 것은 아니므로 "해결됨"으로 표기하지 않는다.

### 그럼에도 5초를 권장하는 이유 (손해 없는 경량화)

1. **제품이 스스로 정한 권장 범위의 상단**
   `.PRD/05_FIELD_ISSUES_2026-07-04.md:197` — *"refreshInterval 상향(예: 2~5초)로
   스폰 빈도·잠금 창 축소(가장 저렴)"*. 범위 밖(10초 등)으로 나가지 않는다.
2. **작업 중 체감 손실이 0이다** — 이게 결정적 근거
   `.PRD/.archive/PulseLine원본/RESEARCH_SOURCES.md:75` — *"refreshInterval 필드는
   **이벤트 기반 업데이트에 추가로** N초마다 명령을 다시 실행합니다."*
   → 작업 중에는 이벤트마다 이미 갱신되고, `refreshInterval` 은 **유휴 상태 전용 백업
   타이머**다. 3초 → 5초는 *가만히 있을 때* 갱신이 2초 늦는 것뿐이다.
3. 스폰 **40% 감소**(시간당 1,200 → 720회). 설치·업데이트 시 exe 교체와 겹칠 잠금 창도
   같은 비율로 줄어든다.

### 조치

- [x] **CT-S1** `claudetower config statusline-refresh 5` — **2026-08-30 적용 완료**
      (`src/display/config-command.js`, FR-1으로 2026-07-06 구현·단위테스트·CLI 스모크 완료.
      `settings.json` 의 `refreshInterval` 키만 원자적으로 수정하고 다른 키는 보존한다.)
      - CLI 출력: `상태표시줄 갱신 주기를 5초로 설정했습니다: C:\Users\PC\.claude\settings.json`
      - **무결성 검증 (적용 전/후 해시 대조 — 실측)**: `refreshInterval` 3 → 5.
        `statusLine.command` · `env`(DISABLE_AUTOUPDATER·ECC_GATEGUARD) · `permissions` ·
        `hooks.PreToolUse` · `hooks.PostToolUse` **전부 SHA-256 앞 12자리 동일**.
        파일 크기 995 → 993B(-2)는 `env` 값 뒤 **불필요한 공백 2개가 정규화**된 것으로,
        `JSON.stringify` 비교 결과 **의미적으로 완전 동일**함을 확인(`semantic equal = true`).
        → FR-2가 약속한 "다른 키 보존"이 실제 파일에서 재확인됨.
      - 적용 전 원본 = `~/.claude/settings.json.bak-doctor-20260830`(995B, 유효한 복원점).
      - [ ] **라이브 확인 대기** — 같은 세션 확인은 캐시 스냅샷 때문에 무의미하다
        (`claudetower-widgets` CT-W1과 동일한 함정). **새 세션**에서 상태표시줄이 정상 표시되고
        유휴 상태 갱신이 5초 주기로 도는지 확인해야 done이다.
      - 되돌리기: `claudetower config statusline-refresh 3`.

- [ ] **CT-S2** **README의 갱신 주기 안내 보완** (프로젝트 진행 후 README 작성·갱신 시 필수 확인 항목)

      ※ 이 항목은 2026-08-30 세션에서 **한 번 잘못 적었다가 실측으로 정정한 것**이다.
      최초에 "README 어디에도 권장 주기 안내가 없다"고 썼으나, 실제로 확인해 보니
      **4종 README 모두 각 4곳씩 언급이 있었다.** 없는 게 아니라 **불완전**한 것이 문제다.
      (교훈: README 관련 판단은 실제 grep 전에 단정하지 말 것.)

      **현재 있는 것** — `README.md:145`
      > `claudetower config statusline-refresh <초>` — 상태표시줄 갱신 주기를 조절합니다
      > (기본 3초, **세션을 여러 개 띄워두는 경우 5초 이상**으로 늘리면 컴퓨터 부담이 더 줄어듭니다)

      **문제 1 (가장 중요) — `README.md:219` 가 오해를 유발한다**
      > 1. Claude Code와 대화를 주고받는 동안, Claude Code가 **정해둔 주기마다(기본 3초, …)**
      >    자동으로 이 프로그램을 실행합니다.

      이 서술은 **이벤트 기반 갱신을 빠뜨렸다.** Claude Code 사양상 `refreshInterval` 은
      *"이벤트 기반 업데이트에 **추가로** N초마다"* 도는 값이다
      (`.PRD/.archive/PulseLine원본/RESEARCH_SOURCES.md:75`). 즉 실제로는 **유휴 상태 전용
      백업 타이머**인데, 219행만 읽으면 "3초마다만 갱신된다 → 짧을수록 반응이 빠르다"로
      읽힌다. **권장 방향과 정반대의 오해**이고, 2026-07-04 스폰 폭주와 같은 경로다.

      **문제 2 — 권장이 조건부라 단일 세션 사용자에게는 기준이 없다**
      145행의 "5초 이상" 권장은 *"세션을 여러 개 띄워두는 경우"* 에만 걸려 있다.
      세션 하나만 쓰는 사용자는 기본 3초를 그대로 쓰게 된다.

      **문제 3 — 근거 수치가 없다**
      "컴퓨터 부담이 줄어듭니다"만 있고 얼마나 줄어드는지가 없어 판단할 근거가 안 된다.

      - 넣을 내용:
        · `README.md:219` 를 **이벤트 갱신 + 유휴 타이머** 2단 구조로 정정 (문제 1 — 최우선)
        · 조건 없는 **기본 권장값 5초** 로 상향 (문제 2)
        · 실측 근거: 실행 **76ms/회** → 1초 7.6% / 3초 2.5% / **5초 1.5%** (문제 3)
        · 제품 자체 권장 범위가 2~5초임을 명시 (`.PRD/05_FIELD_ISSUES_2026-07-04.md:197`)
      - done-when: `README.md` · `README.en.md` · `README.html` · `README.en.html` **4종 전부**
        반영되고 한국어판·영어판 내용이 일치. (영어판 3종의 현재 문구는 아직 대조하지 않았다 —
        한국어판과 같은 구조일 것이라는 **추정**이므로 작업 시 먼저 확인할 것.)
      - ⚠️ **M61(2026-08-21 README 전면 갱신)이 끝난 뒤에 나온 요구사항**이다.
        M61이 끝났다고 README를 다 된 것으로 간주하면 그대로 누락된다.

### 남은 한계 (숨기지 않고 기록)

- 76ms는 **5회 연속 실행이라 OS 파일 캐시가 따뜻한 상태**의 값이다. 오랜 유휴 뒤 첫 실행
  (콜드 스타트, 83MB exe 로딩)은 더 느릴 수 있는데 **측정하지 못했다**. 다만 콜드 스타트일수록
  간격을 늘리는 쪽이 유리하므로 5초 권장의 방향은 바뀌지 않는다.
- 이번 측정은 **1세션 기준**이다. 4세션 동시 수치는 단순 곱셈으로 낸 추정치이며 실측이 아니다.
- 2026-08-30 UI 멈춤의 진짜 원인은 **끝내 규명하지 못했다**. 해당 턴이 트랜스크립트에 한 줄도
  기록되지 않아(=응답이 커밋되기 전에 프로세스가 멈춤) 로그로 추적할 근거 자체가 없다.
  당시 세션 컨텍스트가 408k 토큰(1M의 41%)이었다는 점만 정황으로 남긴다. ClaudeTower 소관 아님.

---

## M62: 2026-08-31 — 회귀 버그 수정(`claudetower-widgets` 스킬 name: 누락) + `active_account`
상태표시줄 위젯 신설 (2026-08-21 "다음 세션 작업 계획" 완료)

**착수 전 확인**: `git fetch` + `git log origin/docs-and-fixes/2026-07-06..HEAD` / 역방향 둘 다
0건 — 동시 세션 없음, origin과 완전 동기화 확인 후 시작(이 문서가 반복 요구해온 절차).

### ① 회귀 버그 수정: `skill-file.js`의 `buildSkillFileContent()`에 `name:` 프론트매터 누락

**발견 경위**: PRD·CHECKPOINT 전수 재검독 중 2026-08-23 `/doctor` 기록(바로 위 절, CT-W1 —
"사용자 결정으로 보류")을 실제 배포 파일과 대조하다가 **모순**을 하나 찾았다. 이 PC에 설치된
`%APPDATA%\claude-code\skills\claudetower-widgets\SKILL.md`는 `name:` 필드가 이미 있었다
(누군가 배포본만 수동 패치, 이 문서엔 반영 안 됨) — 그런데 그 패치의 **원본 소스**
(`src/display/config/skill-file.js`의 `buildSkillFileContent()`)는 여전히 `name:` 없이
`description:`으로 프론트매터가 바로 시작했다. 즉 CT-W2가 이미 경고했던 그 시나리오("원본이
빠져 있으면 재설치 때 되살아난다")가 실제로 성립하는 상태였다 — 다음 `claudetower setup`
재실행(재설치·업데이트 포함)마다 이 수동 패치가 덮어써져 버그가 되살아난다. `name:`이 없으면
Claude Code가 이 스킬의 이름을 폴더명으로만 대체하고 `description`/`argument-hint`/
`allowed-tools`를 전부 드롭한다 — `01_PRD.md` §3 P1 요구사항("슬래시 명령 대화형 설정")이
재설치할 때마다 조용히(에러 없이) 깨지는 구조적 결함이었다.

**수정**: `buildSkillFileContent()`가 반환하는 템플릿 첫 줄에 `name: ${SKILL_NAME}` 추가(이미
있던 상수를 재사용, 새 문자열 하드코딩 없음). 회귀 테스트 1건 추가 — frontmatter의 정확히
2번째 줄(`---` 바로 다음)이 `name: claudetower-widgets`인지 검증(순서까지 고정해 재발 방지).

**범위**: Display 모듈 전용, 🛑 실거래 배선 게이트와 완전히 무관. 이 PC의 실제 설치본
(`%APPDATA%\claude-code\skills\...`)은 이번 세션에서 건드리지 않았다 — 다음
`claudetower setup` 재실행 시 정상 내용(신규 6종 위젯 설명 포함, 배포본은 구버전 5종
문구로 낡아 있던 것도 확인)으로 자동 갱신된다.

### ② `active_account` 상태표시줄 위젯 신설 (2026-08-21 계획 그대로 구현)

**배경**: 위 계획 섹션이 이미 근거를 전부 남겨뒀다 — M59(`accounts switch`)로
`ActiveAccountHandle`을 실제로 쓰는 코드 경로가 처음 생겨 차단 조건이 해소됐고, 다른 후보는
전부 ToS/🛑게이트/환경 부재로 막혀 있어 이 위젯이 AI가 자체적으로 진행 가능한 유일한 항목이었다.

**만든 것**:
- [x] `src/display/widgets/active-account.js`(신규) — `src/shared/active-account-handle/
  read.js`(Display↔Account 유일한 연결점, 02_DATA_MODEL.md 모듈 경계 규칙)를 통해서만
  핸들을 읽는다. 핸들 없음(Account 미사용, 절대다수)·라벨 공백·JSON 손상 전부 크래시 없이
  `null`(비표시)로 안전하게 폴백. `👤 ` 접두어 + `truncateForDisplay`(model.js와 동일 정책).
- [x] `widget-config.js`의 `ALL_WIDGET_TYPES`, `setup-wizard.js`의 `WIDGET_LABELS`,
  `statusline.js`의 `WIDGETS`·`WIDGET_DROP_PRIORITY` 4곳 전부 배선(계획이 명시한 "하나만
  고치고 끝냈다고 착각하지 말 것" 체크리스트 그대로 이행). `WIDGET_DROP_PRIORITY`는 git보다도
  먼저 빠지도록 맨 앞에 둠(계획의 권고 그대로 채택).
- [x] **설계 결정(계획에 없던 것, 이번 세션이 직접 발견·판단)**: `setup-wizard.js`의 대화형
  Y/n 질문 목록(`PROMPTED_WIDGET_TYPES`)에서 `active_account`를 의도적으로 제외했다 —
  Account 모듈은 `accounts enable`이라는 완전히 별개의 opt-in·동의 절차를 이미 갖고 있는데,
  Display 설치 시점에 "활성 계정 표시할까요?"라고 물으면 절대다수인 Display 전용 사용자에게
  아직 알지도 못하는 기능을 낯설게 소개하는 셈이 된다(`01_PRD.md`의 "①Display=즉시 안전,
  ②Account=별도 opt-in" 두 단계 분리 원칙과 직결). 대신 `enabled_widgets`에는 항상 조용히
  포함시켜 저장한다 — 렌더가 핸들 부재 시 항상 `null`이므로 기본으로 켜둬도 안전하고, Account를
  실제로 쓰기 시작하면(`accounts switch`) 별도 설정 변경 없이 자동으로 나타난다. "설정 완료"
  로그에도 물어본 적 없는 이 항목은 표시하지 않는다.
- [x] `.PRD/02_DATA_MODEL.md`("미구현" 각주)·`.PRD/03_PHASES.md`(115행 체크박스 + Phase
  로드맵 요약 표)를 완료로 정정. README.md/README.en.md에 위젯 설명 문단 1곳 + `status` 예시
  출력 1곳씩 반영(비개발자 대상 표현 유지, "Display는 계정 정보를 다루지 않는다"는 기존 문구와
  모순되지 않도록 "Account가 이미 쓴 값을 읽기만 한다"는 취지로 서술).

**실제로 코드 작성 중 테스트로 잡아낸 버그 2건(정직하게 기록, "짰다"≠"맞다")**:
1. `setup-wizard.js`에서 `let displayEnabled = enabled;`가 배열을 복사하지 않고 같은 참조를
   가리켜, 이후 `enabled.push('active_account')`가 `displayEnabled`도 함께 오염시켰다 — "설정
   완료" 로그에 물어본 적 없는 "활성 계정"이 그대로 노출되는 결함. 테스트로 즉시 발견(`/활성
   계정/` 매치), `[...enabled]` 얕은 복사로 수정 후 재검증 통과.
2. `active-account.test.js`의 80자 절단 테스트가 접두어 길이를 `2`(글자 수)로 하드코딩했다가
   실패(`83 !== 82`) — 👤(U+1F464)가 BMP 밖 문자라 JS 문자열 `.length`가 서로게이트 쌍(2)으로
   세어 실제 접두어 길이는 3이었다(model.js/location.js/git.js의 이모지 접두어도 전부 같은
   함정). `'👤 '.length`로 동적 계산하도록 테스트를 고쳐 재검증 통과.

**검증(전부 직접 실행, 자기선언 아님)**:
- `npm run verify`(lint+lint:boundary+test:display): **259/259**(기존 245 + 신규 14 — 위
  버그 2건을 잡아 수정한 뒤 최종 통과), `lint:boundary`: `src/display/` **24개 파일**(신규
  1개 포함) 전부 모듈 경계 준수(PASS 문구까지 직접 확인).
- `npm run test:accounts`: **309/309**(M61 이후 무변화, Account 모듈 완전 무관 확인).
- **실제 CLI 엔드투엔드 스모크**(단위테스트 아님, 격리 경로 — `CLAUDETOWER_*` 환경변수로 완전
  격리, 이 PC의 실제 설치는 전혀 접촉 안 함):
  1. `node bin/claudetower.js setup`에 6개 답변(`y y y y y y`)만 파이프 — **정확히 6개
     질문만** 나옴(active_account 질문 없음, 계획대로 배선됐는지 실측 확인) → "설정 완료"
     로그에 "활성 계정" 미노출 확인 → `config.json`엔 `active_account`가 조용히 포함됨 확인.
  2. `node bin/claudetower.js statusline` — 핸들 파일 없을 때: `Sonnet 5  📁 my-project`
     (👤 없음) → 핸들 파일(`{"account_label":"업무용",...}`) 생성 후 재실행: `Sonnet 5
     📁 my-project  👤 업무용` — 위젯이 실제 CLI 경로로 정확히 나타남·사라짐을 직접 확인.
- 위 스모크 도중 PowerShell `Set-Content -Encoding utf8`이 UTF-8 BOM을 추가해(Windows
  PowerShell 5.1 고유 동작, `[239,187,191]` 바이트로 직접 확인) `readRawConfig()`의
  `JSON.parse`가 조용히 실패 → 기본값(ALL_WIDGET_TYPES)로 폴백하는 현상을 먼저 겪었다 —
  **ClaudeTower 코드 결함이 아니라 이번 스모크 스크립트 자체의 문제**임을 바이트 직접 대조로
  확인 후, `node`로 직접 파일을 쓰는 방식(실제 `writeEnabledWidgets`와 동일하게 BOM 없는
  UTF-8)으로 재검증해 위 결과를 얻었다(과잉 결함 보고 방지, 원인 오귀속 없이 정정한 과정
  그대로 기록).

**의도적으로 하지 않은 것**:
- README.html/README.en.html 재생성 — M61이 이미 "범위 밖, 수동 pandoc 필요"로 남겨둔 기존
  격차이고, 이번 위젯은 절대다수 사용자에게 비표시라 실사용 임팩트가 낮다고 판단해 이번
  라운드에서는 .md 2개만 갱신했다. **.html 2개는 이제 .md보다 한 걸음 더 뒤처졌다** — 다음에
  README를 다시 손댈 때 반드시 함께 재생성할 것(M61과 동일한 pandoc 파이프라인 사용).
- 이 PC의 실제 설치된 스킬 파일(`%APPDATA%\claude-code\skills\claudetower-widgets\SKILL.md`)
  직접 수정 — 소스만 고쳤다. 사용자가 다음에 `claudetower setup`을 실행하면 자동 갱신된다.
- Powerline 색상 테마·Git/PR 위젯(Phase 3 나머지 항목) — 이번 라운드 범위 밖, 새 기능이라
  별도 판단 필요.

**남은 위험**: 없음(신규, 위 2건은 발견 즉시 수정·재검증 완료). README.html/README.en.html이
.md 대비 뒤처진 상태로 남는다는 것만 다음 세션이 알아야 할 부채로 명시.

- 상태: **완료** — `src/display/widgets/active-account.js`(신규), `src/display/config/
  skill-file.js`(수정), `src/display/config/widget-config.js`(수정), `src/display/
  statusline.js`(수정), `src/display/setup-wizard.js`(수정), `test/display/active-account.test.js`
  (신규), `test/display/skill-file.test.js`·`statusline.test.js`·`setup-wizard.test.js`·
  `widgets-command.test.js`(수정), `.PRD/02_DATA_MODEL.md`·`.PRD/03_PHASES.md`·`README.md`·
  `README.en.md`·`CHECKPOINT.md` 변경. 로컬 커밋만(push는 사용자가 이후 결정).
