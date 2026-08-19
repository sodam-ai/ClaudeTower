'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const readline = require('node:readline');
const { PassThrough } = require('node:stream');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { appendAccount } = require('../../src/accounts/accounts/accounts-registry');
const { readQuotaCacheEntry } = require('../../src/accounts/quota/quota-cache-store');

const CREDENTIAL_STORE_PATH = require.resolve('../../src/accounts/credential-store');
const COMMAND_PATH = require.resolve('../../src/accounts/accounts/diagnose-quota-command');
// accounts-purge-command.test.js와 동일한 이유로 add-api-key-command.js(backendForPlatform
// 출처)도 함께 캐시를 비운다 — 안 그러면 이전 테스트의 mock credential-store가 그 모듈에
// 바인딩된 채로 새어 들어갈 수 있다(실제로 이 프로젝트에서 한 번 재현된 결함 부류).
const ADD_API_KEY_COMMAND_PATH = require.resolve('../../src/accounts/accounts/add-api-key-command');

function withMockedCredentialStore(behavior, fn) {
  const mock = {
    getSecret: (ref) => (behavior.getSecret ? behavior.getSecret(ref) : null),
    setSecret: () => {},
    deleteSecret: () => {},
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

  const { runDiagnoseQuotaCommand } = require('../../src/accounts/accounts/diagnose-quota-command');

  try {
    return fn(runDiagnoseQuotaCommand);
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

function fakeInteractiveSession(answerText) {
  const input = new PassThrough();
  const output = new PassThrough();
  output.on('data', () => {});
  const rl = readline.createInterface({ input, output });
  setImmediate(() => input.end(answerText));
  return rl;
}

test('등록되지 않은 라벨이면 확인도 묻지 않고 실패, 네트워크 요청도 보내지 않는다', async () => {
  await withMockedCredentialStore({}, async (runDiagnoseQuotaCommand) => {
    const registryPath = tmpJsonPath('registry');
    const rl = fakeInteractiveSession('');
    let sendCalls = 0;
    const result = await runDiagnoseQuotaCommand(rl, 'no-such-label', {
      registryPath,
      log: () => {},
      send: async () => {
        sendCalls += 1;
        return { statusCode: 200, headers: {} };
      },
    });
    rl.close();
    assert.equal(result.applied, false);
    assert.equal(result.reason, 'account_not_found');
    assert.equal(sendCalls, 0);
  });
});

test('oauth 계정이면 확인도 묻지 않고 거부, 네트워크 요청도 보내지 않는다', async () => {
  await withMockedCredentialStore({}, async (runDiagnoseQuotaCommand) => {
    const registryPath = tmpJsonPath('registry');
    appendAccount(
      { account_id: 'a1', label: 'sub', auth_type: 'oauth', status: 'active', created_at: '2026-08-20T00:00:00Z' },
      registryPath
    );
    const rl = fakeInteractiveSession('');
    let sendCalls = 0;
    const result = await runDiagnoseQuotaCommand(rl, 'sub', {
      registryPath,
      log: () => {},
      send: async () => {
        sendCalls += 1;
        return { statusCode: 200, headers: {} };
      },
    });
    rl.close();
    assert.equal(result.applied, false);
    assert.equal(result.reason, 'unsupported_auth_type');
    assert.equal(sendCalls, 0);
    fs.unlinkSync(registryPath);
  });
});

test('credential store에 시크릿이 없으면 거부, 네트워크 요청도 보내지 않는다', async () => {
  await withMockedCredentialStore({ getSecret: () => null }, async (runDiagnoseQuotaCommand) => {
    const registryPath = tmpJsonPath('registry');
    appendAccount(
      { account_id: 'a1', label: 'work', auth_type: 'api_key', status: 'active', created_at: '2026-08-20T00:00:00Z' },
      registryPath
    );
    const rl = fakeInteractiveSession('');
    let sendCalls = 0;
    const result = await runDiagnoseQuotaCommand(rl, 'work', {
      registryPath,
      log: () => {},
      send: async () => {
        sendCalls += 1;
        return { statusCode: 200, headers: {} };
      },
    });
    rl.close();
    assert.equal(result.applied, false);
    assert.equal(result.reason, 'secret_not_found');
    assert.equal(sendCalls, 0);
    fs.unlinkSync(registryPath);
  });
});

test('N 입력 시 취소하고 네트워크 요청을 보내지 않는다', async () => {
  await withMockedCredentialStore({ getSecret: () => 'sk-ant-test-marker' }, async (runDiagnoseQuotaCommand) => {
    const registryPath = tmpJsonPath('registry');
    appendAccount(
      { account_id: 'a1', label: 'work', auth_type: 'api_key', status: 'active', created_at: '2026-08-20T00:00:00Z' },
      registryPath
    );
    const rl = fakeInteractiveSession('n\n');
    let sendCalls = 0;
    const result = await runDiagnoseQuotaCommand(rl, 'work', {
      registryPath,
      log: () => {},
      send: async () => {
        sendCalls += 1;
        return { statusCode: 200, headers: {} };
      },
    });
    rl.close();
    assert.equal(result.applied, false);
    assert.equal(result.reason, 'cancelled');
    assert.equal(sendCalls, 0);
    fs.unlinkSync(registryPath);
  });
});

test('y 입력 + 기대한 헤더가 전부 있는 응답이면 전부 일치로 보고한다', async () => {
  await withMockedCredentialStore({ getSecret: () => 'sk-ant-test-marker' }, async (runDiagnoseQuotaCommand) => {
    const registryPath = tmpJsonPath('registry');
    appendAccount(
      { account_id: 'a1', label: 'work', auth_type: 'api_key', status: 'active', created_at: '2026-08-20T00:00:00Z' },
      registryPath
    );
    const rl = fakeInteractiveSession('y\n');
    const calls = [];
    const result = await runDiagnoseQuotaCommand(rl, 'work', {
      registryPath,
      log: () => {},
      send: async (apiKey, model) => {
        calls.push({ apiKey, model });
        return {
          statusCode: 200,
          headers: {
            'anthropic-ratelimit-tokens-limit': '1000',
            'anthropic-ratelimit-tokens-remaining': '400',
            'anthropic-ratelimit-tokens-reset': '2026-08-20T01:00:00Z',
            'anthropic-ratelimit-requests-limit': '50',
            'anthropic-ratelimit-requests-remaining': '49',
            'anthropic-ratelimit-requests-reset': '2026-08-20T01:00:00Z',
          },
        };
      },
    });
    rl.close();
    assert.equal(result.applied, true);
    assert.equal(result.foundFields.length, 6);
    assert.equal(result.missingFields.length, 0);
    assert.ok(result.parsed);
    assert.equal(result.parsed.tokens_used_pct, 60);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].apiKey, 'sk-ant-test-marker');
    fs.unlinkSync(registryPath);
  });
});

test('y 입력 + 기대한 헤더가 전혀 없는 응답이면 불일치를 정직하게 보고한다(파서 결과 null)', async () => {
  await withMockedCredentialStore({ getSecret: () => 'sk-ant-test-marker' }, async (runDiagnoseQuotaCommand) => {
    const registryPath = tmpJsonPath('registry');
    appendAccount(
      { account_id: 'a1', label: 'work', auth_type: 'api_key', status: 'active', created_at: '2026-08-20T00:00:00Z' },
      registryPath
    );
    const rl = fakeInteractiveSession('y\n');
    const result = await runDiagnoseQuotaCommand(rl, 'work', {
      registryPath,
      log: () => {},
      send: async () => ({ statusCode: 200, headers: { 'x-request-id': 'abc123' } }),
    });
    rl.close();
    assert.equal(result.applied, true);
    assert.equal(result.foundFields.length, 0);
    assert.equal(result.missingFields.length, 6);
    assert.equal(result.parsed, null);
    fs.unlinkSync(registryPath);
  });
});

test('네트워크 요청 자체가 실패하면 에러를 정직하게 보고한다', async () => {
  await withMockedCredentialStore({ getSecret: () => 'sk-ant-test-marker' }, async (runDiagnoseQuotaCommand) => {
    const registryPath = tmpJsonPath('registry');
    appendAccount(
      { account_id: 'a1', label: 'work', auth_type: 'api_key', status: 'active', created_at: '2026-08-20T00:00:00Z' },
      registryPath
    );
    const rl = fakeInteractiveSession('y\n');
    const result = await runDiagnoseQuotaCommand(rl, 'work', {
      registryPath,
      log: () => {},
      send: async () => {
        throw new Error('getaddrinfo ENOTFOUND api.anthropic.com');
      },
    });
    rl.close();
    assert.equal(result.applied, false);
    assert.equal(result.reason, 'request_failed');
    assert.match(result.error, /ENOTFOUND/);
    fs.unlinkSync(registryPath);
  });
});

test('model 옵션을 넘기면 그 값 그대로 send에 전달된다(기본값을 덮어쓸 수 있다)', async () => {
  await withMockedCredentialStore({ getSecret: () => 'sk-ant-test-marker' }, async (runDiagnoseQuotaCommand) => {
    const registryPath = tmpJsonPath('registry');
    appendAccount(
      { account_id: 'a1', label: 'work', auth_type: 'api_key', status: 'active', created_at: '2026-08-20T00:00:00Z' },
      registryPath
    );
    const rl = fakeInteractiveSession('y\n');
    const calls = [];
    await runDiagnoseQuotaCommand(rl, 'work', {
      registryPath,
      model: 'custom-model-id',
      log: () => {},
      send: async (apiKey, model) => {
        calls.push(model);
        return { statusCode: 200, headers: {} };
      },
    });
    rl.close();
    assert.equal(calls[0], 'custom-model-id');
    fs.unlinkSync(registryPath);
  });
});

test('파싱 성공 시 accounts list가 읽을 사용률 캐시에 저장한다(quotaCachePath)', async () => {
  await withMockedCredentialStore({ getSecret: () => 'sk-ant-test-marker' }, async (runDiagnoseQuotaCommand) => {
    const registryPath = tmpJsonPath('registry');
    const quotaCachePath = tmpJsonPath('quota-cache');
    appendAccount(
      { account_id: 'a1', label: 'work', auth_type: 'api_key', status: 'active', created_at: '2026-08-20T00:00:00Z' },
      registryPath
    );
    const rl = fakeInteractiveSession('y\n');
    await runDiagnoseQuotaCommand(rl, 'work', {
      registryPath,
      quotaCachePath,
      log: () => {},
      send: async () => ({
        statusCode: 200,
        headers: {
          'anthropic-ratelimit-tokens-limit': '1000',
          'anthropic-ratelimit-tokens-remaining': '400',
          'anthropic-ratelimit-requests-limit': '50',
          'anthropic-ratelimit-requests-remaining': '49',
        },
      }),
    });
    rl.close();
    const cached = readQuotaCacheEntry('a1', quotaCachePath);
    assert.ok(cached, '캐시에 저장돼야 한다');
    assert.equal(cached.tokens_used_pct, 60);
    fs.unlinkSync(registryPath);
    fs.unlinkSync(quotaCachePath);
  });
});

test('파싱 실패(헤더 없음)면 캐시에 아무것도 쓰지 않는다', async () => {
  await withMockedCredentialStore({ getSecret: () => 'sk-ant-test-marker' }, async (runDiagnoseQuotaCommand) => {
    const registryPath = tmpJsonPath('registry');
    const quotaCachePath = tmpJsonPath('quota-cache');
    appendAccount(
      { account_id: 'a1', label: 'work', auth_type: 'api_key', status: 'active', created_at: '2026-08-20T00:00:00Z' },
      registryPath
    );
    const rl = fakeInteractiveSession('y\n');
    await runDiagnoseQuotaCommand(rl, 'work', {
      registryPath,
      quotaCachePath,
      log: () => {},
      send: async () => ({ statusCode: 200, headers: {} }),
    });
    rl.close();
    assert.equal(readQuotaCacheEntry('a1', quotaCachePath), null);
    fs.unlinkSync(registryPath);
  });
});

test('diagnose-quota-command.js는 oauth/proxy를 절대 require하지 않는다(credential-store는 정상 참조, 정적 검사)', () => {
  const source = fs.readFileSync(
    path.join(__dirname, '..', '..', 'src', 'accounts', 'accounts', 'diagnose-quota-command.js'),
    'utf8'
  );
  assert.doesNotMatch(source, /require\(['"].*oauth\//);
  assert.doesNotMatch(source, /require\(['"].*proxy\//);
  assert.match(source, /require\(['"]\.\.\/credential-store['"]\)/);
});
