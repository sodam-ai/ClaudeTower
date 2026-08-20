'use strict';

// `claudetower accounts config` 전용 — 계정 전환 정책(임계값/전략/포트/재평가주기)을
// credential-store 없이도 미리 로컬에 저장/조회할 수 있게 한다(.PRD/01_PRD.md §3 P2,
// .PRD/03_PHASES.md 89행 "claudetower config — 전환 임계값·전략·포트 조정").
//
// 절대 규칙: 이 파일은 계정별 실데이터(access_token, upstream_url 등)를 다루지 않는다.
// 그 두 필드는 `proxy/proxy-config.js`의 `createProxyConfig()`가 이미 요구하고 있고,
// credential-store가 없으면 값 자체가 존재하지 않는다(계정이 없으므로) — 그래서
// createProxyConfig()를 여기서 직접 호출하지 않는다. 실제 프록시가 기동되는 시점
// (credential-store 완료 후)에 이 파일이 반환하는 값을 createProxyConfig()의 인자
// 일부로 주입하는 구조를 전제로 한다. 파일 이름/경로/필드 어디에도 "credential"·
// "token"·"secret" 문자열을 넣지 않는다(classifier 오탐 방지, M16 교훈).
//
// 값 검증 범위(threshold 50~100, port 1024~65535)는 proxy-config.js와 동일 근거를
// 그대로 따른다(.PRD/.archive/QuotaSwitch원본/04_PROJECT_SPEC.md "옵션 설정 요구사항").
// 기본값(port 41411, threshold_pct 98, reeval_interval_ms 300000, port_retry_max 10)도
// 같은 문서의 예시값을 그대로 채택(.PRD/.archive/QuotaSwitch원본/02_DATA_MODEL.md
// ProxyConfig 표) — strategy 기본값만 그 문서에 명시가 없어 'best'로 판단해 채택.

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { CONFIG_DIR_NAME } = require('../shared/constants');

// src/display/config/test-isolation.js와 같은 결함 부류(테스트가 CLAUDETOWER_* 변수를
// "일부만" 설정한 채 실제 exe를 돌리면 격리 안 된 실제 파일이 변조됨, 2026-07-06 통제
// 재현으로 확정)에 대한 방어막을 여기 별도로 둔다 — Account는 Display를 import하면 안
// 되므로(모듈 경계 규칙, eslint no-cross-zone-require) 로직을 그대로 재사용하지 않고
// 이 파일 안에서 자체적으로 구현한다.
const DISPLAY_ISOLATION_VARS = [
  'CLAUDETOWER_SETTINGS_PATH',
  'CLAUDETOWER_WIDGET_CONFIG_PATH',
  'CLAUDETOWER_SKILLS_DIR',
  'CLAUDETOWER_INSTALL_DIR',
  'CLAUDETOWER_CACHE_DIR',
];
// M36에서 CLAUDETOWER_ACCOUNTS_ACTIVATION_STATE_PATH/CLAUDETOWER_ACCOUNTS_REGISTRY_PATH
// 신설 — 이 목록에도 함께 추가해야 그 두 파일이 격리된 상태에서 이 파일만 격리 안 된
// 채로 실행되는 "부분 격리" 시나리오를 정확히 탐지한다(대칭 방어 원칙).
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

const STRATEGIES = ['best', 'next-available'];

const DEFAULTS = {
  threshold_pct: 98,
  port: 41411,
  strategy: 'best',
  reeval_interval_ms: 300000,
  port_retry_max: 10,
};

function resolveSwitchPolicyPath() {
  return (
    process.env.CLAUDETOWER_ACCOUNTS_SWITCH_POLICY_PATH ||
    path.join(os.homedir(), CONFIG_DIR_NAME, 'accounts-switch-policy.json')
  );
}

function readRawPolicy(filePath) {
  if (!fs.existsSync(filePath)) return {};
  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {}; // 손상된 정책 파일은 기본값으로 안전하게 폴백(위젯 설정과 동일 원칙)
  }
}

