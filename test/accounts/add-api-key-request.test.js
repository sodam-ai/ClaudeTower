'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { buildAddApiKeyRequest } = require('../../src/accounts/accounts/add-api-key-request');
const { createModuleActivationState } = require('../../src/accounts/module-activation-state');

const ENABLED = createModuleActivationState({
  enabled: true,
  consentGivenAt: '2026-07-27T00:00:00Z',
  consentTextVersion: 'v2-hybrid',
});
const DISABLED = createModuleActivationState();

const VALID = {
  label: '업무용',
  apiKeyValue: 'test-fake-key-not-real',
  accountId: 'acc-001',
  createdAt: '2026-07-28T00:00:00Z',
  activationState: ENABLED,
};

test('buildAddApiKeyRequest: 정상 입력이면 api_key 타입 Account와 저장할 비밀값을 반환한다', () => {
  const result = buildAddApiKeyRequest(VALID);
  assert.equal(result.account.label, '업무용');
  assert.equal(result.account.auth_type, 'api_key');
  assert.equal(result.account.status, 'active');
  assert.equal(result.secretToStore, 'test-fake-key-not-real');
});

test('buildAddApiKeyRequest: Account 모듈이 꺼져있으면(동의 전) 거부한다 — 동의 게이트', () => {
  assert.throws(
    () => buildAddApiKeyRequest({ ...VALID, activationState: DISABLED }),
    /Account 모듈이 아직 켜지지 않았습니다/
  );
});

test('buildAddApiKeyRequest: activationState가 없으면(null/undefined) 안전하게 거부한다', () => {
  assert.throws(() => buildAddApiKeyRequest({ ...VALID, activationState: null }));
  assert.throws(() => buildAddApiKeyRequest({ ...VALID, activationState: undefined }));
});

test('buildAddApiKeyRequest: 라벨이 빈 문자열/공백이면 거부한다', () => {
  assert.throws(() => buildAddApiKeyRequest({ ...VALID, label: '' }), TypeError);
  assert.throws(() => buildAddApiKeyRequest({ ...VALID, label: '   ' }), TypeError);
});

test('buildAddApiKeyRequest: API 키 값이 빈 문자열/공백이면 거부한다', () => {
  assert.throws(() => buildAddApiKeyRequest({ ...VALID, apiKeyValue: '' }), TypeError);
  assert.throws(() => buildAddApiKeyRequest({ ...VALID, apiKeyValue: '   ' }), TypeError);
});

test('buildAddApiKeyRequest: 라벨이 100자를 넘으면 거부한다(2026-08-19 실측 발견)', () => {
  assert.throws(
    () => buildAddApiKeyRequest({ ...VALID, label: 'a'.repeat(101) }),
    /100자를 넘을 수 없습니다/
  );
  // 경계값: 정확히 100자는 통과해야 한다
  const result = buildAddApiKeyRequest({ ...VALID, label: 'a'.repeat(100) });
  assert.equal(result.account.label.length, 100);
});

test('buildAddApiKeyRequest: 라벨에 개행 등 제어문자가 있으면 거부한다(2026-08-19 실측 발견)', () => {
  assert.throws(
    () => buildAddApiKeyRequest({ ...VALID, label: 'line1\nline2' }),
    /제어문자/
  );
  assert.throws(() => buildAddApiKeyRequest({ ...VALID, label: '탭\t포함' }), /제어문자/);
});

test('buildAddApiKeyRequest: 이미 등록된 라벨이면 자동 변경 없이 거부한다(슬롯 충돌 방지)', () => {
  assert.throws(
    () => buildAddApiKeyRequest({ ...VALID, existingLabels: ['업무용', '개인용'] }),
    /이미 등록되어 있습니다/
  );
});

test('buildAddApiKeyRequest: existingLabels가 비어있거나 겹치지 않으면 통과한다', () => {
  const result = buildAddApiKeyRequest({ ...VALID, existingLabels: ['개인용'] });
  assert.equal(result.account.label, '업무용');
});

test('buildAddApiKeyRequest: 반환값에 apiKeyValue 원문이 account 객체 안에는 없다(자격증명 분리 원칙)', () => {
  const result = buildAddApiKeyRequest(VALID);
  assert.equal(JSON.stringify(result.account).includes('test-fake-key-not-real'), false);
});
