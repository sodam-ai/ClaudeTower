'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { readRegistry, existingLabels, appendAccount } = require('../../src/accounts/accounts/accounts-registry');

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

test('accounts-registry.js는 credential-store/oauth/proxy를 절대 require하지 않는다(정적 검사)', () => {
  const source = fs.readFileSync(
    path.join(__dirname, '..', '..', 'src', 'accounts', 'accounts', 'accounts-registry.js'),
    'utf8'
  );
  assert.doesNotMatch(source, /require\(['"].*credential-store/);
  assert.doesNotMatch(source, /require\(['"].*oauth\//);
  assert.doesNotMatch(source, /require\(['"].*proxy\//);
});
