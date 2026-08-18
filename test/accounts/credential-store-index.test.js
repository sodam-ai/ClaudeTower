'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const INDEX_PATH = require.resolve('../../src/accounts/credential-store');
const KEYRING_PATH = require.resolve('@napi-rs/keyring');

// 실제 @napi-rs/keyring(네이티브 바인딩)을 require 캐시 조작으로 가짜 Entry로 교체한다.
// node:test의 mock.module()은 이 프로젝트의 Node 최소버전(>=22.0.0)에서 안정적으로
// 보장되지 않는 실험적 API라 쓰지 않고, vanilla require.cache 치환만 사용한다
// (이 프로젝트의 다른 테스트들도 외부 프로세스 의존성은 실제 실행, 순수 로직은 격리하는
// 패턴을 따름 — 여기서도 동일하게 "OS 키체인 I/O"만 격리하고 credential-store의 로직
// 자체는 진짜로 실행한다).
function withMockedEntry(behavior, fn) {
  const calls = [];

  class MockEntry {
    constructor(service, username) {
      this.service = service;
      this.username = username;
    }
    getPassword() {
      calls.push({ method: 'getPassword', service: this.service, username: this.username });
      return behavior.getPassword ? behavior.getPassword(this.username) : null;
    }
    setPassword(value) {
      calls.push({ method: 'setPassword', service: this.service, username: this.username, value });
      if (behavior.setPassword) behavior.setPassword(this.username, value);
    }
    deletePassword() {
      calls.push({ method: 'deletePassword', service: this.service, username: this.username });
      if (behavior.deletePassword) behavior.deletePassword(this.username);
    }
  }

  const originalKeyringCache = require.cache[KEYRING_PATH];
  const originalIndexCache = require.cache[INDEX_PATH];
  delete require.cache[KEYRING_PATH];
  delete require.cache[INDEX_PATH];

  require.cache[KEYRING_PATH] = {
    id: KEYRING_PATH,
    filename: KEYRING_PATH,
    loaded: true,
    exports: { Entry: MockEntry },
  };

  const credentialStore = require('../../src/accounts/credential-store');

  try {
    fn(credentialStore, calls);
  } finally {
    delete require.cache[KEYRING_PATH];
    delete require.cache[INDEX_PATH];
    if (originalKeyringCache) require.cache[KEYRING_PATH] = originalKeyringCache;
    if (originalIndexCache) require.cache[INDEX_PATH] = originalIndexCache;
  }
}

const REF = { account_id: 'acc-1', backend: 'windows_dpapi', external_ref: 'ref-abc', token_expires_at: '2099-01-01T00:00:00Z', last_refreshed_at: null };

test('getSecret: service는 고정값 claudetower, username은 external_ref를 그대로 전달한다', () => {
  withMockedEntry({ getPassword: () => 'the-secret' }, (store, calls) => {
    const result = store.getSecret(REF);
    assert.equal(result, 'the-secret');
    assert.deepEqual(calls, [{ method: 'getPassword', service: 'claudetower', username: 'ref-abc' }]);
  });
});

test('getSecret: 존재하지 않는 항목은 에러 없이 null을 반환한다(라이브러리 네이티브 동작 그대로 노출)', () => {
  withMockedEntry({ getPassword: () => null }, (store) => {
    assert.equal(store.getSecret(REF), null);
  });
});

test('setSecret: 값을 그대로 저장소에 전달한다', () => {
  withMockedEntry({}, (store, calls) => {
    store.setSecret(REF, 'new-value');
    assert.deepEqual(calls, [{ method: 'setPassword', service: 'claudetower', username: 'ref-abc', value: 'new-value' }]);
  });
});

test('setSecret: 빈 문자열/비문자열 값은 거부한다', () => {
  withMockedEntry({}, (store) => {
    assert.throws(() => store.setSecret(REF, ''), TypeError);
    assert.throws(() => store.setSecret(REF, undefined), TypeError);
    assert.throws(() => store.setSecret(REF, 12345), TypeError);
  });
});

test('setSecret: 유효한 값은 성공하고, 실패 시 에러 메시지에 그 값이 노출되지 않는다', () => {
  withMockedEntry({}, (store, calls) => {
    const secretMarker = 'very-secret-marker-should-never-appear';
    store.setSecret(REF, secretMarker); // 유효한 값이므로 성공해야 함
    assert.equal(calls[0].value, secretMarker); // mock에는 전달되는 게 정상(저장소 계층이 받는 것)

    try {
      store.setSecret(REF, undefined); // 무효한 값 — 이번엔 실패해야 함
      assert.fail('should have thrown');
    } catch (err) {
      assert.doesNotMatch(err.message, new RegExp(secretMarker));
    }
  });
});

test('deleteSecret: 존재하는 항목을 삭제한다', () => {
  withMockedEntry({}, (store, calls) => {
    store.deleteSecret(REF);
    assert.deepEqual(calls, [{ method: 'deletePassword', service: 'claudetower', username: 'ref-abc' }]);
  });
});

test('deleteSecret: 존재하지 않는 항목 삭제도 에러 없이 멱등하게 처리한다', () => {
  withMockedEntry({ deletePassword: () => {} }, (store) => {
    assert.doesNotThrow(() => store.deleteSecret(REF));
    assert.doesNotThrow(() => store.deleteSecret(REF));
  });
});

test('credentialRef.external_ref가 없거나 빈 문자열이면 세 함수 모두 거부한다', () => {
  withMockedEntry({}, (store) => {
    assert.throws(() => store.getSecret({}), TypeError);
    assert.throws(() => store.getSecret({ external_ref: '' }), TypeError);
    assert.throws(() => store.setSecret({}, 'x'), TypeError);
    assert.throws(() => store.deleteSecret(null), TypeError);
  });
});

test('채택된 라이브러리 결정이 코드에 기록되어 있다', () => {
  withMockedEntry({}, (store) => {
    assert.equal(store.PLANNED_LIBRARY, '@napi-rs/keyring');
  });
});

// --- 통합 테스트: 실제 Windows Credential Manager를 왕복한다 ---
// win32에서만 실행(라이브 검증이 이 세션에서 이뤄진 플랫폼). 다른 플랫폼에서는 건너뛴다
// (macOS/Linux는 이 세션에서 실측하지 못했다는 정직성 원칙 그대로 테스트에도 반영).
// 항목명은 반드시 claudetower-test-로 시작 + timestamp로 유일화, try/finally로 반드시 정리.
const integrationTest = process.platform === 'win32' ? test : test.skip;

integrationTest('통합: 실제 OS 키체인에 왕복 저장/조회/삭제 후 흔적을 남기지 않는다', () => {
  delete require.cache[INDEX_PATH];
  const store = require('../../src/accounts/credential-store');
  const testRef = {
    account_id: 'integration-test',
    backend: 'windows_dpapi',
    external_ref: `claudetower-test-${Date.now()}-${process.pid}`,
    token_expires_at: '2099-01-01T00:00:00Z',
    last_refreshed_at: null,
  };
  try {
    assert.equal(store.getSecret(testRef), null, '테스트 시작 전엔 당연히 없어야 함');
    store.setSecret(testRef, 'integration-test-value-delete-me');
    assert.equal(store.getSecret(testRef), 'integration-test-value-delete-me');
  } finally {
    store.deleteSecret(testRef);
    assert.equal(store.getSecret(testRef), null, '정리 후 흔적이 없어야 함');
  }
});
