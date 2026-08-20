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
const { execFileSync } = require('node:child_process');
const { CONFIG_DIR_NAME } = require('../../shared/constants');
const { readRegistry, updateRegistry } = require('./accounts-registry');
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
  'CLAUDETOWER_ACCOUNTS_QUOTA_CACHE_PATH',
];
const ALL_ISOLATION_VARS = [...DISPLAY_ISOLATION_VARS, ...ACCOUNTS_ISOLATION_VARS];

// 통째로 덮어쓰는 fs.writeFileSync는 원자적이지 않다 — 이 파일은 앞으로 프록시가 응답을
// 받을 때마다(사용자 명령 1회당 1번이 아니라) 자동으로 갱신되므로, 터미널 여러 개에서
// 동시에 claudetower를 켜두면 두 프로세스가 같은 순간에 쓰다가 파일이 반쯤 쓰인 채로
// 깨질 수 있다. 이 프로젝트가 install.ps1에서 이미 실제로 겪은 것과 같은 결함 부류
// (`.PRD/05_FIELD_ISSUES_2026-07-04.md` 이슈#1, self-collision) — 그때 검증된 해법을
// 그대로 따른다: 같은 디렉터리의 임시 파일에 먼저 다 쓴 뒤 rename()으로 교체한다.
// rename()은 "중간 상태가 절대 보이지 않는다"는 원자성은 POSIX·Windows 둘 다 보장하지만
// (내용이 섞이거나 반쯤 쓰인 채로 읽히는 일은 없음), **Windows에서는 이 rename() 호출
// 자체가 일시적으로 실패할 수 있다**는 걸 2026-08-20 실측으로 발견해 이 문단을 정정한다
// — 원래 이 주석은 "양쪽에서 항상 성공한다"고 적혀 있었으나, 진짜 프로세스 10개를 동시에
// 띄워 쓰기 경합을 재현하는 테스트(test/accounts/active-account-state.test.js)를 이
// 프로젝트가 상시 겪는 다중 세션 환경(프로세스 수백~천 개대)에서 돌려보니 자식 프로세스
// 1개가 `EPERM: operation not permitted, rename ...`으로 실제로 죽는 것을 확인했다(격리
// 실행 시엔 3/3 재현 안 됨 — 이 PC의 배경 프로세스 부하가 경합 창을 넓힐 때만 드러남).
// 원인: 대상 파일을 다른 프로세스가 그 찰나에 열어(읽기/쓰기) 붙잡고 있으면 Windows의
// MoveFile이 공유 위반으로 거부될 수 있다(POSIX rename()에는 없는 제약) — install.ps1이
// 이미 겪은 것과 같은 부류의 문제라 같은 해법(재시도)을 그대로 적용한다.
const RENAME_MAX_RETRIES = 10;
const RENAME_RETRY_DELAY_MS = 20;

// 2026-08-20 신설: `.PRD/02_DATA_MODEL.md` NEEDS CLARIFICATION("ActiveAccountHandle도
// 다른 사용자가 못 읽게 권한 제한이 필요한지")가 그동안 미해결로 남아있었다 — 이 파일이
// RotationEvent(M30)와 나란히 "지금 활성 계정이 뭔지"라는 계정 사용 메타데이터를
// 로컬에 영속화하면서도 권한만 빠져 있었던 비일관성을 해소한다. M30(rotation-log.js)과
// 동일한 원칙(Windows는 chmod 0o600이 예외 없이 "성공"해도 실제 모드가 0o666로 남는 걸
// 이 PC에서 실측 확인했으므로 ACL로 강제, POSIX는 chmod 후 실제 모드를 재확인)을 쓰되,
// 적용 시점은 다르다: rotation-log는 append 파일이라 "최초 생성 시 1회만" 충분하지만,
// 이 파일은 매 쓰기마다 새 임시 파일을 만들어 rename()으로 통째로 교체하므로 — 같은
// 볼륨 내 rename()은 대상이 아니라 원본(임시 파일)의 보안 속성을 그대로 옮기는 게
// NTFS/POSIX 공통 동작이라, 매번 새로 생기는 임시 파일에 매번 적용해야 최종 파일도
// 항상 소유자 전용 권한을 갖는다. src/shared/에는 이 로직을 둘 수 없다(Display 모듈도
// 읽는 공유 파일이라 Account 전용 로직을 얹으면 모듈 경계가 흐려짐) — 그래서 코드는
// active-account-handle/write.js에도 동일하게 중복 작성한다(이 프로젝트의 기존
// ACCOUNTS_ISOLATION_VARS 중복 관례와 같은 이유).
const ACL_ENTRY_PATTERN = /:\([A-Za-z,]+\)$/;

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
      // 동기 함수라 async/await를 쓸 수 없다 — Atomics.wait로 이벤트 루프를 블로킹하지
      // 않으면서(spin-wait 아님) 짧게 대기한 뒤 재시도한다(Node 표준 동기 sleep 기법).
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, RENAME_RETRY_DELAY_MS);
    }
  }
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
  return atomicWriteFileSync(
    filePath,
    JSON.stringify({ account_id: accountId, updated_at: new Date().toISOString() }, null, 2)
  );
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

  const occurredAt = new Date().toISOString();

  writeActiveAccountId(target.account_id, statePath);
  writeActiveAccountHandle(target.label, activeAccountHandlePath);

  // `.PRD/01_PRD.md` §3 "계정별 마지막 사용 프로젝트 경로 표시"(2026-08-20 감사로 발견한
  // 잔여 갭 — account.js 스키마엔 이미 있었고 RotationEvent에는 이미 기록되고 있었지만,
  // 정작 계정 레지스트리 항목 자체는 한 번도 갱신되지 않았었다). projectPath가 null이면
  // (호출부가 cwd를 모르는 경우) 기존에 알고 있던 값을 덮어쓰지 않는다 — "몰랐다"는 정보로
  // "알고 있던 값"을 지우는 건 사용자에게 손해이기 때문. last_used_at은 projectPath 유무와
  // 무관하게 항상 이 전환 시각으로 갱신한다(전환이 실제로 일어났다는 사실 자체는 확실하므로).
  // 2026-08-20 정정: 위 accounts(전환 대상 유효성만 확인하려고 읽은 스냅샷)를 그대로
  // map해서 쓰지 않는다 — 전환마다 자동 호출되는 이 경로는 여러 터미널이 동시에 계정을
  // 전환할 수 있는 실제 위험 시나리오라, updateRegistry가 락을 쥔 시점의 최신 목록
  // 기준으로 다시 반영해야 그 사이 다른 프로세스가 만든 변경(다른 계정의 전환, rename
  // 등)을 잃어버리지 않는다.
  updateRegistry(
    (current) =>
      current.map((a) =>
        a.account_id === target.account_id
          ? { ...a, last_project_path: projectPath !== null ? projectPath : a.last_project_path, last_used_at: occurredAt }
          : a
      ),
    registryPath
  );

  const { event } = appendRotationEvent(
    {
      eventId: crypto.randomUUID(),
      fromAccountId,
      toAccountId: target.account_id,
      projectPath,
      reason: decision.reason,
      occurredAt,
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
