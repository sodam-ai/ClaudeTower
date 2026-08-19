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
function formatAccountLine(account, quotaEntry = null) {
  const base = `  - ${account.label} (${account.auth_type}, ${account.status}, 등록: ${account.created_at})`;
  if (!quotaEntry) {
    return `${base}\n      사용률: 확인 안 됨(claudetower accounts diagnose-quota ${account.label}로 확인 가능)`;
  }
  const pct = (v) => (typeof v === 'number' ? `${v.toFixed(1)}%` : '알 수 없음');
  return (
    `${base}\n      사용률(마지막 확인: ${quotaEntry.checked_at}): ` +
    `토큰 ${pct(quotaEntry.tokens_used_pct)} / 요청수 ${pct(quotaEntry.requests_used_pct)}`
  );
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
