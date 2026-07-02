'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { run } = require('../../bin/claudetower');

// bin/claudetower.js의 uninstall 서브커맨드는 내부적으로 환경변수 오버라이드가 있으면
// 그 경로를 쓰고 없으면 실제 ~/.claude/settings.json 등 기본 경로를 쓴다(setup과 동일 패턴).
// 테스트는 반드시 오버라이드를 걸어 실제 사용자 파일을 절대 건드리지 않는다.
function withTempPaths(fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'claudetower-uninstall-test-'));
  const settingsPath = path.join(dir, 'settings.json');
  const widgetConfigPath = path.join(dir, 'config.json');
  const prevSettings = process.env.CLAUDETOWER_SETTINGS_PATH;
  const prevWidget = process.env.CLAUDETOWER_WIDGET_CONFIG_PATH;
  process.env.CLAUDETOWER_SETTINGS_PATH = settingsPath;
  process.env.CLAUDETOWER_WIDGET_CONFIG_PATH = widgetConfigPath;
  try {
    return fn({ settingsPath, widgetConfigPath });
  } finally {
    if (prevSettings === undefined) delete process.env.CLAUDETOWER_SETTINGS_PATH;
    else process.env.CLAUDETOWER_SETTINGS_PATH = prevSettings;
    if (prevWidget === undefined) delete process.env.CLAUDETOWER_WIDGET_CONFIG_PATH;
    else process.env.CLAUDETOWER_WIDGET_CONFIG_PATH = prevWidget;
  }
}

test('uninstall: statusLine과 위젯 설정 파일을 제거하고 다른 설정은 보존한다', async () => {
  await withTempPaths(async ({ settingsPath, widgetConfigPath }) => {
    fs.writeFileSync(
      settingsPath,
      JSON.stringify({ hooks: { foo: 'bar' }, statusLine: { type: 'command', command: 'x' } })
    );
    fs.writeFileSync(widgetConfigPath, JSON.stringify({ enabled_widgets: ['location'] }));

    const code = await run(['uninstall']);
    assert.equal(code, 0);

    const written = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
    assert.deepEqual(written.hooks, { foo: 'bar' });
    assert.equal('statusLine' in written, false);
    assert.equal(fs.existsSync(widgetConfigPath), false);
  });
});

test('uninstall: 아무 것도 설치 안 된 상태에서 실행해도 에러 없이 끝난다', async () => {
  await withTempPaths(async () => {
    const code = await run(['uninstall']);
    assert.equal(code, 0);
  });
});
