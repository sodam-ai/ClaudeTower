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
