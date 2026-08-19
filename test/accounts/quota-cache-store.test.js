'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const {
  readQuotaCache,
  readQuotaCacheEntry,
  writeQuotaCacheEntry,
} = require('../../src/accounts/quota/quota-cache-store');

function tmpJsonPath() {
  return path.join(os.tmpdir(), `claudetower-quota-cache-test-${Date.now()}-${Math.random().toString(36).slice(2)}.json`);
}

test('readQuotaCache: 파일이 없으면 빈 객체를 반환한다', () => {
  const filePath = tmpJsonPath();
  assert.deepEqual(readQuotaCache(filePath), {});
});

test('readQuotaCacheEntry: 기록된 적 없는 account_id는 null을 반환한다', () => {
  const filePath = tmpJsonPath();
  writeQuotaCacheEntry('a1', { tokens_used_pct: 10, requests_used_pct: 5 }, filePath);
  assert.equal(readQuotaCacheEntry('a2', filePath), null);
  fs.unlinkSync(filePath);
});

test('writeQuotaCacheEntry → readQuotaCacheEntry: 저장한 값이 checked_at과 함께 그대로 조회된다', () => {
  const filePath = tmpJsonPath();
  writeQuotaCacheEntry('a1', { tokens_used_pct: 42.5, requests_used_pct: 10, tokens_reset_at: '2026-08-20T10:00:00Z', requests_reset_at: null }, filePath);
  const entry = readQuotaCacheEntry('a1', filePath);
  assert.equal(entry.tokens_used_pct, 42.5);
  assert.equal(entry.requests_used_pct, 10);
  assert.equal(typeof entry.checked_at, 'string');
  fs.unlinkSync(filePath);
});

test('writeQuotaCacheEntry: 다른 계정 항목을 덮어쓰지 않고 누적한다', () => {
  const filePath = tmpJsonPath();
  writeQuotaCacheEntry('a1', { tokens_used_pct: 10 }, filePath);
  writeQuotaCacheEntry('a2', { tokens_used_pct: 20 }, filePath);
  const cache = readQuotaCache(filePath);
  assert.equal(Object.keys(cache).length, 2);
  assert.equal(cache.a1.tokens_used_pct, 10);
  assert.equal(cache.a2.tokens_used_pct, 20);
  fs.unlinkSync(filePath);
});

test('writeQuotaCacheEntry: 같은 계정에 다시 쓰면 최신 값으로 교체된다', () => {
  const filePath = tmpJsonPath();
  writeQuotaCacheEntry('a1', { tokens_used_pct: 10 }, filePath);
  writeQuotaCacheEntry('a1', { tokens_used_pct: 90 }, filePath);
  assert.equal(readQuotaCacheEntry('a1', filePath).tokens_used_pct, 90);
  fs.unlinkSync(filePath);
});

test('readQuotaCache: 손상된 파일은 안전하게 빈 객체로 폴백한다', () => {
  const filePath = tmpJsonPath();
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, '{not valid json', 'utf8');
  assert.deepEqual(readQuotaCache(filePath), {});
  fs.unlinkSync(filePath);
});

test('writeQuotaCacheEntry: accountId가 비어있으면 거부한다', () => {
  assert.throws(() => writeQuotaCacheEntry('', { tokens_used_pct: 1 }, tmpJsonPath()), TypeError);
});

test('writeQuotaCacheEntry: 인자 없이(filePath undefined) 호출 시 다른 CLAUDETOWER_* 변수만 설정돼 있으면 부분격리로 거부한다', () => {
  const prevWidget = process.env.CLAUDETOWER_WIDGET_CONFIG_PATH;
  process.env.CLAUDETOWER_WIDGET_CONFIG_PATH = '/tmp/irrelevant.json';
  try {
    assert.throws(() => writeQuotaCacheEntry('a1', { tokens_used_pct: 1 }, undefined), /테스트 격리 변수/);
  } finally {
    if (prevWidget === undefined) delete process.env.CLAUDETOWER_WIDGET_CONFIG_PATH;
    else process.env.CLAUDETOWER_WIDGET_CONFIG_PATH = prevWidget;
  }
});

test('quota-cache-store.js는 credential-store/oauth/proxy를 절대 require하지 않는다(정적 검사)', () => {
  const source = fs.readFileSync(
    path.join(__dirname, '..', '..', 'src', 'accounts', 'quota', 'quota-cache-store.js'),
    'utf8'
  );
  assert.doesNotMatch(source, /require\(['"].*credential-store/);
  assert.doesNotMatch(source, /require\(['"].*oauth\//);
  assert.doesNotMatch(source, /require\(['"].*proxy\//);
});
