'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createRotationEvent } = require('../../src/accounts/rotation/rotation-event');

const VALID = {
  eventId: 'evt-001',
  toAccountId: 'acc-002',
  reason: 'quota_threshold',
  occurredAt: '2026-07-04T14:58:00Z',
};

test('createRotationEvent: 최초 선택(from 없음)도 정상 생성된다', () => {
  const event = createRotationEvent(VALID);
  assert.equal(event.from_account_id, null);
  assert.equal(event.to_account_id, 'acc-002');
  assert.equal(event.project_path, null);
});

test('createRotationEvent: fromAccountId/projectPath를 명시하면 반영된다', () => {
  const event = createRotationEvent({
    ...VALID,
    fromAccountId: 'acc-001',
    projectPath: 'D:/AI_Dev_Work/my-project',
  });
  assert.equal(event.from_account_id, 'acc-001');
  assert.equal(event.project_path, 'D:/AI_Dev_Work/my-project');
});

test('createRotationEvent: reason이 문서화된 3종이 아니면 거부한다', () => {
  assert.throws(() => createRotationEvent({ ...VALID, reason: 'user_click' }), TypeError);
});

test('createRotationEvent: toAccountId가 없으면 거부한다(from과 달리 필수)', () => {
  assert.throws(() => createRotationEvent({ ...VALID, toAccountId: '' }), TypeError);
});

test('createRotationEvent: occurredAt이 비어있으면 거부한다', () => {
  assert.throws(() => createRotationEvent({ ...VALID, occurredAt: '' }), TypeError);
});
