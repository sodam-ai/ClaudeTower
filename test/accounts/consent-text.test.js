'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { CONSENT_TEXT, CONSENT_TEXT_VERSION } = require('../../src/accounts/consent-text');

test('CONSENT_TEXT_VERSION: 하이브리드 개정판 버전 문자열', () => {
  assert.equal(CONSENT_TEXT_VERSION, 'v2-hybrid');
});

test('CONSENT_TEXT: 04_PROJECT_SPEC.md 요구사항 — 계정 정지 위험 문구를 반드시 포함', () => {
  assert.match(CONSENT_TEXT, /정지되거나 제한될 수 있으며/);
});

test('CONSENT_TEXT: Display 모듈은 영향 없다는 문구를 반드시 포함(오해 방지, 04_PROJECT_SPEC.md 신규 항목)', () => {
  assert.match(CONSENT_TEXT, /상태표시줄.*완전히 분리되어 있고/s);
});

test('CONSENT_TEXT: 하이브리드 리스크 차등(로그인 계정 vs API 키 계정)을 항목 2/2-1로 분리해 포함', () => {
  assert.match(CONSENT_TEXT, /2\. 로그인 계정\(구독, Free\/Pro\/Max\)을 등록하는 경우/);
  assert.match(CONSENT_TEXT, /2-1\. API 키 계정을 등록하는 경우/);
});

test('CONSENT_TEXT: "이용약관 위반 아님을 보장한다"류 안전 단정 문구가 없어야 한다(DO NOT 규칙)', () => {
  assert.doesNotMatch(CONSENT_TEXT, /보장합니다|안전합니다/);
});

test('CONSENT_TEXT: [y/N] 명시적 동의 프롬프트로 끝난다(동의 없이 진행 금지 원칙)', () => {
  assert.match(CONSENT_TEXT.trim(), /\[y\/N\]:$/);
});
