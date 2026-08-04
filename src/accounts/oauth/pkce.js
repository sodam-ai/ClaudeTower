'use strict';

// PKCE(Proof Key for Code Exchange, RFC 7636) code_verifier/code_challenge 생성 —
// credential-store와 완전 무관한 순수 crypto 유틸. .PRD/07_OAUTH_FLOW_SPEC.md §3-2가 확인한
// OAuth 흐름(console.anthropic.com/oauth/authorize, PKCE 사용 확인됨)의 사전 준비 단계.
//
// code_verifier: RFC 7636 §4.1 — 43~128자, [A-Za-z0-9-._~] 문자만 허용. 32바이트 무작위값을
// base64url로 인코딩하면 43자(패딩 없음)로 요구사항을 정확히 충족한다.
// code_challenge: RFC 7636 §4.2 — S256 방식만 지원한다(plain 방식은 PKCE 보호 효과가 없는
// downgrade 옵션이라 의도적으로 만들지 않음).

const crypto = require('node:crypto');

function generateCodeVerifier() {
  return crypto.randomBytes(32).toString('base64url');
}

function generateCodeChallenge(codeVerifier) {
  if (typeof codeVerifier !== 'string' || codeVerifier.length === 0) {
    throw new TypeError('codeVerifier는 비어있지 않은 문자열이어야 합니다.');
  }
  return crypto.createHash('sha256').update(codeVerifier).digest('base64url');
}

module.exports = { generateCodeVerifier, generateCodeChallenge };
