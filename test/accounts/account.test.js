'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createAccount } = require('../../src/accounts/accounts/account');

const VALID = {
  accountId: 'acc-001',
  label: '업무용',
  authType: 'oauth',
  status: 'active',
  createdAt: '2026-07-04T10:00:00Z',
};

test('createAccount: 필수 필드만으로 정상 생성되고 선택 필드는 null 기본값', () => {
  const account = createAccount(VALID);
  assert.equal(account.account_id, 'acc-001');
  assert.equal(account.label, '업무용');
  assert.equal(account.auth_type, 'oauth');
  assert.equal(account.status, 'active');
  assert.equal(account.last_project_path, null);
  assert.equal(account.last_used_at, null);
});

test('createAccount: authType이 oauth/api_key가 아니면 거부한다', () => {
  assert.throws(() => createAccount({ ...VALID, authType: 'password' }), TypeError);
});

test('createAccount: status가 active/cooldown/disabled가 아니면 거부한다', () => {
  assert.throws(() => createAccount({ ...VALID, status: 'unknown' }), TypeError);
});

test('createAccount: accountId/label이 빈 문자열이면 거부한다', () => {
  assert.throws(() => createAccount({ ...VALID, accountId: '' }), TypeError);
  assert.throws(() => createAccount({ ...VALID, label: '' }), TypeError);
});

test('createAccount: lastProjectPath/lastUsedAt를 명시하면 그대로 반영된다', () => {
  const account = createAccount({
    ...VALID,
    lastProjectPath: 'D:/AI_Dev_Work/my-project',
    lastUsedAt: '2026-07-04T15:00:00Z',
  });
  assert.equal(account.last_project_path, 'D:/AI_Dev_Work/my-project');
  assert.equal(account.last_used_at, '2026-07-04T15:00:00Z');
});
