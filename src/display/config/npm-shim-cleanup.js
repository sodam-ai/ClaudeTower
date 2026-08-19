'use strict';

// 과거 npm-global 설치 방식(현재는 보류 확정 — claudetower-public-repo-next-steps
// 메모리 참고)이 남긴 shim 잔재 문제. .PRD/05_FIELD_ISSUES_2026-07-04.md §2 실측:
// npm이 만든 `claudetower`/`claudetower.cmd`/`claudetower.ps1` shim은 남아있는데
// 백킹 모듈 `node_modules/claudetower`가 삭제되면, bare `claudetower`가
// "Cannot find module ... MODULE_NOT_FOUND"로 깨진다(statusLine은 절대경로로
// 호출하므로 무해하지만 CLI 명령 UX가 오염된다). 권고 수정(§2.5): "installer/
// uninstaller가 stale npm shim을 탐지·정리하도록 추가."
//
// 오삭제 방지가 핵심이다 — 이름이 claudetower(.cmd/.ps1)라고 무조건 지우면
// 다른 정상 npm 전역 패키지를 건드릴 위험이 있으므로, 반드시 (1) 파일 내용에
// "claudetower"를 향한 node_modules 참조가 실제로 있는지, (2) 그 백킹 모듈
// 폴더가 정말 없는지 두 가지를 확인한 뒤에만 삭제한다.

const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { CLI_NAME } = require('../../shared/constants');
const { isPartialIsolation } = require('./test-isolation');

const NPM_PREFIX_ISOLATION_VAR = 'CLAUDETOWER_NPM_PREFIX_DIR';

function isPartialTestIsolation() {
  return isPartialIsolation(NPM_PREFIX_ISOLATION_VAR);
}

// npm 전역 prefix 위치는 환경마다 다르므로(NVM, 커스텀 prefix 등) 하드코딩하지
// 않고 `npm config get prefix`로 직접 물어본다. npm이 없거나 명령이 실패해도
// setup/uninstall 본 기능을 막으면 안 되므로 null을 돌려주고 조용히 건너뛴다.
function resolveNpmPrefixDir() {
  if (process.env[NPM_PREFIX_ISOLATION_VAR]) {
    return process.env[NPM_PREFIX_ISOLATION_VAR];
  }
  try {
    const out = execFileSync('npm', ['config', 'get', 'prefix'], {
      encoding: 'utf8',
      windowsHide: true,
      timeout: 5000,
    });
    const prefix = out.trim();
    return prefix || null;
  } catch {
    return null;
  }
}

// shim 파일 내용에 이 패키지를 향한 node_modules 참조가 실제로 있는지 확인한다.
// 이름만 보고 판단하지 않기 위한 방어막(오삭제 방지 1단계).
function contentReferencesPackage(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    return content.includes('node_modules') && content.includes(CLI_NAME);
  } catch {
    return false;
  }
}

// 백킹 모듈 폴더가 실제로 없는지 확인한다(오삭제 방지 2단계) — 있으면 정상 shim이므로
// 절대 건드리지 않는다.
function backingModuleMissing(prefixDir) {
  const backingDir = path.join(prefixDir, 'node_modules', CLI_NAME);
  return !fs.existsSync(backingDir);
}

// Windows: npm이 prefix 루트에 확장자 3종(POSIX용 확장자 없음, .cmd, .ps1)을 만든다.
function windowsShimCandidates(prefixDir) {
  return [CLI_NAME, `${CLI_NAME}.cmd`, `${CLI_NAME}.ps1`].map((name) => path.join(prefixDir, name));
}

// POSIX: npm이 <prefix>/bin/ 아래 심볼릭 링크 하나만 만든다. 백킹 대상이 없으면
// "끊어진 심볼릭 링크"가 된다 — lstat은 성공하지만(링크 자체는 존재) existsSync는
// 링크를 따라가다 실패해 false를 돌려준다.
function posixShimIsBroken(shimPath) {
  try {
    const stat = fs.lstatSync(shimPath);
    if (!stat.isSymbolicLink()) return false;
    return !fs.existsSync(shimPath);
  } catch {
    return false;
  }
}

// 실패해도(개별 파일 하나가 이상해도) 나머지 정리는 계속 진행하고, 전체가 실패해도
// setup/uninstall 본 기능은 절대 막지 않는다 — 호출자가 try/catch로 감싼다.
function cleanupStaleNpmShims() {
  if (isPartialTestIsolation()) return { skipped: 'partial-test-isolation', cleaned: [] };

  const prefixDir = resolveNpmPrefixDir();
  if (!prefixDir) return { skipped: 'npm-prefix-unresolved', cleaned: [] };

  const cleaned = [];

  if (process.platform === 'win32') {
    for (const shimPath of windowsShimCandidates(prefixDir)) {
      try {
        if (!fs.existsSync(shimPath)) continue;
        if (!contentReferencesPackage(shimPath)) continue; // 이름만 같은 무관한 파일 보호
        if (!backingModuleMissing(prefixDir)) continue; // 정상 설치는 절대 건드리지 않음
        fs.unlinkSync(shimPath);
        cleaned.push(shimPath);
      } catch {
        // 파일 하나 실패해도 나머지는 계속.
      }
    }
  } else {
    const shimPath = path.join(prefixDir, 'bin', CLI_NAME);
    try {
      if (posixShimIsBroken(shimPath)) {
        fs.unlinkSync(shimPath);
        cleaned.push(shimPath);
      }
    } catch {
      // 무시 — 아래에서 결과만 반환.
    }
  }

  return { cleaned };
}

module.exports = {
  NPM_PREFIX_ISOLATION_VAR,
  resolveNpmPrefixDir,
  cleanupStaleNpmShims,
  isPartialTestIsolation,
  // 아래 둘은 테스트 전용 export — POSIX 분기는 이 개발 PC(Windows)가 아니라서
  // cleanupStaleNpmShims() 전체 경로로는 실행되지 않는다(process.platform 분기).
  // 함수 단위로는 플랫폼 무관하게 직접 검증할 수 있어 별도로 노출한다.
  posixShimIsBroken,
  windowsShimCandidates,
};
