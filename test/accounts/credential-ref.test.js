'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createCredentialRef } = require('../../src/accounts/credential-store/credential-ref');

const VALID = {
  accountId: 'acc-001',
  backend: 'windows_dpapi',
  externalRef: 'claudetower/acc-001',
  tokenExpiresAt: '2026-07-04T18:00:00Z',
};

test('createCredentialRef: 정상 값이면 생성되고 비밀값 필드는 애초에 존재하지 않는다', () => {
  const ref = createCredentialRef(VALID);
  assert.equal(ref.backend, 'windows_dpapi');
  assert.deepEqual(Object.keys(ref).sort(), [
    'account_id',
    'backend',
    'external_ref',
    'last_refreshed_at',
    'token_expires_at',
  ]);
});

test('createCredentialRef: 임의 필드(token 등)를 함께 넘겨도 결과 객체에 섞여 들어가지 않는다', () => {
  const ref = createCredentialRef({ ...VALID, token: 'sk-should-not-appear', secret: 'nope' });
  assert.equal('token' in ref, false);
  assert.equal('secret' in ref, false);
});

test('createCredentialRef: backend가 문서화된 4종이 아니면 거부한다', () => {
  assert.throws(() => createCredentialRef({ ...VALID, backend: 'plaintext_file' }), TypeError);
});

test('createCredentialRef: externalRef/tokenExpiresAt이 비어있으면 거부한다', () => {
  assert.throws(() => createCredentialRef({ ...VALID, externalRef: '' }), TypeError);
  assert.throws(() => createCredentialRef({ ...VALID, tokenExpiresAt: '' }), TypeError);
});
