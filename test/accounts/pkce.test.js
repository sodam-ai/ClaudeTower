'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { generateCodeVerifier, generateCodeChallenge } = require('../../src/accounts/oauth/pkce');

test('generateCodeVerifier: 43자 base64url 문자열을 반환한다(RFC 7636 §4.1, 43~128자 요구사항 충족)', () => {
  const verifier = generateCodeVerifier();
  assert.equal(typeof verifier, 'string');
  assert.equal(verifier.length, 43);
  assert.match(verifier, /^[A-Za-z0-9_-]{43}$/);
});

test('generateCodeVerifier: 호출할 때마다 다른 값을 반환한다(Math.random() 금지, 진짜 무작위)', () => {
  const a = generateCodeVerifier();
  const b = generateCodeVerifier();
  assert.notEqual(a, b);
});

test('generateCodeChallenge: RFC 7636 Appendix B 공식 테스트 벡터와 정확히 일치한다(node -e로 독립 재계산해 사전 검증한 값)', () => {
  const verifier = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
  const expectedChallenge = 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM';
  assert.equal(generateCodeChallenge(verifier), expectedChallenge);
});

test('generateCodeChallenge: 같은 verifier는 항상 같은 challenge를 만든다(결정론적 해시)', () => {
  const verifier = generateCodeVerifier();
  assert.equal(generateCodeChallenge(verifier), generateCodeChallenge(verifier));
});

test('generateCodeChallenge: 다른 verifier는 다른 challenge를 만든다', () => {
  const a = generateCodeChallenge(generateCodeVerifier());
  const b = generateCodeChallenge(generateCodeVerifier());
  assert.notEqual(a, b);
});

test('generateCodeChallenge: 빈 문자열이나 문자열이 아닌 입력은 TypeError를 던진다', () => {
  assert.throws(() => generateCodeChallenge(''), TypeError);
  assert.throws(() => generateCodeChallenge(null), TypeError);
  assert.throws(() => generateCodeChallenge(undefined), TypeError);
  assert.throws(() => generateCodeChallenge(123), TypeError);
});
