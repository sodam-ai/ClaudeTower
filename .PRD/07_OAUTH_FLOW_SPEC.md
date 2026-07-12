# ClaudeTower — Account 모듈 OAuth 흐름 명세 (준비 문서, 2026-07-12)

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

## 3. 미확인 — 실제 구현 전 반드시 조사 필요 [미확인]

이 항목들은 **추측하지 않고 명시적으로 비워둔다.** 게이트 해제 후 실제 구현에 들어가기
직전, 가장 먼저 조사해야 할 목록이다.

- [ ] **정확한 OAuth 엔드포인트(authorize/token URL)** — 04_PROJECT_SPEC.md·아카이브
  어디에도 구체적인 URL이 없다. Claude Code CLI 자체가 어떤 OAuth 클라이언트로 로그인하는지
  역공학하거나, Anthropic 공식 문서·teamclaude/claude-swap 등 리서치된 경쟁 도구의 실제
  구현을 다시 확인해야 한다.
- [ ] **서드파티 OAuth 클라이언트 등록 정책** — 04_PROJECT_SPEC.md 183행에 이미
  "[법무 검토 필요]"로 명시된 미해결 항목. Anthropic이 ClaudeTower 같은 서드파티 도구의
  OAuth 클라이언트 등록을 허용하는지 자체가 확인되지 않았다.
- [ ] **콜백 수신 방식** — 로컬 HTTP 리스너(포트 하나 더 필요)로 받을지, 프록시 서버
  (`src/accounts/proxy/server.js`)가 겸할지 미정.
- [ ] **리프레시 토큰 갱신 주기·실패 시 재시도 정책** — "자동 갱신"이라고만 결정돼 있고
  구체적인 갱신 임계값(만료 몇 분 전)·실패 시 사용자 알림 방식은 미정.

---

## 4. 다음 단계

게이트 해제(2026-07-14 이후) 시, 이 문서의 "3. 미확인" 항목부터 조사해 해소한 뒤에만
`src/accounts/proxy/server.js`와 신규 OAuth 모듈의 실제 구현에 들어갈 것을 권장한다 —
순서를 바꿔 먼저 코드를 쓰면, 04_PROJECT_SPEC.md가 이미 여러 번 경험한 "원본 스펙을
나중에 재확인해서 다시 고치는" 패턴(예: ProxyConfig 검증 범위 정정, 2026-07-11)이
반복될 위험이 있다.
