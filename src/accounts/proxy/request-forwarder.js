'use strict';

// startProxyServer(proxyConfig, { onAuthorizedRequest }) 콜백의 실제 구현체.
// server.js가 로컬 접근 토큰 검증을 이미 통과시킨 요청만 여기 도달한다.
//
// 설계: 이 파일은 "지금 활성 계정이 무엇인지"·"전환 시 어디에 기록할지"를 스스로 알지
// 못한다 — 전부 호출부가 주입한다(getApiKey/onUpstreamHeaders). 실제 claudetower run
// 진입점에서 이 콜백들을 registry/active-account-handle/rotation-log에 연결하는 것은
// 별도 세션의 몫으로 남긴다(2026-08-20 결정) — 이 파일 자체는 "요청을 정확히 중계하고,
// 응답 헤더를 관찰해 알려주는" 책임만 진다.
//
// 절대 원칙(.PRD/04_PROJECT_SPEC.md DO NOT 규칙과 같은 정신):
//  - 스트리밍 응답을 통째로 버퍼링해서 다시 보내지 않는다 — 받는 대로 그대로 흘려보낸다.
//  - 업스트림 에러 응답(4xx/5xx)을 삼키거나 다른 상태코드로 바꾸지 않는다 — 그대로 중계한다.
//  - onUpstreamHeaders(관찰 콜백)의 예외가 응답 전달 자체를 막으면 안 된다.
//  - 진행 중인 요청의 계정은 이 파일이 바꾸지 않는다 — 전환은 호출부가 "다음" 요청부터
//    다른 getApiKey() 결과를 주입하는 방식으로 이뤄진다(이 파일은 전환을 실행하지 않음).

const https = require('node:https');
const http = require('node:http');

const DEFAULT_TIMEOUT_MS = 30000; // 업스트림 요청(연결+응답 완료까지) 상한

// getApiKey(): 이 요청에 쓸 API 키를 반환(동기/비동기 모두 허용, await로 처리).
// onUpstreamHeaders(headers): 업스트림 응답 헤더를 받는 즉시(본문 완료 전) 호출된다 —
//   quota 파싱·전환 판단(../quota/api-key-quota-reading.js, ../quota/switch-decision.js)에
//   그대로 넘기라고 만든 훅이다. 반환값은 쓰지 않고, 예외를 던져도 무시된다.
function createRequestForwarder({
  getApiKey,
  onUpstreamHeaders = () => {},
  upstreamHost = 'api.anthropic.com',
  upstreamPort = 443,
  useTls = true,
  timeoutMs = DEFAULT_TIMEOUT_MS,
}) {
  if (typeof getApiKey !== 'function') {
    throw new TypeError('createRequestForwarder requires a getApiKey() function');
  }
  const transport = useTls ? https : http;

  return async function onAuthorizedRequest(req, res) {
    let apiKey;
    try {
      apiKey = await getApiKey();
    } catch (err) {
      res.writeHead(502, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: `활성 계정의 API 키를 가져오지 못했습니다: ${err.message}` }));
      return;
    }
    if (typeof apiKey !== 'string' || apiKey.length === 0) {
      res.writeHead(502, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: '활성 계정이 없거나 API 키를 가져오지 못했습니다.' }));
      return;
    }

    const forwardHeaders = { ...req.headers };
    delete forwardHeaders.host; // 업스트림 호스트로 새로 설정됨(각 transport가 자동 처리)
    delete forwardHeaders['x-claudetower-access-token']; // 로컬 전용 헤더 — 업스트림에 보낼 이유 없음
    forwardHeaders['x-api-key'] = apiKey; // 클라이언트가 보낸 값이 있어도 활성 계정 키로 항상 덮어씀

    let settled = false;
    const upstreamReq = transport.request(
      {
        hostname: upstreamHost,
        port: upstreamPort,
        path: req.url,
        method: req.method,
        headers: forwardHeaders,
        timeout: timeoutMs,
      },
      (upstreamRes) => {
        settled = true;
        try {
          onUpstreamHeaders(upstreamRes.headers);
        } catch {
          // 관찰 콜백의 실패가 응답 전달을 막으면 안 된다(위 DO NOT 규칙).
        }
        res.writeHead(upstreamRes.statusCode, upstreamRes.headers); // 상태코드·헤더 그대로 중계
        upstreamRes.pipe(res); // 스트리밍 그대로 흘려보냄(버퍼링 금지)
      }
    );

    upstreamReq.on('timeout', () => {
      upstreamReq.destroy(new Error(`업스트림 응답 시간 초과(${timeoutMs}ms)`));
    });
    upstreamReq.on('error', (err) => {
      if (settled || res.headersSent) {
        res.destroy(); // 이미 응답을 시작했으면 상태코드를 다시 쓸 수 없다 — 연결만 끊는다.
        return;
      }
      res.writeHead(502, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: `업스트림 요청 실패: ${err.message}` }));
    });

    req.pipe(upstreamReq); // 요청 본문도 스트리밍 그대로 전달(버퍼링 금지)
  };
}

module.exports = { createRequestForwarder };
