'use strict';

// .PRD/05_FIELD_ISSUES_2026-07-04.md 이슈#3(P2): install.ps1이 PATH 추가를
// "실행하지 않고 안내만" 해서, 비개발자는 그 단계를 건너뛰고 bare `claudetower`
// 명령을 못 쓰게 되는 문제의 근본 수정. Windows의 User PATH는 레지스트리
// (HKCU\Environment)에 저장되고, Node에는 이를 영구적으로 바꾸는 내장 API가
// 없어 reg.exe를 부른다 — 셸 문자열 조합(`exec`)이 아니라 인자 배열로만 넘기는
// `execFileSync`를 쓴다(.PRD/04_PROJECT_SPEC.md 인젝션 방지 요구사항).
//
// PATH는 이 프로그램 전용이 아니라 시스템 전체·다른 모든 프로그램이 공유하는
// 값이므로, 절대로 통째로 덮어쓰지 않는다 — 반드시 기존 값을 먼저 읽어서
// "이미 포함돼 있는지" 확인하고, 없을 때만 맨 뒤에 追加(append)한다.

const { execFileSync } = require('node:child_process');

const REGISTRY_KEY = 'HKCU\\Environment';

function normalizeForCompare(dir) {
  return dir.replace(/\\+$/, '').toLowerCase();
}

// reg.exe query 출력 예시:
//   HKEY_CURRENT_USER\Environment
//       Path    REG_EXPAND_SZ    C:\a;C:\b
// 값이 아예 없으면(User PATH를 한 번도 설정한 적 없는 극히 드문 경우) reg.exe가
// 0이 아닌 종료 코드로 실패하는데, 그 경우는 "빈 PATH"로 취급한다.
function readUserPath(execFileImpl = execFileSync) {
  let raw;
  try {
    raw = execFileImpl('reg.exe', ['query', REGISTRY_KEY, '/v', 'Path'], { encoding: 'utf8' });
  } catch {
    return '';
  }
  const match = raw.match(/Path\s+REG(?:_EXPAND)?_SZ\s+(.*)/);
  return match ? match[1].trim() : '';
}

function isDirInPath(dir, pathValue) {
  const target = normalizeForCompare(dir);
  return pathValue
    .split(';')
    .map((p) => normalizeForCompare(p.trim()))
    .filter((p) => p.length > 0)
    .includes(target);
}

// 이미 들어있으면 아무것도 안 하고 즉시 반환(멱등) — setup을 여러 번 실행해도
// PATH에 같은 경로가 중복으로 쌓이는 일이 없어야 한다.
function addDirToUserPath(dir, execFileImpl = execFileSync) {
  if (process.platform !== 'win32') {
    return { changed: false, reason: 'unsupported-platform' };
  }
  const current = readUserPath(execFileImpl);
  if (isDirInPath(dir, current)) {
    return { changed: false, reason: 'already-present' };
  }
  const next = current.length > 0 ? `${current};${dir}` : dir;
  execFileImpl('reg.exe', ['add', REGISTRY_KEY, '/v', 'Path', '/t', 'REG_EXPAND_SZ', '/d', next, '/f'], {
    encoding: 'utf8',
  });
  return { changed: true, previous: current, next };
}

module.exports = { readUserPath, isDirInPath, addDirToUserPath };
