'use strict';

// Account 모듈의 로컬 프록시 서버 인터페이스.
//
// 역할(.PRD/04_PROJECT_SPEC.md, .PRD/02_DATA_MODEL.md ProxyConfig 절 참고):
//   - ProxyConfig.bind_address(127.0.0.1 고정)·port에서 HTTP 서버를 띄우고, 요청마다
//     로컬 접근 토큰을 검증한 뒤 upstream_url(Anthropic 서버)로 그대로 전달한다.
//   - QuotaState.threshold_pct를 넘으면 다음 계정으로 전환하고 RotationEvent를 남긴다.
//   - 포트 충돌 시 port_retry_max까지 자동으로 다음 포트를 시도한다
//     (.PRD/04_PROJECT_SPEC.md [NEEDS CLARIFICATION] "프록시 포트 충돌 정책" 확정 사항).
//
// startProxyServer/stopProxyServer: 2026-08-03 실제 구현(CHECKPOINT.md 작업 순서표 5번).
// 서버 수명주기(listen/포트 재시도/로컬 접근 토큰 검증/종료)는 credential-store와 전혀
// 무관해 지금 만들 수 있지만, "검증 통과한 요청을 실제로 업스트림(Anthropic)에 어떤
// 인증 헤더로 전달할지"는 credential-store가 계정의 실제 비밀값을 내줘야 알 수 있다
// (2026-07-27 M16, classifier가 실제 OS 키체인 I/O를 차단해 아직 구현되지 못함). 그래서
// 이 부분만 호출부가 주입하는 콜백(onAuthorizedRequest)으로 분리했다 — 지금은 테스트에서
// mock 콜백을 넣어 서버 자체의 정확성을 증명하고, credential-store가 풀리면 이 자리에
// "resolveProxyEnv 결과로 업스트림에 실제 요청을 쏘는" 진짜 콜백만 갈아 끼우면 된다
// (consent-text/resolve-proxy-env/add-api-key-request와 동일한 의존성 주입 패턴).
//
// verifyLocalAccessToken/generateLocalAccessToken: credential-store와 완전히 무관하게
// 구현 가능해 2026-07-28 실제로 구현했다 — OS 자격증명 저장소·계정·OAuth를 전혀
// 건드리지 않는 순수 in-memory crypto 유틸(랜덤 토큰 생성 + 상수시간 비교)이다.
// .PRD/04_PROJECT_SPEC.md "절대 하지 마": "로컬 접근 토큰 검증 없이 요청 처리하지 마" —
// startProxyServer는 이 검증을 통과하지 못한 요청을 onAuthorizedRequest에 절대 넘기지
// 않는다(아래 http.createServer 콜백 참고). 04_PROJECT_SPEC.md·07_OAUTH_FLOW_SPEC.md:
// "로컬 프록시 접근 토큰은 프로세스 재시작마다 재생성, 디스크에 저장하지 않음" — 그래서
// generateLocalAccessToken은 파일 I/O가 전혀 없고 메모리 안에서만 값을 만든다.

const http = require('node:http');
const crypto = require('node:crypto');
const { FIXED_BIND_ADDRESS } = require('./proxy-config');

const ACCESS_TOKEN_HEADER = 'x-claudetower-access-token';

function listenOnce(server, port, bindAddress) {
  return new Promise((resolve, reject) => {
    function onError(err) {
      cleanup();
      reject(err);
    }
    function onListening() {
      cleanup();
      resolve();
    }
    function cleanup() {
      server.removeListener('error', onError);
      server.removeListener('listening', onListening);
    }
    server.once('error', onError);
    server.once('listening', onListening);
    server.listen(port, bindAddress);
  });
}

