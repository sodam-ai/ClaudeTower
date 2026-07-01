'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { render } = require('../../src/display/statusline');

test('모든 필드가 있을 때 4개 위젯이 모두 렌더링된다', () => {
  const out = render({
    workspace: { current_dir: '/home/user/my-project' },
    context_window: { used_percentage: 50 },
    cost: { total_cost_usd: 1.5 },
    rate_limits: { five_hour: { used_percentage: 30 }, seven_day: { used_percentage: 20 } },
  });
  assert.match(out, /my-project/);
  assert.match(out, /50%/);
  assert.match(out, /\$1\.50/);
  assert.match(out, /5h 30%/);
  assert.match(out, /7d 20%/);
});

test('빈 세션(필드 전무)이면 빈 문자열을 반환한다', () => {
  assert.equal(render({}), '');
});

test('context_window.used_percentage가 null이면 context 위젯이 숨겨진다', () => {
  const out = render({
    workspace: { current_dir: '/x' },
    context_window: { used_percentage: null },
  });
  assert.match(out, /x/);
  assert.doesNotMatch(out, /%/);
});

test('rate_limits가 통째로 없으면 rate-limit 위젯이 숨겨진다(Free 플랜 등)', () => {
  const out = render({ workspace: { current_dir: '/x' } });
  assert.doesNotMatch(out, /⏱/);
});

test('rate_limits.seven_day만 없으면 five_hour만 표시된다', () => {
  const out = render({ rate_limits: { five_hour: { used_percentage: 10 } } });
  assert.match(out, /5h 10%/);
  assert.doesNotMatch(out, /7d/);
});

test('context 70% 이상이면 경고색, 90% 이상이면 위험색이 적용된다', () => {
  const warn = render({ context_window: { used_percentage: 75 } });
  const critical = render({ context_window: { used_percentage: 95 } });
  const safe = render({ context_window: { used_percentage: 10 } });
  assert.match(warn, /\x1b\[33m/);
  assert.match(critical, /\x1b\[31m/);
  assert.doesNotMatch(safe, /\x1b\[/);
});

test('위젯 하나가 예외를 던져도 나머지 위젯은 정상 렌더링된다(위젯 단위 격리)', () => {
  const { WIDGETS } = require('../../src/display/statusline');
  const originalFirst = WIDGETS[0];
  WIDGETS[0] = () => {
    throw new Error('강제 위젯 오류');
  };
  try {
    const out = render({ cost: { total_cost_usd: 2 } });
    assert.match(out, /\$2\.00/);
  } finally {
    WIDGETS[0] = originalFirst;
  }
});

test('잘못된 타입 값(문자열)이 들어와도 크래시하지 않는다', () => {
  assert.doesNotThrow(() => {
    render({ context_window: { used_percentage: 'not-a-number' }, cost: { total_cost_usd: 'free' } });
  });
});
