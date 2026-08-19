'use strict';

// src/shared/active-account-handle/{read,write}.js 전용 테스트. Account가 쓰고 Display가
// 읽는 파일이지만, 두 모듈 어느 쪽에도 이 파일을 직접 검증하는 테스트가 없었다
// (2026-08-20 발견) — 이번 세션에 이 파일에 두 가지 실질 변경(격리 변수 지원 추가,
// 원자적 쓰기 적용)을 했으므로 최소한의 직접 테스트를 신설한다.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { writeActiveAccountHandle } = require('../../src/shared/active-account-handle/write');
const { readActiveAccountHandle } = require('../../src/shared/active-account-handle/read');

function tmpJsonPath(prefix) {
  return path.join(
    os.tmpdir(),
    `claudetower-${prefix}-test-${Date.now()}-${Math.random().toString(36).slice(2)}.json`
  );
}

test('writeActiveAccountHandle → readActiveAccountHandle 라운드트립', () => {
  const p = tmpJsonPath('handle');
  writeActiveAccountHandle('work-account', p);
  const handle = readActiveAccountHandle(p);
  assert.equal(handle.account_label, 'work-account');
  assert.equal(typeof handle.updated_at, 'string');
  fs.unlinkSync(p);
});

test('writeActiveAccountHandle: 빈 라벨은 거부한다', () => {
  assert.throws(() => writeActiveAccountHandle('', tmpJsonPath('handle')), TypeError);
});

test('readActiveAccountHandle: 파일이 없으면 null을 반환한다', () => {
  assert.equal(readActiveAccountHandle(tmpJsonPath('missing')), null);
});

test('readActiveAccountHandle: 손상된 파일은 null로 안전하게 폴백한다', () => {
  const p = tmpJsonPath('corrupt');
  fs.writeFileSync(p, 'not json at all', 'utf8');
  assert.equal(readActiveAccountHandle(p), null);
  fs.unlinkSync(p);
});

test('writeActiveAccountHandle: CLAUDETOWER_ACTIVE_ACCOUNT_HANDLE_PATH 환경변수로 경로를 지정할 수 있다', () => {
  const p = tmpJsonPath('handle-env');
  process.env.CLAUDETOWER_ACTIVE_ACCOUNT_HANDLE_PATH = p;
  try {
    writeActiveAccountHandle('via-env-var');
    assert.equal(readActiveAccountHandle().account_label, 'via-env-var');
  } finally {
    delete process.env.CLAUDETOWER_ACTIVE_ACCOUNT_HANDLE_PATH;
    fs.unlinkSync(p);
  }
});

test('writeActiveAccountHandle: 명시적 filePath 인자가 환경변수보다 우선한다', () => {
  const envPath = tmpJsonPath('handle-env2');
  const explicitPath = tmpJsonPath('handle-explicit');
  process.env.CLAUDETOWER_ACTIVE_ACCOUNT_HANDLE_PATH = envPath;
  try {
    writeActiveAccountHandle('explicit-wins', explicitPath);
    assert.equal(fs.existsSync(envPath), false, '환경변수 경로에는 쓰지 않아야 한다');
    assert.equal(readActiveAccountHandle(explicitPath).account_label, 'explicit-wins');
  } finally {
    delete process.env.CLAUDETOWER_ACTIVE_ACCOUNT_HANDLE_PATH;
    fs.unlinkSync(explicitPath);
  }
});

test('writeActiveAccountHandle: 여러 프로세스가 동시에 써도 파일이 항상 유효한 상태로 남는다', async () => {
  const { spawn } = require('node:child_process');
  const handlePath = tmpJsonPath('handle-concurrent');
  const modulePath = path.join(__dirname, '..', '..', 'src', 'shared', 'active-account-handle', 'write.js');

  const N = 10;
  const runs = Array.from({ length: N }, (_, i) => {
    const code = `
      const { writeActiveAccountHandle } = require(${JSON.stringify(modulePath)});
      writeActiveAccountHandle(${JSON.stringify(`label-${i}`)}, ${JSON.stringify(handlePath)});
    `;
    return new Promise((resolve, reject) => {
      const child = spawn(process.execPath, ['-e', code]);
      let stderr = '';
      child.stderr.on('data', (d) => (stderr += d));
      child.on('exit', (code2) => (code2 === 0 ? resolve() : reject(new Error(`child ${i} exit ${code2}: ${stderr}`))));
      child.on('error', reject);
    });
  });

  await Promise.all(runs);

  const parsed = JSON.parse(fs.readFileSync(handlePath, 'utf8')); // 손상됐으면 여기서 예외
  assert.match(parsed.account_label, /^label-\d$/);

  const leftoverTmp = fs.readdirSync(os.tmpdir()).filter((f) => f.includes(path.basename(handlePath)) && f.includes('.tmp-'));
  assert.equal(leftoverTmp.length, 0, `임시 파일이 남아있음: ${leftoverTmp.join(', ')}`);

  fs.unlinkSync(handlePath);
});
