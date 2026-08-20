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

test('writeQuotaCacheEntry: 소유자 전용 권한(permissionRestricted)이 실제로 적용된다', () => {
  // 2026-08-20 추가 — active-account-state.js/active-account-handle/write.js와 동일한
  // 원자적쓰기+권한제한을 이 파일에도 적용(onUpstreamHeaders가 매 응답마다 쓰게 되면서
  // 위험 등급이 같아짐). 같은 관례로 같은 형태의 테스트를 둔다.
  const p = tmpJsonPath();
  const result = writeQuotaCacheEntry('a1', { tokens_used_pct: 10, requests_used_pct: null }, p);
  assert.equal(typeof result.permissionRestricted, 'boolean');
  assert.equal(result.permissionRestricted, true, '이 PC(Windows)에서는 icacls 강제가 항상 성공해야 한다');
  fs.unlinkSync(p);
});

test('writeQuotaCacheEntry: 매 쓰기(=매 rename)마다 다시 권한을 강제한다', () => {
  const p = tmpJsonPath();
  const first = writeQuotaCacheEntry('a1', { tokens_used_pct: 10, requests_used_pct: null }, p);
  const second = writeQuotaCacheEntry('a2', { tokens_used_pct: 20, requests_used_pct: null }, p);
  assert.equal(first.permissionRestricted, true);
  assert.equal(second.permissionRestricted, true, '두 번째 쓰기(새 임시파일→rename)도 여전히 강제돼야 한다');
  assert.equal(readQuotaCacheEntry('a1', p).tokens_used_pct, 10);
  assert.equal(readQuotaCacheEntry('a2', p).tokens_used_pct, 20);
  fs.unlinkSync(p);
});

test(
  'writeQuotaCacheEntry(win32): icacls 결과 실제로 현재 사용자만 접근 가능하고 상속된 ACE가 남아있지 않다',
  { skip: process.platform !== 'win32' },
  () => {
    const { execFileSync } = require('node:child_process');
    const p = tmpJsonPath();
    writeQuotaCacheEntry('a1', { tokens_used_pct: 10, requests_used_pct: null }, p);
    const output = execFileSync('icacls', [p], { encoding: 'utf8' });
    const username = os.userInfo().username;
    const aceLines = output
      .split('\n')
      .map((line) => line.trimEnd())
      .filter((line) => /:\([A-Za-z,]+\)$/.test(line));
    assert.equal(aceLines.length, 1, `단일 ACE만 있어야 함: ${output}`);
    assert.match(aceLines[0], new RegExp(`${username}:\\(F\\)`));
    fs.unlinkSync(p);
  }
);

test('quota-cache-store.js는 credential-store/oauth/proxy를 절대 require하지 않는다(정적 검사)', () => {
  const source = fs.readFileSync(
    path.join(__dirname, '..', '..', 'src', 'accounts', 'quota', 'quota-cache-store.js'),
    'utf8'
  );
  assert.doesNotMatch(source, /require\(['"].*credential-store/);
  assert.doesNotMatch(source, /require\(['"].*oauth\//);
  assert.doesNotMatch(source, /require\(['"].*proxy\//);
});
