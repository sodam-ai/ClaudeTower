'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const {
  readQuotaCache,
  readQuotaCacheEntry,
  writeQuotaCacheEntry,
} = require('../../src/accounts/quota/quota-cache-store');

function tmpJsonPath() {
  return path.join(os.tmpdir(), `claudetower-quota-cache-test-${Date.now()}-${Math.random().toString(36).slice(2)}.json`);
}

test('readQuotaCache: 파일이 없으면 빈 객체를 반환한다', () => {
  const filePath = tmpJsonPath();
  assert.deepEqual(readQuotaCache(filePath), {});
});

test('readQuotaCacheEntry: 기록된 적 없는 account_id는 null을 반환한다', () => {
  const filePath = tmpJsonPath();
  writeQuotaCacheEntry('a1', { tokens_used_pct: 10, requests_used_pct: 5 }, filePath);
  assert.equal(readQuotaCacheEntry('a2', filePath), null);
  fs.unlinkSync(filePath);
});

test('writeQuotaCacheEntry → readQuotaCacheEntry: 저장한 값이 checked_at과 함께 그대로 조회된다', () => {
  const filePath = tmpJsonPath();
  writeQuotaCacheEntry('a1', { tokens_used_pct: 42.5, requests_used_pct: 10, tokens_reset_at: '2026-08-20T10:00:00Z', requests_reset_at: null }, filePath);
  const entry = readQuotaCacheEntry('a1', filePath);
  assert.equal(entry.tokens_used_pct, 42.5);
  assert.equal(entry.requests_used_pct, 10);
  assert.equal(typeof entry.checked_at, 'string');
  fs.unlinkSync(filePath);
});

test('writeQuotaCacheEntry: 다른 계정 항목을 덮어쓰지 않고 누적한다', () => {
  const filePath = tmpJsonPath();
  writeQuotaCacheEntry('a1', { tokens_used_pct: 10 }, filePath);
  writeQuotaCacheEntry('a2', { tokens_used_pct: 20 }, filePath);
  const cache = readQuotaCache(filePath);
  assert.equal(Object.keys(cache).length, 2);
  assert.equal(cache.a1.tokens_used_pct, 10);
  assert.equal(cache.a2.tokens_used_pct, 20);
  fs.unlinkSync(filePath);
});

test('writeQuotaCacheEntry: 같은 계정에 다시 쓰면 최신 값으로 교체된다', () => {
  const filePath = tmpJsonPath();
  writeQuotaCacheEntry('a1', { tokens_used_pct: 10 }, filePath);
  writeQuotaCacheEntry('a1', { tokens_used_pct: 90 }, filePath);
  assert.equal(readQuotaCacheEntry('a1', filePath).tokens_used_pct, 90);
  fs.unlinkSync(filePath);
});

test('readQuotaCache: 손상된 파일은 안전하게 빈 객체로 폴백한다', () => {
  const filePath = tmpJsonPath();
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, '{not valid json', 'utf8');
  assert.deepEqual(readQuotaCache(filePath), {});
  fs.unlinkSync(filePath);
});

test('writeQuotaCacheEntry: accountId가 비어있으면 거부한다', () => {
  assert.throws(() => writeQuotaCacheEntry('', { tokens_used_pct: 1 }, tmpJsonPath()), TypeError);
});

test('writeQuotaCacheEntry: 인자 없이(filePath undefined) 호출 시 다른 CLAUDETOWER_* 변수만 설정돼 있으면 부분격리로 거부한다', () => {
  const prevWidget = process.env.CLAUDETOWER_WIDGET_CONFIG_PATH;
  process.env.CLAUDETOWER_WIDGET_CONFIG_PATH = '/tmp/irrelevant.json';
  try {
    assert.throws(() => writeQuotaCacheEntry('a1', { tokens_used_pct: 1 }, undefined), /테스트 격리 변수/);
  } finally {
    if (prevWidget === undefined) delete process.env.CLAUDETOWER_WIDGET_CONFIG_PATH;
    else process.env.CLAUDETOWER_WIDGET_CONFIG_PATH = prevWidget;
  }
});

