'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { readRegistry, existingLabels, appendAccount, updateRegistry } = require('../../src/accounts/accounts/accounts-registry');

function tmpPath() {
  return path.join(
    os.tmpdir(),
    `claudetower-accounts-registry-test-${Date.now()}-${Math.random().toString(36).slice(2)}.json`
  );
}

const ACCOUNT_A = {
  account_id: 'acc-a',
  label: 'work',
  auth_type: 'api_key',
  status: 'active',
  created_at: '2026-08-19T00:00:00.000Z',
  last_project_path: null,
  last_used_at: null,
};

test('readRegistry: 파일이 없으면 빈 배열을 반환한다', () => {
  assert.deepEqual(readRegistry(tmpPath()), []);
});

test('appendAccount → readRegistry: 추가한 계정이 그대로 조회된다', () => {
  const filePath = tmpPath();
  appendAccount(ACCOUNT_A, filePath);
  const list = readRegistry(filePath);
  assert.equal(list.length, 1);
  assert.deepEqual(list[0], ACCOUNT_A);
  fs.unlinkSync(filePath);
});

test('appendAccount: 여러 계정을 순서대로 누적한다', () => {
  const filePath = tmpPath();
  appendAccount(ACCOUNT_A, filePath);
  appendAccount({ ...ACCOUNT_A, account_id: 'acc-b', label: 'personal' }, filePath);
  const list = readRegistry(filePath);
  assert.equal(list.length, 2);
  assert.deepEqual(existingLabels(filePath), ['work', 'personal']);
  fs.unlinkSync(filePath);
});

test('readRegistry: 손상된 파일은 안전하게 빈 배열로 폴백한다', () => {
  const filePath = tmpPath();
  fs.writeFileSync(filePath, 'not json at all', 'utf8');
  assert.deepEqual(readRegistry(filePath), []);
  fs.unlinkSync(filePath);
});

test('레지스트리에는 비밀값 관련 필드가 절대 저장되지 않는다(Account 엔티티 자체가 화이트리스트)', () => {
  const filePath = tmpPath();
  appendAccount(ACCOUNT_A, filePath);
  const raw = fs.readFileSync(filePath, 'utf8');
  assert.doesNotMatch(raw.toLowerCase(), /secret|apikey|api_key_value|token_value/);
  fs.unlinkSync(filePath);
});

test('appendAccount: 여러 프로세스가 동시에 서로 다른 계정을 추가해도 전부 살아남는다(유실 없음)', async () => {
  // 2026-08-20 — quota-cache-store.js(M52)에서 겪은 것과 정확히 같은 유실 위험이
  // 이 파일에도 있었다(전체 읽기 → 항목 추가 → 전체 교체, 락 없음). 락+원자적쓰기
  // 적용 후 실제 별도 프로세스로 회귀 검증한다.
  const { spawn } = require('node:child_process');
  const filePath = tmpPath();
  const modulePath = path.join(__dirname, '..', '..', 'src', 'accounts', 'accounts', 'accounts-registry.js');

  const N = 10;
  const runs = Array.from({ length: N }, (_, i) => {
    const code = `
      const { appendAccount } = require(${JSON.stringify(modulePath)});
      appendAccount(${JSON.stringify({ ...ACCOUNT_A, account_id: `acc-${i}`, label: `label-${i}` })}, ${JSON.stringify(filePath)});
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

  const finalList = readRegistry(filePath);
  const ids = finalList.map((a) => a.account_id).sort();
  const expectedIds = Array.from({ length: N }, (_, i) => `acc-${i}`).sort();
  assert.deepEqual(ids, expectedIds, `유실된 계정이 있으면 안 됨: 기대 ${expectedIds.join(',')} / 실제 ${ids.join(',')}`);

  const leftoverTmp = fs.readdirSync(os.tmpdir()).filter((f) => f.includes(path.basename(filePath)) && (f.includes('.tmp-') || f.endsWith('.lock')));
  assert.equal(leftoverTmp.length, 0, `임시/락 파일이 남아있음: ${leftoverTmp.join(', ')}`);

  fs.unlinkSync(filePath);
});

test('updateRegistry: updateFn이 항상 락 시점의 최신 목록을 받는다(호출부의 낡은 스냅샷이 아니라)', () => {
  const filePath = tmpPath();
  appendAccount(ACCOUNT_A, filePath);

  // "미리 읽어둔" 낡은 스냅샷을 흉내: 이 시점 이후 다른 곳에서 계정이 하나 더 생겼다고 가정.
  appendAccount({ ...ACCOUNT_A, account_id: 'acc-b', label: 'personal' }, filePath);

  let seenByUpdateFn = null;
  updateRegistry((current) => {
    seenByUpdateFn = current;
    return current; // 변경 없음
  }, filePath);

  assert.equal(seenByUpdateFn.length, 2, 'updateFn은 acc-a·acc-b 둘 다 포함된 최신 목록을 받아야 한다');
  fs.unlinkSync(filePath);
});

test('updateRegistry: updateFn이 입력과 같은 배열(참조 동일)을 반환하면 파일을 다시 쓰지 않는다', () => {
  const filePath = tmpPath();
  appendAccount(ACCOUNT_A, filePath);
  const before = fs.statSync(filePath).mtimeMs;

  const result = updateRegistry((current) => current, filePath);

  assert.equal(result.written, false);
  assert.equal(fs.statSync(filePath).mtimeMs, before, '변경이 없으면 파일의 수정 시각도 그대로여야 한다');
  fs.unlinkSync(filePath);
});

test('appendAccount: 죽은 프로세스가 남긴 오래된 락 파일은 강제로 회수하고 정상 진행한다(영구 교착 방지)', () => {
  const filePath = tmpPath();
  const lockPath = `${filePath}.lock`;
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.closeSync(fs.openSync(lockPath, 'w'));
  const oldTime = new Date(Date.now() - 10000);
  fs.utimesSync(lockPath, oldTime, oldTime);

  appendAccount(ACCOUNT_A, filePath);

  assert.equal(readRegistry(filePath).length, 1);
  assert.equal(fs.existsSync(lockPath), false);
  fs.unlinkSync(filePath);
});

test('accounts-registry.js는 credential-store/oauth/proxy를 절대 require하지 않는다(정적 검사)', () => {
  const source = fs.readFileSync(
    path.join(__dirname, '..', '..', 'src', 'accounts', 'accounts', 'accounts-registry.js'),
    'utf8'
  );
  assert.doesNotMatch(source, /require\(['"].*credential-store/);
  assert.doesNotMatch(source, /require\(['"].*oauth\//);
  assert.doesNotMatch(source, /require\(['"].*proxy\//);
});
