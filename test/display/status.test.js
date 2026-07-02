'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { getInstallStatus } = require('../../src/display/config/status');

function tempPaths() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'claudetower-status-test-'));
  return {
    settingsPath: path.join(dir, 'settings.json'),
    widgetConfigPath: path.join(dir, 'config.json'),
  };
}

test('settings.json 자체가 없으면 installed=false, foreign=false', () => {
  const { settingsPath, widgetConfigPath } = tempPaths();
  const status = getInstallStatus({ settingsPath, widgetConfigPath });
  assert.equal(status.installed, false);
  assert.equal(status.foreign, false);
});

test('statusLine 키가 없으면 installed=false', () => {
  const { settingsPath, widgetConfigPath } = tempPaths();
  fs.writeFileSync(settingsPath, JSON.stringify({ hooks: {} }));
  const status = getInstallStatus({ settingsPath, widgetConfigPath });
  assert.equal(status.installed, false);
  assert.equal(status.foreign, false);
});

test('claudetower가 만든 command면 installed=true이고 enabledWidgets를 함께 반환한다', () => {
  const { settingsPath, widgetConfigPath } = tempPaths();
  fs.writeFileSync(
    settingsPath,
    JSON.stringify({ statusLine: { type: 'command', command: 'node bin/claudetower.js statusline', refreshInterval: 1 } })
  );
  fs.writeFileSync(widgetConfigPath, JSON.stringify({ enabled_widgets: ['model', 'location'] }));
  const status = getInstallStatus({ settingsPath, widgetConfigPath });
  assert.equal(status.installed, true);
  assert.equal(status.foreign, false);
  assert.deepEqual(status.enabledWidgets, ['model', 'location']);
  assert.equal(status.refreshInterval, 1);
});

test('claudetower가 만든 게 아닌 다른 statusLine이면 foreign=true로 구분한다', () => {
  const { settingsPath, widgetConfigPath } = tempPaths();
  fs.writeFileSync(
    settingsPath,
    JSON.stringify({ statusLine: { type: 'command', command: '~/my-custom-statusline.sh' } })
  );
  const status = getInstallStatus({ settingsPath, widgetConfigPath });
  assert.equal(status.installed, false);
  assert.equal(status.foreign, true);
  assert.match(status.command, /my-custom-statusline/);
});

test('statusLine.command가 문자열이 아니면 installed=false로 안전하게 처리한다', () => {
  const { settingsPath, widgetConfigPath } = tempPaths();
  fs.writeFileSync(settingsPath, JSON.stringify({ statusLine: { type: 'command', command: null } }));
  const status = getInstallStatus({ settingsPath, widgetConfigPath });
  assert.equal(status.installed, false);
  assert.equal(status.foreign, false);
});

test('손상된 settings.json은 에러를 던진다(호출자가 사용자에게 알려야 함)', () => {
  const { settingsPath, widgetConfigPath } = tempPaths();
  fs.writeFileSync(settingsPath, '{invalid json,,,');
  assert.throws(() => getInstallStatus({ settingsPath, widgetConfigPath }));
});
