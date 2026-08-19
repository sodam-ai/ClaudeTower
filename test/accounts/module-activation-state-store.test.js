'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const {
  readActivationState,
  writeActivationState,
} = require('../../src/accounts/module-activation-state-store');
const { createModuleActivationState } = require('../../src/accounts/module-activation-state');

function tmpPath() {
  return path.join(
    os.tmpdir(),
    `claudetower-activation-state-test-${Date.now()}-${Math.random().toString(36).slice(2)}.json`
  );
}

test('readActivationState: 파일이 없으면 기본값(비활성화)을 반환한다', () => {
  const filePath = tmpPath();
  const state = readActivationState(filePath);
  assert.equal(state.enabled, false);
  assert.equal(state.consent_given_at, null);
});

test('writeActivationState → readActivationState: 저장한 값이 그대로 돌아온다', () => {
  const filePath = tmpPath();
  const state = createModuleActivationState({
    enabled: true,
    consentGivenAt: '2026-08-19T00:00:00.000Z',
    consentTextVersion: 'v2-hybrid',
  });
  writeActivationState(state, filePath);
  const readBack = readActivationState(filePath);
  assert.equal(readBack.enabled, true);
  assert.equal(readBack.consent_given_at, '2026-08-19T00:00:00.000Z');
  assert.equal(readBack.consent_text_version, 'v2-hybrid');
  fs.unlinkSync(filePath);
});

test('readActivationState: 손상된 파일은 안전하게 비활성화 기본값으로 폴백한다', () => {
  const filePath = tmpPath();
  fs.writeFileSync(filePath, '{ this is not valid json', 'utf8');
  const state = readActivationState(filePath);
  assert.equal(state.enabled, false);
  fs.unlinkSync(filePath);
});

test('부분 격리 상태에서 filePath 없이 쓰기를 시도하면 거부한다', () => {
  const prevA = process.env.CLAUDETOWER_ACCOUNTS_SWITCH_POLICY_PATH;
  process.env.CLAUDETOWER_ACCOUNTS_SWITCH_POLICY_PATH = tmpPath();
  try {
    assert.throws(
      () => writeActivationState(createModuleActivationState({ enabled: true })),
      /테스트 격리 변수/
    );
  } finally {
    if (prevA === undefined) delete process.env.CLAUDETOWER_ACCOUNTS_SWITCH_POLICY_PATH;
    else process.env.CLAUDETOWER_ACCOUNTS_SWITCH_POLICY_PATH = prevA;
  }
});

test('module-activation-state-store.js는 credential-store/oauth/proxy를 절대 require하지 않는다(정적 검사)', () => {
  const source = fs.readFileSync(
    path.join(__dirname, '..', '..', 'src', 'accounts', 'module-activation-state-store.js'),
    'utf8'
  );
  assert.doesNotMatch(source, /require\(['"].*credential-store/);
  assert.doesNotMatch(source, /require\(['"].*oauth\//);
  assert.doesNotMatch(source, /require\(['"].*proxy\//);
});
