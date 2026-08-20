# ClaudeTower — Account 모듈 OAuth 흐름 명세 (2026-07-12 준비 → 2026-07-15 보류 → 2026-07-27 재개)

> **[2026-07-15] 결론 먼저 요약**: 이 문서의 조사 결과(§3) Anthropic이 서드파티 도구의 구독제
> OAuth 사용을 명시적으로 금지하고 기술적으로 차단 중임을 확인했다. Account 모듈은 보류
> 확정됐다 — 아래 내용은 "왜 안 만들기로 했는지"의 조사 기록이다. §4 "결론 및 권고" 참고.

> **[2026-07-27] 재개**: §3의 조사 결과(법적 사실)는 **그대로 유효** — 한 글자도 바뀌지
> 않았다. 사용자가 GitHub `jung-wan-kim/teamclaude`(OAuth 구독계정 다중전환이 실제로 작동하는
> 공개 도구) 실측 분석을 근거로 재개를 요청했고, §3-3("하이브리드도 동일하게 걸림")까지 다시
> 명시적으로 고지한 뒤 사용자가 위험을 인지·수용하고 하이브리드(OAuth 주력+API키 보조)로
> 진행하기로 최종 확정했다(CHECKPOINT.md 트랙3 참고). **이번 갱신은 문서뿐이다** — 실제
> OAuth 로그인·프록시·keyring 연동 코드는 다음 세션. 상세는 §5.

> **이 문서의 성격**: M6 게이트(2026-07-14 종료 예정) 준수 중 작성된 "준비" 문서다.
> 코드를 만들지 않고, 이미 04_PROJECT_SPEC.md·02_DATA_MODEL.md·.archive/QuotaSwitch원본에
> 흩어져 있던 OAuth 관련 결정을 한 곳에 모으고, 실제 구현 전 반드시 확인해야 할
> 미해결 항목을 명시적으로 남긴다. **추측으로 채운 항목은 없다 — 근거 없는 내용은
> "[미확인]"으로 남겨둔다.**

---

## 1. 이미 확정된 것 (근거: 04_PROJECT_SPEC.md, DO NOT 목록)

| 항목 | 결정 | 근거 |
|---|---|---|
| 로그인 방식 | Anthropic 공식 OAuth 흐름만 사용, 자체 로그인 시스템 금지 | 04_PROJECT_SPEC.md 71행, DO NOT 없음(경쟁 도구 QuotaSwitch원본 계승) |
| CSRF 방어 | `state` 파라미터를 암호학적으로 안전한 난수로 생성, 콜백에서 검증 없이는 토큰 교환 진행 금지 | 04_PROJECT_SPEC.md 71행, "절대 하지 마" 163행 |
| 토큰 저장 위치 | OS 자격증명 저장소(`@napi-rs/keyring`)만 사용, 평문 파일·로그·환경변수 절대 금지 | 04_PROJECT_SPEC.md 83행, "절대 하지 마" 161행 |
| 토큰 만료 처리 | 만료 시각을 QuotaState/CredentialRef와 함께 저장, 만료 임박 시 자동 갱신 | QuotaSwitch원본 04_PROJECT_SPEC.md 146행 |
| 난수 생성 | `crypto.randomBytes`/`crypto.randomUUID` 필수, `Math.random()` 절대 금지 | CHECKPOINT.md 트랙3 항목6 (2026-07-11 보안 점검) |
| 실패 시 동작 | 만료된 토큰으로 계속 요청을 시도해 계정이 잠기는 것을 방지 | QuotaSwitch원본 04_PROJECT_SPEC.md 146행 |

---

## 2. 흐름 단계 (개념 수준 — 정확한 엔드포인트는 3번 참고)

1. 사용자가 `claudetower accounts enable`을 처음 실행하면 08_ACCOUNTS_ENABLE_CONSENT_DRAFT.md의
   동의 고지를 먼저 보여주고, 명시적 동의(`y` 입력 등) 없이는 다음 단계로 진행하지 않는다.
