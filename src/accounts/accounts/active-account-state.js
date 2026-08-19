'use strict';

// "지금 프록시가 어느 계정을 쓰고 있는지" 포인터를 관리하고, switch-decision.js(M41)의
// 판단(shouldSwitch/toAccountId/reason)을 실제로 적용한다 — 이 파일이 생기기 전까지는
// 판단 결과를 아무도 반영하지 않았다(2026-08-20 이전 상태, request-forwarder.js는
// onUpstreamHeaders 훅만 있고 그 결과를 적용하는 곳이 없었음).
//
// credential-store를 절대 require하지 않는다 — 실제 API 키 조회는
// proxy/active-account-provider.js가 이 파일과 credential-store를 함께 조합해서 한다
// (정적 검사로 강제, accounts-registry.js와 동일 원칙).
//
// 여러 프로세스(터미널 여러 개에서 동시에 claudetower 실행)가 같은 상태를 공유해야
// 꼬이지 않으므로, 상태는 항상 파일로 영속화한다(메모리 변수 아님).
//
// 의도적으로 하지 않는 것: 전환된(FROM) 계정의 registry status를 'cooldown'으로
// 바꾸는 것 — 그 계정의 실제 quota 리셋 시각을 추적·만료 처리하는 별도 기능이 필요해
// 이번 범위를 벗어난다(2026-08-20 결정, 범위 확대 자제). 지금은 evaluateSwitchDecision이
// 이미 currentAccountId를 후보에서 제외하므로 같은 요청 한 번에 자기 자신으로 도로
// 전환되는 것만 방지한다 — 여러 번의 재평가에 걸친 잦은 전환 방지(스로틀링)는
// switch-policy-config.js의 reeval_interval_ms를 실제로 호출부(추후 claudetower run
// 진입점)가 활용하는 방식으로 나중에 다뤄야 한다.

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const { CONFIG_DIR_NAME } = require('../../shared/constants');
const { readRegistry } = require('./accounts-registry');
const { appendRotationEvent } = require('../audit/rotation-log');
const { writeActiveAccountHandle } = require('../../shared/active-account-handle/write');

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
];
const ALL_ISOLATION_VARS = [...DISPLAY_ISOLATION_VARS, ...ACCOUNTS_ISOLATION_VARS];

// 통째로 덮어쓰는 fs.writeFileSync는 원자적이지 않다 — 이 파일은 앞으로 프록시가 응답을
// 받을 때마다(사용자 명령 1회당 1번이 아니라) 자동으로 갱신되므로, 터미널 여러 개에서
// 동시에 claudetower를 켜두면 두 프로세스가 같은 순간에 쓰다가 파일이 반쯤 쓰인 채로
// 깨질 수 있다. 이 프로젝트가 install.ps1에서 이미 실제로 겪은 것과 같은 결함 부류
// (`.PRD/05_FIELD_ISSUES_2026-07-04.md` 이슈#1, self-collision) — 그때 검증된 해법을
// 그대로 따른다: 같은 디렉터리의 임시 파일에 먼저 다 쓴 뒤 rename()으로 교체한다.
// rename()은 POSIX·Windows(libuv가 MOVEFILE_REPLACE_EXISTING 사용) 양쪽에서 대상 파일이
// 이미 존재해도 원자적으로 교체된다 — 다른 프로세스가 읽는 도중이라도 "옛 내용 전체" 아니면
// "새 내용 전체"만 보이지, 중간 상태를 볼 수 없다.
function atomicWriteFileSync(filePath, content) {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
  const tmpPath = path.join(dir, `.${path.basename(filePath)}.tmp-${process.pid}-${Date.now()}`);
  fs.writeFileSync(tmpPath, content, 'utf8');
  fs.renameSync(tmpPath, filePath);
}

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

function resolveActiveAccountStatePath() {
  return (
    process.env.CLAUDETOWER_ACCOUNTS_ACTIVE_ACCOUNT_PATH ||
    path.join(os.homedir(), CONFIG_DIR_NAME, 'active-account-state.json')
  );
}

function readActiveAccountState(filePath = resolveActiveAccountStatePath()) {
  if (!fs.existsSync(filePath)) return null;
  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    if (typeof parsed.account_id !== 'string' || parsed.account_id.length === 0) return null;
    if (typeof parsed.updated_at !== 'string') return null;
    return { account_id: parsed.account_id, updated_at: parsed.updated_at };
  } catch {
    return null; // 손상된 상태 파일은 "아직 선택 안 됨"으로 안전 폴백(다른 설정 파일들과 동일 원칙)
  }
}

function readActiveAccountId(filePath = resolveActiveAccountStatePath()) {
  const state = readActiveAccountState(filePath);
  return state ? state.account_id : null;
}

