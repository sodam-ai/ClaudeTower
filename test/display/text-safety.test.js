'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { truncateForDisplay, stripControlChars, MAX_DISPLAY_LENGTH } = require('../../src/display/config/text-safety');

test('정상 길이 문자열은 그대로 반환한다', () => {
  assert.equal(truncateForDisplay('my-project'), 'my-project');
});

test('상한을 넘으면 말줄임표를 붙여 자른다(기존 동작 유지)', () => {
  const long = 'X'.repeat(120);
  const out = truncateForDisplay(long);
  assert.equal(out.length, MAX_DISPLAY_LENGTH);
  assert.ok(out.endsWith('…'));
});

test('ESC(0x1b) 등 C0 제어문자를 제거한다(터미널 이스케이프 주입 방지, 2026-07-17 실측 발견)', () => {
  const esc = String.fromCharCode(0x1b);
  const malicious = `Sonnet${esc}[31mFAKE-RED${esc}[0m`;
  const out = truncateForDisplay(malicious);
  assert.equal(out.includes(esc), false);
  assert.equal(out, 'Sonnet[31mFAKE-RED[0m');
});

test('개행·탭 등 다른 C0 제어문자도 제거한다', () => {
  const out = stripControlChars('line1\nline2\ttabbed\rreturn');
  assert.equal(out, 'line1line2tabbedreturn');
});

test('DEL(0x7F)도 제거한다', () => {
  const del = String.fromCharCode(0x7f);
  assert.equal(stripControlChars(`before${del}after`), 'beforeafter');
});

test('한글·이모지 등 일반 유니코드 문자는 전혀 건드리지 않는다', () => {
  assert.equal(stripControlChars('내-프로젝트 📁'), '내-프로젝트 📁');
});

test('제어문자 제거 후에도 길이 상한이 적용된다(결합 시나리오)', () => {
  const esc = String.fromCharCode(0x1b);
  const malicious = esc + '[31m' + 'X'.repeat(120) + esc + '[0m';
  const out = truncateForDisplay(malicious);
  assert.equal(out.includes(esc), false);
  assert.equal(out.length, MAX_DISPLAY_LENGTH);
});
