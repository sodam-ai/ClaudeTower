'use strict';

// M29(CHECKPOINT.md) 성능 회귀 재현·조사의 결과물. 원인 규명 결론: exe 전체 구동시간
// (Node/SEA 콜드스타트 포함)은 render() 코드 밖의 영역이라 node:test 안에서 의미
// 있게 측정할 수 없다(node:test 프로세스 자체가 이미 켜져 있는 상태에서 실행되므로).
// 그래서 이 파일은 "코드가 실제로 통제할 수 있는 부분"만 잰다 — render() 자체의
// 순수 실행 시간(위젯 로직 + 캐시 조회 + git 서브프로세스 호출 시간 포함, Node
// 프로세스 자체 기동 시간은 제외). 캐시 히트 경로는 항상 빨라야 하고, 캐시 미스
// 경로(git 서브프로세스 2회 호출)는 기기마다 편차가 커서 절대치 대신 "캐시 히트보다
// 확실히 느리다"는 상대 비교로 캐싱이 실제로 동작함을 검증한다.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { render } = require('../../src/display/statusline');
const { ALL_WIDGET_TYPES } = require('../../src/display/config/widget-config');

const NON_GIT_WIDGET_TYPES = ALL_WIDGET_TYPES.filter((t) => t !== 'git');

function initTempRepo() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'claudetower-perf-test-'));
  execFileSync('git', ['init', '--quiet'], { cwd: dir });
  execFileSync('git', ['config', 'user.email', 'test@example.com'], { cwd: dir });
  execFileSync('git', ['config', 'user.name', 'Test'], { cwd: dir });
  execFileSync('git', ['checkout', '--quiet', '-b', 'perf-test'], { cwd: dir });
  fs.writeFileSync(path.join(dir, 'a.txt'), 'hi', 'utf8');
  execFileSync('git', ['add', 'a.txt'], { cwd: dir });
  execFileSync('git', ['commit', '--quiet', '-m', 'init'], { cwd: dir });
  return dir;
}

function fullSession(sessionId) {
  return {
    session_id: sessionId,
    model: { display_name: 'Claude Sonnet 5' },
    workspace: { current_dir: '/x' },
    context_window: { used_percentage: 63 },
    cost: { total_cost_usd: 1.23 },
    rate_limits: {
      five_hour: { used_percentage: 82, resets_at: 9999999999 },
      seven_day: { used_percentage: 40, resets_at: 9999999999 },
    },
  };
}

function avgMs(fn, iterations) {
  const samples = [];
  for (let i = 0; i < iterations; i += 1) {
    const start = process.hrtime.bigint();
    fn();
    const end = process.hrtime.bigint();
    samples.push(Number(end - start) / 1e6);
  }
  return samples.reduce((a, b) => a + b, 0) / samples.length;
}

test('render(): git 없는 5개 위젯은 20ms 미만(순수 JS 렌더링, 외부 프로세스 호출 없음)', () => {
  const avg = avgMs(() => render(fullSession('perf-non-git'), NON_GIT_WIDGET_TYPES, false), 10);
  assert.ok(avg < 20, `평균 ${avg.toFixed(2)}ms — 20ms 미만이어야 함`);
});

test('render(): git 위젯이 캐시 히트 상태면 6개 위젯 전부 켜도 20ms 미만(.PRD/04_PROJECT_SPEC.md 100ms 목표에 큰 여유)', () => {
  const original = process.env.CLAUDETOWER_CACHE_DIR;
  const cacheDir = fs.mkdtempSync(path.join(os.tmpdir(), 'claudetower-perf-cache-'));
  process.env.CLAUDETOWER_CACHE_DIR = cacheDir;
  const dir = initTempRepo();
  const originalCwd = process.cwd();
  process.chdir(dir);
  try {
    const sessionId = 'perf-cache-hit';
    render(fullSession(sessionId), ALL_WIDGET_TYPES, false); // 캐시 예열(1회는 미스)
    const avg = avgMs(() => render(fullSession(sessionId), ALL_WIDGET_TYPES, false), 10);
    assert.ok(avg < 20, `평균 ${avg.toFixed(2)}ms — 캐시 히트 상태에서 20ms 미만이어야 함`);
  } finally {
    process.chdir(originalCwd);
    if (original === undefined) delete process.env.CLAUDETOWER_CACHE_DIR;
    else process.env.CLAUDETOWER_CACHE_DIR = original;
  }
});

test('render(): git 캐시 미스는 캐시 히트보다 뚜렷이 느리다(캐싱이 실제로 성능에 기여한다는 증거, 기기 편차 때문에 절대치 대신 상대 비교)', () => {
  const original = process.env.CLAUDETOWER_CACHE_DIR;
  const cacheDir = fs.mkdtempSync(path.join(os.tmpdir(), 'claudetower-perf-cache-2-'));
  process.env.CLAUDETOWER_CACHE_DIR = cacheDir;
  const dir = initTempRepo();
  const originalCwd = process.cwd();
  process.chdir(dir);
  try {
    let counter = 0;
    const missAvg = avgMs(() => {
      counter += 1;
      render(fullSession(`perf-miss-${counter}`), ALL_WIDGET_TYPES, false); // 매번 새 session_id = 항상 캐시 미스
    }, 5);

    const hitSessionId = 'perf-hit-compare';
    render(fullSession(hitSessionId), ALL_WIDGET_TYPES, false); // 예열
    const hitAvg = avgMs(() => render(fullSession(hitSessionId), ALL_WIDGET_TYPES, false), 5);

    assert.ok(
      missAvg > hitAvg * 2,
      `캐시 미스(${missAvg.toFixed(2)}ms)가 캐시 히트(${hitAvg.toFixed(2)}ms)보다 2배 이상 느려야 캐싱이 실제로 동작하는 것`
    );
    // 절대 상한은 기기/CI 환경 편차가 커서(git 서브프로세스 2회 spawn) 느슨하게만 설정 —
    // "캐시가 있는데도 매번 초 단위로 느려지는" 명백한 회귀만 잡는다.
    assert.ok(missAvg < 500, `캐시 미스 평균 ${missAvg.toFixed(2)}ms — 500ms를 넘으면 명백한 회귀`);
  } finally {
    process.chdir(originalCwd);
    if (original === undefined) delete process.env.CLAUDETOWER_CACHE_DIR;
    else process.env.CLAUDETOWER_CACHE_DIR = original;
  }
});
