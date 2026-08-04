'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const {
  startProxyServer,
  stopProxyServer,
  verifyLocalAccessToken,
  generateLocalAccessToken,
  ACCESS_TOKEN_HEADER,
} = require('../../src/accounts/proxy/server');
const { createProxyConfig, FIXED_BIND_ADDRESS } = require('../../src/accounts/proxy/proxy-config');

// 절대 실제 계정 정보를 쓰지 않는다 — 전부 테스트 전용 더미 값(테스트 고유 포트도
// 실사용 포트와 겹치지 않도록 18400번대로 고정 배정).
function testProxyConfig(port, overrides = {}) {
  return createProxyConfig({
    port,
    thresholdPct: 90,
    upstreamUrl: 'https://api.anthropic.com',
    accessToken: 'test-access-token-not-real',
    reevalIntervalMs: 0,
    portRetryMax: 3,
    ...overrides,
  });
}

function request(port, { headers = {} } = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      { host: '127.0.0.1', port, path: '/v1/messages', method: 'GET', headers, agent: false },
      (res) => {
        let body = '';
        res.on('data', (chunk) => {
          body += chunk;
        });
        res.on('end', () => resolve({ statusCode: res.statusCode, body }));
      }
    );
    req.on('error', reject);
    req.end();
  });
}

function occupyPort(port) {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => res.end('occupied'));
    server.once('error', reject);
    server.listen(port, FIXED_BIND_ADDRESS, () => resolve(server));
  });
}

test('startProxyServer: 127.0.0.1의 지정 포트에서 실제로 listen한다', async (t) => {
  const config = testProxyConfig(18401);
  const handle = await startProxyServer(config, { onAuthorizedRequest: (req, res) => res.end('ok') });
  t.after(() => stopProxyServer(handle));
  assert.equal(handle.port, 18401);
  assert.equal(handle.bindAddress, FIXED_BIND_ADDRESS);
});

test('startProxyServer: 올바른 접근 토큰이면 onAuthorizedRequest가 호출되고 응답이 그대로 전달된다', async (t) => {
  const config = testProxyConfig(18403);
  let called = false;
  const handle = await startProxyServer(config, {
    onAuthorizedRequest: (req, res) => {
      called = true;
      res.writeHead(200);
      res.end('authorized-ok');
    },
  });
  t.after(() => stopProxyServer(handle));

  const res = await request(18403, { headers: { [ACCESS_TOKEN_HEADER]: 'test-access-token-not-real' } });
  assert.equal(called, true);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body, 'authorized-ok');
});

test('startProxyServer: 접근 토큰이 없으면 401을 반환하고 onAuthorizedRequest를 호출하지 않는다(DO NOT 규칙: 검증 없이 요청 처리 금지)', async (t) => {
  const config = testProxyConfig(18405);
  let called = false;
  const handle = await startProxyServer(config, {
    onAuthorizedRequest: () => {
      called = true;
    },
  });
  t.after(() => stopProxyServer(handle));

  const res = await request(18405, {});
  assert.equal(called, false);
  assert.equal(res.statusCode, 401);
});

test('startProxyServer: 접근 토큰이 틀리면 401을 반환하고 onAuthorizedRequest를 호출하지 않는다', async (t) => {
  const config = testProxyConfig(18407);
  let called = false;
  const handle = await startProxyServer(config, {
    onAuthorizedRequest: () => {
      called = true;
    },
  });
  t.after(() => stopProxyServer(handle));

  const res = await request(18407, { headers: { [ACCESS_TOKEN_HEADER]: 'wrong-token' } });
  assert.equal(called, false);
  assert.equal(res.statusCode, 401);
});

test('startProxyServer: onAuthorizedRequest 콜백 없이 호출하면 TypeError를 던지고 서버를 열지 않는다', async () => {
  const config = testProxyConfig(18409);
  await assert.rejects(() => startProxyServer(config, {}), TypeError);
});

