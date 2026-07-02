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

// SEA 바이너리로 실행 중일 때만 의미가 있다(개발 모드는 node + 소스 파일이라
// "설치"라는 개념 자체가 없음). 이미 고정 위치에서 실행 중이면(설치 스크립트로
// 이미 설치했거나, 이전에 setup을 이미 실행해 정착된 경우) 자기 자신에게 자기를
// 복사하는 위험한 상황을 피하기 위해 복사를 건너뛴다.
function ensureInstalledAtTarget() {
  if (!sea.isSea()) {
    return { copied: false, skipped: true, reason: 'dev-mode', targetPath: null };
  }

  const targetPath = resolveInstallTargetPath();
  const currentPath = process.execPath;

  if (path.resolve(currentPath) === path.resolve(targetPath)) {
    return { copied: false, skipped: true, reason: 'already-installed', targetPath };
  }

  try {
    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    fs.copyFileSync(currentPath, targetPath);
    if (process.platform !== 'win32') {
      // copyFileSync가 실행 권한 비트를 그대로 보존해준다는 보장이 없어(플랫폼별
      // 동작이 실측 불확실) install.sh처럼 명시적으로 chmod +x를 걸어준다.
      fs.chmodSync(targetPath, 0o755);
    }
    return { copied: true, skipped: false, targetPath };
  } catch (err) {
    // Claude Code가 refreshInterval로 이 파일을 주기적으로 실행 중이라, 하필 그
    // 순간과 겹치면 Windows가 파일을 잠가 복사가 실패할 수 있다(일시적 현상 —
    // 몇 초 뒤 재시도하면 대부분 해결됨). 여기서 예외를 던지지 않고 호출자가
    // 사용자에게 명확히 안내할 수 있도록 결과 객체로 실패를 전달한다.
    return { copied: false, skipped: false, targetPath, error: err };
  }
}

module.exports = { resolveInstallDir, resolveInstallTargetPath, ensureInstalledAtTarget };