// 명시적 filePath 인자는 방어막을 우회한다(단위테스트용) — 이 모듈의 다른 상태 파일들과
// 동일한 관례.
function writeActiveAccountId(accountId, filePath) {
  if (typeof accountId !== 'string' || accountId.length === 0) {
    throw new TypeError('accountId must be a non-empty string');
  }
  if (filePath === undefined) {
    assertNotPartialIsolation('CLAUDETOWER_ACCOUNTS_ACTIVE_ACCOUNT_PATH', '활성 계정 상태 파일');
    filePath = resolveActiveAccountStatePath();
  }
  atomicWriteFileSync(filePath, JSON.stringify({ account_id: accountId, updated_at: new Date().toISOString() }, null, 2));
}

// switch-decision.js(evaluateSwitchDecision)의 반환값을 실제로 적용한다.
// shouldSwitch=false인 결과를 넘기면 아무 것도 하지 않는다(applied:false로 조용히 반환 —
// 호출부가 매 요청마다 무조건 호출해도 안전하도록).
//
// reevalIntervalMs 스로틀(2026-08-20, 실측으로 발견한 결함을 막기 위해 추가): 응답마다
// onUpstreamHeaders가 호출되는데, evaluateSwitchDecision은 매번 "현재 계정"만 후보에서
// 제외하므로 — 업스트림이 계정과 무관하게 계속 임계값 초과 헤더를 준다면(가짜 테스트
// 업스트림으로 직접 재현·확인함) 요청마다 다른 계정으로 계속 튕기는 진동이 실제로
// 발생한다. 이건 switch-policy-config.js의 reeval_interval_ms가 애초에 막으려던 문제와
// 정확히 같다(그 필드 자체 주석: "0 = 주기적 재평가 비활성화") — 지금까지 아무도 그 값을
// 실제로 안 썼을 뿐이다. 마지막 전환 이후 이 시간(ms)이 안 지났으면 판단이 "전환해야
// 한다"여도 적용을 보류한다. 잦은 전환은 동의 문구(consent-text.js)가 이미 고지한 법적
// 불확실성(API 키 로테이션 남용 방지 조항)과도 직결되므로 UX 문제를 넘어선 위험이다.
//
// 검증(방어 심층화 — evaluateSwitchDecision이 이미 걸러줬어도 여기서 다시 확인한다):
// toAccountId가 실제로 registry에 있고 api_key 타입이며 status가 active인지 재확인 —
// 판단이 내려진 시점과 적용하는 시점 사이에 그 계정이 disable/purge됐을 수 있다
// (레이스 컨디션 방어, credential-store 삭제 후 재조회하는 accounts-purge-command.js와
// 같은 정신: "결정 시점의 정보"와 "적용 시점의 실제 상태"를 다른 것으로 취급한다).
function applySwitch(
  decision,
  {
    fromAccountId = null,
    registryPath,
    statePath,
    rotationLogPath,
    activeAccountHandlePath,
    projectPath = null,
    reevalIntervalMs = 0,
  } = {}
) {
  if (!decision || decision.shouldSwitch !== true) {
    return { applied: false, reason: 'not_a_switch_decision' };
  }

  if (reevalIntervalMs > 0) {
    const currentState = readActiveAccountState(statePath);
    if (currentState) {
      const elapsedMs = Date.now() - Date.parse(currentState.updated_at);
      if (Number.isFinite(elapsedMs) && elapsedMs < reevalIntervalMs) {
        return { applied: false, reason: 'reeval_interval_not_elapsed', retryAfterMs: reevalIntervalMs - elapsedMs };
      }
    }
  }

  const accounts = readRegistry(registryPath);
  const target = accounts.find((a) => a.account_id === decision.toAccountId);
  if (!target) {
    return { applied: false, reason: 'target_account_not_found' };
  }
  if (target.auth_type !== 'api_key' || target.status !== 'active') {
    return { applied: false, reason: 'target_account_not_usable' };
  }

  writeActiveAccountId(target.account_id, statePath);
  writeActiveAccountHandle(target.label, activeAccountHandlePath);

  const { event } = appendRotationEvent(
    {
      eventId: crypto.randomUUID(),
      fromAccountId,
      toAccountId: target.account_id,
      projectPath,
      reason: decision.reason,
      occurredAt: new Date().toISOString(),
    },
    rotationLogPath
  );

  return { applied: true, toAccountId: target.account_id, event };
}

module.exports = {
  resolveActiveAccountStatePath,
  readActiveAccountState,
  readActiveAccountId,
  writeActiveAccountId,
  applySwitch,
};
