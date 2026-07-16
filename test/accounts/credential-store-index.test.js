'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { getSecret, setSecret, deleteSecret, PLANNED_LIBRARY } = require('../../src/accounts/credential-store');

test('credential-store 인터페이스: 세 함수 모두 아직 미구현이라 명시적으로 throw한다(M6 게이트 증명)', () => {
  assert.throws(() => getSecret({}), /Phase 2 게이트 대기/);
  assert.throws(() => setSecret({}, 'x'), /Phase 2 게이트 대기/);
  assert.throws(() => deleteSecret({}), /Phase 2 게이트 대기/);
});

test('credential-store 인터페이스: 채택된 라이브러리 결정이 코드에 기록되어 있다', () => {
  assert.equal(PLANNED_LIBRARY, '@napi-rs/keyring');
});
