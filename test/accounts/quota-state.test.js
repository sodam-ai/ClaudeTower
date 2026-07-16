'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createQuotaState } = require('../../src/accounts/accounts/quota-state');

const VALID = {
  accountId: 'acc-001',
  fiveHourUsedPct: 82.5,
  sevenDayUsedPct: 41.0,
  fiveHourResetsAt: '2026-07-04T15:00:00Z',
  sevenDayResetsAt: '2026-07-10T00:00:00Z',
  lastCheckedAt: '2026-07-04T10:05:00Z',
};

test('createQuotaState: 정상 값이면 그대로 생성된다', () => {
  const state = createQuotaState(VALID);
  assert.equal(state.five_hour_used_pct, 82.5);
  assert.equal(state.seven_day_used_pct, 41.0);
});

test('createQuotaState: 경계값 0과 100은 허용한다', () => {
  assert.doesNotThrow(() => createQuotaState({ ...VALID, fiveHourUsedPct: 0, sevenDayUsedPct: 100 }));
});

test('createQuotaState: 0~100 범위를 벗어나면 거부한다', () => {
  assert.throws(() => createQuotaState({ ...VALID, fiveHourUsedPct: -0.1 }), TypeError);
  assert.throws(() => createQuotaState({ ...VALID, sevenDayUsedPct: 100.1 }), TypeError);
});

test('createQuotaState: 숫자가 아니거나 NaN이면 거부한다', () => {
  assert.throws(() => createQuotaState({ ...VALID, fiveHourUsedPct: '82' }), TypeError);
  assert.throws(() => createQuotaState({ ...VALID, fiveHourUsedPct: NaN }), TypeError);
});

test('createQuotaState: 시각 필드가 비어있으면 거부한다', () => {
  assert.throws(() => createQuotaState({ ...VALID, lastCheckedAt: '' }), TypeError);
});
