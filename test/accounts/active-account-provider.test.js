'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { appendAccount } = require('../../src/accounts/accounts/accounts-registry');
const { readActiveAccountId } = require('../../src/accounts/accounts/active-account-state');
const { readRotationEvents } = require('../../src/accounts/audit/rotation-log');
const { writeSwitchPolicyField } = require('../../src/accounts/switch-policy-config');

// diagnose-quota-command.test.js/accounts-purge-command.test.js와 동일한 패턴 —
// credential-store 자체를 가짜로 치환한다. add-api-key-command.js(backendForPlatform
// 출처)도 함께 캐시를 비워야, 이전 테스트의 mock이 그 모듈에 바인딩된 채로 새어 들어가지
// 않는다(그 두 테스트 파일이 이미 실측으로 발견한 결함 부류).
const CREDENTIAL_STORE_PATH = require.resolve('../../src/accounts/credential-store');
const PROVIDER_PATH = require.resolve('../../src/accounts/proxy/active-account-provider');
const ADD_API_KEY_COMMAND_PATH = require.resolve('../../src/accounts/accounts/add-api-key-command');

const FAKE_KEY_ONE = 'test-placeholder-key-one';
const FAKE_KEY_TWO = 'test-placeholder-key-two';

function withMockedCredentialStore(secretsByAccountId, fn) {
  const mock = {
    getSecret: (ref) => (Object.prototype.hasOwnProperty.call(secretsByAccountId, ref.account_id) ? secretsByAccountId[ref.account_id] : null),
    setSecret: () => {},
    deleteSecret: () => {},
  };

  const originalStoreCache = require.cache[CREDENTIAL_STORE_PATH];
  const originalProviderCache = require.cache[PROVIDER_PATH];
  const originalAddApiKeyCache = require.cache[ADD_API_KEY_COMMAND_PATH];
  delete require.cache[CREDENTIAL_STORE_PATH];
  delete require.cache[PROVIDER_PATH];
  delete require.cache[ADD_API_KEY_COMMAND_PATH];
  require.cache[CREDENTIAL_STORE_PATH] = { id: CREDENTIAL_STORE_PATH, filename: CREDENTIAL_STORE_PATH, loaded: true, exports: mock };

  const { createActiveAccountProvider } = require('../../src/accounts/proxy/active-account-provider');

  try {
    return fn(createActiveAccountProvider);
  } finally {
    delete require.cache[CREDENTIAL_STORE_PATH];
    delete require.cache[PROVIDER_PATH];
    delete require.cache[ADD_API_KEY_COMMAND_PATH];
    if (originalStoreCache) require.cache[CREDENTIAL_STORE_PATH] = originalStoreCache;
    if (originalProviderCache) require.cache[PROVIDER_PATH] = originalProviderCache;
    if (originalAddApiKeyCache) require.cache[ADD_API_KEY_COMMAND_PATH] = originalAddApiKeyCache;
  }
}

function tmpJsonPath(prefix) {
  return path.join(
    os.tmpdir(),
    `claudetower-${prefix}-test-${Date.now()}-${Math.random().toString(36).slice(2)}.json`
  );
}

function freshPaths() {
  return {
    registryPath: tmpJsonPath('registry'),
    statePath: tmpJsonPath('state'),
    rotationLogPath: tmpJsonPath('rotation-log'),
    activeAccountHandlePath: tmpJsonPath('handle'),
    policyPath: tmpJsonPath('policy'),
  };
}

function cleanup(paths) {
  for (const p of Object.values(paths)) {
    if (fs.existsSync(p)) fs.unlinkSync(p);
  }
}

test('getApiKey: 등록된 계정이 하나도 없으면 실패한다', async () => {
  await withMockedCredentialStore({}, async (createActiveAccountProvider) => {
    const paths = freshPaths();
    const { getApiKey } = createActiveAccountProvider(paths);
    await assert.rejects(() => getApiKey(), /등록된 사용 가능한 API 키 계정이 없습니다/);
    cleanup(paths);
  });
});

