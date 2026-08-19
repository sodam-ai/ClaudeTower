'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { runAccountsListCommand, formatAccountLine } = require('../../src/accounts/accounts/accounts-list-command');
const { appendAccount } = require('../../src/accounts/accounts/accounts-registry');
const { writeQuotaCacheEntry } = require('../../src/accounts/quota/quota-cache-store');

function tmpPath() {
  return path.join(
    os.tmpdir(),
    `claudetower-list-cmd-test-${Date.now()}-${Math.random().toString(36).slice(2)}.json`
  );
}

test('등록된 계정이 없으면 안내 문구만 출력한다', () => {
  const filePath = tmpPath();
  const logs = [];
  const result = runAccountsListCommand({ registryPath: filePath, log: (m) => logs.push(m) });
  assert.equal(result.applied, true);
  assert.equal(result.count, 0);
  assert.ok(logs.some((l) => l.includes('등록된 계정이 없습니다')));
});

test('등록된 계정이 있으면 개수와 각 항목을 출력한다', () => {
  const filePath = tmpPath();
  appendAccount(
    { account_id: 'a1', label: '업무용', auth_type: 'api_key', status: 'active', created_at: '2026-08-19T00:00:00.000Z', last_project_path: null, last_used_at: null },
    filePath
  );
  appendAccount(
    { account_id: 'a2', label: '개인용', auth_type: 'api_key', status: 'active', created_at: '2026-08-19T01:00:00.000Z', last_project_path: null, last_used_at: null },
    filePath
  );
  const logs = [];
  const result = runAccountsListCommand({ registryPath: filePath, log: (m) => logs.push(m) });
  assert.equal(result.applied, true);
  assert.equal(result.count, 2);
  assert.ok(logs.some((l) => l.includes('2개')));
  assert.ok(logs.some((l) => l.includes('업무용')));
  assert.ok(logs.some((l) => l.includes('개인용')));
  fs.unlinkSync(filePath);
});

test('출력 형식에 비밀값 필드 이름이 전혀 등장하지 않는다(구조적으로 저장 자체가 안 됨)', () => {
  const line = formatAccountLine({
    account_id: 'a1',
    label: '테스트',
    auth_type: 'api_key',
    status: 'active',
    created_at: '2026-08-19T00:00:00.000Z',
  });
  assert.doesNotMatch(line, /token|secret|key.*value/i);
});

test('formatAccountLine: 사용률 캐시가 없으면 "확인 안 됨" + diagnose-quota 안내를 보여준다', () => {
  const line = formatAccountLine({ account_id: 'a1', label: '업무용', auth_type: 'api_key', status: 'active', created_at: '2026-08-20T00:00:00.000Z' }, null);
  assert.match(line, /확인 안 됨/);
  assert.match(line, /diagnose-quota 업무용/);
});

test('formatAccountLine: 사용률 캐시가 있으면 마지막 확인 시각과 함께 보여준다', () => {
  const line = formatAccountLine(
    { account_id: 'a1', label: '업무용', auth_type: 'api_key', status: 'active', created_at: '2026-08-20T00:00:00.000Z' },
    { tokens_used_pct: 12.3, requests_used_pct: 4.5, checked_at: '2026-08-20T05:00:00.000Z' }
  );
  assert.match(line, /12\.3%/);
  assert.match(line, /4\.5%/);
  assert.match(line, /2026-08-20T05:00:00\.000Z/);
});

test('runAccountsListCommand: quotaCachePath를 넘기면 실제 캐시를 읽어 표시한다', () => {
  const registryPath = tmpPath();
  const quotaCachePath = tmpPath();
  appendAccount({ account_id: 'a1', label: '업무용', auth_type: 'api_key', status: 'active', created_at: '2026-08-20T00:00:00.000Z' }, registryPath);
  writeQuotaCacheEntry('a1', { tokens_used_pct: 55, requests_used_pct: 10 }, quotaCachePath);

  const logs = [];
  runAccountsListCommand({ registryPath, quotaCachePath, log: (m) => logs.push(m) });
  assert.ok(logs.some((l) => l.includes('55')));
  fs.unlinkSync(registryPath);
  fs.unlinkSync(quotaCachePath);
});

test('accounts-list-command.js는 credential-store/oauth/proxy를 절대 require하지 않는다(정적 검사)', () => {
  const source = fs.readFileSync(
    path.join(__dirname, '..', '..', 'src', 'accounts', 'accounts', 'accounts-list-command.js'),
    'utf8'
  );
  assert.doesNotMatch(source, /require\(['"].*credential-store/);
  assert.doesNotMatch(source, /require\(['"].*oauth\//);
  assert.doesNotMatch(source, /require\(['"].*proxy\//);
});
