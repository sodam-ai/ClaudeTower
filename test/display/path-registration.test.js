'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  readUserPath,
  isDirInPath,
  addDirToUserPath,
  broadcastEnvironmentChange,
} = require('../../src/display/config/path-registration');

// 실제 reg.exe를 절대 호출하지 않는다 — 이 값은 시스템 전역 PATH라 테스트가
// 잘못 건드리면 실사용 환경이 망가진다. execFileImpl을 항상 가짜 함수로 주입해서
// 모든 시나리오(있음/없음/빈 값/실패)를 순수 함수로만 검증한다.
function fakeExecFile(script) {
  let calls = [];
  const impl = (cmd, args, opts) => {
    calls.push({ cmd, args, opts });
    return script(cmd, args, opts);
  };
  impl.calls = () => calls;
  return impl;
}

// addDirToUserPath는 실제 Windows PATH 등록 동작(reg.exe 호출 여부)을 검증해야
// 하므로, CI가 Linux/macOS 실행기에서 돌 때도 항상 win32로 강제해야 한다.
// 이 모킹 없이는 실제 제품 코드의 "Windows가 아니면 즉시 종료" 분기를 타서
// (그 자체는 올바른 동작) 아래 단언들이 어긋난다 — 실제로 CI가 이 브랜치에서
// 한 번도 실행되지 않아 발견되지 못했던 결함(2026-07-12 실측 확인).
function withWin32Platform(fn) {
  const originalPlatform = process.platform;
  Object.defineProperty(process, 'platform', { value: 'win32' });
  try {
    return fn();
  } finally {
    Object.defineProperty(process, 'platform', { value: originalPlatform });
  }
}

test('readUserPath: reg.exe query 출력에서 Path 값만 정확히 뽑아낸다', () => {
  const impl = fakeExecFile(() => '\r\nHKEY_CURRENT_USER\\Environment\r\n    Path    REG_EXPAND_SZ    C:\\a;C:\\b\r\n\r\n');
  assert.equal(readUserPath(impl), 'C:\\a;C:\\b');
});

test('readUserPath: reg.exe가 실패하면(값이 아예 없는 경우) 빈 문자열로 취급한다', () => {
  const impl = fakeExecFile(() => {
    throw new Error('reg.exe exited with code 1');
  });
  assert.equal(readUserPath(impl), '');
});

test('isDirInPath: 대소문자·끝 슬래시 차이를 무시하고 포함 여부를 판단한다', () => {
  const pathValue = 'C:\\Users\\PC\\.claudetower\\bin;C:\\Other';
  assert.equal(isDirInPath('C:\\Users\\PC\\.claudetower\\bin', pathValue), true);
  assert.equal(isDirInPath('c:\\users\\pc\\.claudetower\\bin\\', pathValue), true);
  assert.equal(isDirInPath('C:\\Not\\There', pathValue), false);
});

test('isDirInPath: 빈 PATH엔 아무 것도 포함되지 않는다', () => {
  assert.equal(isDirInPath('C:\\anything', ''), false);
});

test('addDirToUserPath: 이미 PATH에 있으면 reg.exe add를 호출하지 않고 changed=false를 반환한다(멱등)', () => {
  withWin32Platform(() => {
    const impl = fakeExecFile((cmd, args) => {
      if (args[0] === 'query') return '    Path    REG_EXPAND_SZ    C:\\a;C:\\Users\\PC\\.claudetower\\bin';
      throw new Error('add가 호출되면 안 됨');
    });
    const result = addDirToUserPath('C:\\Users\\PC\\.claudetower\\bin', impl);
    assert.equal(result.changed, false);
    assert.equal(result.reason, 'already-present');
    assert.equal(impl.calls().filter((c) => c.args[0] === 'add').length, 0);
  });
});

