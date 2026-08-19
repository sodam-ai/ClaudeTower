'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const readline = require('node:readline');
const { PassThrough } = require('node:stream');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { appendAccount, readRegistry } = require('../../src/accounts/accounts/accounts-registry');

const CREDENTIAL_STORE_PATH = require.resolve('../../src/accounts/credential-store');
const COMMAND_PATH = require.resolve('../../src/accounts/accounts/remove-account-command');
const ADD_API_KEY_COMMAND_PATH = require.resolve('../../src/accounts/accounts/add-api-key-command');

// accounts-purge-command.test.js와 동일한 패턴(같은 이유: 캐시 오염 방지).
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

  const { runRemoveAccountCommand } = require('../../src/accounts/accounts/remove-account-command');

  try {
    fn(runRemoveAccountCommand, calls);
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
  return path.join(os.tmpdir(), `claudetower-${prefix}-test-${Date.now()}-${Math.random().toString(36).slice(2)}.json`);
}

function fakeInteractiveSession(answerText) {
  const input = new PassThrough();
  const output = new PassThrough();
  output.on('data', () => {});
  const rl = readline.createInterface({ input, output });
  setImmediate(() => input.end(answerText));
  return rl;
}

test('존재하지 않는 라벨이면 확인도 묻지 않고 즉시 거부한다', async () => {
  await withMockedCredentialStore({}, async (run, calls) => {
    const registryPath = tmpJsonPath('registry');
    const rl = fakeInteractiveSession('');
    const result = await run(rl, 'ghost', { registryPath, log: () => {} });
    rl.close();
    assert.equal(result.applied, false);
    assert.equal(result.reason, 'account_not_found');
    assert.equal(calls.length, 0);
  });
});

test('N 입력 시 아무것도 삭제하지 않는다', async () => {
  await withMockedCredentialStore({}, async (run, calls) => {
    const registryPath = tmpJsonPath('registry');
    appendAccount({ account_id: 'a1', label: 'work', auth_type: 'api_key', status: 'active', created_at: '2026-08-20T00:00:00Z' }, registryPath);
    const rl = fakeInteractiveSession('n\n');
    const result = await run(rl, 'work', { registryPath, log: () => {} });
    rl.close();
    assert.equal(result.applied, false);
    assert.equal(calls.length, 0);
    assert.equal(readRegistry(registryPath).length, 1);
    fs.unlinkSync(registryPath);
  });
});

test('y 입력 시 해당 계정만 삭제하고 나머지는 그대로 남긴다', async () => {
  await withMockedCredentialStore({}, async (run, calls) => {
    const registryPath = tmpJsonPath('registry');
    appendAccount({ account_id: 'a1', label: 'work', auth_type: 'api_key', status: 'active', created_at: '2026-08-20T00:00:00Z' }, registryPath);
    appendAccount({ account_id: 'a2', label: 'personal', auth_type: 'api_key', status: 'active', created_at: '2026-08-20T01:00:00Z' }, registryPath);

    const rl = fakeInteractiveSession('y\n');
    const logs = [];
    const result = await run(rl, 'work', { registryPath, log: (m) => logs.push(m) });
    rl.close();

    assert.equal(result.applied, true);
    assert.equal(result.accountId, 'a1');
    const remaining = readRegistry(registryPath);
    assert.equal(remaining.length, 1);
    assert.equal(remaining[0].label, 'personal');
    assert.equal(calls.filter((c) => c.method === 'deleteSecret').length, 1);
    assert.ok(logs.some((l) => l.includes('삭제했습니다')));
    fs.unlinkSync(registryPath);
  });
});

test('삭제 후 재조회했는데도 자격증명이 남아있으면 레지스트리에서 지우지 않는다', async () => {
  await withMockedCredentialStore({ getSecret: () => 'still-there' }, async (run, calls) => {
    const registryPath = tmpJsonPath('registry');
    appendAccount({ account_id: 'a1', label: 'work', auth_type: 'api_key', status: 'active', created_at: '2026-08-20T00:00:00Z' }, registryPath);
    const rl = fakeInteractiveSession('y\n');
    const result = await run(rl, 'work', { registryPath, log: () => {} });
    rl.close();
    assert.equal(result.applied, false);
    assert.equal(result.reason, 'credential_still_present');
    assert.equal(readRegistry(registryPath).length, 1, '실패 시 레지스트리는 그대로 남아야 한다');
    fs.unlinkSync(registryPath);
  });
});

test('remove-account-command.js는 oauth/proxy를 절대 require하지 않는다(credential-store는 정상 참조, 정적 검사)', () => {
  const source = fs.readFileSync(
    path.join(__dirname, '..', '..', 'src', 'accounts', 'accounts', 'remove-account-command.js'),
    'utf8'
  );
  assert.doesNotMatch(source, /require\(['"].*oauth\//);
  assert.doesNotMatch(source, /require\(['"].*proxy\//);
});
