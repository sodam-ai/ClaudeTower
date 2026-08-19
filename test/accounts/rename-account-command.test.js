'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { runRenameAccountCommand } = require('../../src/accounts/accounts/rename-account-command');
const { appendAccount, readRegistry } = require('../../src/accounts/accounts/accounts-registry');

function tmpJsonPath(prefix) {
  return path.join(os.tmpdir(), `claudetower-${prefix}-test-${Date.now()}-${Math.random().toString(36).slice(2)}.json`);
}

test('존재하지 않는 라벨이면 거부한다', () => {
  const registryPath = tmpJsonPath('registry');
  const result = runRenameAccountCommand('ghost', 'new', { registryPath, log: () => {} });
  assert.equal(result.applied, false);
  assert.equal(result.reason, 'account_not_found');
});

test('정상 rename이면 레지스트리의 label만 바뀌고 나머지 필드는 그대로다', () => {
  const registryPath = tmpJsonPath('registry');
  appendAccount({ account_id: 'a1', label: 'work', auth_type: 'api_key', status: 'active', created_at: '2026-08-20T00:00:00Z' }, registryPath);
  const logs = [];
  const result = runRenameAccountCommand('work', 'office', { registryPath, log: (m) => logs.push(m) });
  assert.equal(result.applied, true);
  assert.equal(result.accountId, 'a1');
  const accounts = readRegistry(registryPath);
  assert.equal(accounts.length, 1);
  assert.equal(accounts[0].label, 'office');
  assert.equal(accounts[0].account_id, 'a1');
  assert.equal(accounts[0].auth_type, 'api_key');
  assert.ok(logs.some((l) => l.includes('office')));
  fs.unlinkSync(registryPath);
});

test('이미 존재하는 라벨로 바꾸려 하면 거부하고 레지스트리를 건드리지 않는다', () => {
  const registryPath = tmpJsonPath('registry');
  appendAccount({ account_id: 'a1', label: 'work', auth_type: 'api_key', status: 'active', created_at: '2026-08-20T00:00:00Z' }, registryPath);
  appendAccount({ account_id: 'a2', label: 'personal', auth_type: 'api_key', status: 'active', created_at: '2026-08-20T01:00:00Z' }, registryPath);
  const result = runRenameAccountCommand('work', 'personal', { registryPath, log: () => {} });
  assert.equal(result.applied, false);
  assert.equal(result.reason, 'label_conflict');
  const accounts = readRegistry(registryPath);
  assert.equal(accounts.find((a) => a.account_id === 'a1').label, 'work');
  fs.unlinkSync(registryPath);
});

test('새 라벨이 기존과 동일하면 변경 없이 성공 처리한다(unchanged)', () => {
  const registryPath = tmpJsonPath('registry');
  appendAccount({ account_id: 'a1', label: 'work', auth_type: 'api_key', status: 'active', created_at: '2026-08-20T00:00:00Z' }, registryPath);
  const result = runRenameAccountCommand('work', 'work', { registryPath, log: () => {} });
  assert.equal(result.applied, true);
  assert.equal(result.unchanged, true);
  fs.unlinkSync(registryPath);
});

test('새 라벨이 100자를 넘으면 거부한다(add-api-key-request.js와 동일 규칙)', () => {
  const registryPath = tmpJsonPath('registry');
  appendAccount({ account_id: 'a1', label: 'work', auth_type: 'api_key', status: 'active', created_at: '2026-08-20T00:00:00Z' }, registryPath);
  const result = runRenameAccountCommand('work', 'a'.repeat(101), { registryPath, log: () => {} });
  assert.equal(result.applied, false);
  assert.equal(result.reason, 'label_too_long');
  fs.unlinkSync(registryPath);
});

test('새 라벨에 제어문자가 있으면 거부한다', () => {
  const registryPath = tmpJsonPath('registry');
  appendAccount({ account_id: 'a1', label: 'work', auth_type: 'api_key', status: 'active', created_at: '2026-08-20T00:00:00Z' }, registryPath);
  const result = runRenameAccountCommand('work', 'line1\nline2', { registryPath, log: () => {} });
  assert.equal(result.applied, false);
  assert.equal(result.reason, 'label_control_chars');
  fs.unlinkSync(registryPath);
});

test('rename-account-command.js는 credential-store/oauth/proxy를 절대 require하지 않는다(정적 검사)', () => {
  const source = fs.readFileSync(
    path.join(__dirname, '..', '..', 'src', 'accounts', 'accounts', 'rename-account-command.js'),
    'utf8'
  );
  assert.doesNotMatch(source, /require\(['"].*credential-store/);
  assert.doesNotMatch(source, /require\(['"].*oauth\//);
  assert.doesNotMatch(source, /require\(['"].*proxy\//);
});
