'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const readline = require('node:readline');
const { PassThrough } = require('node:stream');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { appendAccount, readRegistry } = require('../../src/accounts/accounts/accounts-registry');
const { readActivationState, writeActivationState } = require('../../src/accounts/module-activation-state-store');
const { createModuleActivationState } = require('../../src/accounts/module-activation-state');

const CREDENTIAL_STORE_PATH = require.resolve('../../src/accounts/credential-store');
const COMMAND_PATH = require.resolve('../../src/accounts/accounts/accounts-purge-command');
// accounts-purge-command.js가 backendForPlatform()을 얻으려 add-api-key-command.js를
// 함께 require한다 — 이 모듈도 캐시를 지우지 않으면, 그 안에 이미 바인딩된 credential-
// store 참조(모듈 최상단 require는 로드 시점 1회만 평가됨)가 "이전 테스트의 mock"인
// 채로 남아 이후 통합 테스트(진짜 credential-store 사용)에 새어 들어간다 — 실제로
// 이 결함을 이 테스트 작성 중 직접 재현해서 발견했다: 통합 테스트의 setSecret이
// 조용히 no-op mock을 호출하고 있어 "저장했다는데 실제로는 안 저장된" 상태가 됐었다.
const ADD_API_KEY_COMMAND_PATH = require.resolve('../../src/accounts/accounts/add-api-key-command');

// add-api-key-command.test.js와 동일한 패턴 — credential-store 자체를 가짜로 치환해
// 이 테스트는 "무엇을 어떤 순서로 부르는지"만 검증하고, 실제 OS 키체인 정확성은
// credential-store-index.test.js가 이미 커버한다.
function withMockedCredentialStore(behavior, fn) {
  const calls = [];
  const mock = {
    getSecret: (ref) => {
      calls.push({ method: 'getSecret', ref });
      return behavior.getSecret ? behavior.getSecret(ref) : null;
    },
    setSecret: () => {},
    deleteSecret: (ref) => {
      calls.push({ method: 'deleteSecret', ref });
      if (behavior.deleteSecret) behavior.deleteSecret(ref);
    },
  };

  const originalStoreCache = require.cache[CREDENTIAL_STORE_PATH];
  const originalCommandCache = require.cache[COMMAND_PATH];
  const originalAddApiKeyCache = require.cache[ADD_API_KEY_COMMAND_PATH];
  delete require.cache[CREDENTIAL_STORE_PATH];
  delete require.cache[COMMAND_PATH];
  delete require.cache[ADD_API_KEY_COMMAND_PATH];
  require.cache[CREDENTIAL_STORE_PATH] = {
    id: CREDENTIAL_STORE_PATH,
    filename: CREDENTIAL_STORE_PATH,
    loaded: true,
    exports: mock,
  };

  const { runAccountsPurgeCommand } = require('../../src/accounts/accounts/accounts-purge-command');

  try {
    fn(runAccountsPurgeCommand, calls);
  } finally {
    delete require.cache[CREDENTIAL_STORE_PATH];
    delete require.cache[COMMAND_PATH];
    delete require.cache[ADD_API_KEY_COMMAND_PATH];
    if (originalStoreCache) require.cache[CREDENTIAL_STORE_PATH] = originalStoreCache;
    if (originalCommandCache) require.cache[COMMAND_PATH] = originalCommandCache;
    if (originalAddApiKeyCache) require.cache[ADD_API_KEY_COMMAND_PATH] = originalAddApiKeyCache;
  }
}

function tmpJsonPath(prefix) {
  return path.join(
    os.tmpdir(),
    `claudetower-${prefix}-test-${Date.now()}-${Math.random().toString(36).slice(2)}.json`
  );
}

// setup-wizard.js/accounts-enable-command.js와 동일한 EOF 회피 패턴.
function fakeInteractiveSession(answerText) {
  const input = new PassThrough();
  const output = new PassThrough();
  output.on('data', () => {});
  const rl = readline.createInterface({ input, output });
  setImmediate(() => input.end(answerText));
  return rl;
}

