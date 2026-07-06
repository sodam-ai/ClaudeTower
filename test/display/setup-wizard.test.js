'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const readline = require('node:readline');
const { PassThrough } = require('node:stream');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { runSetupWizard } = require('../../src/display/setup-wizard');
const { resolveInstallDir } = require('../../src/display/config/install-target');

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

// PATH 등록은 시스템 전역 레지스트리를 건드리는 동작이라, 위젯 관련 테스트에서는
// 절대 실제 구현이 불려서는 안 된다 — 매 호출마다 이 가짜 함수를 명시적으로
// 주입한다(widgetConfigPath/settingsPath를 항상 임시 경로로 주는 것과 같은 이유).
function fakeRegisterPath() {
  const calls = [];
  const impl = (dir) => {
    calls.push(dir);
    return { changed: true };
  };
  impl.calls = () => calls;
  return impl;
}

function withPlatform(value, fn) {
  const original = Object.getOwnPropertyDescriptor(process, 'platform');
  Object.defineProperty(process, 'platform', { value, configurable: true });
  try {
    return fn();
  } finally {
    Object.defineProperty(process, 'platform', original);
  }
}

test('5개 질문에 y/y/y/n/y로 답하면 cost만 제외된 위젯 목록이 저장된다', async () => {
  const { widgetConfigPath, settingsPath } = tempPaths();
  const rl = fakeInteractiveSession('y\ny\ny\nn\ny\n');

  const result = await runSetupWizard(rl, { widgetConfigPath, settingsPath, registerPath: fakeRegisterPath() });

  assert.deepEqual(result.enabled, ['model', 'location', 'context', 'rate_limit']);
  const written = JSON.parse(fs.readFileSync(widgetConfigPath, 'utf8'));
  assert.deepEqual(written.enabled_widgets, ['model', 'location', 'context', 'rate_limit']);
});

test('전부 n으로 답하면 최소 1개 보장을 위해 기본값(전체)으로 폴백한다', async () => {
  const { widgetConfigPath, settingsPath } = tempPaths();
  const rl = fakeInteractiveSession('n\nn\nn\nn\nn\n');

  const result = await runSetupWizard(rl, { widgetConfigPath, settingsPath, registerPath: fakeRegisterPath() });

  assert.deepEqual(result.enabled, ['model', 'location', 'context', 'cost', 'rate_limit']);
});

test('엔터만 치면(빈 답변) 기본값 Y로 처리된다', async () => {
  const { widgetConfigPath, settingsPath } = tempPaths();
  const rl = fakeInteractiveSession('\n\n\n\n\n');

  const result = await runSetupWizard(rl, { widgetConfigPath, settingsPath, registerPath: fakeRegisterPath() });

  assert.deepEqual(result.enabled, ['model', 'location', 'context', 'cost', 'rate_limit']);
});

test('settings.json에 statusLine.command가 기록된다', async () => {
  const { widgetConfigPath, settingsPath } = tempPaths();
  const rl = fakeInteractiveSession('y\ny\ny\ny\ny\n');

  await runSetupWizard(rl, { widgetConfigPath, settingsPath, registerPath: fakeRegisterPath() });

  const written = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
  assert.equal(written.statusLine.type, 'command');
  assert.match(written.statusLine.command, /statusline$/);
  assert.doesNotMatch(written.statusLine.command, /\\/); // 백슬래시 없이 슬래시로 정규화됐는지
});

// .PRD/06_FIELD_ISSUE_SPAWN_STORM_2026-07-04.md FR-2 수정 검증 — setup을 다시
// 실행해도 사용자가 이미 조정해둔 refreshInterval이 1로 되돌아가면 안 된다.
test('settings.json에 이미 refreshInterval이 있으면 setup을 다시 실행해도 그 값을 유지한다', async () => {
  const { widgetConfigPath, settingsPath } = tempPaths();
  fs.writeFileSync(
    settingsPath,
    JSON.stringify({ statusLine: { type: 'command', command: '이전 명령', refreshInterval: 5 } })
  );
  const rl = fakeInteractiveSession('y\ny\ny\ny\ny\n');

  await runSetupWizard(rl, { widgetConfigPath, settingsPath, registerPath: fakeRegisterPath() });

  const written = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
  assert.equal(written.statusLine.refreshInterval, 5);
});

test('settings.json에 refreshInterval이 없었으면(최초 설치) 기본값 3으로 설정한다(FR-3, 2026-07-06: 1→3 조정)', async () => {
  const { widgetConfigPath, settingsPath } = tempPaths();
  const rl = fakeInteractiveSession('y\ny\ny\ny\ny\n');

  await runSetupWizard(rl, { widgetConfigPath, settingsPath, registerPath: fakeRegisterPath() });

  const written = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
  assert.equal(written.statusLine.refreshInterval, 3);
});

// .PRD/05_FIELD_ISSUES_2026-07-04.md 이슈#3(P2) 수정 검증. PATH는 시스템 전역
// 값이라 registerPath를 항상 가짜 함수로 주입해 실제 레지스트리를 절대 건드리지
// 않는다(fakeRegisterPath 자체가 안전장치).
test('Windows에서 PATH 등록 질문에 y로 답하면 설치 폴더로 registerPath가 호출된다', async () => {
  await withPlatform('win32', async () => {
    const { widgetConfigPath, settingsPath } = tempPaths();
    const rl = fakeInteractiveSession('y\ny\ny\ny\ny\ny\n'); // 위젯 5개 + PATH 질문 1개
    const registerPath = fakeRegisterPath();

    await runSetupWizard(rl, { widgetConfigPath, settingsPath, registerPath });

    assert.deepEqual(registerPath.calls(), [resolveInstallDir()]);
  });
});

test('Windows에서 PATH 등록 질문에 n으로 답하면 registerPath가 호출되지 않는다', async () => {
  await withPlatform('win32', async () => {
    const { widgetConfigPath, settingsPath } = tempPaths();
    const rl = fakeInteractiveSession('y\ny\ny\ny\ny\nn\n');
    const registerPath = fakeRegisterPath();

    await runSetupWizard(rl, { widgetConfigPath, settingsPath, registerPath });

    assert.deepEqual(registerPath.calls(), []);
  });
});

test('Windows에서 PATH 등록 질문에 애매하게 답하면(엔터만 등) 안전하게 "안 함"으로 처리한다 — 위젯 질문과 의도적으로 다른 정책', async () => {
  await withPlatform('win32', async () => {
    const { widgetConfigPath, settingsPath } = tempPaths();
    const rl = fakeInteractiveSession('y\ny\ny\ny\ny\n\n'); // 마지막 답변이 빈 줄(엔터만)
    const registerPath = fakeRegisterPath();

    await runSetupWizard(rl, { widgetConfigPath, settingsPath, registerPath });

    assert.deepEqual(registerPath.calls(), []);
  });
});

test('Windows가 아니면 PATH 등록 질문 자체를 하지 않는다(질문 6개 중 5개만 소비)', async () => {
  await withPlatform('linux', async () => {
    const { widgetConfigPath, settingsPath } = tempPaths();
    const rl = fakeInteractiveSession('y\ny\ny\ny\ny\n'); // 위젯 5개뿐, PATH 질문 없음
    const registerPath = fakeRegisterPath();

    const result = await runSetupWizard(rl, { widgetConfigPath, settingsPath, registerPath });

    assert.deepEqual(result.enabled, ['model', 'location', 'context', 'cost', 'rate_limit']);
    assert.deepEqual(registerPath.calls(), []);
  });
});
