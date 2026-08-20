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
const { execFileSync } = require('node:child_process');
const { CONFIG_DIR_NAME } = require('../../shared/constants');

// 2026-08-20 신설(active-account-provider.js 연결과 함께): 이 파일은 지금까지
// diagnose-quota-command.js가 사용자 [y/N] 확인 후 1회 호출할 때만 쓰였다. 그런데
// onUpstreamHeaders(proxy/active-account-provider.js)가 이번에 이 캐시를 실제 전환
// 판단에 쓰기 시작하면서, 매 업스트림 응답마다(사용자 명령 1회당 1번이 아니라) 자동으로
// 이 파일에 쓰게 된다 — active-account-state.js·active-account-handle/write.js가 이미
// 겪은 것과 똑같은 위험 등급 상승이다(그 두 파일의 상단 주석·`.PRD/05_FIELD_ISSUES_2026-07-04.md`
// 이슈#1 참고). 그래서 그 두 파일과 동일한 원자적쓰기(임시파일+rename)+Windows EPERM/EBUSY
// 재시도+소유자 전용 권한(icacls/chmod) 패턴을 여기도 그대로 적용한다(이 프로젝트 관례대로
// 코드는 공유하지 않고 중복 작성).
const ACL_ENTRY_PATTERN = /:\([A-Za-z,]+\)$/;
const RENAME_MAX_RETRIES = 10;
const RENAME_RETRY_DELAY_MS = 20;

function restrictOwnerOnlyPermission(filePath) {
  if (process.platform === 'win32') {
    try {
      const username = os.userInfo().username;
      execFileSync('icacls', [filePath, '/inheritance:r'], { stdio: 'ignore' });
      execFileSync('icacls', [filePath, '/grant:r', `${username}:F`], { stdio: 'ignore' });
      const output = execFileSync('icacls', [filePath], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
      const aceLines = output
        .split('\n')
        .map((line) => line.trimEnd())
        .filter((line) => ACL_ENTRY_PATTERN.test(line));
      return aceLines.length === 1 && aceLines[0].includes(`${username}:(F)`);
    } catch {
      return false;
    }
  }
  try {
    fs.chmodSync(filePath, 0o600);
    return (fs.statSync(filePath).mode & 0o777) === 0o600;
  } catch {
    return false;
  }
}

function atomicWriteFileSync(filePath, content) {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
  const tmpPath = path.join(dir, `.${path.basename(filePath)}.tmp-${process.pid}-${Date.now()}`);
  fs.writeFileSync(tmpPath, content, { encoding: 'utf8', mode: 0o600 });
  const permissionRestricted = restrictOwnerOnlyPermission(tmpPath);

  for (let attempt = 1; ; attempt++) {
    try {
      fs.renameSync(tmpPath, filePath);
      return { permissionRestricted };
    } catch (err) {
      const isTransient = err.code === 'EPERM' || err.code === 'EBUSY';
      if (!isTransient || attempt >= RENAME_MAX_RETRIES) {
        try {
          fs.unlinkSync(tmpPath);
        } catch {
          // 임시파일 정리 실패는 무시 — 원래 에러(rename 실패)가 더 중요하므로 그대로 던진다.
        }
        throw err;
      }
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, RENAME_RETRY_DELAY_MS);
    }
  }
}

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
  return atomicWriteFileSync(filePath, JSON.stringify(cache, null, 2));
}

module.exports = { resolveQuotaCachePath, readQuotaCache, readQuotaCacheEntry, writeQuotaCacheEntry };
