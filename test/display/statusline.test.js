'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { render } = require('../../src/display/statusline');
const { ALL_WIDGET_TYPES } = require('../../src/display/config/widget-config');

// render()의 두 번째 인자(enabledWidgets)를 항상 명시한다. 생략하면 실제 사용자 홈의
// ~/.claudetower/config.json(또는 CLAUDETOWER_WIDGET_CONFIG_PATH)을 읽어버려, 이 머신에서
// claudetower setup을 실행한 적이 있으면 그 결과에 테스트 성패가 좌우되는 결함이 있었다
// (실사용 테스트로 생성된 실제 설정 파일 내용에 따라 6개 테스트가 재현 가능하게 깨짐 — 발견 후 수정).

test('모든 필드가 있을 때 4개 위젯이 모두 렌더링된다', () => {
  const out = render(
    {
      workspace: { current_dir: '/home/user/my-project' },
      context_window: { used_percentage: 50 },
      cost: { total_cost_usd: 1.5 },
      rate_limits: { five_hour: { used_percentage: 30 }, seven_day: { used_percentage: 20 } },
    },
    ALL_WIDGET_TYPES
  );
  assert.match(out, /my-project/);
  assert.match(out, /컨텍스트/);
  assert.match(out, /50%/);
  assert.match(out, /\$1\.50/);
  assert.match(out, /5시간.*30%/);
  assert.match(out, /7일.*20%/);
});

test('빈 세션(필드 전무)이면 빈 문자열을 반환한다', () => {
  assert.equal(render({}, ALL_WIDGET_TYPES), '');
});

test('context_window.used_percentage가 null이면 context 위젯이 숨겨진다', () => {
  const out = render(
    {
      workspace: { current_dir: '/x' },
      context_window: { used_percentage: null },
    },
    ALL_WIDGET_TYPES
  );
  assert.match(out, /x/);
  assert.doesNotMatch(out, /%/);
});

test('rate_limits가 통째로 없으면 rate-limit 위젯이 숨겨진다(Free 플랜 등)', () => {
  const out = render({ workspace: { current_dir: '/x' } }, ALL_WIDGET_TYPES);
  assert.doesNotMatch(out, /시간/);
  assert.doesNotMatch(out, /일 /);
});

test('rate_limits.seven_day만 없으면 five_hour만 표시된다', () => {
  const out = render({ rate_limits: { five_hour: { used_percentage: 10 } } }, ALL_WIDGET_TYPES);
  assert.match(out, /5시간.*10%/);
  assert.doesNotMatch(out, /7일/);
});

test('context 70% 이상이면 경고색, 90% 이상이면 위험색이 적용된다', () => {
  const warn = render({ context_window: { used_percentage: 75 } }, ALL_WIDGET_TYPES);
  const critical = render({ context_window: { used_percentage: 95 } }, ALL_WIDGET_TYPES);
  const safe = render({ context_window: { used_percentage: 10 } }, ALL_WIDGET_TYPES);
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
    const out = render({ cost: { total_cost_usd: 2 } }, ALL_WIDGET_TYPES);
    assert.match(out, /\$2\.00/);
  } finally {
    WIDGETS[0] = originalFirst;
  }
});

test('잘못된 타입 값(문자열)이 들어와도 크래시하지 않는다', () => {
  assert.doesNotThrow(() => {
    render(
      { context_window: { used_percentage: 'not-a-number' }, cost: { total_cost_usd: 'free' } },
      ALL_WIDGET_TYPES
    );
  });
});

// 아래는 경계값 테스트로 실제 발견해 수정한 결함들의 회귀 테스트.

test('경계값: context 정확히 70/90에서 각각 경고색/위험색, 69/89는 무색', () => {
  assert.doesNotMatch(render({ context_window: { used_percentage: 69 } }, ALL_WIDGET_TYPES), /\x1b\[/);
  assert.match(render({ context_window: { used_percentage: 70 } }, ALL_WIDGET_TYPES), /\x1b\[33m/);
  assert.doesNotMatch(render({ context_window: { used_percentage: 89 } }, ALL_WIDGET_TYPES), /\x1b\[31m/);
  assert.match(render({ context_window: { used_percentage: 90 } }, ALL_WIDGET_TYPES), /\x1b\[31m/);
});

test('위치 위젯: 앞뒤 공백이 포함된 경로는 트리밍 후 표시된다(공백이 출력에 남지 않음)', () => {
  const out = render({ workspace: { current_dir: '   /spaced/path   ' } }, ALL_WIDGET_TYPES);
  assert.match(out, /📁 path$/);
});

test('Infinity/-Infinity 값은 위젯이 숨겨진다(NaN처럼 걸러짐, "Infinity%" 같은 깨진 출력 방지)', () => {
  const out = render(
    {
      context_window: { used_percentage: Infinity },
      cost: { total_cost_usd: -Infinity },
      rate_limits: { five_hour: { used_percentage: Infinity }, seven_day: { used_percentage: 50 } },
    },
    ALL_WIDGET_TYPES
  );
  assert.doesNotMatch(out, /Infinity/);
  assert.match(out, /7일.*50%/); // 유효한 값은 정상 표시
});

test('enabledWidgets에서 제외된 위젯은 유효한 값이 있어도 렌더링되지 않는다(설정 필터링 확인)', () => {
  const out = render(
    {
      workspace: { current_dir: '/x' },
      context_window: { used_percentage: 50 },
    },
    ['location']
  );
  assert.match(out, /x/);
  assert.doesNotMatch(out, /50%/);
});
