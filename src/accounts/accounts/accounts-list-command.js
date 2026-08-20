'use strict';

// `claudetower accounts list` — 등록된 계정 목록을 보여준다.
//
// 왜 지금 만드는가: M36(accounts add --api-key)부터 계정을 실제로 등록할 수 있게 됐지만,
// 등록 성공 로그 한 줄 말고는 "내가 뭘 등록했는지"를 나중에 확인할 방법이 없었다. 이 파일은
// 이미 존재하는 accounts-registry.js의 readRegistry()를 그대로 노출만 한다(신규 저장 로직 없음).
//
// 비밀값 노출 불가능: Account 레코드 자체가 화이트리스트 스키마(account.js)라 애초에
// 토큰·키 값을 담을 필드가 없다 — 이 파일이 실수로 비밀값을 출력할 방법이 구조적으로 없다.

const { readRegistry } = require('./accounts-registry');
const { readQuotaCacheEntry } = require('../quota/quota-cache-store');

// quotaEntry: quota-cache-store.js가 반환하는 { tokens_used_pct, requests_used_pct,
// tokens_reset_at, requests_reset_at, checked_at } 또는 아직 확인 이력이 없으면 null.
// "실시간 값이 아니라 마지막 확인 시점 값"임을 매번 명시한다(diagnose-quota-command.js
// 주석 참고 — list는 실비용이 드는 실제 API 호출을 하지 않는다).
// .PRD/01_PRD.md §3 "계정별 마지막 사용 프로젝트 경로 표시"(2026-08-20 감사로 발견한 잔여
// 갭 — 스키마·RotationEvent에는 이미 있었지만 표시가 빠져 있었다). account 자체가
// active-account-state.js의 applySwitch가 갱신한 값을 그대로 담고 있어(레지스트리 필드),
// 여기서는 추가 조회 없이 그대로 보여주기만 한다 — quotaEntry와 달리 실시간/실비용 조회가
// 아니다.
function formatLastUsedLine(account) {
  if (!account.last_used_at) {
    return '      마지막 사용: 기록 없음(아직 이 계정으로 전환된 적 없음)';
  }
  const project = account.last_project_path ? ` (프로젝트: ${account.last_project_path})` : '';
  return `      마지막 사용: ${account.last_used_at}${project}`;
}

// .PRD/03_PHASES.md Phase 2 체크리스트 "리셋 시각"(2026-08-20 감사로 발견한 잔여 갭 —
// api-key-quota-reading.js가 이미 파싱하고 quota-cache-store.js가 이미 저장하고
// 있었지만 표시가 빠져 있었다). tokens_reset_at/requests_reset_at은 Anthropic 응답
// 헤더 원문을 그대로 저장한 값이라 정확한 형식(ISO 문자열인지 Unix epoch 초인지)이
// 아직 실측 검증되지 않았다(diagnose-quota를 사용자가 아직 실행 전 — 07_OAUTH_FLOW_SPEC.md
// 가 이미 명시한 미확인 항목, CHECKPOINT.md 2026-07-28 "안티패턴#1: 추측 금지" 결정).
// 그래서 날짜로 파싱·재포맷하지 않고 원문 문자열 그대로 보여준다 — 형식을 잘못 짐작해
// 변환하면 실제와 다른 값을 보여주거나 깨질 위험이 있다.
function formatResetLine(quotaEntry) {
  const val = (v) => v || '알 수 없음';
  return (
    `      리셋 예정(응답 헤더 원문 그대로, 형식 가공 안 함): ` +
    `토큰 ${val(quotaEntry.tokens_reset_at)} / 요청수 ${val(quotaEntry.requests_reset_at)}`
  );
}

function formatAccountLine(account, quotaEntry = null) {
  const base = `  - ${account.label} (${account.auth_type}, ${account.status}, 등록: ${account.created_at})`;
  const quotaLines = !quotaEntry
    ? [`      사용률: 확인 안 됨(claudetower accounts diagnose-quota ${account.label}로 확인 가능)`]
    : [
        (() => {
          const pct = (v) => (typeof v === 'number' ? `${v.toFixed(1)}%` : '알 수 없음');
          return (
            `      사용률(마지막 확인: ${quotaEntry.checked_at}): ` +
            `토큰 ${pct(quotaEntry.tokens_used_pct)} / 요청수 ${pct(quotaEntry.requests_used_pct)}`
          );
        })(),
        formatResetLine(quotaEntry),
      ];
  return [base, ...quotaLines, formatLastUsedLine(account)].join('\n');
}

function runAccountsListCommand({ registryPath, quotaCachePath, log = () => {} } = {}) {
  const accounts = readRegistry(registryPath);
  if (accounts.length === 0) {
    log('등록된 계정이 없습니다. claudetower accounts add --api-key <라벨> <키값>으로 등록하세요.');
    return { applied: true, count: 0 };
  }
  log(`등록된 계정 ${accounts.length}개:`);
  accounts.forEach((a) => log(formatAccountLine(a, readQuotaCacheEntry(a.account_id, quotaCachePath))));
  return { applied: true, count: accounts.length };
}

module.exports = { runAccountsListCommand, formatAccountLine };
