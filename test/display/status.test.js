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

test('등록된 경로에 파일이 실제로 있으면 broken=false다', () => {
  const { settingsPath, widgetConfigPath } = tempPaths();
  // settingsPath 자신도 "실제로 존재하는 파일"이라 이걸 가짜 exe 경로로 재사용한다.
  fs.writeFileSync(
    settingsPath,
    JSON.stringify({ statusLine: { type: 'command', command: `"${settingsPath}" statusline` } })
  );
  const status = getInstallStatus({ settingsPath, widgetConfigPath });
  assert.equal(status.installed, true);
  assert.equal(status.broken, false);
});

test('등록된 경로에 파일이 없으면 broken=true다("고장" 상태 감지 - 실사용 피드백으로 추가)', () => {
  const { settingsPath, widgetConfigPath } = tempPaths();
  const missingExePath = path.join(path.dirname(settingsPath), 'does-not-exist-claudetower.exe');
  fs.writeFileSync(
    settingsPath,
    JSON.stringify({ statusLine: { type: 'command', command: `"${missingExePath}" statusline` } })
  );
  const status = getInstallStatus({ settingsPath, widgetConfigPath });
  assert.equal(status.installed, true);
  assert.equal(status.broken, true);
});

test('따옴표 없는 옛 형식 명령은 파일 존재를 판단할 수 없어 broken=false로 통과시킨다(하위 호환)', () => {
  const { settingsPath, widgetConfigPath } = tempPaths();
  fs.writeFileSync(
    settingsPath,
    JSON.stringify({ statusLine: { type: 'command', command: 'D:/nonexistent/claudetower.exe statusline' } })
  );
  const status = getInstallStatus({ settingsPath, widgetConfigPath });
  assert.equal(status.installed, true);
  assert.equal(status.broken, false);
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
