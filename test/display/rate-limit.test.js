'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { renderRateLimit, formatFiveHourReset, formatSevenDayReset } = require('../../src/display/widgets/rate-limit');

const FIXED_NOW = new Date('2026-07-05T04:19:00Z').getTime(); // 임의 고정 시각(테스트 결정성 확보)

test('formatFiveHourReset: 1시간 41분 뒤 재설정이면 "1:41"을 반환한다', () => {
  const resetsAt = Math.floor(FIXED_NOW / 1000) + 1 * 3600 + 41 * 60;
  assert.equal(formatFiveHourReset(resetsAt, FIXED_NOW), '1:41');
});

test('formatFiveHourReset: 분이 한 자리면 0을 채운다(예: 5분 뒤 -> "0:05")', () => {
  const resetsAt = Math.floor(FIXED_NOW / 1000) + 5 * 60;
  assert.equal(formatFiveHourReset(resetsAt, FIXED_NOW), '0:05');
});

test('formatFiveHourReset: resets_at이 없으면(undefined) null을 반환한다', () => {
  assert.equal(formatFiveHourReset(undefined, FIXED_NOW), null);
});

test('formatFiveHourReset: resets_at이 숫자가 아니면 null을 반환한다', () => {
  assert.equal(formatFiveHourReset('not-a-number', FIXED_NOW), null);
  assert.equal(formatFiveHourReset(null, FIXED_NOW), null);
  assert.equal(formatFiveHourReset(NaN, FIXED_NOW), null);
});

test('formatFiveHourReset: 이미 지난 시각이면(데이터 오차 등) null을 반환한다(음수 시간 방지)', () => {
  const pastResetsAt = Math.floor(FIXED_NOW / 1000) - 60;
  assert.equal(formatFiveHourReset(pastResetsAt, FIXED_NOW), null);
});

test('formatSevenDayReset: 요일+시각 형식("일06:00")으로 반환한다', () => {
  // FIXED_NOW = 2026-07-05(일요일) 기준, 다음 일요일 06:00 UTC를 목표로 계산
  const target = new Date(FIXED_NOW);
  target.setUTCDate(target.getUTCDate() + 7);
  target.setUTCHours(6, 0, 0, 0);
  const resetsAt = Math.floor(target.getTime() / 1000);
  const result = formatSevenDayReset(resetsAt, FIXED_NOW);
  assert.match(result, /^[일월화수목금토]\d{2}:\d{2}$/);
});

test('formatSevenDayReset: resets_at이 없으면 null을 반환한다', () => {
  assert.equal(formatSevenDayReset(undefined, FIXED_NOW), null);
});

test('renderRateLimit: 70% 미만(안전 구간)이어도 재설정 시간을 함께 표시한다', () => {
  const resetsAt = Math.floor(FIXED_NOW / 1000) + 3600;
  const out = renderRateLimit(
    { rate_limits: { five_hour: { used_percentage: 50, resets_at: resetsAt } } },
    FIXED_NOW
  );
  assert.match(out, /5시간.*50%·1:00/);
});

test('renderRateLimit: 70% 이상이면 재설정 시간을 함께 표시한다', () => {
  const resetsAt = Math.floor(FIXED_NOW / 1000) + 3600 + 41 * 60;
  const out = renderRateLimit(
    { rate_limits: { five_hour: { used_percentage: 78, resets_at: resetsAt } } },
    FIXED_NOW
  );
  assert.match(out, /5시간.*78%·1:41/);
});

test('renderRateLimit: 70% 이상이어도 resets_at이 없으면(구버전 데이터 등) 재설정 시간 없이 안전하게 표시된다', () => {
  const out = renderRateLimit({ rate_limits: { five_hour: { used_percentage: 78 } } }, FIXED_NOW);
  assert.match(out, /5시간.*78%/);
  assert.doesNotMatch(out, /·/);
});

test('renderRateLimit: 음수 사용률은 "-10%"처럼 그대로 노출되지 않고 0%로 고정된다(경계값 테스트로 발견한 결함)', () => {
  const out = renderRateLimit({ rate_limits: { five_hour: { used_percentage: -10 } } }, FIXED_NOW);
  assert.match(out, /5시간.*0%/);
  assert.doesNotMatch(out, /-\d/);
});

test('renderRateLimit: 100 초과 사용률은 "150%"처럼 그대로 노출되지 않고 100%로 고정된다(경계값 테스트로 발견한 결함)', () => {
  const out = renderRateLimit({ rate_limits: { seven_day: { used_percentage: 150 } } }, FIXED_NOW);
  assert.match(out, /7일.*100%/);
  assert.doesNotMatch(out, /150/);
});

test('renderRateLimit: five_hour/seven_day 둘 다 위험 구간이면 각자의 재설정 시간을 함께 표시한다', () => {
  const fiveHourResetsAt = Math.floor(FIXED_NOW / 1000) + 3600 + 41 * 60;
  const sevenDayTarget = new Date(FIXED_NOW);
  sevenDayTarget.setUTCDate(sevenDayTarget.getUTCDate() + 7);
  sevenDayTarget.setUTCHours(6, 0, 0, 0);
  const sevenDayResetsAt = Math.floor(sevenDayTarget.getTime() / 1000);

  const out = renderRateLimit(
    {
      rate_limits: {
        five_hour: { used_percentage: 78, resets_at: fiveHourResetsAt },
        seven_day: { used_percentage: 71, resets_at: sevenDayResetsAt },
      },
    },
    FIXED_NOW
  );
  assert.match(out, /5시간.*78%·1:41/);
  assert.match(out, /7일.*71%·[일월화수목금토]\d{2}:\d{2}/);
});
