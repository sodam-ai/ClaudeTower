'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const {
  DEFAULTS,
  readSwitchPolicy,
  writeSwitchPolicyField,
} = require('../../src/accounts/switch-policy-config');

function tmpPath() {
  return path.join(os.tmpdir(), `claudetower-switch-policy-test-${Date.now()}-${Math.random().toString(36).slice(2)}.json`);
}

test('readSwitchPolicy: 파일이 없으면 기본값을 반환한다', () => {
  const filePath = tmpPath();
  const policy = readSwitchPolicy(filePath);
  assert.deepEqual(policy, DEFAULTS);
});

test('writeSwitchPolicyField: 유효한 threshold_pct를 저장하고 다시 읽으면 그대로 나온다', () => {
  const filePath = tmpPath();
  writeSwitchPolicyField('threshold_pct', '85', filePath);
  const policy = readSwitchPolicy(filePath);
  assert.equal(policy.threshold_pct, 85);
  fs.unlinkSync(filePath);
});

test('writeSwitchPolicyField: threshold_pct가 50 미만이면 거부한다', () => {
  const filePath = tmpPath();
  assert.throws(() => writeSwitchPolicyField('threshold_pct', '10', filePath), /50~100/);
});

test('writeSwitchPolicyField: port가 1024 미만이면 거부한다', () => {
  const filePath = tmpPath();
  assert.throws(() => writeSwitchPolicyField('port', '80', filePath), /1024~65535/);
});

test('writeSwitchPolicyField: port가 65535 초과면 거부한다', () => {
  const filePath = tmpPath();
  assert.throws(() => writeSwitchPolicyField('port', '70000', filePath), /1024~65535/);
});

test('writeSwitchPolicyField: strategy가 best/next-available이 아니면 거부한다', () => {
  const filePath = tmpPath();
  assert.throws(() => writeSwitchPolicyField('strategy', 'round-robin', filePath), /best 또는 next-available/);
});

test('writeSwitchPolicyField: strategy=next-available은 정상 저장된다', () => {
  const filePath = tmpPath();
  writeSwitchPolicyField('strategy', 'next-available', filePath);
  assert.equal(readSwitchPolicy(filePath).strategy, 'next-available');
  fs.unlinkSync(filePath);
});

test('writeSwitchPolicyField: reeval_interval_ms=0(비활성화)은 허용된다', () => {
  const filePath = tmpPath();
  writeSwitchPolicyField('reeval_interval_ms', '0', filePath);
  assert.equal(readSwitchPolicy(filePath).reeval_interval_ms, 0);
  fs.unlinkSync(filePath);
});

test('writeSwitchPolicyField: reeval_interval_ms 음수는 거부한다', () => {
  const filePath = tmpPath();
  assert.throws(() => writeSwitchPolicyField('reeval_interval_ms', '-1', filePath), /0 이상/);
});

test('writeSwitchPolicyField: port_retry_max가 0이면 거부한다', () => {
  const filePath = tmpPath();
  assert.throws(() => writeSwitchPolicyField('port_retry_max', '0', filePath), /1 이상/);
});

test('writeSwitchPolicyField: 알 수 없는 키는 거부한다', () => {
  const filePath = tmpPath();
  assert.throws(() => writeSwitchPolicyField('access_token', 'x', filePath), /알 수 없는 설정 키/);
});

test('writeSwitchPolicyField: 한 필드를 바꿔도 나머지 필드는 유지된다(read-merge-write)', () => {
  const filePath = tmpPath();
  writeSwitchPolicyField('port', '50000', filePath);
  writeSwitchPolicyField('threshold_pct', '90', filePath);
  const policy = readSwitchPolicy(filePath);
  assert.equal(policy.port, 50000);
  assert.equal(policy.threshold_pct, 90);
  assert.equal(policy.strategy, DEFAULTS.strategy);
  fs.unlinkSync(filePath);
});

test('writeSwitchPolicyField: 인자 없이(filePath undefined) 호출 시 다른 CLAUDETOWER_* 변수만 설정돼 있으면 부분격리로 거부한다', () => {
  const prevWidget = process.env.CLAUDETOWER_WIDGET_CONFIG_PATH;
  process.env.CLAUDETOWER_WIDGET_CONFIG_PATH = '/tmp/irrelevant.json';
  try {
    assert.throws(() => writeSwitchPolicyField('port', '50000', undefined), /테스트 격리 변수/);
  } finally {
    if (prevWidget === undefined) delete process.env.CLAUDETOWER_WIDGET_CONFIG_PATH;
    else process.env.CLAUDETOWER_WIDGET_CONFIG_PATH = prevWidget;
  }
});

test('switch-policy-config.js는 credential-store/oauth/proxy를 절대 require하지 않는다(정적 검사)', () => {
  const source = fs.readFileSync(
    path.join(__dirname, '..', '..', 'src', 'accounts', 'switch-policy-config.js'),
    'utf8'
  );
  assert.doesNotMatch(source, /require\(['"].*credential-store/);
  assert.doesNotMatch(source, /require\(['"].*oauth\//);
  assert.doesNotMatch(source, /require\(['"].*proxy\//);
  assert.doesNotMatch(source, /require\(['"]\.\.\/display/);
});
