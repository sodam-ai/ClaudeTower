'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  createModuleActivationState,
  isAccountModuleEnabled,
} = require('../../src/accounts/module-activation-state');

test('createModuleActivationState: 인자 없이 호출하면 enabled가 false로 고정된다(게이트 기본값)', () => {
  const state = createModuleActivationState();
  assert.equal(state.enabled, false);
  assert.equal(state.consent_given_at, null);
  assert.equal(state.consent_text_version, null);
});

test('createModuleActivationState: 동의 정보를 포함해 생성할 수 있다', () => {
  const state = createModuleActivationState({
    enabled: true,
    consentGivenAt: '2026-07-14T00:00:00Z',
    consentTextVersion: 'v1',
  });
  assert.equal(state.enabled, true);
  assert.equal(state.consent_given_at, '2026-07-14T00:00:00Z');
  assert.equal(state.consent_text_version, 'v1');
});

test('createModuleActivationState: enabled가 boolean이 아니면 거부한다', () => {
  assert.throws(() => createModuleActivationState({ enabled: 'yes' }), TypeError);
});

test('createModuleActivationState: consentGivenAt/consentTextVersion이 string도 null도 아니면 거부한다', () => {
  assert.throws(() => createModuleActivationState({ consentGivenAt: 123 }), TypeError);
  assert.throws(() => createModuleActivationState({ consentTextVersion: 123 }), TypeError);
});

test('isAccountModuleEnabled: enabled:true일 때만 true', () => {
  assert.equal(isAccountModuleEnabled(createModuleActivationState({ enabled: true })), true);
  assert.equal(isAccountModuleEnabled(createModuleActivationState()), false);
});

test('isAccountModuleEnabled: null/undefined이 와도 안전하게 false', () => {
  assert.equal(isAccountModuleEnabled(null), false);
  assert.equal(isAccountModuleEnabled(undefined), false);
});
