'use strict';

// `claudetower accounts disable` — Account 모듈을 다시 끈다.
//
// 왜 지금 만드는가: 08_ACCOUNTS_ENABLE_CONSENT_DRAFT.md의 동의 문구(consent-text.js, M36부터
// 실제로 사용자에게 출력됨)가 "언제든지 claudetower accounts disable로 다시 끌 수 있고"라고
// 명시적으로 약속하는데, enable/add가 실제로 라이브가 된 지금까지 disable 명령 자체가
// 존재하지 않았다 — 동의 화면이 지키지 못할 약속을 하고 있던 상태였다(실행으로 확인된 결함).
//
// 절대 하지 않는 것: 등록된 계정(레지스트리)이나 자격증명(credential-store)은 전혀 건드리지
// 않는다 — 동의 문구 자체가 "꺼도 등록해둔 계정 정보는 남아있습니다(완전히 지우려면
// claudetower account-purge)"라고 명시하므로, disable은 오직 활성화 상태만 되돌린다.
// purge와 disable을 분리하는 것 자체가 이 문구가 요구하는 설계다.
//
// 확인 절차 없이 즉시 실행한다: 04_PROJECT_SPEC.md DO NOT가 확인 없이 즉시 실행하지 말라고
// 명시한 대상은 remove·purge(되돌릴 수 없는 삭제)뿐이다 — disable은 데이터를 지우지 않고
// 자격증명·등록 정보가 그대로 남아 있어 accounts enable로 언제든 되돌릴 수 있으므로(가역적),
// 동의 문구의 "언제든지... 다시 끌 수 있고"라는 표현과도 일치하게 확인 프롬프트 없이 즉시
// 처리한다(enable과의 비대칭은 의도적 — enable은 새로운 위험을 시작하는 쪽이라 동의가
// 필요하고, disable은 위험을 끝내는 쪽이라 마찰이 없어야 한다).

const { readActivationState, writeActivationState } = require('./module-activation-state-store');
const { createModuleActivationState } = require('./module-activation-state');

function runAccountsDisableCommand({ activationStatePath, log = () => {} } = {}) {
  const current = readActivationState(activationStatePath);
  if (!current.enabled) {
    log('이미 비활성화되어 있습니다.');
    return { applied: true, alreadyDisabled: true };
  }

  writeActivationState(createModuleActivationState(), activationStatePath);
  log('비활성화했습니다. 등록해둔 계정 정보는 그대로 남아있습니다(완전히 지우려면 claudetower account-purge).');
  log('다시 켜려면 claudetower accounts enable을 실행하세요.');
  return { applied: true, alreadyDisabled: false };
}

module.exports = { runAccountsDisableCommand };
