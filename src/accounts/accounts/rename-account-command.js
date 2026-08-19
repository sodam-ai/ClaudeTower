'use strict';

// `claudetower accounts rename <기존라벨> <새라벨>` — 계정의 표시용 라벨만 바꾼다.
//
// credential-store는 라벨이 아니라 account_id(=external_ref)로 키를 잡으므로
// (add-api-key-command.js의 credentialRefFor 참고), 라벨 변경은 credential-store를
// 전혀 건드리지 않는다 — registry.json의 label 필드 하나만 고치는 순수 로컬 쓰기다.
//
// 확인 절차가 없는 이유: 04_PROJECT_SPEC.md DO NOT가 확인 없이 즉시 실행하지 말라고
// 명시한 대상은 remove·purge(되돌릴 수 없는 삭제)뿐이다. rename은 언제든 다시
// rename으로 되돌릴 수 있어(가역적) accounts config/add와 같은 마찰 없는 쓰기로 취급한다.
//
// 라벨 검증(add-api-key-request.js와 동일한 규칙 재사용): 길이 상한·제어문자 거부 —
// 새 라벨도 등록 시점과 똑같은 위험(2026-08-19 실측 발견, 100자 초과·개행 포함 라벨이
// 그대로 저장되던 결함)에 노출되므로 여기서도 동일하게 막는다.

const { readRegistry, writeRegistry } = require('./accounts-registry');

const MAX_LABEL_LENGTH = 100;
const CONTROL_CHARS = /[\x00-\x1F\x7F]/;

function runRenameAccountCommand(oldLabel, newLabel, { registryPath, log = () => {} } = {}) {
  if (typeof newLabel !== 'string' || newLabel.trim().length === 0) {
    log('새 라벨을 입력해주세요.');
    return { applied: false, reason: 'invalid_new_label' };
  }
  if (newLabel.length > MAX_LABEL_LENGTH) {
    log(`계정 라벨은 ${MAX_LABEL_LENGTH}자를 넘을 수 없습니다.`);
    return { applied: false, reason: 'label_too_long' };
  }
  if (CONTROL_CHARS.test(newLabel)) {
    log('계정 라벨에는 줄바꿈 등 제어문자를 쓸 수 없습니다.');
    return { applied: false, reason: 'label_control_chars' };
  }

  const accounts = readRegistry(registryPath);
  const account = accounts.find((a) => a.label === oldLabel);
  if (!account) {
    log(`계정을 찾을 수 없습니다: ${oldLabel} (claudetower accounts list로 등록된 라벨을 확인하세요)`);
    return { applied: false, reason: 'account_not_found' };
  }

  if (newLabel === oldLabel) {
    log('기존 라벨과 같습니다 — 변경 사항이 없습니다.');
    return { applied: true, accountId: account.account_id, unchanged: true };
  }
  if (accounts.some((a) => a.label === newLabel)) {
    log(`"${newLabel}" 라벨이 이미 등록되어 있습니다. 다른 라벨을 쓰세요.`);
    return { applied: false, reason: 'label_conflict' };
  }

  const updated = accounts.map((a) => (a.account_id === account.account_id ? { ...a, label: newLabel } : a));
  writeRegistry(updated, registryPath);

  log(`"${oldLabel}" → "${newLabel}"로 이름을 바꿨습니다.`);
  return { applied: true, accountId: account.account_id, unchanged: false };
}

module.exports = { runRenameAccountCommand, MAX_LABEL_LENGTH };
