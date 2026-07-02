'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { renderGauge, BAR_WIDTH } = require('../../src/display/config/gauge');

test('0%는 전부 빈 칸, 100%는 전부 채워진 칸이다', () => {
  assert.equal(renderGauge(0), '▱'.repeat(BAR_WIDTH));
  assert.equal(renderGauge(100), '▰'.repeat(BAR_WIDTH));
});

test('막대 길이는 값과 무관하게 항상 고정 폭이다', () => {
  for (const v of [0, 1, 50, 99, 100, -10, 150]) {
    assert.equal(renderGauge(v).length, BAR_WIDTH);
  }
});

test('음수는 0%로, 100 초과는 100%로 클램핑된다(칸 수 계산이 안 깨짐)', () => {
  assert.equal(renderGauge(-50), renderGauge(0));
  assert.equal(renderGauge(200), renderGauge(100));
});

test('NaN/Infinity/-Infinity는 크래시 없이 빈 막대를 반환한다', () => {
  assert.doesNotThrow(() => renderGauge(NaN));
  assert.doesNotThrow(() => renderGauge(Infinity));
  assert.doesNotThrow(() => renderGauge(-Infinity));
  assert.equal(renderGauge(NaN), '▱'.repeat(BAR_WIDTH));
});

test('채워진 칸 수는 항상 반올림 공식(value/100*width)과 일치한다', () => {
  // BAR_WIDTH가 홀수면 50%가 정확히 절반으로 안 나뉜다(예: 5칸의 50% -> round(2.5) = 3칸).
  // "절반"을 하드코딩하는 대신 구현과 동일한 공식으로 기대값을 계산해 폭 변경에 안전하게 한다.
  for (const v of [0, 10, 25, 50, 75, 90, 100]) {
    const bar = renderGauge(v);
    const filledCount = (bar.match(/▰/g) || []).length;
    assert.equal(filledCount, Math.round((v / 100) * BAR_WIDTH));
  }
});
