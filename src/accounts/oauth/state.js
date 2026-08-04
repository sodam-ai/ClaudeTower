'use strict';

// OAuth CSRF state 파라미터 생성/검증 — credential-store와 완전 무관한 순수 crypto 유틸.
// .PRD/07_OAUTH_FLOW_SPEC.md §1·§2: "state 파라미터를 암호학적으로 안전한 난수로 생성,
// 콜백에서 검증 없이는 토큰 교환 진행하지 않는다". .PRD/04_PROJECT_SPEC.md "절대 하지 마":
// "OAuth state 검증 없이 토큰 교환 진행하지 마".
//
// src/accounts/proxy/server.js의 verifyLocalAccessToken과 동일한 패턴 — crypto.randomBytes로
// 생성하고 crypto.timingSafeEqual로 상수시간 비교한다(타이밍 공격 방지, Math.random() 절대
// 금지 DO NOT 규칙). 파일 I/O·OS 자격증명 저장소 접근이 전혀 없다.

const crypto = require('node:crypto');

function generateState() {
  return crypto.randomBytes(32).toString('base64url');
}

function verifyState(providedState, expectedState) {
  if (typeof providedState !== 'string' || typeof expectedState !== 'string') {
    return false;
  }
  const providedBuf = Buffer.from(providedState, 'utf8');
  const expectedBuf = Buffer.from(expectedState, 'utf8');
  if (providedBuf.length !== expectedBuf.length) {
    return false;
  }
  return crypto.timingSafeEqual(providedBuf, expectedBuf);
}

module.exports = { generateState, verifyState };
