'use strict';

// `claudetower accounts enable` — 동의 고지(consent-text.js)를 그대로 보여주고
// [y/N] 확인 후에만 module-activation-state를 "활성화"로 영속화한다.
//
// setup-wizard.js가 이미 확정한 readline 패턴을 그대로 재사용한다: rl.question()을
// 연속 호출하면 파이프 입력이 EOF에서 두 번째 호출부터 콜백이 영영 안 오는 실제 버그가
// 있어(자동화 스크립트로 답을 흘려보내는 시나리오에서 재현됨), 비동기 이터레이터
// (rl[Symbol.asyncIterator]())로 읽는다. 프롬프트는 반드시 rl.output에 쓴다(process.
// stdout에 직접 쓰면 node --test 하위 프로세스에서 IPC 채널과 경합하는 실제 버그가
// 있었다, setup-wizard.js 주석 참고).

const { CONSENT_TEXT, CONSENT_TEXT_VERSION } = require('./consent-text');
const { readActivationState, writeActivationState } = require('./module-activation-state-store');
const { createModuleActivationState } = require('./module-activation-state');

async function runAccountsEnableCommand(rl, { activationStatePath, log = () => {} } = {}) {
  const current = readActivationState(activationStatePath);
  if (current.enabled) {
    log(`이미 활성화되어 있습니다 (동의: ${current.consent_given_at || '알 수 없음'}).`);
    return { applied: true, alreadyEnabled: true };
  }

  rl.output.write(`${CONSENT_TEXT} `);
  const lineIterator = rl[Symbol.asyncIterator]();
  const { value, done } = await lineIterator.next();
  const answer = done ? '' : value;
  const normalized = answer.trim().toLowerCase();

  if (normalized !== 'y' && normalized !== 'yes') {
    log('\n취소했습니다 — 활성화되지 않았습니다.');
    return { applied: false };
  }

  const newState = createModuleActivationState({
    enabled: true,
    consentGivenAt: new Date().toISOString(),
    consentTextVersion: CONSENT_TEXT_VERSION,
  });
  writeActivationState(newState, activationStatePath);
  log(
    '\n활성화됐습니다. 이제 claudetower accounts add --api-key <라벨> <키값>으로 계정을 등록할 수 있습니다.'
  );
  return { applied: true, alreadyEnabled: false };
}

module.exports = { runAccountsEnableCommand };