test('startProxyServer: bind_address가 127.0.0.1이 아니면 TypeError를 던진다(0.0.0.0 금지, 방어 심층화 — proxy-config.js가 막아도 실행 직전 한 번 더 확인)', async () => {
  const tamperedConfig = { ...testProxyConfig(18411), bind_address: '0.0.0.0' };
  await assert.rejects(() => startProxyServer(tamperedConfig, { onAuthorizedRequest: () => {} }), TypeError);
});

test('startProxyServer: 포트가 이미 사용 중이면 port_retry_max까지 다음 포트를 자동으로 시도한다', async (t) => {
  const occupied = await occupyPort(18413);
  t.after(() => new Promise((resolve) => occupied.close(resolve)));

  const config = testProxyConfig(18413, { portRetryMax: 3 });
  const handle = await startProxyServer(config, { onAuthorizedRequest: (req, res) => res.end('ok') });
  t.after(() => stopProxyServer(handle));

  assert.equal(handle.port, 18414);
});

test('startProxyServer: 재시도 횟수를 다 써도 전부 사용 중이면 명확한 에러로 실패한다(silent fallback 금지)', async (t) => {
  const occupied = await occupyPort(18415);
  t.after(() => new Promise((resolve) => occupied.close(resolve)));

  const config = testProxyConfig(18415, { portRetryMax: 1 });
  await assert.rejects(() => startProxyServer(config, { onAuthorizedRequest: () => {} }), /사용 중입니다/);
});

test('stopProxyServer: 서버를 닫으면 이후 연결 시도가 거부된다', async () => {
  const config = testProxyConfig(18417);
  const handle = await startProxyServer(config, { onAuthorizedRequest: (req, res) => res.end('ok') });
  await stopProxyServer(handle);
  await assert.rejects(() => request(18417, {}));
});

test('stopProxyServer: 잘못된 handle을 넘기면 TypeError를 던진다', () => {
  assert.throws(() => stopProxyServer(null), TypeError);
  assert.throws(() => stopProxyServer({}), TypeError);
  assert.throws(() => stopProxyServer({ server: {} }), TypeError);
});

// --- 로컬 접근 토큰 생성/검증 (기존 테스트, 변경 없음) ---

test('generateLocalAccessToken: 64자 16진수 문자열을 반환한다(32바이트, crypto.randomBytes)', () => {
  const token = generateLocalAccessToken();
  assert.equal(typeof token, 'string');
  assert.equal(token.length, 64);
  assert.match(token, /^[0-9a-f]{64}$/);
});

test('generateLocalAccessToken: 호출할 때마다 다른 값을 반환한다(Math.random() 금지, 진짜 무작위)', () => {
  const a = generateLocalAccessToken();
  const b = generateLocalAccessToken();
  assert.notEqual(a, b);
});

test('verifyLocalAccessToken: 두 토큰이 정확히 같으면 true', () => {
  const token = generateLocalAccessToken();
  assert.equal(verifyLocalAccessToken(token, token), true);
});

test('verifyLocalAccessToken: 한 글자만 달라도 false', () => {
  const token = generateLocalAccessToken();
  const flippedFirstChar = (token[0] === '0' ? '1' : '0') + token.slice(1);
  assert.equal(verifyLocalAccessToken(flippedFirstChar, token), false);
});

test('verifyLocalAccessToken: 길이가 다르면 예외 없이 false를 반환한다(timingSafeEqual 길이불일치 예외 방어)', () => {
  assert.equal(verifyLocalAccessToken('short', generateLocalAccessToken()), false);
  assert.equal(verifyLocalAccessToken('', generateLocalAccessToken()), false);
});

test('verifyLocalAccessToken: 문자열이 아닌 입력(null/undefined/숫자)은 예외 없이 false를 반환한다', () => {
  assert.equal(verifyLocalAccessToken(null, 'x'), false);
  assert.equal(verifyLocalAccessToken(undefined, 'x'), false);
  assert.equal(verifyLocalAccessToken(123, 'x'), false);
  assert.equal(verifyLocalAccessToken('x', null), false);
});
