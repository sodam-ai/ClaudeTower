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