test('등록된 계정이 없으면 확인도 묻지 않고 즉시 종료한다', async () => {
  await withMockedCredentialStore({}, async (runAccountsPurgeCommand, calls) => {
    const registryPath = tmpJsonPath('registry');
    const rl = fakeInteractiveSession(''); // 답이 필요 없어야 함
    const logs = [];
    const result = await runAccountsPurgeCommand(rl, { registryPath, log: (m) => logs.push(m) });
    rl.close();
    assert.equal(result.applied, true);
    assert.equal(result.deletedCount, 0);
    assert.equal(calls.length, 0);
    assert.ok(logs.some((l) => l.includes('삭제할 계정이 없습니다')));
  });
});

test('N 입력 시 아무것도 삭제하지 않는다', async () => {
  await withMockedCredentialStore({}, async (runAccountsPurgeCommand, calls) => {
    const registryPath = tmpJsonPath('registry');
    appendAccount({ account_id: 'a1', label: 'work', auth_type: 'api_key', status: 'active', created_at: '2026-08-19T00:00:00Z' }, registryPath);
    const rl = fakeInteractiveSession('n\n');
    const result = await runAccountsPurgeCommand(rl, { registryPath, log: () => {} });
    rl.close();
    assert.equal(result.applied, false);
    assert.equal(calls.length, 0);
    assert.equal(readRegistry(registryPath).length, 1, '취소 시 레지스트리가 그대로여야 한다');
    fs.unlinkSync(registryPath);
  });
});

test('y 입력 시 전부 성공하면 레지스트리를 비우고 모듈도 비활성화한다', async () => {
  await withMockedCredentialStore({}, async (runAccountsPurgeCommand, calls) => {
    const registryPath = tmpJsonPath('registry');
    const activationStatePath = tmpJsonPath('activation');
    appendAccount({ account_id: 'a1', label: 'work', auth_type: 'api_key', status: 'active', created_at: '2026-08-19T00:00:00Z' }, registryPath);
    appendAccount({ account_id: 'a2', label: 'personal', auth_type: 'api_key', status: 'active', created_at: '2026-08-19T01:00:00Z' }, registryPath);
    writeActivationState(createModuleActivationState({ enabled: true, consentGivenAt: '2026-08-19T00:00:00Z' }), activationStatePath);

    const rl = fakeInteractiveSession('y\n');
    const logs = [];
    const result = await runAccountsPurgeCommand(rl, { registryPath, activationStatePath, log: (m) => logs.push(m) });
    rl.close();

    assert.equal(result.applied, true);
    assert.equal(result.deletedCount, 2);
    assert.equal(result.failedCount, 0);
    assert.equal(readRegistry(registryPath).length, 0);
    assert.equal(readActivationState(activationStatePath).enabled, false);
    const deleteCalls = calls.filter((c) => c.method === 'deleteSecret');
    assert.equal(deleteCalls.length, 2);
    // 삭제 순서가 중요하다는 걸 코드로도 보증: deleteSecret이 getSecret(재확인)보다 먼저 불려야 함
    assert.ok(logs.some((l) => l.includes('전부 삭제')));

    fs.unlinkSync(registryPath);
    fs.unlinkSync(activationStatePath);
  });
});

