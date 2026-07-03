'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { runWidgetsCommand } = require('../../src/display/widgets-command');
const { writeEnabledWidgets, readEnabledWidgets, ALL_WIDGET_TYPES } = require('../../src/display/config/widget-config');

function tempWidgetConfigPath() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'claudetower-widgets-cmd-test-'));
  return path.join(dir, 'config.json');
}

test('widgets off: 지정한 항목만 끄고 나머지는 그대로 둔다', () => {
  const widgetConfigPath = tempWidgetConfigPath();
  writeEnabledWidgets(ALL_WIDGET_TYPES, widgetConfigPath);

  const result = runWidgetsCommand(['off', 'context', 'cost'], { widgetConfigPath });

  assert.equal(result.applied, true);
  assert.deepEqual(readEnabledWidgets(widgetConfigPath), ['model', 'location', 'rate_limit']);
});

test('widgets on: 꺼져 있던 항목만 다시 켠다(이미 켜진 항목은 중복 없이 유지)', () => {
  const widgetConfigPath = tempWidgetConfigPath();
  writeEnabledWidgets(['model', 'location'], widgetConfigPath);

  const result = runWidgetsCommand(['on', 'cost'], { widgetConfigPath });

  assert.equal(result.applied, true);
  assert.deepEqual(readEnabledWidgets(widgetConfigPath), ['model', 'location', 'cost']);
});

test('widgets off: 알 수 없는 항목 이름은 거부하고 설정 파일을 건드리지 않는다', () => {
  const widgetConfigPath = tempWidgetConfigPath();
  writeEnabledWidgets(ALL_WIDGET_TYPES, widgetConfigPath);

  const result = runWidgetsCommand(['off', 'weather'], { widgetConfigPath });

  assert.equal(result.applied, false);
  assert.deepEqual(readEnabledWidgets(widgetConfigPath), ALL_WIDGET_TYPES);
});

test('widgets off: 전부 끄려는 시도는 거부한다(최소 1개 유지)', () => {
  const widgetConfigPath = tempWidgetConfigPath();
  writeEnabledWidgets(ALL_WIDGET_TYPES, widgetConfigPath);

  const result = runWidgetsCommand(['off', ...ALL_WIDGET_TYPES], { widgetConfigPath });

  assert.equal(result.applied, false);
  assert.deepEqual(readEnabledWidgets(widgetConfigPath), ALL_WIDGET_TYPES);
});

test('widgets(인자 없음): 켜고 끄지 않고 지금 상태만 보여준다', () => {
  const widgetConfigPath = tempWidgetConfigPath();
  writeEnabledWidgets(['model', 'cost'], widgetConfigPath);

  const result = runWidgetsCommand([], { widgetConfigPath });

  assert.deepEqual(result.enabled, ['model', 'cost']);
  // 상태 조회는 파일을 바꾸지 않는다.
  assert.deepEqual(readEnabledWidgets(widgetConfigPath), ['model', 'cost']);
});

test('widgets off: 이미 꺼진 항목을 또 꺼도 에러 없이 멱등하게 처리한다', () => {
  const widgetConfigPath = tempWidgetConfigPath();
  writeEnabledWidgets(['model', 'location'], widgetConfigPath);

  const result = runWidgetsCommand(['off', 'cost'], { widgetConfigPath });

  assert.equal(result.applied, true);
  assert.deepEqual(readEnabledWidgets(widgetConfigPath), ['model', 'location']);
});

test('widgets off/on: 항목 이름을 하나도 안 주면 "성공"으로 위장하지 않고 명확히 거부한다', () => {
  const widgetConfigPath = tempWidgetConfigPath();
  writeEnabledWidgets(ALL_WIDGET_TYPES, widgetConfigPath);

  const offResult = runWidgetsCommand(['off'], { widgetConfigPath });
  assert.equal(offResult.applied, false);
  assert.deepEqual(readEnabledWidgets(widgetConfigPath), ALL_WIDGET_TYPES);

  const onResult = runWidgetsCommand(['on'], { widgetConfigPath });
  assert.equal(onResult.applied, false);
  assert.deepEqual(readEnabledWidgets(widgetConfigPath), ALL_WIDGET_TYPES);
});

test('widgets off: 유효한 항목과 잘못된 항목이 섞이면 유효한 항목도 적용하지 않고 전체를 거부한다', () => {
  const widgetConfigPath = tempWidgetConfigPath();
  writeEnabledWidgets(ALL_WIDGET_TYPES, widgetConfigPath);

  const result = runWidgetsCommand(['off', 'cost', 'bogus'], { widgetConfigPath });

  assert.equal(result.applied, false);
  // cost도 함께 거부돼야 한다(부분 적용 금지) — 실제 유효한 항목까지 같이 꺼지면 안 됨.
  assert.deepEqual(readEnabledWidgets(widgetConfigPath), ALL_WIDGET_TYPES);
});
