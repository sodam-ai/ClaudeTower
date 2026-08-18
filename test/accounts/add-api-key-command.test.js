'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { readActivationState, writeActivationState } = require('../../src/accounts/module-activation-state-store');
const { createModuleActivationState } = require('../../src/accounts/module-activation-state');
const { readRegistry } = require('../../src/accounts/accounts/accounts-registry');

const CREDENTIAL_STORE_PATH = require.resolve('../../src/accounts/credential-store');
const COMMAND_PATH = require.resolve('../../src/accounts/accounts/add-api-key-command');

// credential-store 모듈 자체를 가짜로 치환한다(getSecret/setSecret/deleteSecret) —
// 이 테스트는 add-api-key-command의 "무엇을 어떤 순서로 호출하는지" 로직만 검증하고,
// 실제 OS 키체인 I/O 정확성은 credential-store-index.test.js가 이미 별도로 검증한다.
function withMockedCredentialStore(behavior, fn) {
  const calls = [];
  const mock = {
    getSecret: (ref) => {
      calls.push({ method: 'getSecret', ref });
      return behavior.getSecret ? behavior.getSecret(ref) : null;
    },
    setSecret: (ref, value) => {
      calls.push({ method: 'setSecret', ref, value });
      if (behavior.setSecret) behavior.setSecret(ref, value);
    },
    deleteSecret: (ref) => {
      calls.push({ method: 'deleteSecret', ref });
      if (behavior.deleteSecret) behavior.deleteSecret(ref);
    },
  };

  const originalStoreCache = require.cache[CREDENTIAL_STORE_PATH];
  const originalCommandCache = require.cache[COMMAND_PATH];
  delete require.cache[CREDENTIAL_STORE_PATH];
  delete require.cache[COMMAND_PATH];
  require.cache[CREDENTIAL_STORE_PATH] = {
    id: CREDENTIAL_STORE_PATH,
    filename: CREDENTIAL_STORE_PATH,
    loaded: true,
    exports: mock,
  };

  const { runAddApiKeyCommand } = require('../../src/accounts/accounts/add-api-key-command');

  try {
    fn(runAddApiKeyCommand, calls);
  } finally {
    delete require.cache[CREDENTIAL_STORE_PATH];
    delete require.cache[COMMAND_PATH];
    if (originalStoreCache) require.cache[CREDENTIAL_STORE_PATH] = originalStoreCache;
    if (originalCommandCache) require.cache[COMMAND_PATH] = originalCommandCache;
  }
}

function tmpJsonPath(prefix) {
  return path.join(
    os.tmpdir(),
    `claudetower-${prefix}-test-${Date.now()}-${Math.random().toString(36).slice(2)}.json`
  );
}

function enabledState(activationStatePath) {
  writeActivationState(createModuleActivationState({ enabled: true, consentGivenAt: '2026-08-19T00:00:00Z' }), activationStatePath);
}

test('모듈 비활성화 상태에서는 credential-store를 전혀 호출하지 않고 거부한다', () => {
  withMockedCredentialStore({}, (runAddApiKeyCommand, calls) => {
    const activationStatePath = tmpJsonPath('activation');
    const registryPath = tmpJsonPath('registry');
    const logs = [];
    const result = runAddApiKeyCommand(
      { label: 'work', apiKeyValue: 'test-api-key-marker-do-not-use' },
      { activationStatePath, registryPath, log: (m) => logs.push(m) }
    );
    assert.equal(result.applied, false);
    assert.equal(calls.length, 0);
    assert.ok(logs.some((l) => l.includes('enable')));
  });
});

test('활성화 상태에서 정상 등록: setSecret 호출 + 레지스트리에 시크릿 없이 기록', () => {
  withMockedCredentialStore({}, (runAddApiKeyCommand, calls) => {
    const activationStatePath = tmpJsonPath('activation');
    const registryPath = tmpJsonPath('registry');
    enabledState(activationStatePath);

    const secretMarker = 'test-api-key-marker-do-not-use';
    const logs = [];
    const result = runAddApiKeyCommand(
      { label: 'work', apiKeyValue: secretMarker },
      { activationStatePath, registryPath, log: (m) => logs.push(m) }
    );

    assert.equal(result.applied, true);
    const setCall = calls.find((c) => c.method === 'setSecret');
    assert.ok(setCall);
    assert.equal(setCall.value, secretMarker);

    const registry = readRegistry(registryPath);
    assert.equal(registry.length, 1);
    assert.equal(registry[0].label, 'work');
    assert.equal(registry[0].auth_type, 'api_key');
    const rawRegistryFile = fs.readFileSync(registryPath, 'utf8');
    assert.doesNotMatch(rawRegistryFile, new RegExp(secretMarker));
    assert.ok(logs.some((l) => l.includes('등록했습니다')));

    fs.unlinkSync(activationStatePath);
    fs.unlinkSync(registryPath);
  });
});

