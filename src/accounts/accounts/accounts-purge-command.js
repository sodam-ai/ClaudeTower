'use strict';

// `claudetower account-purge` — 등록된 모든 계정의 자격증명(OS 키체인)과 계정 목록을
// 완전히 삭제한다. 동의 문구(consent-text.js)가 "완전히 지우려면 claudetower
// account-purge"라고 명시하는 그 명령 — 2026-08-19까지 존재하지 않아 그 약속이 거짓이던
// 것을 채운다(accounts-disable-command.js와 같은 계기, DO NOT 규칙 "확인 절차 없이
// remove·purge를 즉시 실행하지 마"의 대상).
//
// 삭제 순서가 중요하다(부분 실패 안전성): 레지스트리를 먼저 지우면, 그 다음 자격증명
// 삭제가 실패했을 때 "어떤 계정의 자격증명이 아직 키체인에 남아있는지" 알 방법이
// 사라진다(레지스트리가 유일한 account_id 매핑 출처). 그래서 항상 자격증명을 먼저
// 지우고, 결과를 확인한 뒤에만 레지스트리에서 그 항목을 제거한다 — 실패한 계정은
// 레지스트리에 그대로 남겨 사용자가 무엇이 안 지워졌는지 알 수 있게 한다(silent
// fallback 금지 원칙, 04_PROJECT_SPEC.md).
//
// 삭제 후 재확인: deleteSecret()이 에러 없이 끝나는 것과 실제로 지워진 것은 다르다
// (rotation-log.js의 chmod/icacls 교훈과 같은 정신) — getSecret()으로 다시 조회해
// null인지까지 확인한 뒤에만 "성공"으로 취급한다.

const { readRegistry, writeRegistry } = require('./accounts-registry');
const { backendForPlatform } = require('./add-api-key-command');
const { getSecret, deleteSecret } = require('../credential-store');
const { writeActivationState } = require('../module-activation-state-store');
const { createModuleActivationState } = require('../module-activation-state');

function credentialRefFor(account) {
  return { account_id: account.account_id, backend: backendForPlatform(), external_ref: account.account_id };
}

// 실제 삭제 실행(확인 이후 호출) — 계정별로 지우고 재확인, 실패분은 레지스트리에 보존.
function purgeAll(accounts, { registryPath, activationStatePath }) {
  const failed = [];
  const succeeded = [];
  for (const account of accounts) {
    const ref = credentialRefFor(account);
    try {
      deleteSecret(ref);
      const stillPresent = getSecret(ref);
      if (stillPresent !== null) {
        failed.push({ account, reason: '삭제 명령은 성공했지만 재조회 결과 여전히 남아있음' });
      } else {
        succeeded.push(account);
      }
    } catch (err) {
      failed.push({ account, reason: err.message });
    }
  }

  // 실패분만 레지스트리에 남긴다 — 전부 성공하면 빈 배열(완전 삭제).
  writeRegistry(
    failed.map((f) => f.account),
    registryPath
  );

  // 등록된 계정이 하나도 안 남았을 때만 활성화 상태도 끈다 — 실패분이 남아있는데
  // 활성화까지 꺼버리면 "완전히 정리됐다"는 잘못된 인상을 줄 수 있다.
  if (failed.length === 0) {
    writeActivationState(createModuleActivationState(), activationStatePath);
  }

  return { succeeded, failed };
}

async function runAccountsPurgeCommand(rl, { registryPath, activationStatePath, log = () => {} } = {}) {
  const accounts = readRegistry(registryPath);
  if (accounts.length === 0) {
    log('삭제할 계정이 없습니다(이미 비어있습니다).');
    return { applied: true, deletedCount: 0 };
  }

  log(
    `⚠️  등록된 계정 ${accounts.length}개를 전부 삭제합니다(되돌릴 수 없습니다):\n` +
      accounts.map((a) => `  - ${a.label}`).join('\n')
  );
  rl.output.write('정말 전부 삭제하시겠습니까? [y/N]: ');
  const lineIterator = rl[Symbol.asyncIterator]();
  const { value, done } = await lineIterator.next();
  const answer = done ? '' : value;
  if (answer.trim().toLowerCase() !== 'y' && answer.trim().toLowerCase() !== 'yes') {
    log('취소했습니다 — 아무것도 삭제하지 않았습니다.');
    return { applied: false };
  }

  const { succeeded, failed } = purgeAll(accounts, { registryPath, activationStatePath });

  if (failed.length === 0) {
    log(`${succeeded.length}개 계정을 전부 삭제했습니다. Account 모듈도 함께 비활성화했습니다.`);
    return { applied: true, deletedCount: succeeded.length, failedCount: 0 };
  }

  log(`${succeeded.length}개는 삭제됐지만, ${failed.length}개는 실패했습니다(목록에 그대로 남아있습니다):`);
  failed.forEach((f) => log(`  - ${f.account.label}: ${f.reason}`));
  log('실패한 항목은 claudetower account-purge를 다시 실행해 재시도할 수 있습니다.');
  return { applied: true, deletedCount: succeeded.length, failedCount: failed.length };
}

module.exports = { runAccountsPurgeCommand, purgeAll };
