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
// startProxyServer/stopProxyServer: 여전히 게이트 대기 스텁이다 — 실제 요청을 업스트림
// (Anthropic API)으로 전달하려면 credential-store에서 계정의 실제 토큰/키를 조회해야
// 하는데, credential-store/index.js는 Claude Code 상위 안전장치(classifier)가 실제 OS
// 키체인 I/O를 차단해(2026-07-27 M16, A/B 대조로 확인) 아직 구현되지 못했다. 이 두
// 함수를 credential-store 없이 먼저 만들면 나중에 재작업 위험만 커진다(순서 원칙,
// .PRD/07_OAUTH_FLOW_SPEC.md §5).
//
// verifyLocalAccessToken/generateLocalAccessToken: credential-store와 완전히 무관하게
// 구현 가능해 2026-07-28 실제로 구현했다 — OS 자격증명 저장소·계정·OAuth를 전혀
// 건드리지 않는 순수 in-memory crypto 유틸(랜덤 토큰 생성 + 상수시간 비교)이다.
// .PRD/04_PROJECT_SPEC.md "절대 하지 마": "로컬 접근 토큰 검증 없이 요청 처리하지 마".
// 04_PROJECT_SPEC.md·07_OAUTH_FLOW_SPEC.md: "로컬 프록시 접근 토큰은 프로세스
// 재시작마다 재생성, 디스크에 저장하지 않음" — 그래서 generateLocalAccessToken은
// 파일 I/O가 전혀 없고 메모리 안에서만 값을 만든다.

const crypto = require('node:crypto');

const NOT_YET = 'credential-store 실동작 준비 이후 구현 (.PRD/07_OAUTH_FLOW_SPEC.md §5 참고)';

function startProxyServer(_proxyConfig) {
  throw new Error(NOT_YET);
}

function stopProxyServer(_serverHandle) {
  throw new Error(NOT_YET);
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
};
