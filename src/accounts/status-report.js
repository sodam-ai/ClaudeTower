'use strict';

// `claudetower accounts status` 전용 읽기 전용 진단 로직.
//
// Account 모듈은 안전지대 코드(OAuth state/PKCE, 로컬 프록시, 회전 감사 로그, 동의
// 문구, credential-store)가 이미 상당히 구현돼 있고, M36(2026-08-19)부터 `enable`/
// `add --api-key`로 실제 계정 하나를 등록할 수 있다. 이 파일은 credential-store/
// oauth/proxy의 실제 저장·네트워크 함수는 여전히 절대 import도 호출도 하지 않는다 —
// module-activation-state만 (호출부가 주입한 실제 상태를) 읽어서 보여준다.

const { createModuleActivationState } = require('./module-activation-state');

const IMPLEMENTED_COMPONENTS = [
  { name: 'OAuth CSRF state 검증', detail: 'crypto.randomBytes(32) + timingSafeEqual 상수시간 비교' },
  { name: 'PKCE', detail: 'RFC7636 S256만 지원(plain 방식 의도적 미구현) — 단, OAuth 실 로그인 흐름은 ToS로 여전히 미구현' },
  { name: 'credential-store (OS 자격증명 저장소)', detail: 'Windows에서 실측 완료(M35), macOS/Linux는 추정' },
  { name: 'accounts enable / add --api-key', detail: 'M36 — API키 계정 등록 가능(로그인 계정 등록은 여전히 미구현)' },
  { name: '로컬 프록시 서버', detail: '127.0.0.1 고정 바인딩 + 로컬 접근 토큰 검증 — 단, 실제 기동(startProxyServer)은 미배선' },
  { name: '회전 감사 로그', detail: 'Windows: icacls / macOS·Linux: chmod 소유자 전용 권한' },
  { name: '동의 고지 문구', detail: '.PRD/08_ACCOUNTS_ENABLE_CONSENT_DRAFT.md v2-hybrid' },
  { name: 'quota 헤더 필드명', detail: '문서로만 확정(anthropic-ratelimit-unified-*), 파싱 코드 없음' },
];

const BLOCKED_COMPONENTS = [
  {
    name: 'OAuth 로그인 자동화(구독 계정 등록)',
    detail: 'Anthropic ToS §3-1/§3-3 이중 금지 — 구현 계획 자체가 없음(.PRD/07_OAUTH_FLOW_SPEC.md)',
  },
  {
    name: '프록시 실제 기동·자동전환·quota 실사용',
    detail: '미배선 — accounts add로 등록만 가능, 자동전환은 다음 단계',
  },
];

function buildStatusReport({ activationState = createModuleActivationState() } = {}) {
  return {
    enabled: activationState.enabled,
    consentGivenAt: activationState.consent_given_at,
    consentTextVersion: activationState.consent_text_version,
    implementedComponents: IMPLEMENTED_COMPONENTS,
    blockedComponents: BLOCKED_COMPONENTS,
    canEnable: true,
  };
}

function formatStatusReport(report) {
  const lines = [];
  lines.push('=== ClaudeTower Account 모듈 상태 ===');
  lines.push('');
  lines.push(
    report.enabled
      ? `활성화 여부: 활성화됨 (동의: ${report.consentGivenAt || '알 수 없음'})`
      : '활성화 여부: 비활성화됨 — claudetower accounts enable로 켤 수 있습니다'
  );
  lines.push('');
  lines.push('구현·사용 가능한 컴포넌트:');
  for (const c of report.implementedComponents) {
    lines.push(`  ✔ ${c.name} — ${c.detail}`);
  }
  lines.push('');
  lines.push('여전히 사용 불가능한 부분:');
  for (const c of report.blockedComponents) {
    lines.push(`  ✘ ${c.name} — ${c.detail}`);
  }
  lines.push('');
  lines.push('사용법: claudetower accounts enable (동의 후 켜기) → claudetower accounts add --api-key <라벨> <키값>');
  return lines.join('\n');
}

module.exports = { buildStatusReport, formatStatusReport };
