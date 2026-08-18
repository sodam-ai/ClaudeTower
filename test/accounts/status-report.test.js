'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { buildStatusReport, formatStatusReport } = require('../../src/accounts/status-report');
const { createModuleActivationState } = require('../../src/accounts/module-activation-state');

test('buildStatusReport: activationState를 안 넘기면 기본값(비활성화)을 반환한다', () => {
  const report = buildStatusReport();
  assert.equal(report.enabled, false);
  assert.equal(report.consentGivenAt, null);
  assert.equal(report.canEnable, true); // M36부터 enable 명령이 실재하므로 true
});

test('buildStatusReport: activationState를 주입하면 그 값을 그대로 반영한다', () => {
  const state = createModuleActivationState({
    enabled: true,
    consentGivenAt: '2026-08-17T00:00:00Z',
    consentTextVersion: 'v2-hybrid',
  });
  const report = buildStatusReport({ activationState: state });
  assert.equal(report.enabled, true);
  assert.equal(report.consentGivenAt, '2026-08-17T00:00:00Z');
  assert.equal(report.consentTextVersion, 'v2-hybrid');
});

test('buildStatusReport: 구현된 컴포넌트와 차단된 컴포넌트 목록을 둘 다 포함한다', () => {
  const report = buildStatusReport();
  assert.ok(report.implementedComponents.length >= 5);
  assert.ok(report.implementedComponents.some((c) => c.name.includes('credential-store')));
  assert.ok(report.blockedComponents.some((c) => c.name.includes('OAuth 로그인')));
});

test('formatStatusReport: 비활성화 상태일 때 "비활성화됨"과 enable 사용법 안내를 포함한다', () => {
  const text = formatStatusReport(buildStatusReport());
  assert.match(text, /비활성화됨/);
  assert.match(text, /accounts enable/);
});

test('formatStatusReport: 활성화 상태일 때는 동의 시각을 함께 보여준다', () => {
  const state = createModuleActivationState({ enabled: true, consentGivenAt: '2026-08-17T00:00:00Z' });
  const text = formatStatusReport(buildStatusReport({ activationState: state }));
  assert.match(text, /활성화됨/);
  assert.match(text, /2026-08-17T00:00:00Z/);
});

test('status-report.js는 credential-store/oauth/proxy를 절대 require하지 않는다(정적 검사)', () => {
  const source = fs.readFileSync(
    path.join(__dirname, '..', '..', 'src', 'accounts', 'status-report.js'),
    'utf8'
  );
  assert.doesNotMatch(source, /require\(['"].*credential-store/);
  assert.doesNotMatch(source, /require\(['"].*oauth\//);
  assert.doesNotMatch(source, /require\(['"].*proxy\//);
});
