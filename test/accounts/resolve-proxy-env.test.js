'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { resolveProxyEnv } = require('../../src/accounts/proxy/resolve-proxy-env');

const PROXY_URL = 'http://127.0.0.1:41411';

test('resolveProxyEnv: oauth 계정은 ANTHROPIC_BASE_URL만 스왑하고 API_KEY는 건드리지 않는다', () => {
  const env = resolveProxyEnv({ authType: 'oauth', proxyBaseUrl: PROXY_URL });
  assert.deepEqual(env, { ANTHROPIC_BASE_URL: PROXY_URL });
  assert.equal('ANTHROPIC_API_KEY' in env, false);
});

test('resolveProxyEnv: api_key 계정은 BASE_URL과 API_KEY를 함께 스왑한다', () => {
  const env = resolveProxyEnv({
    authType: 'api_key',
    proxyBaseUrl: PROXY_URL,
    apiKeyValue: 'test-fake-key-not-real',
  });
  assert.deepEqual(env, {
    ANTHROPIC_BASE_URL: PROXY_URL,
    ANTHROPIC_API_KEY: 'test-fake-key-not-real',
  });
});

test('resolveProxyEnv: api_key인데 apiKeyValue가 없으면 거부한다', () => {
  assert.throws(() => resolveProxyEnv({ authType: 'api_key', proxyBaseUrl: PROXY_URL }), TypeError);
  assert.throws(
    () => resolveProxyEnv({ authType: 'api_key', proxyBaseUrl: PROXY_URL, apiKeyValue: '' }),
    TypeError
  );
});

test('resolveProxyEnv: authType이 oauth/api_key가 아니면 거부한다', () => {
  assert.throws(() => resolveProxyEnv({ authType: 'password', proxyBaseUrl: PROXY_URL }), TypeError);
});

test('resolveProxyEnv: proxyBaseUrl이 127.0.0.1이 아니면 거부한다(0.0.0.0 금지 DO NOT 규칙)', () => {
  assert.throws(
    () => resolveProxyEnv({ authType: 'oauth', proxyBaseUrl: 'http://0.0.0.0:41411' }),
    TypeError
  );
  assert.throws(
    () => resolveProxyEnv({ authType: 'oauth', proxyBaseUrl: 'http://192.168.0.1:41411' }),
    TypeError
  );
});
