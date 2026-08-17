'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { appendRotationEvent, readRotationEvents } = require('../../src/accounts/audit/rotation-log');

// 절대 실제 사용자 감사 로그 경로를 쓰지 않는다 — 매 테스트마다 임시 디렉터리를 새로 만든다
// (settings-writer.test.js의 tempSettingsPath 패턴과 동일).
function tempAuditPath() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'claudetower-audit-test-'));
  return path.join(dir, 'rotation.jsonl');
}

const VALID = {
  eventId: 'evt-001',
  toAccountId: 'acc-002',
  reason: 'quota_threshold',
  occurredAt: '2026-07-28T00:00:00Z',
};

test('appendRotationEvent: 파일이 없으면 디렉터리까지 새로 만들고 1줄을 기록한다', () => {
  const filePath = tempAuditPath();
  const { event } = appendRotationEvent(VALID, filePath);
  assert.equal(event.event_id, 'evt-001');
  const raw = fs.readFileSync(filePath, 'utf8');
  assert.equal(raw.trim().split('\n').length, 1);
  assert.deepEqual(JSON.parse(raw.trim()), event);
});

test('appendRotationEvent: 여러 번 호출하면 기존 줄을 지우지 않고 이어서 추가한다(로그 생략 금지 DO NOT 규칙)', () => {
  const filePath = tempAuditPath();
  appendRotationEvent(VALID, filePath);
  appendRotationEvent({ ...VALID, eventId: 'evt-002', occurredAt: '2026-07-28T01:00:00Z' }, filePath);
  const lines = fs.readFileSync(filePath, 'utf8').trim().split('\n');
  assert.equal(lines.length, 2);
  assert.equal(JSON.parse(lines[0]).event_id, 'evt-001');
  assert.equal(JSON.parse(lines[1]).event_id, 'evt-002');
});

test('appendRotationEvent: 유효하지 않은 이벤트(reason 등)는 createRotationEvent가 그대로 거부한다', () => {
  const filePath = tempAuditPath();
  assert.throws(() => appendRotationEvent({ ...VALID, reason: 'user_click' }, filePath), TypeError);
  assert.equal(fs.existsSync(filePath), false, '검증 실패 시 파일이 생성되면 안 된다');
});

test('appendRotationEvent: 기록된 JSON 줄에 토큰·비밀값 필드가 없다(자격증명 분리 원칙, 스키마 화이트리스트)', () => {
  const filePath = tempAuditPath();
  appendRotationEvent(VALID, filePath);
  const raw = fs.readFileSync(filePath, 'utf8');
  const keys = Object.keys(JSON.parse(raw.trim()));
  assert.deepEqual(
    keys.sort(),
    ['event_id', 'from_account_id', 'to_account_id', 'project_path', 'reason', 'occurred_at'].sort()
  );
});

test('appendRotationEvent: permissionRestricted는 chmod/icacls 성공 여부가 아니라 실제 권한 상태를 재확인한 값이다', () => {
  const filePath = tempAuditPath();
  const { permissionRestricted } = appendRotationEvent(VALID, filePath);
  assert.equal(typeof permissionRestricted, 'boolean');
  if (process.platform === 'win32') {
    // 2026-08-17 icacls 구현 후: POSIX 모드 비트 대신 ACL로 강제하므로 신규 생성 파일은
    // 반드시 true여야 한다(2026-07-28 chmodSync 단독으로는 false였던 것을 icacls로 해소).
    assert.equal(permissionRestricted, true);
  } else {
    assert.equal(permissionRestricted, true);
  }
});

test('appendRotationEvent(win32): icacls 결과 실제로 현재 사용자만 접근 가능하고 상속된 ACE가 남아있지 않다', { skip: process.platform !== 'win32' }, () => {
  const filePath = tempAuditPath();
  appendRotationEvent(VALID, filePath);
  const output = execFileSync('icacls', [filePath], { encoding: 'utf8' });
  const aceLines = output.split('\n').map((line) => line.trimEnd()).filter((line) => /:\([A-Za-z,]+\)$/.test(line));
  const username = os.userInfo().username;
  assert.equal(aceLines.length, 1, `ACE는 정확히 1개여야 한다(실제: ${JSON.stringify(aceLines)})`);
  assert.match(aceLines[0], new RegExp(`${username}:\\(F\\)$`));
  assert.ok(!aceLines[0].includes('(I)'), '상속된(Inherited) ACE가 남아있으면 안 된다');
});

test('appendRotationEvent(win32): 파일이 이미 존재하면(추가 기록) icacls를 다시 건드리지 않는다', { skip: process.platform !== 'win32' }, () => {
  const filePath = tempAuditPath();
  appendRotationEvent(VALID, filePath);
  const beforeSecondWrite = execFileSync('icacls', [filePath], { encoding: 'utf8' });
  const { permissionRestricted } = appendRotationEvent({ ...VALID, eventId: 'evt-002', occurredAt: '2026-07-28T01:00:00Z' }, filePath);
  const afterSecondWrite = execFileSync('icacls', [filePath], { encoding: 'utf8' });
  assert.equal(permissionRestricted, false, '기존 파일에 이어 쓸 때는 권한 재설정을 시도하지 않으므로 false');
  assert.equal(beforeSecondWrite, afterSecondWrite, 'ACL 자체는 변하지 않아야 한다');
});

test('readRotationEvents: 파일이 없으면 빈 배열을 반환한다(에러로 죽지 않음)', () => {
  const filePath = tempAuditPath();
  assert.deepEqual(readRotationEvents(filePath), []);
});

test('readRotationEvents: 기록된 이벤트를 순서대로 그대로 읽어온다', () => {
  const filePath = tempAuditPath();
  appendRotationEvent(VALID, filePath);
  appendRotationEvent({ ...VALID, eventId: 'evt-002', occurredAt: '2026-07-28T01:00:00Z' }, filePath);
  const events = readRotationEvents(filePath);
  assert.equal(events.length, 2);
  assert.equal(events[0].event_id, 'evt-001');
  assert.equal(events[1].event_id, 'evt-002');
});

test('readRotationEvents: 손상된 줄이 하나 섞여도 나머지 정상 이벤트는 그대로 읽는다(2026-07-28 실측 발견 회귀 테스트)', () => {
  const filePath = tempAuditPath();
  appendRotationEvent(VALID, filePath);
  fs.appendFileSync(filePath, 'CORRUPTED_NOT_JSON\n');
  appendRotationEvent({ ...VALID, eventId: 'evt-002', occurredAt: '2026-07-28T01:00:00Z' }, filePath);
  const events = readRotationEvents(filePath);
  assert.equal(events.length, 2, '손상된 줄 때문에 파일 전체 읽기가 실패하면 안 된다');
  assert.equal(events[0].event_id, 'evt-001');
  assert.equal(events[1].event_id, 'evt-002');
});

test('readRotationEvents: 빈 줄(파일 끝 개행 등)이 섞여도 무시하고 유효한 줄만 파싱한다', () => {
  const filePath = tempAuditPath();
  appendRotationEvent(VALID, filePath);
  fs.appendFileSync(filePath, '\n\n');
  const events = readRotationEvents(filePath);
  assert.equal(events.length, 1);
});
