'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { parseApiKeyQuotaHeaders, bindingUsedPct } = require('../../src/accounts/quota/api-key-quota-reading');

test('parseApiKeyQuotaHeaders: 정상 헤더면 사용률을 계산한다', () => {
  const reading = parseApiKeyQuotaHeaders({
    'anthropic-ratelimit-tokens-limit': '1000',
    'anthropic-ratelimit-tokens-remaining': '250',
    'anthropic-ratelimit-tokens-reset': '2026-08-20T00:00:00Z',
    'anthropic-ratelimit-requests-limit': '50',
    'anthropic-ratelimit-requests-remaining': '50',
    'anthropic-ratelimit-requests-reset': '2026-08-20T00:00:00Z',
  });
  assert.equal(reading.tokens_used_pct, 75);
  assert.equal(reading.requests_used_pct, 0);
  assert.equal(reading.tokens_reset_at, '2026-08-20T00:00:00Z');
});

test('parseApiKeyQuotaHeaders: 헤더 키 대소문자가 섞여도 인식한다', () => {
  const reading = parseApiKeyQuotaHeaders({
    'Anthropic-Ratelimit-Tokens-Limit': '100',
    'Anthropic-Ratelimit-Tokens-Remaining': '0',
  });
  assert.equal(reading.tokens_used_pct, 100);
});

test('parseApiKeyQuotaHeaders: 다중 헤더 값(배열)이 와도 첫 값을 쓴다', () => {
  const reading = parseApiKeyQuotaHeaders({
    'anthropic-ratelimit-tokens-limit': ['100', '999'],
    'anthropic-ratelimit-tokens-remaining': ['40'],
  });
  assert.equal(reading.tokens_used_pct, 60);
});

test('parseApiKeyQuotaHeaders: 기대한 헤더가 전혀 없으면 null(예외를 던지지 않는다)', () => {
  assert.equal(parseApiKeyQuotaHeaders({}), null);
  assert.equal(parseApiKeyQuotaHeaders({ 'content-type': 'application/json' }), null);
});

test('parseApiKeyQuotaHeaders: 입력 자체가 객체가 아니면 null', () => {
  assert.equal(parseApiKeyQuotaHeaders(null), null);
  assert.equal(parseApiKeyQuotaHeaders(undefined), null);
  assert.equal(parseApiKeyQuotaHeaders('not an object'), null);
});

test('parseApiKeyQuotaHeaders: limit이 0이거나 숫자가 아니면 해당 지표만 null(다른 지표는 유지)', () => {
  const reading = parseApiKeyQuotaHeaders({
    'anthropic-ratelimit-tokens-limit': '0',
    'anthropic-ratelimit-tokens-remaining': '0',
    'anthropic-ratelimit-requests-limit': '10',
    'anthropic-ratelimit-requests-remaining': '5',
  });
  assert.equal(reading.tokens_used_pct, null);
  assert.equal(reading.requests_used_pct, 50);
});

test('parseApiKeyQuotaHeaders: remaining이 limit보다 커도(비정상 값) 0%로 클램프한다', () => {
  const reading = parseApiKeyQuotaHeaders({
    'anthropic-ratelimit-tokens-limit': '100',
    'anthropic-ratelimit-tokens-remaining': '9999',
  });
  assert.equal(reading.tokens_used_pct, 0);
});

test('parseApiKeyQuotaHeaders: reset 헤더가 없으면 null로 채운다', () => {
  const reading = parseApiKeyQuotaHeaders({
    'anthropic-ratelimit-tokens-limit': '100',
    'anthropic-ratelimit-tokens-remaining': '50',
  });
  assert.equal(reading.tokens_reset_at, null);
  assert.equal(reading.requests_used_pct, null);
  assert.equal(reading.requests_reset_at, null);
});

test('bindingUsedPct: 토큰·요청 중 더 급한(높은) 사용률을 반환한다', () => {
  assert.equal(bindingUsedPct({ tokens_used_pct: 30, requests_used_pct: 90 }), 90);
  assert.equal(bindingUsedPct({ tokens_used_pct: 90, requests_used_pct: 30 }), 90);
});

test('bindingUsedPct: null/undefined 입력이면 null을 반환한다', () => {
  assert.equal(bindingUsedPct(null), null);
  assert.equal(bindingUsedPct(undefined), null);
});

test('bindingUsedPct: 두 지표 다 null이면 null을 반환한다', () => {
  assert.equal(bindingUsedPct({ tokens_used_pct: null, requests_used_pct: null }), null);
});