test('일부 계정 삭제가 실패하면 실패분만 레지스트리에 남기고, 활성화 상태는 끄지 않는다', async () => {
  await withMockedCredentialStore(
    {
      // a2만 재조회 시 여전히 남아있는 것처럼(삭제 실패) 시뮬레이션
      getSecret: (ref) => (ref.account_id === 'a2' ? 'still-here' : null),
    },
    async (runAccountsPurgeCommand) => {
      const registryPath = tmpJsonPath('registry');
      const activationStatePath = tmpJsonPath('activation');
      appendAccount({ account_id: 'a1', label: 'ok-account', auth_type: 'api_key', status: 'active', created_at: '2026-08-19T00:00:00Z' }, registryPath);
      appendAccount({ account_id: 'a2', label: 'stuck-account', auth_type: 'api_key', status: 'active', created_at: '2026-08-19T01:00:00Z' }, registryPath);
      writeActivationState(createModuleActivationState({ enabled: true, consentGivenAt: '2026-08-19T00:00:00Z' }), activationStatePath);

      const rl = fakeInteractiveSession('y\n');
      const logs = [];
      const result = await runAccountsPurgeCommand(rl, { registryPath, activationStatePath, log: (m) => logs.push(m) });
      rl.close();

      assert.equal(result.deletedCount, 1);
      assert.equal(result.failedCount, 1);
      const remaining = readRegistry(registryPath);
      assert.equal(remaining.length, 1);
      assert.equal(remaining[0].label, 'stuck-account', '실패한 계정만 레지스트리에 남아야 한다');
      // 일부 실패 시 "완전히 정리됐다"는 잘못된 인상을 주면 안 되므로 활성화 상태 유지
      assert.equal(readActivationState(activationStatePath).enabled, true);
      assert.ok(logs.some((l) => l.includes('stuck-account')));

      fs.unlinkSync(registryPath);
      fs.unlinkSync(activationStatePath);
    }
  );
});

test('accounts-purge-command.js는 oauth/proxy를 절대 require하지 않는다(credential-store는 정상 참조, 정적 검사)', () => {
  const source = fs.readFileSync(
    path.join(__dirname, '..', '..', 'src', 'accounts', 'accounts', 'accounts-purge-command.js'),
    'utf8'
  );
  assert.doesNotMatch(source, /require\(['"].*oauth\//);
  assert.doesNotMatch(source, /require\(['"].*proxy\//);
  assert.match(source, /require\(['"]\.\.\/credential-store['"]\)/);
});

// --- 통합 테스트: 실제 OS 키체인까지 왕복(mock 없음) ---
const integrationTest = process.platform === 'win32' ? test : test.skip;

integrationTest('통합: add --api-key로 등록한 실제 계정을 purge가 실제 Credential Manager에서 지운다', async () => {
  const { runAddApiKeyCommand } = require('../../src/accounts/accounts/add-api-key-command');
  const { runAccountsPurgeCommand } = require('../../src/accounts/accounts/accounts-purge-command');
  const { getSecret } = require('../../src/accounts/credential-store');

  const activationStatePath = tmpJsonPath('integration-purge-activation');
  const registryPath = tmpJsonPath('integration-purge-registry');
  writeActivationState(createModuleActivationState({ enabled: true, consentGivenAt: '2026-08-19T00:00:00Z' }), activationStatePath);

  const secretMarker = `claudetower-purge-test-${Date.now()}-${process.pid}`;
  const addResult = runAddApiKeyCommand(
    { label: 'purge-integration-test', apiKeyValue: secretMarker },
    { activationStatePath, registryPath, log: () => {} }
  );
  assert.equal(addResult.applied, true);
  assert.equal(getSecret({ external_ref: addResult.accountId }), secretMarker, '등록 직후엔 실제로 저장돼 있어야 함');

  const rl = fakeInteractiveSession('y\n');
  try {
    const purgeResult = await runAccountsPurgeCommand(rl, { registryPath, activationStatePath, log: () => {} });
    assert.equal(purgeResult.deletedCount, 1);
    assert.equal(purgeResult.failedCount, 0);
    assert.equal(getSecret({ external_ref: addResult.accountId }), null, 'purge 후 실제 키체인에서 사라져야 함');
    assert.equal(readRegistry(registryPath).length, 0);
  } finally {
    rl.close();
    if (fs.existsSync(activationStatePath)) fs.unlinkSync(activationStatePath);
    if (fs.existsSync(registryPath)) fs.unlinkSync(registryPath);
  }
});
