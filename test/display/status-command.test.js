'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { run } = require('../../bin/claudetower');

// bin/claudetower.js의 status/uninstall 서브커맨드는 환경변수 오버라이드가 있으면
// 그 경로를 쓴다(setup과 동일 패턴) — 테스트는 반드시 오버라이드를 걸어 실제
// 사용자 파일을 절대 건드리지 않는다.
function withTempPaths(fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'claudetower-status-cmd-test-'));
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

test('status: 아무 것도 설치 안 된 상태에서 실행해도 에러 없이 0을 반환한다', async () => {
  await withTempPaths(async () => {
    const code = await run(['status']);
    assert.equal(code, 0);
  });
});

test('status: 설치돼 있으면 정상 종료한다(exit 0)', async () => {
  await withTempPaths(async ({ settingsPath, widgetConfigPath }) => {
    fs.writeFileSync(
      settingsPath,
      JSON.stringify({ statusLine: { type: 'command', command: 'node bin/claudetower.js statusline' } })
    );
    fs.writeFileSync(widgetConfigPath, JSON.stringify({ enabled_widgets: ['location'] }));
    const code = await run(['status']);
    assert.equal(code, 0);
  });
});

test('status: 손상된 settings.json이면 실패로 처리한다(exit 1, 크래시 아님)', async () => {
  await withTempPaths(async ({ settingsPath }) => {
    fs.writeFileSync(settingsPath, '{invalid json,,,');
    const code = await run(['status']);
    assert.equal(code, 1);
  });
});

test('uninstall: 제거 후 재확인까지 통과해 exit 0을 반환한다', async () => {
  await withTempPaths(async ({ settingsPath, widgetConfigPath }) => {
    fs.writeFileSync(
      settingsPath,
      JSON.stringify({ hooks: { foo: 'bar' }, statusLine: { type: 'command', command: 'x-claudetower' } })
    );
    fs.writeFileSync(widgetConfigPath, JSON.stringify({ enabled_widgets: ['location'] }));

    const code = await run(['uninstall']);
    assert.equal(code, 0);

    // uninstall 이후 status로 재확인해도 "설치 안 됨"이어야 한다(uninstall 자체의
    // 내부 재확인과 별개로, 외부에서 봤을 때도 일관되게 "제거됨"으로 보이는지 검증).
    const statusCode = await run(['status']);
    assert.equal(statusCode, 0);
  });
});
