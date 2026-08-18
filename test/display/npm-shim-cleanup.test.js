'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { ISOLATION_VARS } = require('../../src/display/config/test-isolation');
const {
  NPM_PREFIX_ISOLATION_VAR,
  resolveNpmPrefixDir,
  cleanupStaleNpmShims,
  posixShimIsBroken,
} = require('../../src/display/config/npm-shim-cleanup');

function withEnv(vars, fn) {
  const prev = {};
  for (const [k, v] of Object.entries(vars)) {
    prev[k] = process.env[k];
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  try {
    return fn();
  } finally {
    for (const [k, v] of Object.entries(prev)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
}

function withCleanIsolationEnv(extra, fn) {
  const cleared = Object.fromEntries(ISOLATION_VARS.map((v) => [v, undefined]));
  return withEnv({ ...cleared, ...extra }, fn);
}

function makeTempPrefix() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'claudetower-npm-shim-test-'));
}

const CMD_SHIM = '@ECHO off\r\nnode "%~dp0\\node_modules\\claudetower\\bin\\claudetower.js" %*\r\n';
const UNRELATED_CONTENT = '@ECHO off\r\nnode "%~dp0\\node_modules\\some-other-tool\\bin\\cli.js" %*\r\n';

test('resolveNpmPrefixDir: 격리 변수가 설정돼 있으면 실제 npm을 실행하지 않고 그 값을 그대로 쓴다', () => {
  withCleanIsolationEnv({ [NPM_PREFIX_ISOLATION_VAR]: 'X:/fake/prefix' }, () => {
    assert.equal(resolveNpmPrefixDir(), 'X:/fake/prefix');
  });
});

test('cleanupStaleNpmShims: 백킹 모듈이 존재하는 정상 shim은 절대 삭제하지 않는다', { skip: process.platform !== 'win32' }, () => {
  const prefix = makeTempPrefix();
  fs.mkdirSync(path.join(prefix, 'node_modules', 'claudetower'), { recursive: true });
  const shimPath = path.join(prefix, 'claudetower.cmd');
  fs.writeFileSync(shimPath, CMD_SHIM, 'utf8');

  withCleanIsolationEnv({ [NPM_PREFIX_ISOLATION_VAR]: prefix }, () => {
    const result = cleanupStaleNpmShims();
    assert.deepEqual(result.cleaned, []);
    assert.equal(fs.existsSync(shimPath), true, '정상 shim은 그대로 남아있어야 한다');
  });
});

test('cleanupStaleNpmShims: 백킹 모듈이 없는 stale shim 3종(확장자없음/.cmd/.ps1)을 전부 정리한다', { skip: process.platform !== 'win32' }, () => {
  const prefix = makeTempPrefix();
  // node_modules/claudetower 디렉터리 자체를 만들지 않음 — 백킹 없음 시뮬레이션.
  const shimPaths = ['claudetower', 'claudetower.cmd', 'claudetower.ps1'].map((name) => path.join(prefix, name));
  for (const p of shimPaths) fs.writeFileSync(p, CMD_SHIM, 'utf8');

  withCleanIsolationEnv({ [NPM_PREFIX_ISOLATION_VAR]: prefix }, () => {
    const result = cleanupStaleNpmShims();
    assert.equal(result.cleaned.length, 3);
    for (const p of shimPaths) assert.equal(fs.existsSync(p), false);
  });
});

test('cleanupStaleNpmShims: 이름만 같고 내용이 무관한 파일은 백킹이 없어도 삭제하지 않는다(오삭제 방지)', { skip: process.platform !== 'win32' }, () => {
  const prefix = makeTempPrefix();
  const shimPath = path.join(prefix, 'claudetower.cmd');
  fs.writeFileSync(shimPath, UNRELATED_CONTENT, 'utf8');

  withCleanIsolationEnv({ [NPM_PREFIX_ISOLATION_VAR]: prefix }, () => {
    const result = cleanupStaleNpmShims();
    assert.deepEqual(result.cleaned, []);
    assert.equal(fs.existsSync(shimPath), true, '무관한 내용의 파일은 보존돼야 한다');
  });
});

