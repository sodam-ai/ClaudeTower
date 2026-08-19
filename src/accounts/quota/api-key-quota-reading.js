'use strict';

// API 키 계정의 anthropic-ratelimit-tokens-*/anthropic-ratelimit-requests-* 응답 헤더를
// 정규화한 사용률로 바꾸는 순수 파서. 필드명 출처: .PRD/07_OAUTH_FLOW_SPEC.md §5-4
// (github.com/jung-wan-kim/teamclaude 실측, GitHub API 원문 직접 확인) — 다만 그 문서
// 스스로도 "ClaudeTower 자신의 실제 API 응답으로 아직 재현 검증되지 않았다"고 명시한다.
// CHECKPOINT.md 2026-07-28 결정("추측으로 만들면 안티패턴#1 위반, 틀린 헤더명으로 조용히
// 매칭 실패할 위험")에 따라 이 파서는 실패에 관대해야 한다 — 기대한 헤더가 없거나
// 형식이 다르면 예외를 던지지 않고 null을 반환한다("매칭 실패 = 조용히 no-op"이지
// "매칭 실패 = 크래시"가 아니어야 함). 실제 라이브 응답으로 필드명이 맞는지 확인하는
// 것은 여전히 사용자 승인이 필요한 별도 단계(실제 API 호출 = 비용·쿼터 소모)로 남긴다.
//
// OAuth/구독 계정 헤더(anthropic-ratelimit-unified-*)는 의도적으로 다루지 않는다 —
// 자동 전환 기능의 범위를 API 키 계정으로만 한정한다는 결정(2026-08-19)에 따름.

function toFiniteNumber(value) {
  if (value === undefined || value === null) return null;
  const raw = Array.isArray(value) ? value[0] : value;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function usedPct(limit, remaining) {
  if (limit === null || remaining === null || limit <= 0) return null;
  const clampedRemaining = Math.max(0, Math.min(remaining, limit));
  return ((limit - clampedRemaining) / limit) * 100;
}

// headers: Node http 응답 헤더 객체. Node는 기본적으로 키를 소문자로 넘기지만, 테스트
// 픽스처나 다른 HTTP 클라이언트가 대소문자를 섞어 넘길 가능성까지 방어적으로 처리한다.
function parseApiKeyQuotaHeaders(headers) {
  if (typeof headers !== 'object' || headers === null) return null;
  const lower = {};
  for (const [k, v] of Object.entries(headers)) {
    lower[k.toLowerCase()] = v;
  }

  const tokensUsedPct = usedPct(
    toFiniteNumber(lower['anthropic-ratelimit-tokens-limit']),
    toFiniteNumber(lower['anthropic-ratelimit-tokens-remaining'])
  );
  const requestsUsedPct = usedPct(
    toFiniteNumber(lower['anthropic-ratelimit-requests-limit']),
    toFiniteNumber(lower['anthropic-ratelimit-requests-remaining'])
  );

  if (tokensUsedPct === null && requestsUsedPct === null) return null; // 기대한 헤더가 전혀 없음

  return {
    tokens_used_pct: tokensUsedPct,
    requests_used_pct: requestsUsedPct,
    tokens_reset_at: lower['anthropic-ratelimit-tokens-reset'] ?? null,
    requests_reset_at: lower['anthropic-ratelimit-requests-reset'] ?? null,
  };
}

// 토큰·요청 수 중 더 급한(사용률이 높은) 쪽을 "이 계정의 현재 압박 수준"으로 취급한다 —
// 어느 한쪽이라도 소진되면 그 계정은 더 이상 쓸 수 없는 hard limit이기 때문(OR 조건).
function bindingUsedPct(reading) {
  if (reading === null || reading === undefined) return null;
  const values = [reading.tokens_used_pct, reading.requests_used_pct].filter((v) => v !== null);
  return values.length === 0 ? null : Math.max(...values);
}

module.exports = { parseApiKeyQuotaHeaders, bindingUsedPct };