2. 동의 후 `claudetower accounts add`(또는 유사 명령)로 OAuth 로그인을 시작한다.
3. CLI가 로컬에서 `state`(암호학적 난수)를 생성해 보관하고, 브라우저를 열어 Anthropic
   로그인 페이지로 사용자를 보낸다.
4. 사용자가 브라우저에서 로그인·동의를 마치면 콜백 URL로 authorization code가 돌아온다.
5. CLI(또는 로컬 콜백 리스너)가 이 code를 받아 `state`가 3번에서 만든 값과 정확히 일치하는지
   검증한다 — **일치하지 않으면 즉시 중단, 토큰 교환 진행하지 않음**.
6. 검증 통과 시에만 code를 access token/refresh token으로 교환한다.
7. 교환된 토큰을 OS 자격증명 저장소(`@napi-rs/keyring`)에 저장하고, 평문으로는 어디에도
   남기지 않는다.
8. `RotationEvent`에 계정 추가 사실을 기록한다(감사 로그, `src/accounts/audit/`).

---

## 3. 미확인 항목 조사 결과 (2026-07-14, M6 게이트 종료일 조사)

### 3-1. 서드파티 OAuth 클라이언트 등록 정책 — **[확인됨: 명시적으로 금지, 이 프로젝트를 사실상 중단시키는 결과]**

