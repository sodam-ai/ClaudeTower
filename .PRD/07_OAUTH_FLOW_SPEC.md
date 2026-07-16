# ClaudeTower — Account 모듈 OAuth 흐름 명세 (준비 문서, 2026-07-12 → 2026-07-15 결론: 보류 확정)

> **[2026-07-15] 결론 먼저 요약**: 이 문서의 조사 결과(§3) Anthropic이 서드파티 도구의 구독제
> OAuth 사용을 명시적으로 금지하고 기술적으로 차단 중임을 확인했다. Account 모듈은 보류
> 확정됐다 — 아래 내용은 "왜 안 만들기로 했는지"의 조사 기록이다. §4 "결론 및 권고" 참고.

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
