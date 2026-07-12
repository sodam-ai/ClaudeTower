'use strict';

// Account 모듈의 로컬 프록시 서버 인터페이스 — 게이트 대기 스텁.
//
// 역할(.PRD/04_PROJECT_SPEC.md, .PRD/02_DATA_MODEL.md ProxyConfig 절 참고):
//   - ProxyConfig.bind_address(127.0.0.1 고정)·port에서 HTTP 서버를 띄우고, 요청마다
//     로컬 접근 토큰을 검증한 뒤 upstream_url(Anthropic 서버)로 그대로 전달한다.
//   - QuotaState.threshold_pct를 넘으면 다음 계정으로 전환하고 RotationEvent를 남긴다.
//   - 포트 충돌 시 port_retry_max까지 자동으로 다음 포트를 시도한다
//     (.PRD/04_PROJECT_SPEC.md [NEEDS CLARIFICATION] "프록시 포트 충돌 정책" 확정 사항).
//
// 왜 아직 구현하지 않았는가: credential-store/index.js와 동일한 이유 — M6 게이트
// (.PRD/03_PHASES.md, 2026-07-14 종료 예정) 준수 중. 이 파일은 실제 http.createServer
// 호출 없이 인터페이스 모양만 남기고 전부 명시적으로 거부한다. 게이트가 풀리면 이 파일
// 안에서만 실제 서버를 구현하면 된다(호출부는 이미 이 시그니처를 씀).

const NOT_YET = 'Phase 2 게이트 대기 — 2026-07-14 이후 구현 (.PRD/03_PHASES.md M6 참고)';

function startProxyServer(_proxyConfig) {
  throw new Error(NOT_YET);
}

function stopProxyServer(_serverHandle) {
  throw new Error(NOT_YET);
}

function verifyLocalAccessToken(_providedToken, _expectedToken) {
  throw new Error(NOT_YET);
}

module.exports = { startProxyServer, stopProxyServer, verifyLocalAccessToken };
