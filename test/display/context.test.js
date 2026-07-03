'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { renderContext } = require('../../src/display/widgets/context');

test('정상 값이면 반올림된 퍼센트와 게이지바를 표시한다', () => {
  const out = renderContext({ context_window: { used_percentage: 45.3 } });
  assert.match(out, /컨텍스트.*45%/);
});

test('used_percentage가 null이면(세션 초반) 위젯 자체를 숨긴다', () => {
  assert.equal(renderContext({ context_window: { used_percentage: null } }), null);
});

test('used_percentage가 없으면(필드 자체 누락) 위젯 자체를 숨긴다', () => {
  assert.equal(renderContext({}), null);
  assert.equal(renderContext(undefined), null);
});

test('NaN/Infinity/-Infinity는 위젯 자체를 숨긴다(크래시 없음)', () => {
  assert.doesNotThrow(() => renderContext({ context_window: { used_percentage: NaN } }));
  assert.equal(renderContext({ context_window: { used_percentage: NaN } }), null);
  assert.equal(renderContext({ context_window: { used_percentage: Infinity } }), null);
  assert.equal(renderContext({ context_window: { used_percentage: -Infinity } }), null);
});

test('used_percentage가 숫자가 아니면(문자열 등) 위젯 자체를 숨긴다', () => {
  assert.equal(renderContext({ context_window: { used_percentage: '50' } }), null);
});

test('음수 값은 "-10%"처럼 그대로 노출되지 않고 0%로 고정된다(경계값 테스트로 발견한 결함)', () => {
  const out = renderContext({ context_window: { used_percentage: -10 } });
  assert.match(out, /컨텍스트.*0%/);
  assert.doesNotMatch(out, /-\d/);
});

test('100 초과 값은 "150%"처럼 그대로 노출되지 않고 100%로 고정된다(경계값 테스트로 발견한 결함)', () => {
  const out = renderContext({ context_window: { used_percentage: 150 } });
  assert.match(out, /컨텍스트.*100%/);
  assert.doesNotMatch(out, /150/);
});

test('0%는 정상적으로 0%로 표시된다(클램핑이 유효한 0을 지워버리지 않음)', () => {
  const out = renderContext({ context_window: { used_percentage: 0 } });
  assert.match(out, /컨텍스트.*0%/);
});
