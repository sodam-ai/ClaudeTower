'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { writeStatusLineConfig, readExistingSettings } = require('../../src/display/config/settings-writer');

// 절대 실제 ~/.claude/settings.json을 쓰지 않는다 — 매 테스트마다 임시 디렉터리를 새로 만든다.
function tempSettingsPath() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'claudetower-test-'));
  return path.join(dir, 'settings.json');
}

test('설정 파일이 없으면 새로 만든다', () => {
  const filePath = tempSettingsPath();
  writeStatusLineConfig({ type: 'command', command: 'x' }, filePath);
  const written = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  assert.deepEqual(written.statusLine, { type: 'command', command: 'x' });
});

test('기존 설정의 다른 키(hooks 등)는 보존하고 statusLine만 갱신한다', () => {
  const filePath = tempSettingsPath();
  fs.writeFileSync(filePath, JSON.stringify({ hooks: { foo: 'bar' }, permissions: { allow: ['*'] } }));
  writeStatusLineConfig({ type: 'command', command: 'y' }, filePath);
  const written = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  assert.deepEqual(written.hooks, { foo: 'bar' });
  assert.deepEqual(written.permissions, { allow: ['*'] });
  assert.deepEqual(written.statusLine, { type: 'command', command: 'y' });
});

test('기존 파일이 있으면 .bak 백업을 남긴다', () => {
  const filePath = tempSettingsPath();
  fs.writeFileSync(filePath, JSON.stringify({ original: true }));
  const result = writeStatusLineConfig({ type: 'command', command: 'z' }, filePath);
  assert.equal(result.backedUp, true);
  const backup = JSON.parse(fs.readFileSync(`${filePath}.bak`, 'utf8'));
  assert.deepEqual(backup, { original: true });
});

test('손상된 기존 JSON은 덮어쓰지 않고 에러를 던진다', () => {
  const filePath = tempSettingsPath();
  fs.writeFileSync(filePath, '{invalid json,,,');
  assert.throws(() => writeStatusLineConfig({ type: 'command', command: 'x' }, filePath));
  // 원본 손상 파일이 그대로 남아있어야 함(덮어쓰지 않았는지 확인)
  assert.equal(fs.readFileSync(filePath, 'utf8'), '{invalid json,,,');
});

test('존재하지 않는 부모 디렉터리도 자동 생성한다', () => {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'claudetower-test-'));
  const nestedPath = path.join(base, 'nested', 'dir', 'settings.json');
  writeStatusLineConfig({ type: 'command', command: 'x' }, nestedPath);
  assert.equal(fs.existsSync(nestedPath), true);
});

test('readExistingSettings는 파일이 없으면 빈 객체를 반환한다', () => {
  const filePath = tempSettingsPath();
  assert.deepEqual(readExistingSettings(filePath), {});
});

test('쓰기 권한이 없어 실패해도 원본은 보존되고 .tmp 잔여물을 남기지 않는다', (t) => {
  const filePath = tempSettingsPath();
  const original = JSON.stringify({ existing: true });
  fs.writeFileSync(filePath, original);
  fs.chmodSync(filePath, 0o444); // 읽기 전용

  // CI(GitHub Actions Linux/macOS 러너)는 root 권한으로 돌아서 chmod 0o444를 걸어도
  // 실제 쓰기가 그대로 성공해버리는 걸 실측으로 확인했다(로컬 Windows에서는 EPERM,
  // CI Linux/macOS에서는 성공 — "Missing expected exception"으로 실패 재현).
  // 권한 강제가 안 통하는 환경(주로 root)에서는 이 테스트 자체가 성립하지 않으므로
  // 무력화하는 대신 명시적으로 건너뛴다 — 실제 코드의 방어 로직은 그대로 유지.
  let writeSucceededDespiteReadonly = false;
  try {
    writeStatusLineConfig({ type: 'command', command: 'probe' }, filePath);
    writeSucceededDespiteReadonly = true;
  } catch {
    // 예상대로 실패 — 아래에서 본검증 진행
  } finally {
    fs.chmodSync(filePath, 0o644);
  }

  if (writeSucceededDespiteReadonly) {
    t.skip('이 환경(예: CI가 root로 실행)에서는 파일 권한이 강제되지 않아 검증 불가');
    return;
  }

  // 권한이 실제로 강제되는 환경에서만 본검증: 실패 시 원본 보존 + .tmp 잔여물 없음.
  fs.writeFileSync(filePath, original);
  fs.chmodSync(filePath, 0o444);
  try {
    assert.throws(() => writeStatusLineConfig({ type: 'command', command: 'x' }, filePath));
    assert.equal(fs.readFileSync(filePath, 'utf8'), original);
    assert.equal(fs.existsSync(`${filePath}.tmp`), false);
  } finally {
    fs.chmodSync(filePath, 0o644);
  }
});
