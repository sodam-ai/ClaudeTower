'use strict';

// `claudetower accounts status` 전용 읽기 전용 진단 로직.
//
// Account 모듈은 안전지대 코드(OAuth state/PKCE, 로컬 프록시, 회전 감사 로그, 동의
// 문구)가 이미 상당히 구현돼 있지만, CLI 진입점이 전혀 없어 사람이 검증할 방법이
// 없었다(2026-08-17 PRD 준수 감사에서 발견). 이 파일은 그 갭을 메우되, credential-
// store/oauth/proxy의 실제 함수는 절대 import도 호출도 하지 않는다 — 아래 컴포넌트
// 목록은 전부 정적 문자열이며, 실행 시 어떤 계정/자격증명 관련 코드 경로도 타지
// 않는다(module-activation-state만 읽는다).
//
// module-activation-state에는 아직 영속화 계층이 없다(2026-07-11 주석 참고,
// `enable` 명령 자체가 존재하지 않음) — 그래서 상태는 항상 기본값(enabled:false)이다.
// 이건 버그가 아니라 정확한 현재 상태이므로 그대로 보여준다.

const { createModuleActivationState } = require('./module-activation-state');

const IMPLEMENTED_COMPONENTS = [
  { name: 'OAuth CSRF state 검증', detail: 'crypto.randomBytes(32) + timingSafeEqual 상수시간 비교' },
  { name: 'PKCE', detail: 'RFC7636 S256만 지원(plain 방식 의도적 미구현)' },
  { name: '로컬 프록시 서버', detail: '127.0.0.1 고정 바인딩 + 로컬 접근 토큰 검증' },
  { name: '회전 감사 로그', detail: 'Windows: icacls / macOS·Linux: chmod 소유자 전용 권한' },
  { name: '동의 고지 문구', detail: '.PRD/08_ACCOUNTS_ENABLE_CONSENT_DRAFT.md v2-hybrid' },
  { name: 'quota 헤더 필드명', detail: '문서로만 확정(anthropic-ratelimit-unified-*), 파싱 코드 없음' },
];

const BLOCKED_COMPONENTS = [
  {
    name: 'credential-store (OS 자격증명 저장소 연동)',
    detail: '미구현 스텁 — Phase 2 게이트 대기(.PRD/03_PHASES.md M6)',
  },
];

function buildStatusReport({ activationState = createModuleActivationState() } = {}) {
  return {
    enabled: activationState.enabled,
    consentGivenAt: activationState.consent_given_at,
    consentTextVersion: activationState.consent_text_version,
    implementedComponents: IMPLEMENTED_COMPONENTS,
    blockedComponents: BLOCKED_COMPONENTS,
    canEnable: false,
  };
}

function formatStatusReport(report) {
  const lines = [];
  lines.push('=== ClaudeTower Account 모듈 상태 ===');
  lines.push('');
  lines.push(
    report.enabled
      ? `활성화 여부: 활성화됨 (동의: ${report.consentGivenAt || '알 수 없음'})`
      : '활성화 여부: 비활성화됨 (기본값)'
  );
  lines.push('');
  lines.push('구현된 안전지대 컴포넌트 (미배선 — 아직 CLI에서 실제로 쓸 수 없음):');
  for (const c of report.implementedComponents) {
    lines.push(`  ✔ ${c.name} — ${c.detail}`);
  }
  lines.push('');
  lines.push('사용 불가능한 부분:');
  for (const c of report.blockedComponents) {
    lines.push(`  ✘ ${c.name} — ${c.detail}`);
  }
  lines.push('');
  lines.push(
    '현재 claudetower accounts enable 명령은 존재하지 않습니다 — 이 기능은 아직 개발 중이며'
  );
  lines.push('실제로 켤 수 있는 방법이 없습니다. 이 명령은 진행 상황을 투명하게 보여주는 읽기 전용 진단입니다.');
  return lines.join('\n');
}

module.exports = { buildStatusReport, formatStatusReport };
