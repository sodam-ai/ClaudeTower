'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { renderCost } = require('../../src/display/widgets/cost');

test('정상 값이면 소수점 둘째 자리까지 표시한다', () => {
  const out = renderCost({ cost: { total_cost_usd: 1.234 } });
  assert.match(out, /\$1\.23/);
});

test('total_cost_usd가 없으면(필드 자체 누락) 위젯 자체를 숨긴다', () => {
  assert.equal(renderCost({}), null);
  assert.equal(renderCost(undefined), null);
});

test('NaN/Infinity/-Infinity는 위젯 자체를 숨긴다(크래시 없음)', () => {
  assert.doesNotThrow(() => renderCost({ cost: { total_cost_usd: NaN } }));
  assert.equal(renderCost({ cost: { total_cost_usd: NaN } }), null);
  assert.equal(renderCost({ cost: { total_cost_usd: Infinity } }), null);
  assert.equal(renderCost({ cost: { total_cost_usd: -Infinity } }), null);
});

test('total_cost_usd가 숫자가 아니면(문자열 등) 위젯 자체를 숨긴다', () => {
  assert.equal(renderCost({ cost: { total_cost_usd: '1.5' } }), null);
});

test('음수 값은 "$-5.00"처럼 그대로 노출되지 않고 $0.00으로 고정된다(경계값 테스트로 발견한 결함, 2026-07-12)', () => {
  const out = renderCost({ cost: { total_cost_usd: -5 } });
  assert.match(out, /\$0\.00/);
  assert.doesNotMatch(out, /-\d/);
});

test('0은 정상적으로 $0.00으로 표시된다(클램핑이 유효한 0을 지워버리지 않음)', () => {
  const out = renderCost({ cost: { total_cost_usd: 0 } });
  assert.match(out, /\$0\.00/);
});
