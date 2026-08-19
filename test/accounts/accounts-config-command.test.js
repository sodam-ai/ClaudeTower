'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { runAccountsConfigCommand } = require('../../src/accounts/accounts-config-command');

function tmpPath() {
  return path.join(os.tmpdir(), `claudetower-accounts-config-cmd-test-${Date.now()}-${Math.random().toString(36).slice(2)}.json`);
}

test('인자 없이 실행하면 현재 정책을 전부 출력하고 applied:true를 반환한다', () => {
  const filePath = tmpPath();
  const lines = [];
  const result = runAccountsConfigCommand([], { switchPolicyPath: filePath, log: (m) => lines.push(m) });
  assert.equal(result.applied, true);
  assert.match(lines.join('\n'), /threshold_pct/);
  assert.match(lines.join('\n'), /credential 무관/);
});

test('유효한 key value는 저장되고 applied:true를 반환한다', () => {
  const filePath = tmpPath();
  const lines = [];
  const result = runAccountsConfigCommand(['threshold_pct', '85'], {
    switchPolicyPath: filePath,
    log: (m) => lines.push(m),
  });
  assert.equal(result.applied, true);
  assert.equal(result.threshold_pct, 85);
  assert.match(lines.join('\n'), /85/);
  fs.unlinkSync(filePath);
});

test('알 수 없는 key는 거부하고 applied:false를 반환한다', () => {
  const filePath = tmpPath();
  const lines = [];
  const result = runAccountsConfigCommand(['access_token', 'x'], {
    switchPolicyPath: filePath,
    log: (m) => lines.push(m),
  });
  assert.equal(result.applied, false);
  assert.match(lines.join('\n'), /알 수 없는 설정 키/);
});

test('잘못된 값(port 범위 밖)은 거부하고 applied:false를 반환한다', () => {
  const filePath = tmpPath();
  const lines = [];
  const result = runAccountsConfigCommand(['port', '80'], {
    switchPolicyPath: filePath,
    log: (m) => lines.push(m),
  });
  assert.equal(result.applied, false);
  assert.match(lines.join('\n'), /1024~65535/);
});

test('key만 있고 value가 없으면 사용법을 안내하고 applied:false를 반환한다', () => {
  const filePath = tmpPath();
  const lines = [];
  const result = runAccountsConfigCommand(['port'], { switchPolicyPath: filePath, log: (m) => lines.push(m) });
  assert.equal(result.applied, false);
  assert.match(lines.join('\n'), /사용법/);
});

test('accounts-config-command.js는 credential-store/oauth/proxy를 절대 require하지 않는다(정적 검사)', () => {
  const source = fs.readFileSync(
    path.join(__dirname, '..', '..', 'src', 'accounts', 'accounts-config-command.js'),
    'utf8'
  );
  assert.doesNotMatch(source, /require\(['"].*credential-store/);
  assert.doesNotMatch(source, /require\(['"].*oauth\//);
  assert.doesNotMatch(source, /require\(['"].*proxy\//);
});