test('getApiKey: 활성 계정 포인터가 아직 없으면 registry의 첫 사용 가능 계정을 자동 채택한다', async () => {
  await withMockedCredentialStore({ a1: FAKE_KEY_ONE }, async (createActiveAccountProvider) => {
    const paths = freshPaths();
    appendAccount({ account_id: 'a1', label: 'first', auth_type: 'api_key', status: 'active', created_at: 'x' }, paths.registryPath);
    const { getApiKey } = createActiveAccountProvider(paths);
    assert.equal(await getApiKey(), FAKE_KEY_ONE);
    cleanup(paths);
  });
});

test('getApiKey: 포인터가 설정돼 있으면 그 계정의 키를 쓴다(첫 계정이 아니어도)', async () => {
  await withMockedCredentialStore({ a1: FAKE_KEY_ONE, a2: FAKE_KEY_TWO }, async (createActiveAccountProvider) => {
    const paths = freshPaths();
    appendAccount({ account_id: 'a1', label: 'first', auth_type: 'api_key', status: 'active', created_at: 'x' }, paths.registryPath);
    appendAccount({ account_id: 'a2', label: 'second', auth_type: 'api_key', status: 'active', created_at: 'x' }, paths.registryPath);
    const { writeActiveAccountId } = require('../../src/accounts/accounts/active-account-state');
    writeActiveAccountId('a2', paths.statePath);
    const { getApiKey } = createActiveAccountProvider(paths);
    assert.equal(await getApiKey(), FAKE_KEY_TWO);
    cleanup(paths);
  });
});

test('getApiKey: 포인터가 더 이상 못 쓰는 계정(disabled)을 가리키면 사용 가능한 다른 계정으로 폴백한다', async () => {
  await withMockedCredentialStore({ a2: FAKE_KEY_TWO }, async (createActiveAccountProvider) => {
    const paths = freshPaths();
    appendAccount({ account_id: 'a1', label: 'first', auth_type: 'api_key', status: 'disabled', created_at: 'x' }, paths.registryPath);
    appendAccount({ account_id: 'a2', label: 'second', auth_type: 'api_key', status: 'active', created_at: 'x' }, paths.registryPath);
    const { writeActiveAccountId } = require('../../src/accounts/accounts/active-account-state');
    writeActiveAccountId('a1', paths.statePath); // a1을 가리키지만 이미 disabled
    const { getApiKey } = createActiveAccountProvider(paths);
    assert.equal(await getApiKey(), FAKE_KEY_TWO);
    cleanup(paths);
  });
});

test('getApiKey: credential store에 시크릿이 없으면 실패한다', async () => {
  await withMockedCredentialStore({}, async (createActiveAccountProvider) => {
    const paths = freshPaths();
    appendAccount({ account_id: 'a1', label: 'first', auth_type: 'api_key', status: 'active', created_at: 'x' }, paths.registryPath);
    const { getApiKey } = createActiveAccountProvider(paths);
    await assert.rejects(() => getApiKey(), /API 키를 credential store에서 찾을 수 없습니다/);
    cleanup(paths);
  });
});

test('onUpstreamHeaders: 활성 계정이 없으면 예외 없이 조용히 아무 것도 하지 않는다', async () => {
  await withMockedCredentialStore({}, async (createActiveAccountProvider) => {
    const paths = freshPaths();
    const { onUpstreamHeaders } = createActiveAccountProvider(paths);
    assert.doesNotThrow(() => onUpstreamHeaders({}));
    cleanup(paths);
  });
});

