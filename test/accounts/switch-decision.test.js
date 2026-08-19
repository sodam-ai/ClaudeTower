'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { evaluateSwitchDecision } = require('../../src/accounts/quota/switch-decision');
const { REASONS } = require('../../src/accounts/rotation/rotation-event');

function account(id, overrides = {}) {
  return {
    account_id: id,
    label: id,
    auth_type: 'api_key',
    status: 'active',
    created_at: '2026-08-19T00:00:00Z',
    last_project_path: null,
    last_used_at: null,
    ...overrides,
  };
}

const POLICY_BEST = { threshold_pct: 90, strategy: 'best' };
const POLICY_NEXT = { threshold_pct: 90, strategy: 'next-available' };

test('사용률 정보가 없으면(currentQuotaReading=null) 전환하지 않는다', () => {
  const result = evaluateSwitchDecision({
    currentAccountId: 'a1',
    currentQuotaReading: null,
    allAccounts: [account('a1'), account('a2')],
    policy: POLICY_BEST,
  });
  assert.equal(result.shouldSwitch, false);
  assert.equal(result.reason, 'no_quota_data');
});

test('사용률이 임계값 미만이면 전환하지 않는다', () => {
  const result = evaluateSwitchDecision({
    currentAccountId: 'a1',
    currentQuotaReading: { tokens_used_pct: 50, requests_used_pct: null },
    allAccounts: [account('a1'), account('a2')],
    policy: POLICY_BEST,
  });
  assert.equal(result.shouldSwitch, false);
  assert.equal(result.reason, 'below_threshold');
});

test('임계값을 넘었는데 다른 계정이 없으면 전환하지 않는다', () => {
  const result = evaluateSwitchDecision({
    currentAccountId: 'a1',
    currentQuotaReading: { tokens_used_pct: 95, requests_used_pct: null },
    allAccounts: [account('a1')],
    policy: POLICY_BEST,
  });
  assert.equal(result.shouldSwitch, false);
  assert.equal(result.reason, 'no_candidates');
});

test('best 전략: 후보 중 사용률이 가장 낮은(여유가 가장 많은) 계정을 고른다', () => {
  const result = evaluateSwitchDecision({
    currentAccountId: 'a1',
    currentQuotaReading: { tokens_used_pct: 95, requests_used_pct: null },
    allAccounts: [account('a1'), account('a2'), account('a3')],
    quotaByAccountId: {
      a2: { tokens_used_pct: 40, requests_used_pct: null },
      a3: { tokens_used_pct: 10, requests_used_pct: null },
    },
    policy: POLICY_BEST,
  });
  assert.equal(result.shouldSwitch, true);
  assert.equal(result.toAccountId, 'a3');
  assert.equal(result.reason, 'quota_threshold');
});

test('best 전략: 사용률 정보가 아예 없는 후보는 0%(가장 여유 있음)로 취급되어 우선 선택된다', () => {
  const result = evaluateSwitchDecision({
    currentAccountId: 'a1',
    currentQuotaReading: { tokens_used_pct: 95, requests_used_pct: null },
    allAccounts: [account('a1'), account('a2'), account('a3')],
    quotaByAccountId: { a2: { tokens_used_pct: 10, requests_used_pct: null } }, // a3는 정보 없음
    policy: POLICY_BEST,
  });
  assert.equal(result.toAccountId, 'a3');
});

test('next-available 전략: 등록 순서상 임계값 미만인 첫 후보를 즉시 고른다(더 여유 있는 후보를 더 찾지 않음)', () => {
  const result = evaluateSwitchDecision({
    currentAccountId: 'a1',
    currentQuotaReading: { tokens_used_pct: 95, requests_used_pct: null },
    allAccounts: [account('a1'), account('a2'), account('a3')],
    quotaByAccountId: {
      a2: { tokens_used_pct: 85, requests_used_pct: null }, // 임계값(90) 미만이라 즉시 선택
      a3: { tokens_used_pct: 5, requests_used_pct: null }, // 이쪽이 더 여유 있어도 무시됨
    },
    policy: POLICY_NEXT,
  });
  assert.equal(result.toAccountId, 'a2');
});

test('next-available 전략: 후보가 전부 임계값 이상이면 전환하지 않는다', () => {
  const result = evaluateSwitchDecision({
    currentAccountId: 'a1',
    currentQuotaReading: { tokens_used_pct: 95, requests_used_pct: null },
    allAccounts: [account('a1'), account('a2')],
    quotaByAccountId: { a2: { tokens_used_pct: 91, requests_used_pct: null } },
    policy: POLICY_NEXT,
  });
  assert.equal(result.shouldSwitch, false);
  assert.equal(result.reason, 'no_candidates_below_threshold');
});

test('oauth 타입 계정은 전환 후보에서 제외된다(자동 전환 범위는 api_key로 한정)', () => {
  const result = evaluateSwitchDecision({
    currentAccountId: 'a1',
    currentQuotaReading: { tokens_used_pct: 95, requests_used_pct: null },
    allAccounts: [account('a1'), account('a2', { auth_type: 'oauth' })],
    policy: POLICY_BEST,
  });
  assert.equal(result.shouldSwitch, false);
  assert.equal(result.reason, 'no_candidates');
});

test('disabled/cooldown 상태 계정은 전환 후보에서 제외된다', () => {
  const result = evaluateSwitchDecision({
    currentAccountId: 'a1',
    currentQuotaReading: { tokens_used_pct: 95, requests_used_pct: null },
    allAccounts: [
      account('a1'),
      account('a2', { status: 'disabled' }),
      account('a3', { status: 'cooldown' }),
    ],
    policy: POLICY_BEST,
  });
  assert.equal(result.shouldSwitch, false);
  assert.equal(result.reason, 'no_candidates');
});

test('현재 계정 자신은 전환 후보에서 제외된다', () => {
  const result = evaluateSwitchDecision({
    currentAccountId: 'a1',
    currentQuotaReading: { tokens_used_pct: 95, requests_used_pct: null },
    allAccounts: [account('a1')],
    quotaByAccountId: {},
    policy: POLICY_BEST,
  });
  assert.equal(result.shouldSwitch, false);
  assert.equal(result.reason, 'no_candidates');
});

test('shouldSwitch=true일 때 reason은 rotation-event.js의 REASONS 화이트리스트에 실제로 포함된 값이다(호환성 회귀 테스트)', () => {
  const result = evaluateSwitchDecision({
    currentAccountId: 'a1',
    currentQuotaReading: { tokens_used_pct: 95, requests_used_pct: null },
    allAccounts: [account('a1'), account('a2')],
    policy: POLICY_BEST,
  });
  assert.equal(result.shouldSwitch, true);
  assert.ok(REASONS.includes(result.reason), `reason "${result.reason}"이 REASONS(${REASONS.join(', ')})에 없음`);
});
