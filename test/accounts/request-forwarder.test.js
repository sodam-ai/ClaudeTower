'use strict';

// 실제 로컬 TCP 서버(가짜 업스트림 + 실제 startProxyServer)를 띄워 진짜 네트워크
// 경로로 검증한다 — require.cache mock이 아니라, 이 파일이 하는 일(요청 중계) 자체가
// 네트워크 I/O이므로 실제로 데이터를 주고받아야만 스트리밍·헤더 전달·에러 전달이
// 진짜 맞는지 증명된다. api.anthropic.com에는 전혀 접촉하지 않는다(전부 127.0.0.1).
//
// 테스트 포트: proxy-server.test.js가 18401~18417을 쓰므로 겹치지 않게 18500번대를 쓴다.

const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { createRequestForwarder } = require('../../src/accounts/proxy/request-forwarder');
const { startProxyServer, stopProxyServer, ACCESS_TOKEN_HEADER } = require('../../src/accounts/proxy/server');
const { createProxyConfig } = require('../../src/accounts/proxy/proxy-config');
const { parseApiKeyQuotaHeaders } = require('../../src/accounts/quota/api-key-quota-reading');
const { evaluateSwitchDecision } = require('../../src/accounts/quota/switch-decision');

// 테스트 전용 자리표시자 — 실제 키 형식(sk-ant-...)을 흉내내지 않는다(로컬 보안 가드
// 오탐 회피, add-api-key-command.test.js 등 기존 테스트도 같은 이유로 마커 문자열 사용).
const FAKE_KEY_A = 'test-placeholder-key-alpha';
const FAKE_KEY_ACTIVE_ACCOUNT = 'test-placeholder-key-active-account';
const FAKE_KEY_CLIENT_SUPPLIED = 'test-placeholder-key-client-supplied-should-be-overwritten';
const FAKE_ACCESS_TOKEN = 'test-access-token-not-real';

function testProxyConfig(port, overrides = {}) {
  return createProxyConfig({
    port,
    thresholdPct: 90,
    upstreamUrl: 'https://api.anthropic.com', // forwarder 자신은 이 필드를 안 쓴다(옵션으로 실제 대상 지정)
    accessToken: FAKE_ACCESS_TOKEN,
    reevalIntervalMs: 0,
    portRetryMax: 3,
    ...overrides,
  });
}

function startFakeUpstream(handler) {
  return new Promise((resolve) => {
    const server = http.createServer(handler);
    server.listen(0, '127.0.0.1', () => resolve({ server, port: server.address().port }));
  });
}

function stopServer(server) {
  return new Promise((resolve) => server.close(resolve));
}

function httpGetRaw(port, path, headers = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request({ hostname: '127.0.0.1', port, path, method: 'GET', headers }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve({ statusCode: res.statusCode, headers: res.headers, body: Buffer.concat(chunks).toString('utf8') }));
    });
    req.on('error', reject);
    req.end();
  });
}

test('정상 요청을 상태코드·헤더·바디 그대로 중계한다', async (t) => {
  const { server: upstream, port: upstreamPort } = await startFakeUpstream((req, res) => {
    res.writeHead(200, { 'content-type': 'application/json', 'x-upstream-marker': 'hello' });
    res.end(JSON.stringify({ ok: true }));
  });
  t.after(() => stopServer(upstream));

  const config = testProxyConfig(18501);
  const onAuthorizedRequest = createRequestForwarder({
    getApiKey: () => FAKE_KEY_A,
    upstreamHost: '127.0.0.1',
    upstreamPort,
    useTls: false,
  });
  const handle = await startProxyServer(config, { onAuthorizedRequest });
  t.after(() => stopProxyServer(handle));

  const res = await httpGetRaw(handle.port, '/v1/messages', { [ACCESS_TOKEN_HEADER]: config.access_token });
  assert.equal(res.statusCode, 200);
  assert.equal(res.headers['x-upstream-marker'], 'hello');
  assert.deepEqual(JSON.parse(res.body), { ok: true });
});

