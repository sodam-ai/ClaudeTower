'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { runAccountsDisableCommand } = require('../../src/accounts/accounts-disable-command');
const { readActivationState, writeActivationState } = require('../../src/accounts/module-activation-state-store');
const { createModuleActivationState } = require('../../src/accounts/module-activation-state');

function tmpPath() {
  return path.join(
    os.tmpdir(),
    `claudetower-disable-cmd-test-${Date.now()}-${Math.random().toString(36).slice(2)}.json`
  );
}

test('활성화된 상태에서 실행하면 비활성화로 되돌린다', () => {
  const filePath = tmpPath();
  writeActivationState(
    createModuleActivationState({ enabled: true, consentGivenAt: '2026-08-19T00:00:00.000Z', consentTextVersion: 'v2-hybrid' }),
    filePath
  );
  const logs = [];
  const result = runAccountsDisableCommand({ activationStatePath: filePath, log: (m) => logs.push(m) });
  assert.equal(result.applied, true);
  assert.equal(result.alreadyDisabled, false);
  const state = readActivationState(filePath);
  assert.equal(state.enabled, false);
  assert.ok(logs.some((l) => l.includes('비활성화')));
  // 동의 문구가 약속한 내용을 실제로 지키는지 — 계정 정보는 지우지 않는다고 안내하는지 확인
  assert.ok(logs.some((l) => l.includes('그대로 남아있습니다')));
  fs.unlinkSync(filePath);
});

test('이미 비활성화된 상태에서 실행하면 멱등하게 처리한다', () => {
  const filePath = tmpPath();
  // 파일 자체가 없는 상태(기본값 = 비활성화)에서 실행
  const logs = [];
  const result = runAccountsDisableCommand({ activationStatePath: filePath, log: (m) => logs.push(m) });
  assert.equal(result.applied, true);
  assert.equal(result.alreadyDisabled, true);
  assert.ok(logs.some((l) => l.includes('이미 비활성화')));
});

test('비활성화해도 계정 레지스트리·자격증명 관련 모듈은 전혀 건드리지 않는다(정적 검사)', () => {
  const source = fs.readFileSync(
    path.join(__dirname, '..', '..', 'src', 'accounts', 'accounts-disable-command.js'),
    'utf8'
  );
  assert.doesNotMatch(source, /require\(['"].*credential-store/);
  assert.doesNotMatch(source, /require\(['"].*oauth\//);
  assert.doesNotMatch(source, /require\(['"].*proxy\//);
  assert.doesNotMatch(source, /require\(['"].*accounts-registry/);
});
