'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const readline = require('node:readline');
const { PassThrough } = require('node:stream');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { runSetupWizard } = require('../../src/display/setup-wizard');

// 실제 TTY 없이 파이프 입력을 흉내낸다(readline.question() 연속 호출 버그를
// 재현했던 것과 동일한 조건 — 이 테스트가 통과하면 그 버그가 없다는 뜻).
function fakeInteractiveSession(answersText) {
  const input = new PassThrough();
  const output = new PassThrough();
  output.on('data', () => {}); // 출력은 버려도 되지만 배압 방지를 위해 소비는 해야 함
  const rl = readline.createInterface({ input, output });
  // input.end()를 동기적으로 바로 호출하면 readline이 async iterator 리스너를 붙이기
  // 전에 'end' 이벤트를 이미 흘려보내 버려서 모든 질문이 즉시 done:true로 끝나는
  // 경쟁 상태가 생긴다(실제 OS 파이프는 비동기 I/O라 이 문제가 없음 — 실측으로 확인).
  // 한 틱 미뤄서 호출자가 async iterator를 먼저 만들 시간을 준다.
  setImmediate(() => input.end(answersText));
  return rl;
}

function tempPaths() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'claudetower-wizard-test-'));
  return {
    widgetConfigPath: path.join(dir, 'widget-config.json'),
    settingsPath: path.join(dir, 'settings.json'),
  };
}

test('5개 질문에 y/y/y/n/y로 답하면 cost만 제외된 위젯 목록이 저장된다', async () => {
  const { widgetConfigPath, settingsPath } = tempPaths();
  const rl = fakeInteractiveSession('y\ny\ny\nn\ny\n');

  const result = await runSetupWizard(rl, { widgetConfigPath, settingsPath });

  assert.deepEqual(result.enabled, ['model', 'location', 'context', 'rate_limit']);
  const written = JSON.parse(fs.readFileSync(widgetConfigPath, 'utf8'));
  assert.deepEqual(written.enabled_widgets, ['model', 'location', 'context', 'rate_limit']);
});

test('전부 n으로 답하면 최소 1개 보장을 위해 기본값(전체)으로 폴백한다', async () => {
  const { widgetConfigPath, settingsPath } = tempPaths();
  const rl = fakeInteractiveSession('n\nn\nn\nn\nn\n');

  const result = await runSetupWizard(rl, { widgetConfigPath, settingsPath });

  assert.deepEqual(result.enabled, ['model', 'location', 'context', 'cost', 'rate_limit']);
});

test('엔터만 치면(빈 답변) 기본값 Y로 처리된다', async () => {
  const { widgetConfigPath, settingsPath } = tempPaths();
  const rl = fakeInteractiveSession('\n\n\n\n\n');

  const result = await runSetupWizard(rl, { widgetConfigPath, settingsPath });

  assert.deepEqual(result.enabled, ['model', 'location', 'context', 'cost', 'rate_limit']);
});

test('settings.json에 statusLine.command가 기록된다', async () => {
  const { widgetConfigPath, settingsPath } = tempPaths();
  const rl = fakeInteractiveSession('y\ny\ny\ny\ny\n');

  await runSetupWizard(rl, { widgetConfigPath, settingsPath });

  const written = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
  assert.equal(written.statusLine.type, 'command');
  assert.match(written.statusLine.command, /statusline$/);
  assert.doesNotMatch(written.statusLine.command, /\\/); // 백슬래시 없이 슬래시로 정규화됐는지
});