test('라벨 중복 시 credential-store를 호출하지 않고 거부한다(검증이 저장보다 먼저)', () => {
  withMockedCredentialStore({}, (runAddApiKeyCommand, calls) => {
    const activationStatePath = tmpJsonPath('activation');
    const registryPath = tmpJsonPath('registry');
    enabledState(activationStatePath);

    runAddApiKeyCommand(
      { label: 'work', apiKeyValue: 'first-key-marker' },
      { activationStatePath, registryPath, log: () => {} }
    );
    calls.length = 0; // 첫 등록 호출 기록 제거, 두 번째 시도만 확인

    const result = runAddApiKeyCommand(
      { label: 'work', apiKeyValue: 'second-key-marker' },
      { activationStatePath, registryPath, log: () => {} }
    );
    assert.equal(result.applied, false);
    assert.equal(calls.length, 0, '라벨 중복은 credential-store 호출 전에 걸러져야 한다');

    fs.unlinkSync(activationStatePath);
    fs.unlinkSync(registryPath);
  });
});

test('레지스트리 쓰기 실패 시 방금 저장한 키를 롤백(delete)한다', () => {
  withMockedCredentialStore({}, (runAddApiKeyCommand, calls) => {
    const activationStatePath = tmpJsonPath('activation');
    enabledState(activationStatePath);
    // 존재할 수 없는 디렉터리 경로(파일이 아니라 디렉터리인 척)를 registryPath로 줘서
    // 레지스트리 쓰기 자체가 실패하도록 강제한다.
    const brokenDir = tmpJsonPath('broken-dir');
    fs.mkdirSync(brokenDir);
    const registryPath = brokenDir; // 디렉터리 경로에 파일을 쓰려고 하면 에러 발생

    const logs = [];
    const result = runAddApiKeyCommand(
      { label: 'work', apiKeyValue: 'rollback-test-marker' },
      { activationStatePath, registryPath, log: (m) => logs.push(m) }
    );

    assert.equal(result.applied, false);
    const methods = calls.map((c) => c.method);
    assert.deepEqual(methods, ['setSecret', 'deleteSecret'], '쓰기 실패 시 setSecret → deleteSecret(롤백) 순서여야 한다');
    assert.ok(logs.some((l) => l.includes('롤백')));

    fs.unlinkSync(activationStatePath);
    fs.rmdirSync(brokenDir);
  });
});

test('add-api-key-command.js는 oauth/proxy를 절대 require하지 않는다(credential-store는 정상 참조, 정적 검사)', () => {
  const source = fs.readFileSync(
    path.join(__dirname, '..', '..', 'src', 'accounts', 'accounts', 'add-api-key-command.js'),
    'utf8'
  );
  assert.doesNotMatch(source, /require\(['"].*oauth\//);
  assert.doesNotMatch(source, /require\(['"].*proxy\//);
  assert.match(source, /require\(['"]\.\.\/credential-store['"]\)/);
});

// --- 통합 테스트: 실제 OS 키체인까지 왕복(mock 없음) ---
const integrationTest = process.platform === 'win32' ? test : test.skip;

integrationTest('통합: enable → add --api-key 전체 흐름이 실제 Credential Manager까지 왕복하고 흔적을 안 남긴다', () => {
  const { runAddApiKeyCommand } = require('../../src/accounts/accounts/add-api-key-command');
  const { getSecret, deleteSecret } = require('../../src/accounts/credential-store');

  const activationStatePath = tmpJsonPath('integration-activation');
  const registryPath = tmpJsonPath('integration-registry');
  enabledState(activationStatePath);

  const secretMarker = `claudetower-test-${Date.now()}-${process.pid}`;
  let accountId;
  try {
    const result = runAddApiKeyCommand(
      { label: 'integration-test-account', apiKeyValue: secretMarker },
      { activationStatePath, registryPath, log: () => {} }
    );
    assert.equal(result.applied, true);
    accountId = result.accountId;

    const registry = readRegistry(registryPath);
    const stored = getSecret({ external_ref: accountId });
    assert.equal(stored, secretMarker);
  } finally {
    if (accountId) {
      deleteSecret({ external_ref: accountId });
      assert.equal(getSecret({ external_ref: accountId }), null, '정리 후 흔적이 없어야 함');
    }
    if (fs.existsSync(activationStatePath)) fs.unlinkSync(activationStatePath);
    if (fs.existsSync(registryPath)) fs.unlinkSync(registryPath);
  }
});
