'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { runSwitchAccountCommand } = require('../../src/accounts/accounts/switch-account-command');
const { appendAccount, readRegistry } = require('../../src/accounts/accounts/accounts-registry');
const { readActiveAccountId } = require('../../src/accounts/accounts/active-account-state');
const { readActiveAccountHandle } = require('../../src/shared/active-account-handle/read');
const { readRotationEvents } = require('../../src/accounts/audit/rotation-log');

function tmpJsonPath(prefix) {
  return path.join(os.tmpdir(), `claudetower-${prefix}-test-${Date.now()}-${Math.random().toString(36).slice(2)}.json`);
}

function tmpPaths() {
  return {
    registryPath: tmpJsonPath('registry'),
    statePath: tmpJsonPath('state'),
    rotationLogPath: tmpJsonPath('rotation'),
    activeAccountHandlePath: tmpJsonPath('handle'),
  };
}

function cleanup(paths) {
  for (const p of Object.values(paths)) {
    try {
      fs.unlinkSync(p);
    } catch {
      // 애초에 안 만들어졌을 수도 있음(예: label_required로 조기 반환) — 무시.
    }
  }
}

test('라벨을 안 주면 사용법 안내 후 거부한다', () => {
  const result = runSwitchAccountCommand('', { log: () => {} });
  assert.equal(result.applied, false);
  assert.equal(result.reason, 'label_required');
});

test('존재하지 않는 라벨이면 거부한다', () => {
  const paths = tmpPaths();
  const result = runSwitchAccountCommand('ghost', { ...paths, log: () => {} });
  assert.equal(result.applied, false);
  assert.equal(result.reason, 'account_not_found');
  cleanup(paths);
});

test('OAuth(구독) 계정이면 거부한다(자동/수동 전환 모두 API 키만 지원)', () => {
  const paths = tmpPaths();
  appendAccount(
    { account_id: 'a1', label: 'sub', auth_type: 'oauth', status: 'active', created_at: '2026-08-20T00:00:00Z' },
    paths.registryPath
  );
  const result = runSwitchAccountCommand('sub', { ...paths, log: () => {} });
  assert.equal(result.applied, false);
  assert.equal(result.reason, 'not_api_key_account');
  cleanup(paths);
});

test('비활성(active가 아닌) 계정이면 거부한다', () => {
  const paths = tmpPaths();
  appendAccount(
    { account_id: 'a1', label: 'work', auth_type: 'api_key', status: 'disabled', created_at: '2026-08-20T00:00:00Z' },
    paths.registryPath
  );
  const result = runSwitchAccountCommand('work', { ...paths, log: () => {} });
  assert.equal(result.applied, false);
  assert.equal(result.reason, 'target_not_active');
  cleanup(paths);
});

test('정상 전환: active-account-state/handle/RotationEvent가 실제로 갱신된다', () => {
  const paths = tmpPaths();
  appendAccount(
    { account_id: 'a1', label: 'work', auth_type: 'api_key', status: 'active', created_at: '2026-08-20T00:00:00Z' },
    paths.registryPath
  );
  const logs = [];
  const result = runSwitchAccountCommand('work', { ...paths, log: (m) => logs.push(m) });
  assert.equal(result.applied, true);
  assert.equal(result.toAccountId, 'a1');
  assert.equal(readActiveAccountId(paths.statePath), 'a1');
  assert.equal(readActiveAccountHandle(paths.activeAccountHandlePath).account_label, 'work');
  const events = readRotationEvents(paths.rotationLogPath);
  assert.equal(events.length, 1);
  assert.equal(events[0].reason, 'manual');
  assert.equal(events[0].to_account_id, 'a1');
  assert.ok(logs.some((l) => l.includes('work')));
  cleanup(paths);
});

test('전환 시 레지스트리의 last_project_path/last_used_at도 함께 갱신된다(M53과 동일 경로 재사용)', () => {
  const paths = tmpPaths();
  appendAccount(
    { account_id: 'a1', label: 'work', auth_type: 'api_key', status: 'active', created_at: '2026-08-20T00:00:00Z' },
    paths.registryPath
  );
  runSwitchAccountCommand('work', { ...paths, log: () => {} });
  const accounts = readRegistry(paths.registryPath);
  assert.equal(accounts[0].last_project_path, process.cwd());
  assert.ok(typeof accounts[0].last_used_at === 'string' && accounts[0].last_used_at.length > 0);
  cleanup(paths);
});

test('이미 활성 상태인 계정으로 다시 전환하면 거부하고 아무 것도 바꾸지 않는다', () => {
  const paths = tmpPaths();
  appendAccount(
    { account_id: 'a1', label: 'work', auth_type: 'api_key', status: 'active', created_at: '2026-08-20T00:00:00Z' },
    paths.registryPath
  );
  const first = runSwitchAccountCommand('work', { ...paths, log: () => {} });
  assert.equal(first.applied, true);
  const second = runSwitchAccountCommand('work', { ...paths, log: () => {} });
  assert.equal(second.applied, false);
  assert.equal(second.reason, 'already_active');
  const events = readRotationEvents(paths.rotationLogPath);
  assert.equal(events.length, 1); // 두 번째 호출로 이벤트가 추가되지 않았어야 함
  cleanup(paths);
});

test('두 계정 사이를 전환하면 fromAccountId/toAccountId가 RotationEvent에 정확히 기록된다', () => {
  const paths = tmpPaths();
  appendAccount(
    { account_id: 'a1', label: 'work', auth_type: 'api_key', status: 'active', created_at: '2026-08-20T00:00:00Z' },
    paths.registryPath
  );
  appendAccount(
    { account_id: 'a2', label: 'personal', auth_type: 'api_key', status: 'active', created_at: '2026-08-20T01:00:00Z' },
    paths.registryPath
  );
  runSwitchAccountCommand('work', { ...paths, log: () => {} });
  runSwitchAccountCommand('personal', { ...paths, log: () => {} });
  const events = readRotationEvents(paths.rotationLogPath);
  assert.equal(events.length, 2);
  assert.equal(events[1].from_account_id, 'a1');
  assert.equal(events[1].to_account_id, 'a2');
  assert.equal(readActiveAccountId(paths.statePath), 'a2');
  cleanup(paths);
});

test('switch-account-command.js는 credential-store/oauth/proxy를 절대 require하지 않는다(정적 검사)', () => {
  const source = fs.readFileSync(
    path.join(__dirname, '..', '..', 'src', 'accounts', 'accounts', 'switch-account-command.js'),
    'utf8'
  );
  assert.doesNotMatch(source, /require\(['"].*credential-store/);
  assert.doesNotMatch(source, /require\(['"].*oauth\//);
  assert.doesNotMatch(source, /require\(['"].*proxy\//);
});
