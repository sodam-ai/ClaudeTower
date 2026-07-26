'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  renderGauge,
  resolveGaugeWidth,
  BAR_WIDTH,
  WIDE_BAR_WIDTH,
  WIDE_TERMINAL_COLUMNS,
  FILLED,
  EMPTY,
} = require('../../src/display/config/gauge');

test('0%는 전부 빈 칸, 100%는 전부 채워진 칸이다', () => {
  assert.equal(renderGauge(0), EMPTY.repeat(BAR_WIDTH));
  assert.equal(renderGauge(100), FILLED.repeat(BAR_WIDTH));
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
  assert.equal(renderGauge(NaN), EMPTY.repeat(BAR_WIDTH));
});

test('채워진 칸 수는 항상 반올림 공식(value/100*width)과 일치한다', () => {
  // BAR_WIDTH가 홀수면 50%가 정확히 절반으로 안 나뉜다(예: 5칸의 50% -> round(2.5) = 3칸).
  // "절반"을 하드코딩하는 대신 구현과 동일한 공식으로 기대값을 계산해 폭 변경에 안전하게 한다.
  for (const v of [0, 10, 25, 50, 75, 90, 100]) {
    const bar = renderGauge(v);
    const filledCount = (bar.match(new RegExp(FILLED, 'g')) || []).length;
    assert.equal(filledCount, Math.round((v / 100) * BAR_WIDTH));
  }
});

test('resolveGaugeWidth: COLUMNS가 없거나 파싱 불가하면 기존 고정폭(BAR_WIDTH)을 반환한다', () => {
  assert.equal(resolveGaugeWidth(undefined), BAR_WIDTH);
  assert.equal(resolveGaugeWidth(''), BAR_WIDTH);
  assert.equal(resolveGaugeWidth('not-a-number'), BAR_WIDTH);
});

test('resolveGaugeWidth: 문턱값(WIDE_TERMINAL_COLUMNS) 미만이면 기존 고정폭을 반환한다', () => {
  assert.equal(resolveGaugeWidth(String(WIDE_TERMINAL_COLUMNS - 1)), BAR_WIDTH);
  assert.equal(resolveGaugeWidth('80'), BAR_WIDTH);
});

test('resolveGaugeWidth: 문턱값 이상이면 넓은 폭(WIDE_BAR_WIDTH)을 반환한다', () => {
  assert.equal(resolveGaugeWidth(String(WIDE_TERMINAL_COLUMNS)), WIDE_BAR_WIDTH);
  assert.equal(resolveGaugeWidth('200'), WIDE_BAR_WIDTH);
});

test('resolveGaugeWidth: 음수·0은 절대 BAR_WIDTH보다 좁은 값을 만들지 않는다', () => {
  assert.equal(resolveGaugeWidth('-100'), BAR_WIDTH);
  assert.equal(resolveGaugeWidth('0'), BAR_WIDTH);
});

test('renderGauge + resolveGaugeWidth: 넓은 터미널에서 게이지가 실제로 더 길어진다(90~100% 구분력 개선 확인)', () => {
  const narrowWidth = resolveGaugeWidth('80');
  const wideWidth = resolveGaugeWidth('200');
  assert.equal(renderGauge(95, narrowWidth).length, BAR_WIDTH);
  assert.equal(renderGauge(95, wideWidth).length, WIDE_BAR_WIDTH);
  assert.ok(wideWidth > narrowWidth, '넓은 터미널의 게이지 폭이 좁은 터미널보다 커야 한다');
});
