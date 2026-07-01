#!/usr/bin/env node
'use strict';

// Node.js SEA 빌드 스크립트 — 이 스크립트를 실행하는 OS/아키텍처용 단일 실행파일 하나만 만든다.
// 크로스 빌드 불가(실측 확인, .PRD 계획서 SEA 리스크 표 참고) — GitHub Actions 3-OS 매트릭스에서
// 각 러너가 이 스크립트를 각자 실행해 자기 플랫폼용 바이너리를 만드는 구조를 전제로 설계했다.
//
// 왜 esbuild 번들이 필요한가(실측): SEA blob은 지정된 진입 파일 하나만 담고, 그 안에서
// require('../src/shared/constants') 같은 상대경로 require는 디스크의 다른 파일을 찾지 못해
// ERR_UNKNOWN_BUILTIN_MODULE로 즉시 실패한다(번들링 없이 직접 시도해 재현 확인함).
// 그래서 배포 전 esbuild로 단일 CJS 파일로 먼저 합친다.

const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const { execFileSync } = require('node:child_process');
const esbuild = require('esbuild');

const ROOT = path.join(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const SENTINEL_FUSE = 'NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2';

const PLATFORM_NAMES = { win32: 'win', darwin: 'macos', linux: 'linux' };
const platformName = PLATFORM_NAMES[process.platform] || process.platform;
const arch = process.arch; // x64 | arm64 등
const ext = process.platform === 'win32' ? '.exe' : '';
const artifactName = `claudetower-${platformName}-${arch}${ext}`;

function step(label) {
  console.log(`\n=== ${label} ===`);
}

function main() {
  fs.mkdirSync(DIST, { recursive: true });

  step('1) esbuild 번들 (bin/claudetower.js -> dist/bundle.cjs)');
  esbuild.buildSync({
    entryPoints: [path.join(ROOT, 'bin', 'claudetower.js')],
    bundle: true,
    platform: 'node',
    target: 'node22',
    format: 'cjs',
    outfile: path.join(DIST, 'bundle.cjs'),
    // package.json은 코드가 아니라 데이터라 esbuild가 안 건드리게 외부 처리하지 않고
    // JSON require는 esbuild가 기본적으로 인라인 번들링한다(별도 설정 불필요, 아래서 실측 확인).
  });
  console.log('OK');

  step('2) SEA config 생성');
  const seaConfigPath = path.join(DIST, 'sea-config.json');
  fs.writeFileSync(
    seaConfigPath,
    JSON.stringify(
      {
        main: 'bundle.cjs',
        output: 'sea-prep.blob',
        disableExperimentalSEAWarning: true,
      },
      null,
      2
    )
  );
  console.log('OK');

  step('3) SEA blob 생성');
  execFileSync(process.execPath, ['--experimental-sea-config', 'sea-config.json'], {
    cwd: DIST,
    stdio: 'inherit',
  });

  step('4) node 실행파일 복사');
  const targetExePath = path.join(DIST, artifactName);
  fs.copyFileSync(process.execPath, targetExePath);
  console.log(`OK -> ${targetExePath}`);

  step('5) postject로 blob 주입');
  execFileSync(
    'npx',
    [
      '--yes',
      'postject',
      artifactName,
      'NODE_SEA_BLOB',
      'sea-prep.blob',
      '--sentinel-fuse',
      SENTINEL_FUSE,
      ...(process.platform === 'darwin' ? ['--macho-segment-name', 'NODE_SEA'] : []),
    ],
    { cwd: DIST, stdio: 'inherit', shell: process.platform === 'win32' }
  );

  if (process.platform === 'darwin') {
    step('6) macOS ad-hoc 자체 서명 (무료, 공증 아님 — Gatekeeper 완전 차단만 회피)');
    execFileSync('codesign', ['--sign', '-', targetExePath], { stdio: 'inherit' });
  }

  console.log(`\n빌드 완료: dist/${artifactName}`);
}

main();
