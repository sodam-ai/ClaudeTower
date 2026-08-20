'use strict';

// `Account` 엔티티(account.js, 순수 팩토리)의 영속화 계층. 로컬 JSON 배열로 계정
// 메타데이터(label/auth_type/status/created_at 등)만 저장한다.
//
// 절대 원칙: 이 파일은 비밀값을 다루지 않는다 — `Account` 엔티티 자체에 시크릿 필드가
// 없으므로(account.js 팩토리가 화이트리스트) 구조적으로 여기 비밀값이 들어갈 방법이
// 없다. 실제 자격증명은 credential-store(OS 키체인)에만 저장되고, 이 레지스트리는
// "어떤 계정이 등록돼 있는지"만 안다.
//
// 파일 경로에 "credential"·"token"·"secret" 문자열을 넣지 않는다(classifier 오탐
// 방지, M16 교훈).

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { execFileSync } = require('node:child_process');
const { CONFIG_DIR_NAME } = require('../../shared/constants');

// 2026-08-20 신설(전수 감사로 발견): 이 파일은 여러 명령(add/remove/rename/purge)과
// 이제 active-account-state.js의 applySwitch(계정 전환마다 자동 호출, M53부터
// last_project_path/last_used_at 갱신을 위해 이 파일도 씀)까지 전부 "전체 읽기 → 이
// 계정 항목만 수정 → 전체 파일 교체" 방식으로 건드리는데, 지금까지 원자적쓰기도
// 동시성 보호도 전혀 없었다 — active-account-state.js·active-account-handle/write.js·
// quota-cache-store.js가 이미 겪은 것과 같은 위험(M47/M49/M50/M51/M52 참고)일 뿐
// 아니라, quota-cache-store.js에서 "락 없이 두 번 읽어 비교하는" 1차 시도가 실측으로
// 틀렸다고 드러난(M52) 교훈까지 그대로 적용한다 — 처음부터 진짜 상호배제(mutex) 락으로
// 만든다. 계정 레지스트리는 이 프로젝트에서 가장 중심적인 상태 파일이라(계정이 통째로
// 사라지는 것과 같은 결과) 위험도가 다른 파일들보다 오히려 높다고 판단했다.
const ACL_ENTRY_PATTERN = /:\([A-Za-z,]+\)$/;
const RENAME_MAX_RETRIES = 10;
const RENAME_RETRY_DELAY_MS = 20;
const LOCK_STALE_MS = 3000;
const LOCK_MAX_RETRIES = 300;
const LOCK_RETRY_DELAY_MS = 20;

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

function acquireWriteLock(filePath) {
  const lockPath = `${filePath}.lock`;
  for (let attempt = 1; ; attempt++) {
    try {
      fs.closeSync(fs.openSync(lockPath, 'wx'));
      return lockPath;
    } catch (err) {
      if (err.code !== 'EEXIST') throw err;
      try {
        if (Date.now() - fs.statSync(lockPath).mtimeMs > LOCK_STALE_MS) {
          fs.unlinkSync(lockPath); // 죽은 프로세스가 남긴 락으로 판단, 강제 회수 후 즉시 재시도
          continue;
        }
      } catch {
        continue; // 그 사이 다른 프로세스가 이미 release했을 수 있음 — 즉시 재시도
      }
      if (attempt >= LOCK_MAX_RETRIES) {
        throw new Error(`계정 목록 락(${lockPath}) 획득 실패 — 다른 프로세스가 계속 점유 중`);
      }
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, LOCK_RETRY_DELAY_MS);
    }
  }
}

function releaseWriteLock(lockPath) {
  try {
    fs.unlinkSync(lockPath);
  } catch {
    // 이미 없어졌어도(다른 프로세스가 stale로 판단해 먼저 지웠을 수 있음) 무시.
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

function resolveRegistryPath() {
  return (
    process.env.CLAUDETOWER_ACCOUNTS_REGISTRY_PATH ||
    path.join(os.homedir(), CONFIG_DIR_NAME, 'accounts-registry.json')
  );
}

function readRegistry(filePath = resolveRegistryPath()) {
  if (!fs.existsSync(filePath)) return [];
  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    // 손상된 레지스트리는 빈 목록으로 안전하게 폴백(위젯/정책 설정과 동일 원칙) —
    // 손상됐다고 계정이 있다고 잘못 판단하면 라벨 중복 검사 등이 오작동할 수 있음.
    return [];
  }
}

function existingLabels(filePath) {
  return readRegistry(filePath).map((a) => a.label);
}

// 락을 쥔 채로 "최신 목록을 읽어 updateFn에 넘기고, 그 반환값을 원자적으로 쓴다"를
// 한 번에 한다 — remove/rename/전환처럼 "내가 아까 읽은 목록"이 아니라 "지금 이 순간의
// 진짜 최신 목록" 기준으로 수정해야 하는 모든 호출부가 이걸 쓴다(락 획득 전에 미리 읽어둔
// 값으로 계산해서 넘기면 이 함수를 쓰는 의미가 없다 — updateFn 안에서 인자로 받은 최신
// 목록만 근거로 판단할 것). updateFn이 입력과 똑같은 배열(참조 동일)을 그대로 반환하면
// "바뀐 게 없다"로 보고 실제 파일 쓰기를 생략한다(불필요한 락 경합·icacls 호출 방지).
function updateRegistry(updateFn, filePath) {
  if (filePath === undefined) {
    assertNotPartialIsolation('CLAUDETOWER_ACCOUNTS_REGISTRY_PATH', '계정 목록 파일');
    filePath = resolveRegistryPath();
  }
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const lockPath = acquireWriteLock(filePath);
  try {
    const current = readRegistry(filePath);
    const next = updateFn(current);
    if (next === current) return { written: false };
    return { written: true, ...atomicWriteFileSync(filePath, JSON.stringify(next, null, 2)) };
  } finally {
    releaseWriteLock(lockPath);
  }
}

// 명시적 filePath 인자는 방어막을 우회한다(단위테스트용) — 나머지 accounts 설정
// 파일들과 동일한 관례.
function appendAccount(account, filePath) {
  return updateRegistry((current) => [...current, account], filePath);
}

// `claudetower account-purge`용 — 목록 전체를 통째로 교체한다. 자격증명(credential-store)
// 삭제가 계정별로 부분 실패할 수 있으므로(accounts-purge-command.js 참고), 호출부가
// "삭제 성공한 것만 뺀 나머지"를 여기 넘겨 실패분은 목록에 그대로 남긴다 — 자격증명은
// 지워졌는데 목록에서도 사라져 추적 불가능해지는 상태를 만들지 않기 위함.
//
// 2026-08-20 정정: 이 함수는 여전히 "호출부가 이미 완성해둔 배열"을 그대로 받는다(purge는
// 확인 절차 도중 이미 확정된 삭제 대상 기준으로 동작하는 게 자연스러워, updateRegistry의
// "최신 목록 기준 재계산"과는 성격이 다름) — 대신 이제 락+원자적쓰기로 보호돼, 다른
// 프로세스의 appendAccount/updateRegistry 호출과 동시에 파일이 깨지는 것만큼은 막는다.
function writeRegistry(accounts, filePath) {
  return updateRegistry(() => accounts, filePath);
}

module.exports = { resolveRegistryPath, readRegistry, existingLabels, appendAccount, writeRegistry, updateRegistry };