async function startProxyServer(proxyConfig, { onAuthorizedRequest } = {}) {
  // 방어 심층화(defense in depth) — ProxyConfig가 생성 시점에 이미 127.0.0.1을 강제하지만,
  // "절대 하지 마: 프록시를 0.0.0.0에 바인딩하지 마"의 무게를 감안해 실행 직전에도 재확인한다.
  if (proxyConfig.bind_address !== FIXED_BIND_ADDRESS) {
    throw new TypeError(`proxyConfig.bind_address must be exactly "${FIXED_BIND_ADDRESS}" (0.0.0.0 금지, DO NOT 규칙)`);
  }
  if (typeof onAuthorizedRequest !== 'function') {
    throw new TypeError(
      'startProxyServer requires an onAuthorizedRequest(req, res) callback — 실제 업스트림 전달 로직은 ' +
        'credential-store 실동작 준비 이후 주입 예정(.PRD/07_OAUTH_FLOW_SPEC.md §5 참고), 지금은 호출부가 직접 제공해야 함'
    );
  }

  const server = http.createServer((req, res) => {
    const providedToken = req.headers[ACCESS_TOKEN_HEADER];
    if (!verifyLocalAccessToken(providedToken, proxyConfig.access_token)) {
      res.writeHead(401, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: 'invalid or missing local access token' }));
      return;
    }
    onAuthorizedRequest(req, res);
  });

  let port = proxyConfig.port;
  let attempts = 0;
  let lastError = null;

  while (attempts < proxyConfig.port_retry_max) {
    try {
      await listenOnce(server, port, proxyConfig.bind_address);
      return { server, port, bindAddress: proxyConfig.bind_address };
    } catch (err) {
      lastError = err;
      if (err.code !== 'EADDRINUSE') {
        throw err;
      }
      attempts += 1;
      port += 1;
    }
  }

  throw new Error(
    `포트 ${proxyConfig.port}부터 ${proxyConfig.port_retry_max}회 재시도했지만 전부 사용 중입니다 ` +
      `(마지막 오류: ${lastError ? lastError.message : '알 수 없음'})`
  );
}

function stopProxyServer(serverHandle) {
  if (!serverHandle || typeof serverHandle.server !== 'object' || typeof serverHandle.server.close !== 'function') {
    throw new TypeError('stopProxyServer requires a valid server handle from startProxyServer');
  }
  return new Promise((resolve, reject) => {
    serverHandle.server.close((err) => {
      if (err) {
        reject(err);
        return;
      }
      resolve();
    });
  });
}

// crypto.randomBytes 필수(Math.random() 절대 금지 — DO NOT 규칙, 04_PROJECT_SPEC.md).
// 32바이트(256비트) 무작위값을 16진수 문자열로 — 브루트포스 추측이 사실상 불가능한
// 길이이면서, HTTP 헤더 값으로 그대로 쓰기 좋은 형태(공백·특수문자 없음).
function generateLocalAccessToken() {
  return crypto.randomBytes(32).toString('hex');
}

// 타이밍 공격 방지를 위해 crypto.timingSafeEqual로 상수시간 비교한다 — 단순
// 문자열(===) 비교는 앞에서부터 몇 글자가 일치하는지에 따라 비교 시간이 달라져,
// 공격자가 응답 시간차를 측정해 토큰을 한 글자씩 추측할 수 있는 이론적 여지가 있다.
// 길이가 다르면 timingSafeEqual이 즉시 예외를 던지므로, 길이 비교부터 먼저 하고
// 다르면 false로 처리한다(길이 자체는 고정 64자 hex라 민감도가 낮음 — 값의 내용만
// 상수시간으로 보호하면 충분하다는 일반적인 토큰 비교 관행을 따름).
function verifyLocalAccessToken(providedToken, expectedToken) {
  if (typeof providedToken !== 'string' || typeof expectedToken !== 'string') {
    return false;
  }
  const providedBuf = Buffer.from(providedToken, 'utf8');
  const expectedBuf = Buffer.from(expectedToken, 'utf8');
  if (providedBuf.length !== expectedBuf.length) {
    return false;
  }
  return crypto.timingSafeEqual(providedBuf, expectedBuf);
}

module.exports = {
  startProxyServer,
  stopProxyServer,
  verifyLocalAccessToken,
  generateLocalAccessToken,
  ACCESS_TOKEN_HEADER,
};