test('스트리밍 응답을 청크 여러 개로 나눠 보내도 그대로(버퍼링 없이) 전달한다', async (t) => {
  const { server: upstream, port: upstreamPort } = await startFakeUpstream((req, res) => {
    res.writeHead(200, { 'content-type': 'text/event-stream' });
    res.write('chunk-1\n');
    setTimeout(() => {
      res.write('chunk-2\n');
      res.end('chunk-3\n');
    }, 20);
  });
  t.after(() => stopServer(upstream));

  const config = testProxyConfig(18503);
  const onAuthorizedRequest = createRequestForwarder({
    getApiKey: () => FAKE_KEY_A,
    upstreamHost: '127.0.0.1',
    upstreamPort,
    useTls: false,
  });
  const handle = await startProxyServer(config, { onAuthorizedRequest });
  t.after(() => stopProxyServer(handle));

  const chunkArrivalTimes = [];
  const body = await new Promise((resolve, reject) => {
    const req = http.request(
      { hostname: '127.0.0.1', port: handle.port, path: '/v1/messages', method: 'GET', headers: { [ACCESS_TOKEN_HEADER]: config.access_token } },
      (res) => {
        const chunks = [];
        res.on('data', (c) => {
          chunkArrivalTimes.push(Date.now());
          chunks.push(c);
        });
        res.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
      }
    );
    req.on('error', reject);
    req.end();
  });
  assert.equal(body, 'chunk-1\nchunk-2\nchunk-3\n');
  // 최소 2번 이상 나눠 도착했어야 한다(전부 버퍼링했다 한 번에 보냈다면 1번만 도착)
  assert.ok(chunkArrivalTimes.length >= 2, `청크가 ${chunkArrivalTimes.length}번만 도착함(버퍼링 의심)`);
});

test('업스트림의 429 에러 응답을 상태코드·바디 그대로 중계한다(삼키지 않는다)', async (t) => {
  const { server: upstream, port: upstreamPort } = await startFakeUpstream((req, res) => {
    res.writeHead(429, { 'content-type': 'application/json', 'anthropic-ratelimit-tokens-remaining': '0' });
    res.end(JSON.stringify({ error: { type: 'rate_limit_error' } }));
  });
  t.after(() => stopServer(upstream));

  const config = testProxyConfig(18505);
  const onAuthorizedRequest = createRequestForwarder({
    getApiKey: () => FAKE_KEY_A,
    upstreamHost: '127.0.0.1',
    upstreamPort,
    useTls: false,
  });
  const handle = await startProxyServer(config, { onAuthorizedRequest });
  t.after(() => stopProxyServer(handle));

  const res = await httpGetRaw(handle.port, '/v1/messages', { [ACCESS_TOKEN_HEADER]: config.access_token });
  assert.equal(res.statusCode, 429);
  assert.equal(JSON.parse(res.body).error.type, 'rate_limit_error');
});

test('활성 계정의 API 키를 업스트림에 x-api-key로 주입하고, 클라이언트가 보낸 값은 덮어쓴다', async (t) => {
  let receivedApiKey = null;
  let receivedAccessTokenHeader = 'not-checked';
  const { server: upstream, port: upstreamPort } = await startFakeUpstream((req, res) => {
    receivedApiKey = req.headers['x-api-key'];
    receivedAccessTokenHeader = req.headers['x-claudetower-access-token'];
    res.writeHead(200, {});
    res.end('ok');
  });
  t.after(() => stopServer(upstream));

  const config = testProxyConfig(18507);
  const onAuthorizedRequest = createRequestForwarder({
    getApiKey: () => FAKE_KEY_ACTIVE_ACCOUNT,
    upstreamHost: '127.0.0.1',
    upstreamPort,
    useTls: false,
  });
  const handle = await startProxyServer(config, { onAuthorizedRequest });
  t.after(() => stopProxyServer(handle));

  await httpGetRaw(handle.port, '/v1/messages', {
    [ACCESS_TOKEN_HEADER]: config.access_token,
    'x-api-key': FAKE_KEY_CLIENT_SUPPLIED,
  });
  assert.equal(receivedApiKey, FAKE_KEY_ACTIVE_ACCOUNT);
  assert.equal(receivedAccessTokenHeader, undefined, '로컬 전용 접근 토큰 헤더가 업스트림으로 새어나가면 안 된다');
});

