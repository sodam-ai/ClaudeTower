'use strict';

// "이름/위치/경로를 바꿔도 안 깨지게" — install.sh/install.ps1이 이미 쓰던 고정 설치
// 위치(~/.claudetower/bin) 관례를 setup 명령도 그대로 따르게 한다. 지금까지는
// "지금 실행 중인 파일의 위치"를 그대로 settings.json에 등록해서, 사용자가 다운로드한
// exe를 지우거나 옮기면 등록이 깨지는 문제가 실사용 중 발견됨 — 이 문제의 근본 해결책.

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const sea = require('node:sea');

// install.sh/install.ps1과 동일한 환경변수(CLAUDETOWER_INSTALL_DIR)를 공유한다 —
// 설치 스크립트로 설치하든 setup이 자체적으로 복사하든 항상 같은 위치에 모이게.
function resolveInstallDir() {
  return process.env.CLAUDETOWER_INSTALL_DIR || path.join(os.homedir(), '.claudetower', 'bin');
}

// Windows는 .exe 확장자가 있어야 탐색기 더블클릭·PATH 실행이 정상 동작한다
// (install.ps1도 동일하게 'claudetower.exe'로 저장 - 관례를 맞춤).
function resolveInstallTargetPath() {
  const filename = process.platform === 'win32' ? 'claudetower.exe' : 'claudetower';
  return path.join(resolveInstallDir(), filename);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// SEA 바이너리로 실행 중일 때만 의미가 있다(개발 모드는 node + 소스 파일이라
// "설치"라는 개념 자체가 없음). 이미 고정 위치에서 실행 중이면(설치 스크립트로
// 이미 설치했거나, 이전에 setup을 이미 실행해 정착된 경우) 자기 자신에게 자기를
// 복사하는 위험한 상황을 피하기 위해 복사를 건너뛴다.
//
// 왜 "임시 파일 복사 후 rename" 2단계로 나눴는가(실사용 중 발견된 결함의 근본 수정):
// 이 함수가 덮어쓰는 대상 파일은 보통 이미 Claude Code의 statusLine에
// refreshInterval(기본 1초)로 등록되어 있는 바로 그 파일이다 — 사용자가 setup을
// 다시 실행해 새 버전을 설치하려는 바로 그 순간에도 Claude Code가 초 단위로 이
// 파일을 계속 실행한다. 처음엔 "대상 경로에 직접 덮어쓰기 + 재시도"로 고쳤으나,
// 실행 파일이 수십MB라 복사 자체가 잠금이 풀리는 짧은 틈(Claude Code가 재실행
// 사이에 파일을 놓아주는 순간)보다 오래 걸릴 수 있어 재시도해도 계속 실패할
// 위험이 남는다는 걸 재검토 중 발견했다. 그래서 시간이 걸리는 복사는 아무도
// 손대지 않는 임시 경로에 먼저 끝내고(잠금 충돌 자체가 없음), 실제 교체는
// 밀리초 단위인 rename 한 번으로 끝낸다 — rename만 재시도하면 되므로 짧은 틈에
// 들어갈 확률이 훨씬 높다(claudetower statusline은 매번 새로 실행되고 바로
// 끝나는 짧은 프로세스라 대부분의 순간엔 아무도 대상 파일을 붙잡고 있지 않음).
async function ensureInstalledAtTarget({ onRetry } = {}) {
  if (!sea.isSea()) {
    return { copied: false, skipped: true, reason: 'dev-mode', targetPath: null };
  }

  const targetPath = resolveInstallTargetPath();
  const currentPath = process.execPath;

  if (path.resolve(currentPath) === path.resolve(targetPath)) {
    return { copied: false, skipped: true, reason: 'already-installed', targetPath };
  }

  fs.mkdirSync(path.dirname(targetPath), { recursive: true });

  // PID를 붙여 동시 실행·이전 실패 잔여물과 경로가 겹치지 않게 한다.
  const tempPath = `${targetPath}.new-${process.pid}`;
  try {
    fs.copyFileSync(currentPath, tempPath);
    if (process.platform !== 'win32') {
      // copyFileSync가 실행 권한 비트를 그대로 보존해준다는 보장이 없어(플랫폼별
      // 동작이 실측 불확실) install.sh처럼 명시적으로 chmod +x를 걸어준다.
      fs.chmodSync(tempPath, 0o755);
    }
  } catch (err) {
    try {
      fs.unlinkSync(tempPath);
    } catch {
      /* 임시 파일이 애초에 안 생겼으면 지울 것도 없음 — 무시 */
    }
    return { copied: false, skipped: false, targetPath, error: err, attempts: 0 };
  }

  const MAX_ATTEMPTS = 6;
  const RETRY_DELAY_MS = 700;
  let lastError;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      // Node의 rename은 대상이 이미 존재해도 덮어쓴다(공식 동작) — 별도 삭제 불필요.
      fs.renameSync(tempPath, targetPath);
      return { copied: true, skipped: false, targetPath, attempts: attempt };
    } catch (err) {
      lastError = err;
      if (attempt < MAX_ATTEMPTS) {
        if (typeof onRetry === 'function') {
          onRetry(attempt, MAX_ATTEMPTS);
        }
        await sleep(RETRY_DELAY_MS);
      }
    }
  }
  // 재시도를 다 써도 계속 실패하면(드물게, 예를 들어 백신 검사가 새로 생긴 파일을
  // 오래 붙잡는 경우) 예외를 던지지 않고 호출자가 사용자에게 명확히 안내할 수
  // 있도록 결과 객체로 실패를 전달한다. 임시 파일은 정리해서 남겨두지 않는다.
  try {
    fs.unlinkSync(tempPath);
  } catch {
    /* 정리 실패는 무시 — 어차피 아래에서 에러를 그대로 보고함 */
  }
  return { copied: false, skipped: false, targetPath, error: lastError, attempts: MAX_ATTEMPTS };
}

module.exports = { resolveInstallDir, resolveInstallTargetPath, ensureInstalledAtTarget };
