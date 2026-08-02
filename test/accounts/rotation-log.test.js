'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
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

test('appendRotationEvent: permissionRestricted는 chmod 성공 여부가 아니라 실제 파일 모드(0o600)를 재확인한 값이다', () => {
  const filePath = tempAuditPath();
  const { permissionRestricted } = appendRotationEvent(VALID, filePath);
  assert.equal(typeof permissionRestricted, 'boolean');
  if (process.platform === 'win32') {
    // 2026-07-28 이 PC 실측: chmodSync(0o600)는 에러 없이 끝나지만 실제 모드는 0o666로
    // 남는다(fs.statSync 직접 대조) — Windows는 POSIX 모드 비트를 지원하지 않으므로
    // 반드시 false여야 한다("에러 안 남" = "성공"으로 오판하는 결함을 막기 위한 회귀 테스트.
    assert.equal(permissionRestricted, false);
  } else {
    assert.equal(permissionRestricted, true);
  }
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

test('readRotationEvents: 빈 줄(파일 끝 개행 등)이 섞여도 무시하고 유효한 줄만 파싱한다', () => {
  const filePath = tempAuditPath();
  appendRotationEvent(VALID, filePath);
  fs.appendFileSync(filePath, '\n\n');
  const events = readRotationEvents(filePath);
  assert.equal(events.length, 1);
});