test('getApiKey()가 실패하면 502를 반환하고, 업스트림에는 요청 자체를 보내지 않는다', async (t) => {
  let upstreamHitCount = 0;
  const { server: upstream, port: upstreamPort } = await startFakeUpstream((req, res) => {
    upstreamHitCount += 1;
    res.writeHead(200, {});
    res.end('ok');
  });
  t.after(() => stopServer(upstream));

  const config = testProxyConfig(18509);
  const onAuthorizedRequest = createRequestForwarder({
    getApiKey: () => {
      throw new Error('활성 계정이 없습니다');
    },
    upstreamHost: '127.0.0.1',
    upstreamPort,
    useTls: false,
  });
  const handle = await startProxyServer(config, { onAuthorizedRequest });
  t.after(() => stopProxyServer(handle));

  const res = await httpGetRaw(handle.port, '/v1/messages', { [ACCESS_TOKEN_HEADER]: config.access_token });
  assert.equal(res.statusCode, 502);
  assert.equal(upstreamHitCount, 0);
});

test('getApiKey()가 빈 문자열을 반환해도 502를 반환하고 업스트림에 보내지 않는다', async (t) => {
  let upstreamHitCount = 0;
  const { server: upstream, port: upstreamPort } = await startFakeUpstream((req, res) => {
    upstreamHitCount += 1;
    res.end('ok');
  });
  t.after(() => stopServer(upstream));

  const config = testProxyConfig(18511);
  const onAuthorizedRequest = createRequestForwarder({
    getApiKey: () => '',
    upstreamHost: '127.0.0.1',
    upstreamPort,
    useTls: false,
  });
  const handle = await startProxyServer(config, { onAuthorizedRequest });
  t.after(() => stopProxyServer(handle));

  const res = await httpGetRaw(handle.port, '/v1/messages', { [ACCESS_TOKEN_HEADER]: config.access_token });
  assert.equal(res.statusCode, 502);
  assert.equal(upstreamHitCount, 0);
});

test('업스트림 연결 자체가 실패하면(포트에 아무 것도 없음) 502를 반환한다(크래시하지 않는다)', async (t) => {
  const config = testProxyConfig(18513);
  const onAuthorizedRequest = createRequestForwarder({
    getApiKey: () => FAKE_KEY_A,
    upstreamHost: '127.0.0.1',
    upstreamPort: 18514, // 이 포트엔 아무 것도 리스닝하지 않음
    useTls: false,
  });
  const handle = await startProxyServer(config, { onAuthorizedRequest });
  t.after(() => stopProxyServer(handle));

  const res = await httpGetRaw(handle.port, '/v1/messages', { [ACCESS_TOKEN_HEADER]: config.access_token });
  assert.equal(res.statusCode, 502);
});

test('업스트림이 응답하지 않으면 timeoutMs 후 502를 반환한다(무한 대기하지 않는다)', async (t) => {
  const { server: upstream, port: upstreamPort } = await startFakeUpstream(() => {
    // 응답을 절대 안 보낸다(연결만 열어둠) — 타임아웃 유발
  });
  t.after(() => stopServer(upstream));

  const config = testProxyConfig(18515);
  const onAuthorizedRequest = createRequestForwarder({
    getApiKey: () => FAKE_KEY_A,
    upstreamHost: '127.0.0.1',
    upstreamPort,
    useTls: false,
    timeoutMs: 200,
  });
  const handle = await startProxyServer(config, { onAuthorizedRequest });
  t.after(() => stopProxyServer(handle));

  const res = await httpGetRaw(handle.port, '/v1/messages', { [ACCESS_TOKEN_HEADER]: config.access_token });
  assert.equal(res.statusCode, 502);
});

test('onUpstreamHeaders가 응답 헤더를 실제로 받고, 그 안에서 예외가 나도 응답 전달은 막히지 않는다', async (t) => {
  const { server: upstream, port: upstreamPort } = await startFakeUpstream((req, res) => {
    res.writeHead(200, { 'x-marker': 'present' });
    res.end('ok');
  });
  t.after(() => stopServer(upstream));

  let observedHeaders = null;
  const config = testProxyConfig(18517);
  const onAuthorizedRequest = createRequestForwarder({
    getApiKey: () => FAKE_KEY_A,
    upstreamHost: '127.0.0.1',
    upstreamPort,
    useTls: false,
    onUpstreamHeaders: (headers) => {
      observedHeaders = headers;
      throw new Error('관찰 콜백 내부 결함 시뮬레이션');
    },
  });
  const handle = await startProxyServer(config, { onAuthorizedRequest });
  t.after(() => stopProxyServer(handle));

  const res = await httpGetRaw(handle.port, '/v1/messages', { [ACCESS_TOKEN_HEADER]: config.access_token });
  assert.equal(res.statusCode, 200);
  assert.equal(res.body, 'ok');
  assert.equal(observedHeaders['x-marker'], 'present');
});

