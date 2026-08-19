'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const {
  readActiveAccountId,
  writeActiveAccountId,
  applySwitch,
} = require('../../src/accounts/accounts/active-account-state');
const { appendAccount } = require('../../src/accounts/accounts/accounts-registry');
const { readActiveAccountHandle } = require('../../src/shared/active-account-handle/read');
const { readRotationEvents } = require('../../src/accounts/audit/rotation-log');
const { REASONS } = require('../../src/accounts/rotation/rotation-event');

function tmpJsonPath(prefix) {
  return path.join(
    os.tmpdir(),
    `claudetower-${prefix}-test-${Date.now()}-${Math.random().toString(36).slice(2)}.json`
  );
}

test('readActiveAccountId: 파일이 없으면 null을 반환한다', () => {
  assert.equal(readActiveAccountId(tmpJsonPath('missing')), null);
});

test('writeActiveAccountId → readActiveAccountId 라운드트립', () => {
  const p = tmpJsonPath('state');
  writeActiveAccountId('acc-123', p);
  assert.equal(readActiveAccountId(p), 'acc-123');
  fs.unlinkSync(p);
});

test('writeActiveAccountId: 빈 문자열은 거부한다', () => {
  assert.throws(() => writeActiveAccountId('', tmpJsonPath('state')), TypeError);
});

test('readActiveAccountId: 손상된 파일은 null로 안전하게 폴백한다', () => {
  const p = tmpJsonPath('corrupt');
  fs.writeFileSync(p, '{ not valid json', 'utf8');
  assert.equal(readActiveAccountId(p), null);
  fs.unlinkSync(p);
});

test('applySwitch: shouldSwitch=false인 결정을 넘기면 아무 것도 하지 않는다', () => {
  const statePath = tmpJsonPath('state');
  const result = applySwitch(
    { shouldSwitch: false, reason: 'below_threshold', toAccountId: null },
    { registryPath: tmpJsonPath('registry'), statePath }
  );
  assert.equal(result.applied, false);
  assert.equal(result.reason, 'not_a_switch_decision');
  assert.equal(fs.existsSync(statePath), false);
});

test('applySwitch: 대상 계정이 registry에 없으면 거부한다', () => {
  const registryPath = tmpJsonPath('registry');
  const result = applySwitch(
    { shouldSwitch: true, reason: 'quota_threshold', toAccountId: 'ghost' },
    { registryPath, statePath: tmpJsonPath('state') }
  );
  assert.equal(result.applied, false);
  assert.equal(result.reason, 'target_account_not_found');
});

test('applySwitch: 대상 계정이 비활성 상태면 거부한다(레이스 컨디션 방어)', () => {
  const registryPath = tmpJsonPath('registry');
  appendAccount(
    { account_id: 'a2', label: 'backup', auth_type: 'api_key', status: 'disabled', created_at: '2026-08-20T00:00:00Z' },
    registryPath
  );
  const result = applySwitch(
    { shouldSwitch: true, reason: 'quota_threshold', toAccountId: 'a2' },
    { registryPath, statePath: tmpJsonPath('state') }
  );
  assert.equal(result.applied, false);
  assert.equal(result.reason, 'target_account_not_usable');
  fs.unlinkSync(registryPath);
});

test('applySwitch: 정상 케이스 — 상태 파일·active-account-handle·감사로그를 전부 갱신한다', () => {
  const registryPath = tmpJsonPath('registry');
  const statePath = tmpJsonPath('state');
  const activeAccountHandlePath = tmpJsonPath('handle');
  const rotationLogPath = tmpJsonPath('rotation-log');
  appendAccount(
    { account_id: 'a2', label: 'backup-account', auth_type: 'api_key', status: 'active', created_at: '2026-08-20T00:00:00Z' },
    registryPath
  );

  const result = applySwitch(
    { shouldSwitch: true, reason: 'quota_threshold', toAccountId: 'a2' },
    {
      fromAccountId: 'a1',
      registryPath,
      statePath,
      rotationLogPath,
      activeAccountHandlePath,
      projectPath: 'C:\\some\\project',
    }
  );

  assert.equal(result.applied, true);
  assert.equal(result.toAccountId, 'a2');
  assert.equal(readActiveAccountId(statePath), 'a2');

  const handle = readActiveAccountHandle(activeAccountHandlePath);
  assert.equal(handle.account_label, 'backup-account');

  const events = readRotationEvents(rotationLogPath);
  assert.equal(events.length, 1);
  assert.equal(events[0].from_account_id, 'a1');
  assert.equal(events[0].to_account_id, 'a2');
  assert.equal(events[0].reason, 'quota_threshold');
  assert.ok(REASONS.includes(events[0].reason));
  assert.equal(events[0].project_path, 'C:\\some\\project');

  fs.unlinkSync(registryPath);
  fs.unlinkSync(statePath);
  fs.unlinkSync(activeAccountHandlePath);
  fs.unlinkSync(rotationLogPath);
});

