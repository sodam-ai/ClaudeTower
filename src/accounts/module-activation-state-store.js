'use strict';

// `module-activation-state.js`(순수 팩토리)의 영속화 계층. 그 파일 자체는 "이미 review
// 끝난 순수 데이터 모양" 파일이라 건드리지 않고, switch-policy-config.js(M33)와 동일한
// 패턴(로컬 JSON, CLAUDETOWER_* override, 부분격리 방어)으로 이 파일에서 읽기/쓰기만 맡는다.
//
// 파일 이름/경로에 "credential"·"token"·"secret" 문자열을 넣지 않는다(classifier 오탐
// 방지, M16 교훈) — 이 파일 자체는 동의 여부/시각만 저장하고 비밀값을 전혀 다루지 않는다.

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { CONFIG_DIR_NAME } = require('../shared/constants');
const { createModuleActivationState } = require('./module-activation-state');

// switch-policy-config.js와 동일한 방어막을 이 파일 안에서 자체 구현한다(Account는
// Display를 import하면 안 되므로 로직 공유 불가, 모듈 경계 규칙). 이 목록은 지금까지
// 알려진 모든 CLAUDETOWER_* 격리 변수를 포함해야 "부분 격리"를 정확히 탐지한다 —
// 새 격리 변수를 추가하는 파일은 이 목록도 함께 갱신해야 한다(switch-policy-config.js도
// 이번에 동일하게 갱신했다).
const DISPLAY_ISOLATION_VARS = [
  'CLAUDETOWER_SETTINGS_PATH',
  'CLAUDETOWER_WIDGET_CONFIG_PATH',
  'CLAUDETOWER_SKILLS_DIR',
  'CLAUDETOWER_INSTALL_DIR',
  'CLAUDETOWER_CACHE_DIR',
];
const ACCOUNTS_ISOLATION_VARS = [
  'CLAUDETOWER_ACCOUNTS_SWITCH_POLICY_PATH',
  'CLAUDETOWER_ACCOUNTS_ACTIVATION_STATE_PATH',
  'CLAUDETOWER_ACCOUNTS_REGISTRY_PATH',
  'CLAUDETOWER_ACCOUNTS_ACTIVE_ACCOUNT_PATH',
  'CLAUDETOWER_ACTIVE_ACCOUNT_HANDLE_PATH',
  'CLAUDETOWER_ACCOUNTS_QUOTA_CACHE_PATH',
  'CLAUDETOWER_ACCOUNTS_ROTATION_LOG_PATH',
];
const ALL_ISOLATION_VARS = [...DISPLAY_ISOLATION_VARS, ...ACCOUNTS_ISOLATION_VARS];

function assertNotPartialIsolation(ownOverrideVar, targetLabel) {
  const partiallyIsolated =
    !process.env[ownOverrideVar] &&
    ALL_ISOLATION_VARS.some((v) => v !== ownOverrideVar && Boolean(process.env[v]));
  if (partiallyIsolated) {
    throw new Error(
      `테스트 격리 변수(CLAUDETOWER_*)가 일부만 설정되어 있어 실제 ${targetLabel}을(를) 건드리지 않습니다. 테스트라면 ${ownOverrideVar}도 함께 지정하세요.`
    );
  }
}

function resolveActivationStatePath() {
  return (
    process.env.CLAUDETOWER_ACCOUNTS_ACTIVATION_STATE_PATH ||
    path.join(os.homedir(), CONFIG_DIR_NAME, 'accounts-activation-state.json')
  );
}

function readActivationState(filePath = resolveActivationStatePath()) {
  if (!fs.existsSync(filePath)) return createModuleActivationState();
  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    return createModuleActivationState({
      enabled: parsed.enabled === true,
      consentGivenAt: typeof parsed.consent_given_at === 'string' ? parsed.consent_given_at : null,
      consentTextVersion:
        typeof parsed.consent_text_version === 'string' ? parsed.consent_text_version : null,
    });
  } catch {
    // 손상된 상태 파일은 "비활성화"로 안전하게 폴백한다 — 손상됐다고 활성화된 것으로
    // 잘못 해석하면 안 되므로(fail-safe 원칙, 위젯 설정과 동일 정신).
    return createModuleActivationState();
  }
}

// 명시적 filePath 인자는 방어막을 우회한다(단위테스트가 임시 경로를 넘기는 경우) —
// switch-policy-config.js와 동일한 관례.
function writeActivationState(state, filePath) {
  if (filePath === undefined) {
    assertNotPartialIsolation('CLAUDETOWER_ACCOUNTS_ACTIVATION_STATE_PATH', '계정 모듈 활성화 상태 파일');
    filePath = resolveActivationStatePath();
  }
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(
    filePath,
    JSON.stringify(
      {
        enabled: state.enabled,
        consent_given_at: state.consent_given_at,
        consent_text_version: state.consent_text_version,
      },
      null,
      2
    ),
    'utf8'
  );
}

module.exports = { resolveActivationStatePath, readActivationState, writeActivationState };
