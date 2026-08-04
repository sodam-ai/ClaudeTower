'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { generateState, verifyState } = require('../../src/accounts/oauth/state');

test('generateState: base64url 문자열을 반환한다(43자, 32바이트 crypto.randomBytes)', () => {
  const state = generateState();
  assert.equal(typeof state, 'string');
  assert.equal(state.length, 43);
  assert.match(state, /^[A-Za-z0-9_-]{43}$/);
});

test('generateState: 호출할 때마다 다른 값을 반환한다(Math.random() 금지, 진짜 무작위)', () => {
  const a = generateState();
  const b = generateState();
  assert.notEqual(a, b);
});

test('verifyState: 두 state가 정확히 같으면 true', () => {
  const state = generateState();
  assert.equal(verifyState(state, state), true);
});

test('verifyState: 한 글자만 달라도 false(CSRF 위조 시도 시뮬레이션)', () => {
  const state = generateState();
  const tampered = (state[0] === 'A' ? 'B' : 'A') + state.slice(1);
  assert.equal(verifyState(tampered, state), false);
});

test('verifyState: 길이가 다르면 예외 없이 false를 반환한다(timingSafeEqual 길이불일치 예외 방어)', () => {
  assert.equal(verifyState('short', generateState()), false);
  assert.equal(verifyState('', generateState()), false);
});

test('verifyState: 문자열이 아닌 입력(null/undefined/숫자)은 예외 없이 false를 반환한다', () => {
  assert.equal(verifyState(null, 'x'), false);
  assert.equal(verifyState(undefined, 'x'), false);
  assert.equal(verifyState(123, 'x'), false);
  assert.equal(verifyState('x', null), false);
});