test('writeQuotaCacheEntry: 여러 프로세스가 동시에 서로 다른 계정 항목을 써도 전부 살아남는다(유실 없음)', async () => {
  // 2026-08-20 회귀 테스트 — 전수 재검토로 발견한 결함: 이 파일은 "전체 캐시 읽기 →
  // 이 계정 항목만 얹기 → 전체 파일 교체" 구조라, active-account-state.json(단일 값)의
  // last-write-wins 위험과 달리, 서로 다른 계정으로 동시에 쓰면 나중에 rename에 성공한
  // 쪽이 먼저 쓴 쪽의 "다른 계정" 항목을 통째로 지워버리는 유실이 생겼다. 실제 별도 OS
  // 프로세스 N개를 동시에 띄워 각자 다른 계정 키를 쓰게 해서, 최종 캐시에 N개 전부
  // 남아있는지 확인한다(단일 값 재현 테스트로는 이 유실을 못 잡는다 — 매번 같은 키만
  // 덮어써서 "몇 개가 사라졌는지" 셀 수 없기 때문).
  const { spawn } = require('node:child_process');
  const filePath = tmpJsonPath();
  const modulePath = path.join(__dirname, '..', '..', 'src', 'accounts', 'quota', 'quota-cache-store.js');

  const N = 10;
  const runs = Array.from({ length: N }, (_, i) => {
    const code = `
      const { writeQuotaCacheEntry } = require(${JSON.stringify(modulePath)});
      writeQuotaCacheEntry(${JSON.stringify(`acc-${i}`)}, { tokens_used_pct: ${i}, requests_used_pct: null }, ${JSON.stringify(filePath)});
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

  const finalCache = readQuotaCache(filePath);
  const missing = Array.from({ length: N }, (_, i) => `acc-${i}`).filter((id) => !finalCache[id]);
  assert.deepEqual(missing, [], `유실된 계정 항목이 있으면 안 됨: ${missing.join(', ')}`);
  for (let i = 0; i < N; i++) {
    assert.equal(finalCache[`acc-${i}`].tokens_used_pct, i);
  }

  const leftoverTmp = fs.readdirSync(os.tmpdir()).filter((f) => f.includes(path.basename(filePath)) && f.includes('.tmp-'));
  assert.equal(leftoverTmp.length, 0, `임시 파일이 남아있음: ${leftoverTmp.join(', ')}`);

  fs.unlinkSync(filePath);
});

test('writeQuotaCacheEntry: 죽은 프로세스가 남긴 오래된 락 파일은 강제로 회수하고 정상 진행한다(영구 교착 방지)', () => {
  const filePath = tmpJsonPath();
  const lockPath = `${filePath}.lock`;
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.closeSync(fs.openSync(lockPath, 'w')); // 락을 쥔 채로 죽은 프로세스를 흉내
  const oldTime = new Date(Date.now() - 10000); // LOCK_STALE_MS(3000ms)보다 훨씬 오래됨
  fs.utimesSync(lockPath, oldTime, oldTime);

  writeQuotaCacheEntry('a1', { tokens_used_pct: 5, requests_used_pct: null }, filePath);

  assert.equal(readQuotaCacheEntry('a1', filePath).tokens_used_pct, 5);
  assert.equal(fs.existsSync(lockPath), false, '쓰기가 끝나면 락 파일이 정리돼야 한다');
  fs.unlinkSync(filePath);
});

test('writeQuotaCacheEntry: 소유자 전용 권한(permissionRestricted)이 실제로 적용된다', () => {
  // 2026-08-20 추가 — active-account-state.js/active-account-handle/write.js와 동일한
  // 원자적쓰기+권한제한을 이 파일에도 적용(onUpstreamHeaders가 매 응답마다 쓰게 되면서
  // 위험 등급이 같아짐). 같은 관례로 같은 형태의 테스트를 둔다.
  const p = tmpJsonPath();
  const result = writeQuotaCacheEntry('a1', { tokens_used_pct: 10, requests_used_pct: null }, p);
  assert.equal(typeof result.permissionRestricted, 'boolean');
  assert.equal(result.permissionRestricted, true, '이 PC(Windows)에서는 icacls 강제가 항상 성공해야 한다');
  fs.unlinkSync(p);
});

test('writeQuotaCacheEntry: 매 쓰기(=매 rename)마다 다시 권한을 강제한다', () => {
  const p = tmpJsonPath();
  const first = writeQuotaCacheEntry('a1', { tokens_used_pct: 10, requests_used_pct: null }, p);
  const second = writeQuotaCacheEntry('a2', { tokens_used_pct: 20, requests_used_pct: null }, p);
  assert.equal(first.permissionRestricted, true);
  assert.equal(second.permissionRestricted, true, '두 번째 쓰기(새 임시파일→rename)도 여전히 강제돼야 한다');
  assert.equal(readQuotaCacheEntry('a1', p).tokens_used_pct, 10);
  assert.equal(readQuotaCacheEntry('a2', p).tokens_used_pct, 20);
  fs.unlinkSync(p);
});

test(
  'writeQuotaCacheEntry(win32): icacls 결과 실제로 현재 사용자만 접근 가능하고 상속된 ACE가 남아있지 않다',
  { skip: process.platform !== 'win32' },
  () => {
    const { execFileSync } = require('node:child_process');
    const p = tmpJsonPath();
    writeQuotaCacheEntry('a1', { tokens_used_pct: 10, requests_used_pct: null }, p);
    const output = execFileSync('icacls', [p], { encoding: 'utf8' });
    const username = os.userInfo().username;
    const aceLines = output
      .split('\n')
      .map((line) => line.trimEnd())
      .filter((line) => /:\([A-Za-z,]+\)$/.test(line));
    assert.equal(aceLines.length, 1, `단일 ACE만 있어야 함: ${output}`);
    assert.match(aceLines[0], new RegExp(`${username}:\\(F\\)`));
    fs.unlinkSync(p);
  }
);

test('quota-cache-store.js는 credential-store/oauth/proxy를 절대 require하지 않는다(정적 검사)', () => {
  const source = fs.readFileSync(
    path.join(__dirname, '..', '..', 'src', 'accounts', 'quota', 'quota-cache-store.js'),
    'utf8'
  );
  assert.doesNotMatch(source, /require\(['"].*credential-store/);
  assert.doesNotMatch(source, /require\(['"].*oauth\//);
  assert.doesNotMatch(source, /require\(['"].*proxy\//);
});