test('end-to-end: 실제 quota 초과 헤더가 오면 onUpstreamHeaders 안에서 파서+전환결정이 올바르게 연동된다', async (t) => {
  const { server: upstream, port: upstreamPort } = await startFakeUpstream((req, res) => {
    res.writeHead(200, {
      'anthropic-ratelimit-tokens-limit': '1000',
      'anthropic-ratelimit-tokens-remaining': '10', // 99% 사용 — 임계값(90) 초과
      'anthropic-ratelimit-requests-limit': '50',
      'anthropic-ratelimit-requests-remaining': '40',
    });
    res.end('ok');
  });
  t.after(() => stopServer(upstream));

  let decision = null;
  const config = testProxyConfig(18519);
  const onAuthorizedRequest = createRequestForwarder({
    getApiKey: () => FAKE_KEY_A,
    upstreamHost: '127.0.0.1',
    upstreamPort,
    useTls: false,
    onUpstreamHeaders: (headers) => {
      const reading = parseApiKeyQuotaHeaders(headers);
      decision = evaluateSwitchDecision({
        currentAccountId: 'current',
        currentQuotaReading: reading,
        allAccounts: [
          { account_id: 'current', label: 'current', auth_type: 'api_key', status: 'active', created_at: 'x' },
          { account_id: 'backup', label: 'backup', auth_type: 'api_key', status: 'active', created_at: 'x' },
        ],
        policy: { threshold_pct: 90, strategy: 'best' },
      });
    },
  });
  const handle = await startProxyServer(config, { onAuthorizedRequest });
  t.after(() => stopProxyServer(handle));

  await httpGetRaw(handle.port, '/v1/messages', { [ACCESS_TOKEN_HEADER]: config.access_token });
  assert.ok(decision, 'onUpstreamHeaders가 호출되지 않음');
  assert.equal(decision.shouldSwitch, true);
  assert.equal(decision.toAccountId, 'backup');
  assert.equal(decision.reason, 'quota_threshold');
});

test('실제 startProxyServer의 로컬 접근 토큰 검증과 통합돼도 정상 작동한다(토큰 없으면 401, forwarder까지 도달 안 함)', async (t) => {
  let upstreamHitCount = 0;
  const { server: upstream, port: upstreamPort } = await startFakeUpstream((req, res) => {
    upstreamHitCount += 1;
    res.end('ok');
  });
  t.after(() => stopServer(upstream));

  const config = testProxyConfig(18521);
  const onAuthorizedRequest = createRequestForwarder({
    getApiKey: () => FAKE_KEY_A,
    upstreamHost: '127.0.0.1',
    upstreamPort,
    useTls: false,
  });
  const handle = await startProxyServer(config, { onAuthorizedRequest });
  t.after(() => stopProxyServer(handle));

  const res = await httpGetRaw(handle.port, '/v1/messages', {}); // 토큰 헤더 없음
  assert.equal(res.statusCode, 401);
  assert.equal(upstreamHitCount, 0, '토큰 검증을 통과 못 한 요청이 forwarder까지 도달하면 안 된다');
});

test('createRequestForwarder: getApiKey가 함수가 아니면 즉시 거부한다', () => {
  assert.throws(() => createRequestForwarder({ getApiKey: 'not-a-function' }), TypeError);
});

test('request-forwarder.js는 oauth/credential-store를 절대 require하지 않는다(정적 검사)', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const source = fs.readFileSync(
    path.join(__dirname, '..', '..', 'src', 'accounts', 'proxy', 'request-forwarder.js'),
    'utf8'
  );
  assert.doesNotMatch(source, /require\(['"].*oauth\//);
  assert.doesNotMatch(source, /require\(['"].*credential-store/);
});
