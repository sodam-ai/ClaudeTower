'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const readline = require('node:readline');
const { PassThrough } = require('node:stream');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { runAccountsEnableCommand } = require('../../src/accounts/accounts-enable-command');
const { readActivationState } = require('../../src/accounts/module-activation-state-store');

// setup-wizard.test.js와 동일한 패턴 — 실제 TTY 없이 readline 비동기 이터레이터를
// 파이프 입력으로 흉내낸다(EOF 경쟁 상태 회피를 위해 setImmediate로 한 틱 미룸).
function fakeInteractiveSession(answerText) {
  const input = new PassThrough();
  const output = new PassThrough();
  output.on('data', () => {});
  const rl = readline.createInterface({ input, output });
  setImmediate(() => input.end(answerText));
  return rl;
}

function tmpPath() {
  return path.join(
    os.tmpdir(),
    `claudetower-enable-cmd-test-${Date.now()}-${Math.random().toString(36).slice(2)}.json`
  );
}

test('y 입력 시 활성화 상태를 저장하고 동의 문구를 출력한다', async () => {
  const filePath = tmpPath();
  const rl = fakeInteractiveSession('y\n');
  const logs = [];
  const result = await runAccountsEnableCommand(rl, {
    activationStatePath: filePath,
    log: (m) => logs.push(m),
  });
  rl.close();
  assert.equal(result.applied, true);
  assert.equal(result.alreadyEnabled, false);
  const state = readActivationState(filePath);
  assert.equal(state.enabled, true);
  assert.ok(state.consent_given_at);
  assert.equal(state.consent_text_version, 'v2.1-hybrid-scope-clarified');
  assert.ok(logs.some((l) => l.includes('활성화')));
  fs.unlinkSync(filePath);
});

test('N 입력(또는 빈 입력) 시 활성화하지 않는다', async () => {
  const filePath = tmpPath();
  const rl = fakeInteractiveSession('n\n');
  const result = await runAccountsEnableCommand(rl, { activationStatePath: filePath, log: () => {} });
  rl.close();
  assert.equal(result.applied, false);
  const state = readActivationState(filePath);
  assert.equal(state.enabled, false);
});

test('이미 활성화된 상태에서 재실행하면 멱등하게 처리하고 다시 묻지 않는다', async () => {
  const filePath = tmpPath();
  // 1차: 활성화
  const rl1 = fakeInteractiveSession('y\n');
  await runAccountsEnableCommand(rl1, { activationStatePath: filePath, log: () => {} });
  rl1.close();
  // 2차: 입력 없이도(빈 스트림) 이미 활성화됐으므로 바로 반환해야 함
  const rl2 = fakeInteractiveSession('');
  const logs = [];
  const result = await runAccountsEnableCommand(rl2, {
    activationStatePath: filePath,
    log: (m) => logs.push(m),
  });
  rl2.close();
  assert.equal(result.applied, true);
  assert.equal(result.alreadyEnabled, true);
  assert.ok(logs.some((l) => l.includes('이미 활성화')));
  fs.unlinkSync(filePath);
});

test('accounts-enable-command.js는 credential-store/oauth/proxy를 절대 require하지 않는다(정적 검사)', () => {
  const source = fs.readFileSync(
    path.join(__dirname, '..', '..', 'src', 'accounts', 'accounts-enable-command.js'),
    'utf8'
  );
  assert.doesNotMatch(source, /require\(['"].*credential-store/);
  assert.doesNotMatch(source, /require\(['"].*oauth\//);
  assert.doesNotMatch(source, /require\(['"].*proxy\//);
});
