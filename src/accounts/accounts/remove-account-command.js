'use strict';

// `claudetower accounts remove <라벨>` — 계정 1개만 삭제한다(전체 삭제는 account-purge).
//
// 왜 지금 만드는가: .PRD/03_PHASES.md Phase 2 체크리스트가 요구하는 "계정 관리 CRUD"
// (accounts/remove/rename/purge) 중 purge만 있고 remove가 없었다 — 계정을 여러 개
// 등록한 사용자가 "이거 하나만 지우고 싶은데 전부 지우는 것밖에 없다"는 실사용 갭이었다
// (2026-08-20 PRD 재검독으로 발견).
//
// account-purge와 동일한 원칙 재사용: 삭제 순서(자격증명 먼저, 확인 후 레지스트리),
// 삭제 후 재조회 검증(getSecret이 null인지), [y/N] 확인 필수(04_PROJECT_SPEC.md DO NOT
// "확인 절차 없이 remove·purge를 즉시 실행하지 마"의 remove가 바로 이 명령).
//
// purge와 다른 점: 활성화 상태(ModuleActivationState)는 절대 건드리지 않는다 — 계정
// 하나를 지운다고 Account 기능 자체를 꺼버리면 나머지 계정까지 못 쓰게 되는 부작용이라
// disable과 동일하게 "그건 이 명령의 책임이 아니다"라는 원칙을 따른다.

const { readRegistry, writeRegistry } = require('./accounts-registry');
const { backendForPlatform } = require('./add-api-key-command');
const { getSecret, deleteSecret } = require('../credential-store');

function credentialRefFor(account) {
  return { account_id: account.account_id, backend: backendForPlatform(), external_ref: account.account_id };
}

async function runRemoveAccountCommand(rl, label, { registryPath, log = () => {} } = {}) {
  const accounts = readRegistry(registryPath);
  const account = accounts.find((a) => a.label === label);
  if (!account) {
    log(`계정을 찾을 수 없습니다: ${label} (claudetower accounts list로 등록된 라벨을 확인하세요)`);
    return { applied: false, reason: 'account_not_found' };
  }

  log(`⚠️  "${label}" 계정을 삭제합니다(되돌릴 수 없습니다).`);
  rl.output.write('정말 삭제하시겠습니까? [y/N]: ');
  const lineIterator = rl[Symbol.asyncIterator]();
  const { value, done } = await lineIterator.next();
  const answer = done ? '' : value;
  if (answer.trim().toLowerCase() !== 'y' && answer.trim().toLowerCase() !== 'yes') {
    log('취소했습니다 — 아무것도 삭제하지 않았습니다.');
    return { applied: false, reason: 'cancelled' };
  }

  const ref = credentialRefFor(account);
  try {
    deleteSecret(ref);
    const stillPresent = getSecret(ref);
    if (stillPresent !== null) {
      log(`삭제 명령은 실행됐지만 재조회 결과 자격증명이 여전히 남아있습니다 — "${label}"을(를) 목록에서 지우지 않았습니다. 다시 시도해주세요.`);
      return { applied: false, reason: 'credential_still_present' };
    }
  } catch (err) {
    log(`자격증명 삭제에 실패했습니다: ${err.message} — "${label}"을(를) 목록에서 지우지 않았습니다.`);
    return { applied: false, reason: 'credential_delete_failed', error: err.message };
  }

  const remaining = accounts.filter((a) => a.account_id !== account.account_id);
  writeRegistry(remaining, registryPath);

  log(`"${label}" 계정을 삭제했습니다.`);
  return { applied: true, accountId: account.account_id };
}

module.exports = { runRemoveAccountCommand };
