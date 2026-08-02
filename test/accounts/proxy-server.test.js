'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  startProxyServer,
  stopProxyServer,
  verifyLocalAccessToken,
  generateLocalAccessToken,
} = require('../../src/accounts/proxy/server');

test('startProxyServer/stopProxyServer: credential-store 실동작 전까지 여전히 명시적으로 거부한다', () => {
  assert.throws(() => startProxyServer({}), /credential-store 실동작 준비 이후/);
  assert.throws(() => stopProxyServer({}), /credential-store 실동작 준비 이후/);
});

test('generateLocalAccessToken: 64자 16진수 문자열을 반환한다(32바이트, crypto.randomBytes)', () => {
  const token = generateLocalAccessToken();
  assert.equal(typeof token, 'string');
  assert.equal(token.length, 64);
  assert.match(token, /^[0-9a-f]{64}$/);
});

test('generateLocalAccessToken: 호출할 때마다 다른 값을 반환한다(Math.random() 금지, 진짜 무작위)', () => {
  const a = generateLocalAccessToken();
  const b = generateLocalAccessToken();
  assert.notEqual(a, b);
});

test('verifyLocalAccessToken: 두 토큰이 정확히 같으면 true', () => {
  const token = generateLocalAccessToken();
  assert.equal(verifyLocalAccessToken(token, token), true);
});

test('verifyLocalAccessToken: 한 글자만 달라도 false', () => {
  const token = generateLocalAccessToken();
  const flippedFirstChar = (token[0] === '0' ? '1' : '0') + token.slice(1);
  assert.equal(verifyLocalAccessToken(flippedFirstChar, token), false);
});

test('verifyLocalAccessToken: 길이가 다르면 예외 없이 false를 반환한다(timingSafeEqual 길이불일치 예외 방어)', () => {
  assert.equal(verifyLocalAccessToken('short', generateLocalAccessToken()), false);
  assert.equal(verifyLocalAccessToken('', generateLocalAccessToken()), false);
});

test('verifyLocalAccessToken: 문자열이 아닌 입력(null/undefined/숫자)은 예외 없이 false를 반환한다', () => {
  assert.equal(verifyLocalAccessToken(null, 'x'), false);
  assert.equal(verifyLocalAccessToken(undefined, 'x'), false);
  assert.equal(verifyLocalAccessToken(123, 'x'), false);
  assert.equal(verifyLocalAccessToken('x', null), false);
});
