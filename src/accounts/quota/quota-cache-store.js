'use strict';

// diagnose-quota-command.js가 실제로 확인한 사용률(parseApiKeyQuotaHeaders 결과)을
// 계정별로 저장해, accounts list가 "마지막으로 확인된 사용률"을 보여줄 수 있게 한다.
//
// 왜 QuotaState(quota-state.js) 엔티티를 그대로 쓰지 않는가: 그 엔티티는
// five_hour_used_pct/seven_day_used_pct — teamclaude의 OAuth/구독 계정
// anthropic-ratelimit-unified-5h/7d-* 헤더용 이름이다. 이 프로젝트의 자동전환은
// API 키 계정으로만 범위가 좁혀졌고(2026-08-19 결정), API 키 계정은 시간 창 개념이
// 없는 anthropic-ratelimit-tokens/requests-* 헤더를 쓴다(api-key-quota-reading.js).
// "5시간/7일" 이름을 붙이면 실제로 측정하는 것과 다른 이름을 붙이는 셈이라(이 프로젝트가
// 반복해서 잡아온 "능력을 과대·부정확 고지" 부류의 문제), QuotaState를 억지로 재사용하지
// 않고 실제 파서 출력 모양 그대로 저장한다.
//
// list 명령이 매번 실제 API를 호출하지 않는 이유: diagnose-quota 자체가 실비용이 드는
// 유일한 Account 명령이라 [y/N] 확인이 필수다(diagnose-quota-command.js 참고) — list가
// 그 확인 없이 자동으로 매번 실제 요청을 보내면 같은 원칙을 어기게 된다. 그래서 list는
// 이 캐시(마지막으로 사용자가 diagnose-quota를 직접 실행했을 때의 결과)만 읽는다 —
// 실시간 값이 아니라 "마지막 확인 시점" 값임을 항상 함께 표시해야 한다.

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { CONFIG_DIR_NAME } = require('../../shared/constants');

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

function resolveQuotaCachePath() {
  return (
    process.env.CLAUDETOWER_ACCOUNTS_QUOTA_CACHE_PATH ||
    path.join(os.homedir(), CONFIG_DIR_NAME, 'accounts-quota-cache.json')
  );
}

function readQuotaCache(filePath = resolveQuotaCachePath()) {
  if (!fs.existsSync(filePath)) return {};
  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {}; // 손상된 캐시는 "확인 이력 없음"으로 안전 폴백(다른 설정 파일들과 동일 원칙)
  }
}

function readQuotaCacheEntry(accountId, filePath) {
  const cache = readQuotaCache(filePath);
  return cache[accountId] || null;
}

// reading: parseApiKeyQuotaHeaders()의 반환값(null이 아닌 것만 저장 호출부 책임).
function writeQuotaCacheEntry(accountId, reading, filePath) {
  if (typeof accountId !== 'string' || accountId.length === 0) {
    throw new TypeError('accountId must be a non-empty string');
  }
  if (filePath === undefined) {
    assertNotPartialIsolation('CLAUDETOWER_ACCOUNTS_QUOTA_CACHE_PATH', '계정 사용률 캐시 파일');
    filePath = resolveQuotaCachePath();
  }
  const cache = readQuotaCache(filePath);
  cache[accountId] = { ...reading, checked_at: new Date().toISOString() };
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(cache, null, 2), 'utf8');
}

module.exports = { resolveQuotaCachePath, readQuotaCache, readQuotaCacheEntry, writeQuotaCacheEntry };
