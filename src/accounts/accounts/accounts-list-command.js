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

function formatAccountLine(account) {
  return `  - ${account.label} (${account.auth_type}, ${account.status}, 등록: ${account.created_at})`;
}

function runAccountsListCommand({ registryPath, log = () => {} } = {}) {
  const accounts = readRegistry(registryPath);
  if (accounts.length === 0) {
    log('등록된 계정이 없습니다. claudetower accounts add --api-key <라벨> <키값>으로 등록하세요.');
    return { applied: true, count: 0 };
  }
  log(`등록된 계정 ${accounts.length}개:`);
  accounts.forEach((a) => log(formatAccountLine(a)));
  return { applied: true, count: accounts.length };
}

module.exports = { runAccountsListCommand, formatAccountLine };
