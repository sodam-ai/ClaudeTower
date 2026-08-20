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

const { updateRegistry } = require('./accounts-registry');

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

  // 2026-08-20 정정: 계정 존재 여부·라벨 충돌 확인을 미리 읽어둔 스냅샷이 아니라
  // updateRegistry가 락을 쥔 시점의 최신 목록 기준으로 한다 — 그래야 이 명령이 실행되는
  // 그 짧은 순간에 다른 프로세스가 목록을 바꿔도(예: 동시에 다른 계정을 추가/삭제) 낡은
  // 정보로 잘못 판단하지 않는다. 결과는 클로저 변수(outcome)로 꺼내온다.
  let outcome;
  updateRegistry((current) => {
    const account = current.find((a) => a.label === oldLabel);
    if (!account) {
      outcome = { applied: false, reason: 'account_not_found' };
      return current;
    }
    if (newLabel === oldLabel) {
      outcome = { applied: true, accountId: account.account_id, unchanged: true };
      return current;
    }
    if (current.some((a) => a.label === newLabel)) {
      outcome = { applied: false, reason: 'label_conflict' };
      return current;
    }
    outcome = { applied: true, accountId: account.account_id, unchanged: false };
    return current.map((a) => (a.account_id === account.account_id ? { ...a, label: newLabel } : a));
  }, registryPath);

  if (!outcome.applied) {
    log(
      outcome.reason === 'account_not_found'
        ? `계정을 찾을 수 없습니다: ${oldLabel} (claudetower accounts list로 등록된 라벨을 확인하세요)`
        : `"${newLabel}" 라벨이 이미 등록되어 있습니다. 다른 라벨을 쓰세요.`
    );
  } else if (outcome.unchanged) {
    log('기존 라벨과 같습니다 — 변경 사항이 없습니다.');
  } else {
    log(`"${oldLabel}" → "${newLabel}"로 이름을 바꿨습니다.`);
  }
  return outcome;
}

module.exports = { runRenameAccountCommand, MAX_LABEL_LENGTH };
