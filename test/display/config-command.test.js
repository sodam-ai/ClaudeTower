'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { runConfigCommand } = require('../../src/display/config-command');

function tempSettingsPathWithStatusLine(initialRefreshInterval = 1) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'claudetower-config-cmd-test-'));
  const settingsPath = path.join(dir, 'settings.json');
  fs.writeFileSync(
    settingsPath,
    JSON.stringify({ statusLine: { type: 'command', command: 'x', refreshInterval: initialRefreshInterval } })
  );
  return settingsPath;
}

test('config statusline-refresh <n>: 유효한 정수면 refreshInterval을 반영한다', () => {
  const settingsPath = tempSettingsPathWithStatusLine(1);

  const result = runConfigCommand(['statusline-refresh', '5'], { settingsPath });

  assert.equal(result.applied, true);
  assert.equal(result.refreshInterval, 5);
  const written = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
  assert.equal(written.statusLine.refreshInterval, 5);
  assert.equal(written.statusLine.command, 'x'); // 다른 키는 그대로
});

test('config statusline-refresh <n>: 0 이하나 정수가 아니면 거부하고 파일을 건드리지 않는다', () => {
  const settingsPath = tempSettingsPathWithStatusLine(1);

  for (const bad of ['0', '-1', '2.5', 'abc', '']) {
    const result = runConfigCommand(['statusline-refresh', bad], { settingsPath });
    assert.equal(result.applied, false, `값 "${bad}"는 거부되어야 한다`);
  }
  const written = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
  assert.equal(written.statusLine.refreshInterval, 1); // 안 바뀜
});

test('config <알 수 없는 하위명령>: 사용법을 보여주고 아무것도 바꾸지 않는다', () => {
  const settingsPath = tempSettingsPathWithStatusLine(1);

  const result = runConfigCommand(['unknown-thing'], { settingsPath });

  assert.equal(result.applied, false);
  const written = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
  assert.equal(written.statusLine.refreshInterval, 1);
});

test('config statusline-refresh <n>: 아직 설치 전(statusLine 없음)이면 명확한 에러 메시지와 함께 거부한다', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'claudetower-config-cmd-test-'));
  const settingsPath = path.join(dir, 'settings.json'); // 파일 자체가 없음

  const logs = [];
  const result = runConfigCommand(['statusline-refresh', '5'], { settingsPath, log: (msg) => logs.push(msg) });

  assert.equal(result.applied, false);
  assert.ok(logs.some((l) => l.includes('claudetower가 설치되어 있지 않습니다')));
  assert.equal(fs.existsSync(settingsPath), false);
});

function tempWidgetConfigPath(initial) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'claudetower-config-cmd-test-'));
  const widgetConfigPath = path.join(dir, 'config.json');
  if (initial !== undefined) {
    fs.writeFileSync(widgetConfigPath, JSON.stringify(initial));
  }
  return widgetConfigPath;
}

test('config powerline on/off: 정상적으로 켜고 끈다', () => {
  const widgetConfigPath = tempWidgetConfigPath();

  const on = runConfigCommand(['powerline', 'on'], { widgetConfigPath });
  assert.equal(on.applied, true);
  assert.equal(JSON.parse(fs.readFileSync(widgetConfigPath, 'utf8')).powerline_separator, true);

  const off = runConfigCommand(['powerline', 'off'], { widgetConfigPath });
  assert.equal(off.applied, true);
  assert.equal(JSON.parse(fs.readFileSync(widgetConfigPath, 'utf8')).powerline_separator, false);
});

test('config powerline on: 기존 enabled_widgets 설정을 지우지 않는다(read-merge-write 회귀 방지)', () => {
  const widgetConfigPath = tempWidgetConfigPath({ enabled_widgets: ['model', 'cost'] });

  runConfigCommand(['powerline', 'on'], { widgetConfigPath });

  const written = JSON.parse(fs.readFileSync(widgetConfigPath, 'utf8'));
  assert.deepEqual(written.enabled_widgets, ['model', 'cost']);
  assert.equal(written.powerline_separator, true);
});

test('config powerline <on/off 아닌 값>: 사용법을 보여주고 거부한다', () => {
  const widgetConfigPath = tempWidgetConfigPath();
  const logs = [];

  const result = runConfigCommand(['powerline', 'maybe'], { widgetConfigPath, log: (msg) => logs.push(msg) });

  assert.equal(result.applied, false);
  assert.ok(logs.some((l) => l.includes('claudetower config powerline <on|off>')));
  assert.equal(fs.existsSync(widgetConfigPath), false);
});