test('cleanupStaleNpmShims: shim 파일이 하나도 없으면 에러 없이 빈 목록을 반환한다(멱등)', { skip: process.platform !== 'win32' }, () => {
  const prefix = makeTempPrefix();
  withCleanIsolationEnv({ [NPM_PREFIX_ISOLATION_VAR]: prefix }, () => {
    const result = cleanupStaleNpmShims();
    assert.deepEqual(result.cleaned, []);
  });
});

test('cleanupStaleNpmShims: 다른 격리 변수만 설정된 부분 격리 상태에서는 실제 파일을 건드리지 않는다', { skip: process.platform !== 'win32' }, () => {
  const prefix = makeTempPrefix();
  const shimPath = path.join(prefix, 'claudetower.cmd');
  fs.writeFileSync(shimPath, CMD_SHIM, 'utf8'); // 백킹 없음 = 원래대로면 삭제 대상

  // NPM_PREFIX_ISOLATION_VAR는 설정하지 않고, 다른 CLAUDETOWER_* 변수만 설정 —
  // "테스트인데 이 변수만 격리를 깜빡함" 시나리오. 이 경우 진짜 npm prefix를
  // 물어보게 되므로(resolveNpmPrefixDir 폴백), skip으로 그친다는 것만 확인.
  withCleanIsolationEnv({ CLAUDETOWER_SKILLS_DIR: 'X:/fake/skills' }, () => {
    const result = cleanupStaleNpmShims();
    assert.equal(result.skipped, 'partial-test-isolation');
    assert.deepEqual(result.cleaned, []);
  });

  // prefix 자체는 우리가 만든 임시 폴더이니 그대로 남아있는지만 재확인(실제로
  // 건드려지지 않았다는 뜻 — 이 테스트가 검증하려는 건 "진짜 시스템 npm 폴더에
  // 접근을 시도하지 않는다"이므로, skipped 반환 자체가 그 증거다).
  assert.equal(fs.existsSync(shimPath), true);
});

test('posixShimIsBroken: 심볼릭 링크가 아닌 일반 파일은 false', () => {
  const prefix = makeTempPrefix();
  const filePath = path.join(prefix, 'claudetower');
  fs.writeFileSync(filePath, 'not a symlink', 'utf8');
  assert.equal(posixShimIsBroken(filePath), false);
});

test('posixShimIsBroken: 대상이 존재하지 않는 끊어진 심볼릭 링크는 true', (t) => {
  const prefix = makeTempPrefix();
  const linkPath = path.join(prefix, 'claudetower');
  const missingTarget = path.join(prefix, 'node_modules', 'claudetower', 'bin', 'claudetower.js');
  try {
    fs.symlinkSync(missingTarget, linkPath);
  } catch (err) {
    // Windows는 기본적으로 심볼릭 링크 생성에 관리자 권한/개발자 모드가 필요하다 —
    // 이 환경에 그 권한이 없으면 검증 불가로 정직하게 건너뛴다(추측으로 통과시키지 않음).
    t.skip(`이 환경에서 심볼릭 링크 생성 불가(${err.code}) — POSIX 대상 환경에서 재검증 필요`);
    return;
  }
  assert.equal(posixShimIsBroken(linkPath), true);
});

test('posixShimIsBroken: 대상이 실제로 존재하는 심볼릭 링크는 false', (t) => {
  const prefix = makeTempPrefix();
  const targetDir = path.join(prefix, 'node_modules', 'claudetower', 'bin');
  fs.mkdirSync(targetDir, { recursive: true });
  const target = path.join(targetDir, 'claudetower.js');
  fs.writeFileSync(target, '// ok', 'utf8');
  const linkPath = path.join(prefix, 'claudetower');
  try {
    fs.symlinkSync(target, linkPath);
  } catch (err) {
    t.skip(`이 환경에서 심볼릭 링크 생성 불가(${err.code}) — POSIX 대상 환경에서 재검증 필요`);
    return;
  }
  assert.equal(posixShimIsBroken(linkPath), false);
});

test('cleanupStaleNpmShims/setup/uninstall 배선: credential-store/oauth/proxy를 전혀 참조하지 않는다', () => {
  const src = fs.readFileSync(
    path.join(__dirname, '../../src/display/config/npm-shim-cleanup.js'),
    'utf8'
  );
  assert.doesNotMatch(src, /credential-store/);
  assert.doesNotMatch(src, /require\(.*oauth/);
  assert.doesNotMatch(src, /require\(.*\/proxy\//);
  assert.doesNotMatch(src, /accounts/);
});