test('onUpstreamHeaders: 임계값 미만 헤더면 전환하지 않는다(상태 파일 그대로)', async () => {
  await withMockedCredentialStore({ a1: FAKE_KEY_ONE, a2: FAKE_KEY_TWO }, async (createActiveAccountProvider) => {
    const paths = freshPaths();
    appendAccount({ account_id: 'a1', label: 'first', auth_type: 'api_key', status: 'active', created_at: 'x' }, paths.registryPath);
    appendAccount({ account_id: 'a2', label: 'second', auth_type: 'api_key', status: 'active', created_at: 'x' }, paths.registryPath);
    writeSwitchPolicyField('threshold_pct', '90', paths.policyPath);
    const { onUpstreamHeaders } = createActiveAccountProvider(paths);

    onUpstreamHeaders({
      'anthropic-ratelimit-tokens-limit': '1000',
      'anthropic-ratelimit-tokens-remaining': '500', // 50% — 임계값(90) 미만
    });

    // 자동 채택은 매번 계산만 될 뿐 상태 파일에 쓰지 않는다(resolveCurrentAccount는
    // 순수 조회) — 전환이 실제로 일어난 적이 없으니 상태 파일은 계속 비어 있어야 한다.
    assert.equal(readActiveAccountId(paths.statePath), null);
    assert.equal(readRotationEvents(paths.rotationLogPath).length, 0);
    cleanup(paths);
  });
});

test('end-to-end: 임계값 초과 헤더가 오면 실제로 전환하고 상태·감사로그가 전부 갱신된다', async () => {
  await withMockedCredentialStore({ a1: FAKE_KEY_ONE, a2: FAKE_KEY_TWO }, async (createActiveAccountProvider) => {
    const paths = freshPaths();
    appendAccount({ account_id: 'a1', label: 'first', auth_type: 'api_key', status: 'active', created_at: 'x' }, paths.registryPath);
    appendAccount({ account_id: 'a2', label: 'second', auth_type: 'api_key', status: 'active', created_at: 'x' }, paths.registryPath);
    writeSwitchPolicyField('threshold_pct', '90', paths.policyPath);
    writeSwitchPolicyField('strategy', 'best', paths.policyPath);
    const { getApiKey, onUpstreamHeaders } = createActiveAccountProvider(paths);

    assert.equal(await getApiKey(), FAKE_KEY_ONE); // 전환 전엔 a1

    onUpstreamHeaders({
      'anthropic-ratelimit-tokens-limit': '1000',
      'anthropic-ratelimit-tokens-remaining': '10', // 99% — 임계값 초과
    });

    assert.equal(readActiveAccountId(paths.statePath), 'a2');
    assert.equal(await getApiKey(), FAKE_KEY_TWO); // 전환 후 다음 getApiKey는 a2를 반환

    const events = readRotationEvents(paths.rotationLogPath);
    assert.equal(events.length, 1);
    assert.equal(events[0].from_account_id, 'a1');
    assert.equal(events[0].to_account_id, 'a2');
    assert.equal(events[0].reason, 'quota_threshold');

    cleanup(paths);
  });
});

test('onUpstreamHeaders: 전환할 다른 계정이 없으면 조용히 유지한다(에러 없음)', async () => {
  await withMockedCredentialStore({ a1: FAKE_KEY_ONE }, async (createActiveAccountProvider) => {
    const paths = freshPaths();
    appendAccount({ account_id: 'a1', label: 'only', auth_type: 'api_key', status: 'active', created_at: 'x' }, paths.registryPath);
    writeSwitchPolicyField('threshold_pct', '90', paths.policyPath);
    const { onUpstreamHeaders } = createActiveAccountProvider(paths);

    assert.doesNotThrow(() =>
      onUpstreamHeaders({
        'anthropic-ratelimit-tokens-limit': '1000',
        'anthropic-ratelimit-tokens-remaining': '0',
      })
    );
    assert.equal(readActiveAccountId(paths.statePath), null); // 전환 후보가 없어 여전히 미기록
    assert.equal(readRotationEvents(paths.rotationLogPath).length, 0);
    cleanup(paths);
  });
});

test('active-account-provider.js는 oauth를 절대 require하지 않는다(credential-store는 정상 참조, 정적 검사)', () => {
  const source = fs.readFileSync(
    path.join(__dirname, '..', '..', 'src', 'accounts', 'proxy', 'active-account-provider.js'),
    'utf8'
  );
  assert.doesNotMatch(source, /require\(['"].*oauth\//);
  assert.match(source, /require\(['"]\.\.\/credential-store['"]\)/);
});
