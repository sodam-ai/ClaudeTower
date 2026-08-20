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
  { name: 'credential-store (OS 자격증명 저장소)', detail: 'Windows에서 실측 완료(M35), macOS는 추정. Linux는 2026-08-20부터 의도적으로 미지원(안전 검증 불가로 명확히 거부)' },
  { name: 'accounts enable / add --api-key / list / remove / rename / disable / account-purge', detail: 'API키 계정 등록·조회·개별삭제·이름변경·비활성화·전체삭제 가능(로그인 계정 등록·--import는 여전히 미구현)' },
  { name: 'accounts list 사용률 표시', detail: 'diagnose-quota로 마지막 확인한 사용률을 캐시에서 보여줌(실시간 API 호출 없음) — 한 번도 diagnose-quota를 안 돌린 계정은 "확인 안 됨"' },
  { name: 'accounts list 마지막 사용 정보 표시', detail: '전환(applySwitch) 시점에 레지스트리에 기록된 last_project_path/last_used_at을 보여줌 — 실거래 배선 전까지는 실사용에서 값이 채워지지 않음(테스트로만 검증됨)' },
  { name: '로컬 프록시 서버', detail: '127.0.0.1 고정 바인딩 + 로컬 접근 토큰 검증 + Origin/Referer 헤더 검사(브라우저발 요청 차단, CORS 응답 미노출) — 단, 실제 기동(startProxyServer)은 미배선' },
  { name: '회전 감사 로그', detail: 'Windows: icacls / macOS·Linux: chmod 소유자 전용 권한' },
  { name: '동의 고지 문구', detail: '.PRD/08_ACCOUNTS_ENABLE_CONSENT_DRAFT.md v2.1-hybrid-scope-clarified' },
  {
    name: 'API 키 계정 quota 파싱 + 전환 결정 로직',
    detail:
      'anthropic-ratelimit-tokens/requests-* 헤더 파싱 + best/next-available 전환 판단 순수 함수 구현·테스트 완료' +
      '(src/accounts/quota/) — 단, 실제 프록시 요청 경로(server.js)에는 아직 연결하지 않음. OAuth/구독 계정' +
      '(anthropic-ratelimit-unified-*)은 범위 밖 — 다루지 않음.',
  },
  {
    name: 'claudetower accounts diagnose-quota <라벨>',
    detail:
      '실제 API로 최소 크기 요청 1건을 보내([y/N] 확인 필수, 미세한 실비용 발생) 위 파서가 기대하는 헤더' +
      ' 필드명이 실제 응답과 일치하는지 1회 확인하는 진단 명령. 계정을 전환하지 않음 — 헤더만 보여줌.',
  },
];

const BLOCKED_COMPONENTS = [
  {
    name: 'OAuth 로그인 자동화(구독 계정 등록)',
    detail: 'Anthropic ToS §3-1/§3-3 이중 금지 — 구현 계획 자체가 없음(.PRD/07_OAUTH_FLOW_SPEC.md)',
  },
  {
    name: '프록시 실제 기동·자동전환·quota 실사용',
    detail:
      '요청 중계(request-forwarder.js)·활성 계정 상태 관리(active-account-state.js)까지 전부 구현·테스트' +
      ' 완료돼 그대로 이어붙일 수 있는 상태지만, bin/claudetower.js는 의도적으로 아직 연결하지 않음' +
      '(실거래 트래픽을 가로채는 마지막 단계라 별도 명시 승인 필요, test/accounts/live-wiring-gate.test.js가' +
      ' 이 상태를 기계적으로 강제) — 실제 API 응답으로 헤더 필드명 검증(실사용 비용 발생)도 여전히 미실행',
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
