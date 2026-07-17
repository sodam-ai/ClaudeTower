'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { render } = require('../../src/display/statusline');
const { ALL_WIDGET_TYPES } = require('../../src/display/config/widget-config');

// render()의 두 번째 인자(enabledWidgets)를 항상 명시한다. 생략하면 실제 사용자 홈의
// ~/.claudetower/config.json(또는 CLAUDETOWER_WIDGET_CONFIG_PATH)을 읽어버려, 이 머신에서
// claudetower setup을 실행한 적이 있으면 그 결과에 테스트 성패가 좌우되는 결함이 있었다
// (실사용 테스트로 생성된 실제 설정 파일 내용에 따라 6개 테스트가 재현 가능하게 깨짐 — 발견 후 수정).

test('모든 필드가 있을 때 5개 위젯이 모두 렌더링된다', () => {
  const out = render(
    {
      model: { display_name: 'Opus' },
      workspace: { current_dir: '/home/user/my-project' },
      context_window: { used_percentage: 50 },
      cost: { total_cost_usd: 1.5 },
      rate_limits: { five_hour: { used_percentage: 30 }, seven_day: { used_percentage: 20 } },
    },
    ALL_WIDGET_TYPES
  );
  assert.match(out, /Opus/);
  assert.match(out, /my-project/);
  assert.match(out, /컨텍스트/);
  assert.match(out, /50%/);
  assert.match(out, /\$1\.50/);
  assert.match(out, /5시간.*30%/);
  assert.match(out, /7일.*20%/);
});

test('model 필드가 없으면 model 위젯만 숨겨지고 나머지는 그대로 표시된다', () => {
  const out = render({ workspace: { current_dir: '/x' } }, ALL_WIDGET_TYPES);
  assert.doesNotMatch(out, /모델/);
  assert.match(out, /x/);
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

test('context 70% 이상이면 경고색, 90% 이상이면 위험색, 그 아래는 안전색(초록)이 적용된다', () => {
  // "게이지바가 평범하다"는 피드백으로 안전 구간도 항상 초록색을 입히도록 바뀌었다
  // (이전엔 안전 구간이 무색이었음).
  const warn = render({ context_window: { used_percentage: 75 } }, ALL_WIDGET_TYPES);
  const critical = render({ context_window: { used_percentage: 95 } }, ALL_WIDGET_TYPES);
  const safe = render({ context_window: { used_percentage: 10 } }, ALL_WIDGET_TYPES);
  assert.match(warn, /\x1b\[33m/);
  assert.match(critical, /\x1b\[31m/);
  assert.match(safe, /\x1b\[32m/);
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

test('경계값: context 정확히 70/90에서 각각 경고색/위험색, 69는 안전색(초록)/89는 경고색 유지', () => {
  // 89는 70(경고 임계값) 이상이라 경고색이 계속 적용된다 - "무색"이 "안전색"으로
  // 바뀐 건 70 미만 구간뿐이다(69에서 확인).
  assert.match(render({ context_window: { used_percentage: 69 } }, ALL_WIDGET_TYPES), /\x1b\[32m/);
  assert.match(render({ context_window: { used_percentage: 70 } }, ALL_WIDGET_TYPES), /\x1b\[33m/);
  assert.match(render({ context_window: { used_percentage: 89 } }, ALL_WIDGET_TYPES), /\x1b\[33m/);
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

test('부동소수점 오차로 생긴 긴 소수(예: 14.000000000000002)는 반올림돼 깔끔한 정수%로 표시된다', () => {
  // 실사용 중 "5시간 14.000000000000002%" 처럼 표시되는 결함이 보고됨 — Claude Code의
  // used_percentage가 부동소수점 계산 결과라 생기는 오차. 공식 예제 스크립트들도
  // 전부 반올림/절삭 후 표시한다(RESEARCH_SOURCES.md 375/397/415행 - cut -d. -f1,
  // int(), Math.floor() 등) - 우리도 동일하게 반올림해야 함을 뒷받침하는 근거.
  const out = render(
    {
      context_window: { used_percentage: 13.999999999999993 },
      rate_limits: {
        five_hour: { used_percentage: 14.000000000000002 },
        seven_day: { used_percentage: 10.000000000000002 },
      },
    },
    ALL_WIDGET_TYPES
  );
  assert.doesNotMatch(out, /\./); // 소수점 자체가 출력에 남아있으면 안 됨
  assert.match(out, /14%/);
  assert.match(out, /10%/);
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

// render()의 세 번째 인자(powerlineEnabled)도 위 enabledWidgets와 같은 이유로 항상
// 명시한다(2026-07-18 신설, 위 8~11행과 동일 원칙).

test('powerlineEnabled=false(기본값)면 위젯 사이 구분자가 공백 2칸이다', () => {
  const out = render(
    { model: { display_name: 'M' }, workspace: { current_dir: '/x' } },
    ['model', 'location'],
    false
  );
  assert.equal(out, 'M  📁 x');
});

test('powerlineEnabled=true면 위젯 사이 구분자가 Powerline 화살표로 바뀐다', () => {
  const out = render(
    { model: { display_name: 'M' }, workspace: { current_dir: '/x' } },
    ['model', 'location'],
    true
  );
  assert.notEqual(out, 'M  📁 x'); // 기본 구분자가 아님
  assert.match(out, /^M/);
  assert.match(out, /📁 x$/);
});
