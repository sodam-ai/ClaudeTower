'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const os = require('node:os');
const {
  resolveInstallDir,
  resolveInstallTargetPath,
  ensureInstalledAtTarget,
} = require('../../src/display/config/install-target');

function withInstallDirOverride(dir, fn) {
  const prev = process.env.CLAUDETOWER_INSTALL_DIR;
  process.env.CLAUDETOWER_INSTALL_DIR = dir;
  try {
    return fn();
  } finally {
    if (prev === undefined) delete process.env.CLAUDETOWER_INSTALL_DIR;
    else process.env.CLAUDETOWER_INSTALL_DIR = prev;
  }
}

test('resolveInstallDir: 환경변수가 없으면 ~/.claudetower/bin 기본값을 쓴다', () => {
  const prev = process.env.CLAUDETOWER_INSTALL_DIR;
  delete process.env.CLAUDETOWER_INSTALL_DIR;
  try {
    assert.equal(resolveInstallDir(), path.join(os.homedir(), '.claudetower', 'bin'));
  } finally {
    if (prev !== undefined) process.env.CLAUDETOWER_INSTALL_DIR = prev;
  }
});

test('resolveInstallDir: install.sh/install.ps1과 동일한 CLAUDETOWER_INSTALL_DIR 환경변수로 재정의 가능하다', () => {
  withInstallDirOverride('/custom/install/dir', () => {
    assert.equal(resolveInstallDir(), '/custom/install/dir');
  });
});

test('resolveInstallTargetPath: 플랫폼에 맞는 파일명을 쓴다(win32는 .exe, 나머지는 확장자 없음)', () => {
  withInstallDirOverride('/custom/install/dir', () => {
    const target = resolveInstallTargetPath();
    if (process.platform === 'win32') {
      assert.match(target, /claudetower\.exe$/);
    } else {
      assert.match(target, /claudetower$/);
      assert.doesNotMatch(target, /\.exe$/);
    }
  });
});

test('ensureInstalledAtTarget: 개발 모드(node로 직접 실행)에서는 복사를 건너뛴다(SEA 아닐 때 "설치"라는 개념 자체가 없음)', async () => {
  // node --test로 돌아가는 이 테스트 프로세스 자체가 SEA가 아니므로 isSea()===false —
  // 즉 이 테스트는 실제 SEA 바이너리 안에서만 유효한 "복사 발생" 경로(임시 파일
  // 복사 + rename 재시도)는 검증할 수 없다(단위 테스트의 한계 — 그 로직 자체는
  // 빌드된 실제 바이너리로 별도 확인).
  const result = await ensureInstalledAtTarget();
  assert.equal(result.copied, false);
  assert.equal(result.skipped, true);
  assert.equal(result.reason, 'dev-mode');
});
