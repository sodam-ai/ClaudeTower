'use strict';

// 계정 전환 여부·전환 대상을 결정하는 순수 로직(입출력 전부 인자/반환값, 파일 I/O·네트워크
// 없음). 실제 프록시 요청 처리(src/accounts/proxy/server.js)에는 아직 연결하지 않는다 —
// 결정 로직 자체를 먼저 독립적으로 검증하기 위함이며, 실거래 트래픽 배선은 별도의
// 라이브 검증 세션(사용자 승인 필요, 실제 API 요청·비용 발생)으로 미룬다(2026-08-19).
//
// 전략 정의 출처(추측 아님): .PRD/.archive/QuotaSwitch원본/04_PROJECT_SPEC.md 67행
// "claude-swap이 실제로 제공하는 전환 전략(best=할당량 가장 많이 남은 계정 우선,
// next-available=rate-limit 안 걸린 계정으로 즉시 스킵) — 실측 확인된 패턴".
//
// shouldSwitch=true일 때의 reason은 항상 정확히 'quota_threshold' 문자열이다 —
// rotation-event.js의 REASONS 화이트리스트와 그대로 맞물려 호출부가 그 결과를 그대로
// createRotationEvent()에 넘길 수 있게 하기 위함(reason 값을 여기서 임의로 바꾸면 안 됨).

const { bindingUsedPct } = require('./api-key-quota-reading');

// 사용률 정보가 없는 계정(quotaByAccountId에 없거나 null)은 "한 번도 안 써서 0%"로
// 취급한다 — 막 등록한 계정을 후순위로 미루면 자동 전환의 취지에 어긋난다.
function candidatePct(account, quotaByAccountId) {
  return bindingUsedPct(quotaByAccountId[account.account_id] ?? null) ?? 0;
}

function pickBest(candidates, quotaByAccountId) {
  let winner = null;
  let winnerPct = Infinity;
  for (const account of candidates) {
    const pct = candidatePct(account, quotaByAccountId);
    if (pct < winnerPct) {
      winner = account;
      winnerPct = pct;
    }
  }
  return winner;
}

function pickNextAvailable(candidates, quotaByAccountId, thresholdPct) {
  for (const account of candidates) {
    if (candidatePct(account, quotaByAccountId) < thresholdPct) return account;
  }
  return null;
}

// currentAccountId: 지금 쓰고 있는 계정의 account_id.
// currentQuotaReading: parseApiKeyQuotaHeaders()의 반환값(또는 아직 모르면 null).
// allAccounts: accounts-registry.readRegistry()의 반환값 그대로.
// quotaByAccountId: { [account_id]: reading|null } — 후보 계정들의 최근 알려진 사용률.
// policy: switch-policy-config.readSwitchPolicy()의 반환값(threshold_pct, strategy 포함).
function evaluateSwitchDecision({ currentAccountId, currentQuotaReading, allAccounts, quotaByAccountId = {}, policy }) {
  const usedPct = bindingUsedPct(currentQuotaReading);
  if (usedPct === null) {
    return { shouldSwitch: false, reason: 'no_quota_data', toAccountId: null };
  }
  if (usedPct < policy.threshold_pct) {
    return { shouldSwitch: false, reason: 'below_threshold', toAccountId: null };
  }

  const candidates = allAccounts.filter(
    (a) => a.account_id !== currentAccountId && a.auth_type === 'api_key' && a.status === 'active'
  );
  if (candidates.length === 0) {
    return { shouldSwitch: false, reason: 'no_candidates', toAccountId: null };
  }

  const target =
    policy.strategy === 'next-available'
      ? pickNextAvailable(candidates, quotaByAccountId, policy.threshold_pct)
      : pickBest(candidates, quotaByAccountId);

  if (!target) {
    return { shouldSwitch: false, reason: 'no_candidates_below_threshold', toAccountId: null };
  }

  return { shouldSwitch: true, reason: 'quota_threshold', toAccountId: target.account_id };
}

module.exports = { evaluateSwitchDecision };