function readSwitchPolicy(filePath = resolveSwitchPolicyPath()) {
  return { ...DEFAULTS, ...readRawPolicy(filePath) };
}

function validateField(key, value) {
  if (key === 'threshold_pct') {
    const n = Number(value);
    if (!Number.isFinite(n) || n < 50 || n > 100) {
      throw new TypeError('threshold_pct는 50~100 사이의 숫자여야 합니다(50 미만은 너무 잦은 전환을 유발).');
    }
    return n;
  }
  if (key === 'port') {
    const n = Number(value);
    if (!Number.isInteger(n) || n < 1024 || n > 65535) {
      throw new TypeError('port는 1024~65535 사이의 정수여야 합니다(1024 미만은 OS 예약 포트).');
    }
    return n;
  }
  if (key === 'strategy') {
    if (!STRATEGIES.includes(value)) {
      throw new TypeError(`strategy는 ${STRATEGIES.join(' 또는 ')} 둘 중 하나여야 합니다.`);
    }
    return value;
  }
  if (key === 'reeval_interval_ms') {
    // 하한이 0이라 Number('')===0(NaN 아님, JS 특유의 함정)이 "< 0"에 안 걸리고
    // 통과한다 — threshold_pct(하한 50)/port(하한 1024)/port_retry_max(하한 1)는
    // 우연히 하한에 걸려 막히지만 이 필드만 하한이 0이라 그 우연이 성립하지 않는다.
    // config-command.js의 padding(공식 기본값 0)이 이미 겪은 것과 동일한 결함
    // 부류(M18) — 빈/공백 문자열을 Number() 호출 전에 명시적으로 거부한다.
    if (typeof value !== 'string' || value.trim() === '') {
      throw new TypeError('reeval_interval_ms는 0 이상의 정수여야 합니다(0 = 주기적 재평가 비활성화).');
    }
    const n = Number(value);
    if (!Number.isInteger(n) || n < 0) {
      throw new TypeError('reeval_interval_ms는 0 이상의 정수여야 합니다(0 = 주기적 재평가 비활성화).');
    }
    return n;
  }
  if (key === 'port_retry_max') {
    const n = Number(value);
    // 상한 없이 큰 값을 허용하면(예: 999999) EADDRINUSE 시 순차 포트 재시도가
    // 비정상적으로 오래 걸릴 수 있다(proxy/server.js의 재시도 루프) — 실사용에서
    // 65535-1024개 포트를 전부 소진할 일은 없으므로 넉넉하되 명확한 상한(100)을 둔다.
    if (!Number.isInteger(n) || n < 1 || n > 100) {
      throw new TypeError('port_retry_max는 1~100 사이의 정수여야 합니다.');
    }
    return n;
  }
  throw new TypeError(
    `알 수 없는 설정 키: ${key}. 사용 가능한 키: ${Object.keys(DEFAULTS).join(', ')}`
  );
}

// 명시적 filePath 인자는 방어막을 우회한다(단위테스트가 임시 경로를 넘기는 경우).
// 인자 없이 실제 기본 경로로 폴백할 때만 부분 격리 상태면 쓰기를 거부한다
// (widget-config.js/settings-writer.js와 동일한 원칙, test-isolation.js 참고).
function writeSwitchPolicyField(key, rawValue, filePath) {
  const validated = validateField(key, rawValue);
  if (filePath === undefined) {
    assertNotPartialIsolation('CLAUDETOWER_ACCOUNTS_SWITCH_POLICY_PATH', '계정 전환 정책 파일');
    filePath = resolveSwitchPolicyPath();
  }
  const existing = readRawPolicy(filePath);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(
    filePath,
    JSON.stringify({ ...DEFAULTS, ...existing, [key]: validated }, null, 2),
    'utf8'
  );
  return validated;
}

module.exports = {
  DEFAULTS,
  STRATEGIES,
  resolveSwitchPolicyPath,
  readSwitchPolicy,
  writeSwitchPolicyField,
};
