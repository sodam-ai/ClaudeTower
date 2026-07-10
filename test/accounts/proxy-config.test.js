'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createProxyConfig, FIXED_BIND_ADDRESS } = require('../../src/accounts/proxy/proxy-config');

const VALID = {
  port: 41411,
  thresholdPct: 98,
  upstreamUrl: 'https://api.anthropic.com',
  accessToken: 'runtime-only-token',
  reevalIntervalMs: 300000,
  portRetryMax: 10,
};

test('createProxyConfig: 정상 값이면 bind_address가 자동으로 127.0.0.1로 채워진다', () => {
  const config = createProxyConfig(VALID);
  assert.equal(config.bind_address, '127.0.0.1');
  assert.equal(config.bind_address, FIXED_BIND_ADDRESS);
});

test('createProxyConfig: 0.0.0.0 등 다른 bindAddress를 명시하면 거부한다(DO NOT 규칙 구조적 강제)', () => {
  assert.throws(() => createProxyConfig({ ...VALID, bindAddress: '0.0.0.0' }), TypeError);
  assert.throws(() => createProxyConfig({ ...VALID, bindAddress: 'localhost' }), TypeError);
});

test('createProxyConfig: port가 범위를 벗어나거나 정수가 아니면 거부한다', () => {
  assert.throws(() => createProxyConfig({ ...VALID, port: 0 }), TypeError);
  assert.throws(() => createProxyConfig({ ...VALID, port: 70000 }), TypeError);
  assert.throws(() => createProxyConfig({ ...VALID, port: 8080.5 }), TypeError);
});

test('createProxyConfig: upstreamUrl이 https가 아니면 거부한다', () => {
  assert.throws(() => createProxyConfig({ ...VALID, upstreamUrl: 'http://api.anthropic.com' }), TypeError);
});

test('createProxyConfig: reevalIntervalMs=0(비활성)은 허용한다', () => {
  assert.doesNotThrow(() => createProxyConfig({ ...VALID, reevalIntervalMs: 0 }));
});

test('createProxyConfig: portRetryMax가 1 미만이면 거부한다', () => {
  assert.throws(() => createProxyConfig({ ...VALID, portRetryMax: 0 }), TypeError);
});
