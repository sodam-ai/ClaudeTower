'use strict';

// 계정의 auth_type에 따라 Claude Code 실행 시 주입할 환경변수를 결정하는 순수 함수.
// .PRD/07_OAUTH_FLOW_SPEC.md §5-3(teamclaude 실측 반영) — 로컬 프록시는 항상
// ANTHROPIC_BASE_URL을 스왑하고, api_key 계정만 추가로 ANTHROPIC_API_KEY를 스왑한다.
// oauth 계정은 ANTHROPIC_API_KEY를 건드리지 않아 Claude Code를 "구독 모드"로 유지—
// OAuth 토큰 자체는 프록시가 업스트림 요청에 Authorization: Bearer 헤더로 첨부하며,
// 이 함수는 그 토큰 값을 다루지 않는다(환경변수에 OAuth 토큰을 쓰지 마 — DO NOT 규칙).
//
// 이 함수는 아직 어디서도 호출되지 않는다 — 실제 로컬 프록시 서버(src/accounts/proxy/
// server.js)는 여전히 throw-스텁이다. 로직만 먼저 정의·검증해두는 단계.

const { AUTH_TYPES } = require('../accounts/account');
const { FIXED_BIND_ADDRESS } = require('./proxy-config');

function resolveProxyEnv({ authType, proxyBaseUrl, apiKeyValue = null }) {
  if (!AUTH_TYPES.includes(authType)) {
    throw new TypeError(`authType must be one of: ${AUTH_TYPES.join(', ')}`);
  }
  if (typeof proxyBaseUrl !== 'string' || !proxyBaseUrl.startsWith(`http://${FIXED_BIND_ADDRESS}`)) {
    throw new TypeError(`proxyBaseUrl must start with http://${FIXED_BIND_ADDRESS} (0.0.0.0 금지, DO NOT 규칙)`);
  }

  if (authType === 'oauth') {
    return { ANTHROPIC_BASE_URL: proxyBaseUrl };
  }

  // api_key
  if (typeof apiKeyValue !== 'string' || apiKeyValue.length === 0) {
    throw new TypeError('apiKeyValue must be a non-empty string when authType is api_key');
  }
  return { ANTHROPIC_BASE_URL: proxyBaseUrl, ANTHROPIC_API_KEY: apiKeyValue };
}

module.exports = { resolveProxyEnv };