test('addDirToUserPath: 없으면 기존 값 뒤에 세미콜론으로 이어붙여 reg.exe add를 호출한다', () => {
  withWin32Platform(() => {
    const impl = fakeExecFile((cmd, args) => {
      if (args[0] === 'query') return '    Path    REG_EXPAND_SZ    C:\\a;C:\\b';
      return '';
    });
    const result = addDirToUserPath('C:\\Users\\PC\\.claudetower\\bin', impl);
    assert.equal(result.changed, true);
    assert.equal(result.previous, 'C:\\a;C:\\b');
    assert.equal(result.next, 'C:\\a;C:\\b;C:\\Users\\PC\\.claudetower\\bin');

    const addCall = impl.calls().find((c) => c.args[0] === 'add');
    assert.ok(addCall, 'reg.exe add가 호출되어야 한다');
    assert.deepEqual(addCall.args, [
      'add',
      'HKCU\\Environment',
      '/v',
      'Path',
      '/t',
      'REG_EXPAND_SZ',
      '/d',
      'C:\\a;C:\\b;C:\\Users\\PC\\.claudetower\\bin',
      '/f',
    ]);
  });
});

test('addDirToUserPath: 기존 PATH가 비어있으면 세미콜론 없이 그 경로만 설정한다', () => {
  withWin32Platform(() => {
    const impl = fakeExecFile((cmd, args) => {
      if (args[0] === 'query') throw new Error('값 없음');
      return '';
    });
    const result = addDirToUserPath('C:\\Users\\PC\\.claudetower\\bin', impl);
    assert.equal(result.changed, true);
    assert.equal(result.next, 'C:\\Users\\PC\\.claudetower\\bin');
  });
});

test('addDirToUserPath: PATH를 실제로 추가했을 때만 환경변수 변경 신호(powershell.exe)를 방송한다', () => {
  withWin32Platform(() => {
    const impl = fakeExecFile((cmd, args) => {
      if (args[0] === 'query') return '    Path    REG_EXPAND_SZ    C:\\a;C:\\b';
      return '';
    });
    addDirToUserPath('C:\\Users\\PC\\.claudetower\\bin', impl);

    const broadcastCall = impl.calls().find((c) => c.cmd === 'powershell.exe');
    assert.ok(broadcastCall, 'reg.exe add 뒤에 powershell.exe로 방송해야 한다');
    assert.match(broadcastCall.args.join(' '), /SendMessageTimeout/);
    assert.match(broadcastCall.args.join(' '), /WM_SETTINGCHANGE|0x1a/i);
  });
});

test('addDirToUserPath: 이미 PATH에 있으면(변경 없음) 방송하지 않는다', () => {
  withWin32Platform(() => {
    const impl = fakeExecFile((cmd, args) => {
      if (args[0] === 'query') return '    Path    REG_EXPAND_SZ    C:\\Users\\PC\\.claudetower\\bin';
      throw new Error('add/방송 모두 호출되면 안 됨');
    });
    addDirToUserPath('C:\\Users\\PC\\.claudetower\\bin', impl);
    assert.equal(impl.calls().filter((c) => c.cmd === 'powershell.exe').length, 0);
  });
});

test('broadcastEnvironmentChange: powershell.exe 호출이 실패해도 조용히 무시한다(레지스트리 값 자체는 이미 기록됐으므로 치명적이지 않음)', () => {
  withWin32Platform(() => {
    const impl = fakeExecFile(() => {
      throw new Error('powershell.exe를 찾을 수 없음');
    });
    assert.doesNotThrow(() => broadcastEnvironmentChange(impl));
  });
});

test('broadcastEnvironmentChange: Windows가 아니면 아무것도 호출하지 않는다', () => {
  const originalPlatform = process.platform;
  Object.defineProperty(process, 'platform', { value: 'linux' });
  try {
    const impl = fakeExecFile(() => {
      throw new Error('win32가 아닌데 호출되면 안 됨');
    });
    broadcastEnvironmentChange(impl);
    assert.equal(impl.calls().length, 0);
  } finally {
    Object.defineProperty(process, 'platform', { value: originalPlatform });
  }
});

test('addDirToUserPath: Windows가 아니면 reg.exe를 호출하지 않고 즉시 changed=false를 반환한다', () => {
  const originalPlatform = process.platform;
  Object.defineProperty(process, 'platform', { value: 'linux' });
  try {
    const impl = fakeExecFile(() => {
      throw new Error('win32가 아닌데 reg.exe를 호출하면 안 됨');
    });
    const result = addDirToUserPath('/home/pc/.claudetower/bin', impl);
    assert.equal(result.changed, false);
    assert.equal(result.reason, 'unsupported-platform');
    assert.equal(impl.calls().length, 0);
  } finally {
    Object.defineProperty(process, 'platform', { value: originalPlatform });
  }
});