test('applySwitch: reevalIntervalMs가 지나지 않았으면 판단이 전환이어도 적용을 보류한다(진동 방지)', () => {
  const registryPath = tmpJsonPath('registry');
  const statePath = tmpJsonPath('state');
  const rotationLogPath = tmpJsonPath('rotation-log');
  const activeAccountHandlePath = tmpJsonPath('handle');
  appendAccount({ account_id: 'a1', label: 'first', auth_type: 'api_key', status: 'active', created_at: 'x' }, registryPath);
  appendAccount({ account_id: 'a2', label: 'second', auth_type: 'api_key', status: 'active', created_at: 'x' }, registryPath);

  // 직전 전환을 방금 막 적용해둔 상태로 시작(updated_at=지금)
  writeActiveAccountId('a1', statePath);

  const result = applySwitch(
    { shouldSwitch: true, reason: 'quota_threshold', toAccountId: 'a2' },
    { fromAccountId: 'a1', registryPath, statePath, rotationLogPath, activeAccountHandlePath, reevalIntervalMs: 60000 }
  );

  assert.equal(result.applied, false);
  assert.equal(result.reason, 'reeval_interval_not_elapsed');
  assert.equal(readActiveAccountId(statePath), 'a1', '스로틀에 막혔으니 상태가 바뀌면 안 된다');
  assert.equal(readRotationEvents(rotationLogPath).length, 0);

  fs.unlinkSync(registryPath);
  fs.unlinkSync(statePath);
});

test('applySwitch: 이전 전환 기록이 없으면(최초 전환) reevalIntervalMs와 무관하게 즉시 적용한다', () => {
  const registryPath = tmpJsonPath('registry');
  const statePath = tmpJsonPath('state'); // 아직 존재하지 않는 파일 — "최초 전환" 시뮬레이션
  const rotationLogPath = tmpJsonPath('rotation-log');
  const activeAccountHandlePath = tmpJsonPath('handle');
  appendAccount({ account_id: 'a2', label: 'second', auth_type: 'api_key', status: 'active', created_at: 'x' }, registryPath);

  const result = applySwitch(
    { shouldSwitch: true, reason: 'quota_threshold', toAccountId: 'a2' },
    { registryPath, statePath, rotationLogPath, activeAccountHandlePath, reevalIntervalMs: 60000 }
  );

  assert.equal(result.applied, true);
  assert.equal(readActiveAccountId(statePath), 'a2');

  fs.unlinkSync(registryPath);
  fs.unlinkSync(statePath);
  fs.unlinkSync(rotationLogPath);
  fs.unlinkSync(activeAccountHandlePath);
});

test('writeActiveAccountId: 여러 프로세스가 동시에 같은 파일에 써도 파일이 항상 유효한 상태로 남는다', async () => {
  const { spawn } = require('node:child_process');
  const statePath = tmpJsonPath('concurrent-state');
  const modulePath = path.join(__dirname, '..', '..', 'src', 'accounts', 'accounts', 'active-account-state.js');

  // 실제 별도 OS 프로세스 10개를 동시에 띄워 같은 파일에 동시 쓰기를 시도한다.
  // 정직하게 명시: 이 테스트를 원자적 쓰기 적용 "전" 코드(fs.writeFileSync 직접 호출)로
  // 5회 반복 실행해봤지만 손상을 재현하지 못했다 — 이 페이로드가 작고(수십 바이트) 쓰기가
  // 매우 빨라, 이 PC(Windows/NTFS)에서는 경합 창이 이 테스트로 안정적으로 재현될 만큼
  // 넓지 않은 것으로 보인다. 그래서 이 테스트는 "이전엔 깨졌는데 지금은 안 깨진다"를
  // 증명하는 게 아니라, 원자적 쓰기 적용 후에도 정상적인 동시 다발 상황에서 회귀가
  // 없는지 확인하는 안전망이다 — 원자적 쓰기 자체의 정당성은 이 프로젝트가 실제로 겪은
  // 전례(install.ps1, `.PRD/05_FIELD_ISSUES_2026-07-04.md` 이슈#1)와 rename()의 표준
  // 원자성 보장에 근거한다.
  const N = 10;
  const runs = Array.from({ length: N }, (_, i) => {
    const code = `
      const { writeActiveAccountId } = require(${JSON.stringify(modulePath)});
      writeActiveAccountId(${JSON.stringify(`acc-${i}`)}, ${JSON.stringify(statePath)});
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

  // 파일이 존재하고, 손상 없이 파싱 가능하며, 실제로 그 10개 프로세스 중 하나가 쓴 값이어야 한다
  // (깨진 절반짜리 JSON이거나 두 값이 섞인 내용이면 여기서 JSON.parse가 던지거나 값이 안 맞는다).
  const raw = fs.readFileSync(statePath, 'utf8');
  const parsed = JSON.parse(raw); // 손상됐으면 여기서 예외
  assert.match(parsed.account_id, /^acc-\d$/);

  // 임시 파일이 하나도 안 남아야 한다(성공 시 전부 rename으로 소비됨).
  const leftoverTmp = fs.readdirSync(os.tmpdir()).filter((f) => f.includes(path.basename(statePath)) && f.includes('.tmp-'));
  assert.equal(leftoverTmp.length, 0, `임시 파일이 남아있음: ${leftoverTmp.join(', ')}`);

  fs.unlinkSync(statePath);
});

test('active-account-state.js는 credential-store/oauth/proxy를 절대 require하지 않는다(정적 검사)', () => {
  const source = fs.readFileSync(
    path.join(__dirname, '..', '..', 'src', 'accounts', 'accounts', 'active-account-state.js'),
    'utf8'
  );
  assert.doesNotMatch(source, /require\(['"].*credential-store/);
  assert.doesNotMatch(source, /require\(['"].*oauth\//);
  assert.doesNotMatch(source, /require\(['"].*proxy\//);
});