**1차 출처 직접 확인**(`code.claude.com/docs/en/legal-and-compliance`, "Authentication and
credential use" 절, WebFetch로 원문 직접 확인 — 요약·2차 가공 아님):

> "OAuth authentication is intended exclusively for purchasers of Claude Free, Pro, Max,
> Team, and Enterprise subscription plans and is designed to support ordinary use of
> Claude Code and other native Anthropic applications."
>
> "Anthropic does not permit third-party developers to offer Claude.ai login or to route
> requests through Free, Pro, or Max plan credentials on behalf of their users."
>
> "Anthropic reserves the right to take measures to enforce these restrictions and may
> do so without prior notice."

**추가 확인(복수 독립 뉴스 소스 교차검증 — KERSAI, The Register, GIGAZINE, WinBuzzer,
aihackers.net, Apiyi.com, 총 6개 이상 독립 출처가 동일 사실을 일관되게 보도)**:
- OAuth 클라이언트 ID는 Claude Code 전용으로 하드코딩되어 있고, 서드파티가 새 클라이언트를
  등록할 방법 자체가 제공되지 않는다.
- **2026-01-09부터 서버 측에서 서드파티 도구의 Pro/Max 구독 OAuth 토큰 사용을 기술적으로
  차단하는 조치가 이미 시행 중**이다(정책 문서화 이전에 이미 기술적으로 막혀 있었다는 뜻).
- 2026-02월 "Legal and compliance" 문서에 이 제한이 명문화됐고, 2026-04-04에 OpenClaw·
  OpenCode·NanoClaw 등 비교 가능한 서드파티 도구(Claude 구독 OAuth 토큰으로 여러 도구를
  넘나드는 "harness" 패턴)에 대해 전면 시행됐다 — **ClaudeTower Account 모듈이 하려던 것과
  본질적으로 동일한 패턴**(OAuth 토큰을 발급받은 도구가 아닌 별도 CLI가 그 토큰으로 요청을
  대신 처리)이다.

**이 프로젝트에 대한 의미(추측이 아니라 위 원문에서 직접 도출)**:
- 금지 문구("in any other product, tool, or service")에 "본인 소유 계정을 본인이 만든
  개인용 도구에서 쓰는 경우"에 대한 예외가 없다 — 01_PRD.md §6이 이미 "팀/조직 공유 풀은
  범위 밖, 개인이 혼자 쓰는 여러 계정 시나리오로 한정"이라고 스스로 범위를 좁혀뒀지만, 이
  좁힌 범위조차 위 금지 문구를 피해가지 못한다. `claudetower`는 정확히 "Free/Pro/Max 자격
  증명으로 요청을 대신 라우팅하는, Claude Code·Claude.ai가 아닌 별도의 tool"이다.
- **기술적으로도 막혀 있다**: 서버 측 차단이 2026-01-09부터 시행 중이므로, `state` CSRF
  검증부터 토큰 교환까지 이 문서 2절의 흐름을 전부 올바르게 구현하더라도, 실제 API 요청
  단계에서 Anthropic 서버가 "Claude Code/Claude.ai가 아닌 곳에서 온 요청"으로 판별해
  거부할 가능성이 높다 — 이는 이제 "ToS 위반으로 계정이 정지될 수도 있다"는 확률적 위험을
  넘어, "애초에 작동하지 않을 수 있다"는 기능적 문제로 격상된다.
- Anthropic이 명시한 대안("Developers... should use API key authentication through Claude
  Console")은 **QuotaSwitch 원 설계의 핵심 전제(session 5h/weekly 7d 구독 quota 소진 시
  다음 계정으로 전환)와 근본적으로 다른 과금 모델**이다 — API 키는 종량제라 "5시간/7일
  quota"라는 개념 자체가 없다. 즉 "OAuth 대신 API 키를 쓰면 된다"는 단순 치환으로 해결되지
  않고, Account 모듈이 풀려던 원래 문제(구독제 quota 자동전환) 자체가 이 대안 위에서는
  성립하지 않는다.

### 3-2. 나머지 미확인 항목 (참고용으로 조사는 했으나, 3-1 결론으로 우선순위 낮아짐)

- **OAuth 엔드포인트**: `console.anthropic.com/oauth/authorize`가 authorize 엔드포인트로
  공개 문서·복수 독립 소스에서 확인됨(PKCE 사용). 단, 3-1 결론상 이 엔드포인트를 실제로
  호출하는 구현 자체를 진행할 근거가 사라짐 — 기록만 남기고 실제 사용은 보류.
- **콜백 수신 방식**: 로컬 리다이렉트(localhost) 방식이 표준 패턴으로 확인됨. 마찬가지로
  3-1 결론상 실제 구현 근거 없음.
- **리프레시 갱신 정책**: 공개 자료에서 구체적 임계값을 확인하지 못함 — 3-1로 인해 더 이상
  조사 우선순위 아님.

---

### 3-3. 추가 확인(2026-07-15, 사용자 질문 "완전히 안전한 우회 방법은 없는가"에 답하기 위한 후속 조사)

**질문**: OAuth 토큰을 ClaudeTower가 직접 다루지 않고, Claude Code 자체의 공식 로그인만 쓰게 한
뒤 ClaudeTower는 `CLAUDE_CONFIG_DIR`(계정별 설정 디렉토리)만 자동으로 바꿔주는 설계라면
3-1의 금지를 피할 수 있는가?

**결과: 아니오 — 별도의 독립된 조항이 이 우회도 막는다.** Consumer Terms of Service
(`anthropic.com/legal/consumer-terms`, 1차 출처 직접 확인)에 아래 조항이 있다:

> "Except when you are accessing our Services via an Anthropic API Key or where we
> otherwise explicitly permit it, [you may not] access the Services through automated
> or non-human means, whether through a bot, script, or otherwise."

이 조항은 3-1의 "OAuth 토큰을 다른 도구가 다루는 것" 금지와 **별개**로, "**API 키가 아닌
방식(=구독제 OAuth)으로 서비스에 자동화·스크립트로 접근하는 행위 자체**"를 금지한다. 즉
ClaudeTower가 OAuth 토큰을 직접 커스터디하지 않고 Claude Code의 공식 로그인만 이용하더라도,
"할당량을 감지해 자동으로 계정을 전환한다"는 행위 자체가 이 조항에 해당한다 — 엔지니어링으로
피해갈 수 있는 종류의 문제가 아니다. (참고로 "계정 로그인 정보를 다른 사람과 공유 금지" 조항도
별도로 존재하지만, 이건 사용자 본인 소유의 복수 계정 시나리오와는 직접 관련이 낮다.)

**따라서**: "구독제(Free/Pro/Max) quota를 자동으로 전환한다"는 원래 목적을 유지하면서 동시에
100% 안전한 엔지니어링적 우회는 **존재하지 않는다** — 확인된 두 개의 독립된 조항(3-1의 OAuth
조항, 3-3의 자동화 접근 조항)이 서로 다른 각도에서 같은 결론을 가리킨다. 자동화를 유지하면서
완전히 안전해지는 유일한 길은 "API 키 기반으로 전환"(4절 대안 (2))뿐이다 — 이 조항이 API 키
접근을 명시적으로 예외로 허용하기 때문("Except when you are accessing our Services via an
Anthropic API Key"). 수동 전환(사용자가 매번 직접 계정을 바꿔 로그인)은 자동화가 아니므로 이
조항 자체에는 안 걸리지만, 그러면 "자동 전환"이라는 제품의 핵심 가치가 사라진다.

---

## 4. 결론 및 권고 (2026-07-14, 2026-07-15 보강)

**이 문서가 원래 의도했던 "게이트 해제 후 구현 착수를 위한 사전 조사"라는 목적은 달성하지
못했다** — 조사 결과가 "구현해도 좋다"가 아니라 "이 설계로는 구현 근거가 없다"로 나왔기
때문이다. 04_PROJECT_SPEC.md 183행·01_PRD.md §7이 "[법무 검토 필요]"로 남겨뒀던 항목은
이제 **[확인됨: 충돌]**로 닫혔다.

**권고(AI 단독 결정 아님 — 사용자 확인 필요, 아래 질문 참고)**: 04_PROJECT_SPEC.md의
"절대 하지 마" 목록에 준하는 무게의 새로운 제약으로 취급해, Account 모듈을 현재 명세
(OAuth 기반 구독 quota 자동전환) 그대로 구현하는 것은 **권장하지 않는다.** 대안은 (1) Phase 2
전체를 보류/취소하고 ClaudeTower를 Display 전용 도구로 유지, (2) API 키 기반의 근본적으로
다른 설계로 Account 모듈을 처음부터 재정의(별도 PRD 재작업 필요, "quota 자동전환"이 아닌
"API 키 로테이션"이라는 다른 제품이 됨), (3) 사용자가 위 위험을 전부 이해한 상태에서 그대로
진행(ToS 위반 명시적 감수) — 셋 중 하나를 사용자가 결정해야 한다.

→ **2026-07-27**: 사용자가 (3) 위험 감수·하이브리드 진행을 최종 선택했다. 상세는 §5.

---

## 5. 재개 결정 및 teamclaude 아키텍처 반영 (2026-07-27)

### 5-1. 재개 결정 요약

사용자가 이번 세션에서 GitHub `jung-wan-kim/teamclaude`(생성 2026-06-11, §3-1이 인용한
2026-01-09 기술적 차단 이후 생성됐음에도 6주 이상 계속 작동 중인 OAuth 구독계정 다중전환
도구)를 근거로 재개를 요청했다. 실제 소스코드(`src/oauth.js` 등)를 직접 분석한 결과, 이
도구는 Claude Code와 동일한 OAuth client_id·엔드포인트를 재사용해 구독 로그인 세션을
전환하는 방식이며, README·문서 어디에도 ToS 리스크 고지가 없음을 확인했다.

재개 전 §3-3("OAuth 토큰을 직접 다루지 않는 위장 설계도, API 키 병행 지원 여부와 무관하게
'할당량 감지 후 자동전환' 행위 자체가 금지 대상")을 다시 명시적으로 고지했고, 사용자가
이 구체적 조항까지 확인한 뒤에도 **하이브리드(OAuth 주력+API키 보조)로 진행하기로 2회
확인 후 최종 확정**했다.

**재검토 조건: 없음** — 이 재개 결정은 닫힌 것으로 취급한다. 다시 보류하려면 사용자가
명시적으로 재론해야 한다(대칭 원칙: 2026-07-15 보류 결정도 "API 키 완전 재설계 요청 시만"
재론하도록 못박혔었다).

> **2026-08-20 구분(중요)**: 이 §5-1의 "재개 확정"은 하이브리드(OAuth 보류+API키) 설계
> *원칙*에 대한 승인이지, "지금 이 순간 실제 트래픽에 배선해도 된다"는 승인과는 별개다.
> `active-account-provider`가 배선 직전까지 완성된 시점(`CHECKPOINT.md` 최상단
> "🛑 실거래 배선 승인 게이트" 참고)부터, 실제 배선 실행은 이 §5-1 승인과 무관하게
> 사용자의 **별도의 명시적** 확인이 있어야만 진행한다 — `test/accounts/
> live-wiring-gate.test.js`가 이를 기계적으로 강제한다.

> **2026-08-20 추가 구분(§5-1 "OAuth 주력" vs 실제 구현 범위)**: 이 §5-1은 "어떤 계정
> 유형을 주로 쓸 것인가"에 대한 하이브리드 비전(OAuth 주력+API키 보조)이고, 이후 M41
> (`CHECKPOINT.md` 2026-08-20)에서 실제로 만든 **자동전환 로직 자체는 API 키 계정으로만
> 범위를 한정**했다(OAuth/구독 계정의 `anthropic-ratelimit-unified-*` 헤더는 이 판단 로직이
> 다루지 않음 — 자세한 이유는 `CHECKPOINT.md` M41 참고). 두 결정은 서로 다른 질문에 대한
> 답이라 모순은 아니다 — OAuth 계정은 (`--import`가 만들어지면) 여전히 등록·수동 사용은
> 가능하지만, **자동 전환 대상에서는 제외**된다는 뜻이다. 이 구분이 문서 두 곳에 따로
> 적혀 있어 다음 세션이 "하이브리드=OAuth도 자동전환된다"고 오해하지 않도록 여기 명시해둔다.

**바뀌지 않는 것**:
- §3-1·§3-3의 법적 사실 자체(Anthropic 이용약관 두 독립 조항)는 여전히 유효
- teamclaude가 지금 작동한다는 사실이 "정책 위반이 안전하다"는 증거는 아니다 — 정책 위반은
  기술적 차단 여부와 무관하게 사후에도 언제든 집행될 수 있음
- 이번 세션 범위는 문서 갱신뿐 — 실제 OAuth 로그인·로컬 프록시·keyring 연동·CLI 라우팅
  코드는 `src/accounts/`의 기존 throw-스텁 그대로, 다음 세션(구현 세션)에서 진행

### 5-2. credential import 흐름 (teamclaude 벤치마킹)

teamclaude는 브라우저 재로그인 없이 기존 Claude Code 로그인을 재사용하는 옵션을 제공한다
(`importCredentials()`가 `~/.claude/.credentials.json`의 `claudeAiOauth` 필드를 그대로
읽음). ClaudeTower도 `claudetower accounts add --import`(가칭)로 동일 옵션을 §2 흐름에
분기 추가하는 것을 권장한다 — §2의 3~6단계(브라우저 로그인)를 생략하고 기존 자격증명
파일을 바로 가져오는 경로.

**반드시 명시할 경고**: 이 경로도 §3-1·§3-3 금지 대상과 완전히 동일하다 — "재로그인 생략"은
사용자 편의일 뿐 법적 리스크를 조금도 줄이지 않는다. 08_ACCOUNTS_ENABLE_CONSENT_DRAFT.md의
동의 고지는 `--import` 경로에도 동일하게 적용돼야 한다.

**[NEEDS CLARIFICATION]**: `~/.claude/.credentials.json` 경로·필드 형식이 Windows 환경에서
teamclaude 문서와 동일한지 미실측 — 구현 세션에서 반드시 직접 확인할 것(추측 금지 원칙).

### 5-3. 라우팅 스키마 확정

`src/accounts/accounts/account.js`에 `AUTH_TYPES=['oauth','api_key']`가 이미 구현돼 있어
**스키마 변경이 불필요**하다. teamclaude 실측 근거: 로컬 프록시는 `ANTHROPIC_BASE_URL`만
활성 계정의 값으로 스왑하고 `ANTHROPIC_API_KEY`는 건드리지 않아 Claude Code를 "구독 모드"로
유지한다. 구현 세션에서는 이 분기만 추가하면 된다 — `auth_type: 'oauth'`인 계정은
`ANTHROPIC_BASE_URL`만 스왑(OAuth 토큰은 프록시가 업스트림 요청에 `Authorization: Bearer`
헤더로 첨부), `auth_type: 'api_key'`인 계정은 `ANTHROPIC_API_KEY`를 스왑.

### 5-4. quota 헤더 파싱 방식 비교

| | 기존 QuotaSwitch 설계 | teamclaude 실측 |
|---|---|---|
| 방식 | `QuotaState`를 별도 폴링(`reeval_interval_ms`, 기본 300000ms)으로 갱신 | 매 API 응답의 `anthropic-ratelimit-unified-5h/7d-*` 헤더를 실시간 파싱 |
| 429 처리 | 명세 없음(폴링 갭 사이 감지 못할 수 있음) | 응답 헤더로 즉시 분류·failover |

**결론**: `QuotaState` 스키마(`five_hour_used_pct`/`seven_day_used_pct` 등) 자체는 두 방식과
호환된다 — 값을 어디서 채우는지(폴링 API 호출 vs 응답 헤더 파싱)만 다르다. 구현 세션에는
헤더 파싱 방식 채택을 권장(불필요한 API 호출 제거, 항상 최신 상태 반영). `reeval_interval_ms`는
헤더가 없는 폴백/헬스체크 용도로 유지할지 구현 세션에서 재검토.

**정확한 헤더 필드명 확정 (2026-08-17, CHECKPOINT M31 조사)**: 출처는 이 문서가 이미 §5-1~5-3에서
인용한 것과 동일한 1차 소스 `github.com/jung-wan-kim/teamclaude`(`src/account-manager.js`의
`updateQuota()`, `src/server.js`의 `anthropic-ratelimit-` 헤더 수집부) — GitHub API로 원문을
직접 확인, 코드는 복사하지 않고 필드명(사실 정보)만 기록:

구독(Unified/Claude Max) 계정:
- `anthropic-ratelimit-unified-5h-utilization` (0~1 실수), `anthropic-ratelimit-unified-5h-reset` (Unix epoch 초)
- `anthropic-ratelimit-unified-7d-utilization`, `anthropic-ratelimit-unified-7d-reset`
- `anthropic-ratelimit-unified-status` (예: `rejected` — quota 소진으로 거부된 429인지 판별하는 용도)
- 모델별 주간 윈도우(최상위 모델 티어에만 존재): `anthropic-ratelimit-unified-7d_<label>-utilization` /
  `-reset` — `<label>`은 고정 목록이 아니라 정규식(`/^anthropic-ratelimit-unified-(7d_[a-z0-9_]+)-(utilization|reset)$/`)으로
  매칭해 이름이 바뀌거나 새로 추가돼도 그대로 수용하는 방식(teamclaude 원문 방식 그대로 채택 권장)

API 키 계정(표준 rate limit):
- `anthropic-ratelimit-tokens-limit`, `anthropic-ratelimit-tokens-remaining`, `anthropic-ratelimit-tokens-reset`
- `anthropic-ratelimit-requests-limit`, `anthropic-ratelimit-requests-remaining`, `anthropic-ratelimit-requests-reset`

**미검증 남은 부분**: 이 필드명들은 teamclaude의 실제 라이브 관측 결과이지만, ClaudeTower 자신의
실제 API 응답으로 직접 재현 검증한 적은 없다(credential-store가 열려 인증된 요청을 보낼 수 있어야
가능) — 구현 세션은 실제 응답 헤더로 필드명이 여전히 일치하는지 먼저 1회 확인할 것(추측 금지 원칙).
