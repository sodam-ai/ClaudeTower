'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { render } = require('../../src/display/statusline');
const { ALL_WIDGET_TYPES } = require('../../src/display/config/widget-config');

// render()의 두 번째 인자(enabledWidgets)를 항상 명시한다. 생략하면 실제 사용자 홈의
// ~/.claudetower/config.json(또는 CLAUDETOWER_WIDGET_CONFIG_PATH)을 읽어버려, 이 머신에서
// claudetower setup을 실행한 적이 있으면 그 결과에 테스트 성패가 좌우되는 결함이 있었다
// (실사용 테스트로 생성된 실제 설정 파일 내용에 따라 6개 테스트가 재현 가능하게 깨짐 — 발견 후 수정).
//
// 2026-08-03: git 위젯은 session 필드와 무관하게(캐시가 없으면) 항상 process.cwd()를
// 실제로 조회한다 — 이 저장소 자신이 진짜 git 저장소라, ALL_WIDGET_TYPES를 그대로 쓰면
// "빈 세션 -> 빈 문자열", "위치 위젯이 출력 맨 끝" 같은 git과 무관한 기존 가정이 실제로
// 깨지는 걸 재배선 직후 직접 확인했다.
// 2026-08-31: active_account도 같은 이유로 추가 제외한다 — render()가 filePath를 안
// 넘기면 readActiveAccountHandle이 이 머신의 실제 ~/.claudetower/active-account.json(또는
// CLAUDETOWER_ACTIVE_ACCOUNT_HANDLE_PATH)을 그대로 읽는다. 지금은 이 파일이 없어 null로
// 조용히 통과하지만, 이 머신에서 실제로 Account를 써본 적이 있으면 그 실제 라벨이 테스트
// 출력에 섞여 들어갈 수 있다 — git과 동일한 부류의 "실제 환경 의존" 위젯이라 같은 목록에서
// 뺀다. git·active_account와 무관한 일반 테스트는 전부 GENERIC_WIDGET_TYPES를 쓰고, 각
// 위젯 자체의 통합 동작은 이 파일 맨 아래 전용 테스트로 별도(격리 경로 주입) 검증한다.
const GENERIC_WIDGET_TYPES = ALL_WIDGET_TYPES.filter((t) => t !== 'git' && t !== 'active_account');

test('모든 필드가 있을 때 5개 위젯이 모두 렌더링된다', () => {
  const out = render(
    {
      model: { display_name: 'Opus' },
      workspace: { current_dir: '/home/user/my-project' },
      context_window: { used_percentage: 50 },
      cost: { total_cost_usd: 1.5 },
      rate_limits: { five_hour: { used_percentage: 30 }, seven_day: { used_percentage: 20 } },
    },
    GENERIC_WIDGET_TYPES
  );
  assert.match(out, /Opus/);
  assert.match(out, /my-project/);
  assert.match(out, /컨텍스트/);
  assert.match(out, /50%/);
  assert.match(out, /\$1\.50/);
  assert.match(out, /5시간.*30%/);
  assert.match(out, /7일.*20%/);
});

test('model 필드가 없으면 model 위젯만 숨겨지고 나머지는 그대로 표시된다', () => {
  const out = render({ workspace: { current_dir: '/x' } }, GENERIC_WIDGET_TYPES);
  assert.doesNotMatch(out, /모델/);
  assert.match(out, /x/);
});

test('빈 세션(필드 전무)이면 빈 문자열을 반환한다', () => {
  assert.equal(render({}, GENERIC_WIDGET_TYPES), '');
});

test('context_window.used_percentage가 null이면 context 위젯이 숨겨진다', () => {
  const out = render(
    {
      workspace: { current_dir: '/x' },
      context_window: { used_percentage: null },
    },
    GENERIC_WIDGET_TYPES
  );
  assert.match(out, /x/);
  assert.doesNotMatch(out, /%/);
});

test('rate_limits가 통째로 없으면 rate-limit 위젯이 숨겨진다(Free 플랜 등)', () => {
  const out = render({ workspace: { current_dir: '/x' } }, GENERIC_WIDGET_TYPES);
  assert.doesNotMatch(out, /시간/);
  assert.doesNotMatch(out, /일 /);
});

test('rate_limits.seven_day만 없으면 five_hour만 표시된다', () => {
  const out = render({ rate_limits: { five_hour: { used_percentage: 10 } } }, GENERIC_WIDGET_TYPES);
  assert.match(out, /5시간.*10%/);
  assert.doesNotMatch(out, /7일/);
});

test('context 70% 이상이면 경고색, 90% 이상이면 위험색, 그 아래는 안전색(초록)이 적용된다', () => {
  // "게이지바가 평범하다"는 피드백으로 안전 구간도 항상 초록색을 입히도록 바뀌었다
  // (이전엔 안전 구간이 무색이었음).
  const warn = render({ context_window: { used_percentage: 75 } }, GENERIC_WIDGET_TYPES);
  const critical = render({ context_window: { used_percentage: 95 } }, GENERIC_WIDGET_TYPES);
  const safe = render({ context_window: { used_percentage: 10 } }, GENERIC_WIDGET_TYPES);
  assert.match(warn, /\x1b\[33m/);
  assert.match(critical, /\x1b\[31m/);
  assert.match(safe, /\x1b\[32m/);
});

test('위젯 하나가 예외를 던져도 나머지 위젯은 정상 렌더링된다(위젯 단위 격리)', () => {
  const { WIDGETS } = require('../../src/display/statusline');
  const originalFirst = WIDGETS[0];
  WIDGETS[0] = () => {
    throw new Error('강제 위젯 오류');
  };
  try {
    const out = render({ cost: { total_cost_usd: 2 } }, GENERIC_WIDGET_TYPES);
    assert.match(out, /\$2\.00/);
  } finally {
    WIDGETS[0] = originalFirst;
  }
});

test('잘못된 타입 값(문자열)이 들어와도 크래시하지 않는다', () => {
  assert.doesNotThrow(() => {
    render(
      { context_window: { used_percentage: 'not-a-number' }, cost: { total_cost_usd: 'free' } },
      GENERIC_WIDGET_TYPES
    );
  });
});

// 아래는 경계값 테스트로 실제 발견해 수정한 결함들의 회귀 테스트.

test('경계값: context 정확히 70/90에서 각각 경고색/위험색, 69는 안전색(초록)/89는 경고색 유지', () => {
  // 89는 70(경고 임계값) 이상이라 경고색이 계속 적용된다 - "무색"이 "안전색"으로
  // 바뀐 건 70 미만 구간뿐이다(69에서 확인).
  assert.match(render({ context_window: { used_percentage: 69 } }, GENERIC_WIDGET_TYPES), /\x1b\[32m/);
  assert.match(render({ context_window: { used_percentage: 70 } }, GENERIC_WIDGET_TYPES), /\x1b\[33m/);
  assert.match(render({ context_window: { used_percentage: 89 } }, GENERIC_WIDGET_TYPES), /\x1b\[33m/);
  assert.match(render({ context_window: { used_percentage: 90 } }, GENERIC_WIDGET_TYPES), /\x1b\[31m/);
});

test('위치 위젯: 앞뒤 공백이 포함된 경로는 트리밍 후 표시된다(공백이 출력에 남지 않음)', () => {
  const out = render({ workspace: { current_dir: '   /spaced/path   ' } }, ['location']);
  assert.match(out, /📁 path$/);
});

test('Infinity/-Infinity 값은 위젯이 숨겨진다(NaN처럼 걸러짐, "Infinity%" 같은 깨진 출력 방지)', () => {
  const out = render(
    {
      context_window: { used_percentage: Infinity },
      cost: { total_cost_usd: -Infinity },
      rate_limits: { five_hour: { used_percentage: Infinity }, seven_day: { used_percentage: 50 } },
    },
    GENERIC_WIDGET_TYPES
  );
  assert.doesNotMatch(out, /Infinity/);
  assert.match(out, /7일.*50%/); // 유효한 값은 정상 표시
});

test('부동소수점 오차로 생긴 긴 소수(예: 14.000000000000002)는 반올림돼 깔끔한 정수%로 표시된다', () => {
  // 실사용 중 "5시간 14.000000000000002%" 처럼 표시되는 결함이 보고됨 — Claude Code의
  // used_percentage가 부동소수점 계산 결과라 생기는 오차. 공식 예제 스크립트들도
  // 전부 반올림/절삭 후 표시한다(RESEARCH_SOURCES.md 375/397/415행 - cut -d. -f1,
  // int(), Math.floor() 등) - 우리도 동일하게 반올림해야 함을 뒷받침하는 근거.
  const out = render(
    {
      context_window: { used_percentage: 13.999999999999993 },
      rate_limits: {
        five_hour: { used_percentage: 14.000000000000002 },
        seven_day: { used_percentage: 10.000000000000002 },
      },
    },
    GENERIC_WIDGET_TYPES
  );
  assert.doesNotMatch(out, /\./); // 소수점 자체가 출력에 남아있으면 안 됨
  assert.match(out, /14%/);
  assert.match(out, /10%/);
});

test('enabledWidgets에서 제외된 위젯은 유효한 값이 있어도 렌더링되지 않는다(설정 필터링 확인)', () => {
  const out = render(
    {
      workspace: { current_dir: '/x' },
      context_window: { used_percentage: 50 },
    },
    ['location']
  );
  assert.match(out, /x/);
  assert.doesNotMatch(out, /50%/);
});

// render()의 세 번째 인자(powerlineEnabled)도 위 enabledWidgets와 같은 이유로 항상
// 명시한다(2026-07-18 신설, 위 8~11행과 동일 원칙).

test('powerlineEnabled=false(기본값)면 위젯 사이 구분자가 공백 2칸이다', () => {
  const out = render(
    { model: { display_name: 'M' }, workspace: { current_dir: '/x' } },
    ['model', 'location'],
    false
  );
  assert.equal(out, 'M  📁 x');
});

test('powerlineEnabled=true면 위젯 사이 구분자가 Powerline 화살표로 바뀐다', () => {
  const out = render(
    { model: { display_name: 'M' }, workspace: { current_dir: '/x' } },
    ['model', 'location'],
    true
  );
  assert.notEqual(out, 'M  📁 x'); // 기본 구분자가 아님
  assert.match(out, /^M/);
  assert.match(out, /📁 x$/);
});

// --- git 위젯의 render() 통합 동작(2026-08-03 신설) ---
// git-widget.test.js가 renderGit/queryGitStatus 자체의 정확성은 이미 충분히 검증했으므로,
// 여기서는 "enabledWidgets을 통해 render() 파이프라인에 실제로 연결됐는지"만 확인한다.

test('render(): git이 enabledWidgets에 포함되고 실제 git 저장소 안이면 브랜치 정보가 함께 렌더링된다', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'claudetower-statusline-git-test-'));
  execFileSync('git', ['init', '--quiet'], { cwd: dir });
  execFileSync('git', ['config', 'user.email', 'test@example.com'], { cwd: dir });
  execFileSync('git', ['config', 'user.name', 'Test'], { cwd: dir });
  execFileSync('git', ['checkout', '--quiet', '-b', 'integration-test-branch'], { cwd: dir });
  fs.writeFileSync(path.join(dir, 'a.txt'), 'hi', 'utf8');
  execFileSync('git', ['add', 'a.txt'], { cwd: dir });
  execFileSync('git', ['commit', '--quiet', '-m', 'init'], { cwd: dir });

  const originalCwd = process.cwd();
  process.chdir(dir);
  try {
    const out = render({ model: { display_name: 'M' } }, ALL_WIDGET_TYPES);
    assert.match(out, /🌿 integration-test-branch/);
  } finally {
    process.chdir(originalCwd);
  }
});

test('render(): enabledWidgets에서 git을 빼면 실제 저장소 안에서도 git 관련 출력이 전혀 없다', () => {
  const out = render({ model: { display_name: 'M' } }, GENERIC_WIDGET_TYPES);
  assert.doesNotMatch(out, /🌿/);
});

// --- active_account 위젯의 render() 통합 동작(2026-08-31 신설) ---
// active-account.test.js가 renderActiveAccount 자체의 정확성(null 처리·트리밍 등)은
// 이미 검증하므로, 여기서는 "enabledWidgets을 통해 render() 파이프라인에 실제로
// 연결됐는지"만 CLAUDETOWER_ACTIVE_ACCOUNT_HANDLE_PATH 격리 경로로 확인한다(git
// 테스트의 process.chdir()와 같은 목적, 이 위젯은 chdir 대신 env override로 격리).

function withActiveAccountHandlePath(filePath, fn) {
  const original = process.env.CLAUDETOWER_ACTIVE_ACCOUNT_HANDLE_PATH;
  process.env.CLAUDETOWER_ACTIVE_ACCOUNT_HANDLE_PATH = filePath;
  try {
    return fn();
  } finally {
    if (original === undefined) delete process.env.CLAUDETOWER_ACTIVE_ACCOUNT_HANDLE_PATH;
    else process.env.CLAUDETOWER_ACTIVE_ACCOUNT_HANDLE_PATH = original;
  }
}

test('render(): active_account이 enabledWidgets에 포함되고 핸들 파일이 있으면 활성 계정 라벨이 함께 렌더링된다', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'claudetower-statusline-account-test-'));
  const handlePath = path.join(dir, 'active-account.json');
  fs.writeFileSync(
    handlePath,
    JSON.stringify({ account_label: '업무용', updated_at: '2026-08-31T00:00:00.000Z' })
  );

  withActiveAccountHandlePath(handlePath, () => {
    const out = render({ model: { display_name: 'M' } }, ALL_WIDGET_TYPES);
    assert.match(out, /👤 업무용/);
  });
});

test('render(): 핸들 파일이 없으면(Account 미사용, 절대다수) active_account 위젯이 완전히 비표시된다', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'claudetower-statusline-account-test-'));
  const handlePath = path.join(dir, 'active-account.json'); // 만들지 않음 — 파일 자체가 없는 상태

  withActiveAccountHandlePath(handlePath, () => {
    const out = render({ model: { display_name: 'M' } }, ALL_WIDGET_TYPES);
    assert.doesNotMatch(out, /👤/);
  });
});

test('render(): enabledWidgets에서 active_account을 빼면 핸들 파일이 있어도 표시되지 않는다(설정 필터링 확인)', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'claudetower-statusline-account-test-'));
  const handlePath = path.join(dir, 'active-account.json');
  fs.writeFileSync(
    handlePath,
    JSON.stringify({ account_label: '업무용', updated_at: '2026-08-31T00:00:00.000Z' })
  );

  withActiveAccountHandlePath(handlePath, () => {
    const out = render({ model: { display_name: 'M' } }, GENERIC_WIDGET_TYPES);
    assert.doesNotMatch(out, /👤/);
  });
});

// --- 라인 폭 예산(2026-08-03 신설) ---
// "10칸이 깨져서 보임" 라이브 리포트의 회귀 테스트. 개별 위젯 값은 정상인데 위젯을
// 전부 합친 줄 길이가 COLUMNS를 넘으면 줄바꿈으로 화면이 깨져 보였다 — 우선순위가
// 낮은 위젯부터 자동으로 빠지는지 확인한다.

function fullSession() {
  return {
    model: { display_name: 'Claude Sonnet 5' },
    workspace: { current_dir: process.cwd() }, // 실제 git 저장소(이 프로젝트 자신)
    context_window: { used_percentage: 63 },
    cost: { total_cost_usd: 1.23 },
    rate_limits: {
      five_hour: { used_percentage: 82, resets_at: Math.floor(Date.now() / 1000) + 3600 },
      seven_day: { used_percentage: 40, resets_at: Math.floor(Date.now() / 1000) + 86400 },
    },
  };
}

test('라인 폭 예산: COLUMNS가 좁아 전체 줄이 넘치면 git 위젯부터 빠진다(재현: 실사용 COLUMNS=120 리포트)', () => {
  const original = process.env.COLUMNS;
  process.env.COLUMNS = '120';
  try {
    const out = render(fullSession(), ALL_WIDGET_TYPES, false);
    const visible = out.replace(/\x1b\[[0-9;]*m/g, '');
    assert.doesNotMatch(visible, /🌿/); // git이 가장 먼저 빠짐
    assert.match(visible, /Claude Sonnet 5/); // 핵심 위젯은 유지
    assert.ok(visible.length <= 120, `줄 길이(${visible.length})가 COLUMNS(120) 이내여야 한다`);
  } finally {
    if (original === undefined) delete process.env.COLUMNS;
    else process.env.COLUMNS = original;
  }
});

test('라인 폭 예산: git을 빼도 여전히 넘치면 rate_limit도 추가로 빠진다', () => {
  const original = process.env.COLUMNS;
  process.env.COLUMNS = '80';
  try {
    const out = render(fullSession(), ALL_WIDGET_TYPES, false);
    const visible = out.replace(/\x1b\[[0-9;]*m/g, '');
    assert.doesNotMatch(visible, /🌿/);
    assert.doesNotMatch(visible, /5시간/);
    assert.doesNotMatch(visible, /7일/);
    assert.match(visible, /Claude Sonnet 5/);
    assert.match(visible, /컨텍스트/); // context는 우선순위가 더 높아 남아있음
    assert.ok(visible.length <= 80, `줄 길이(${visible.length})가 COLUMNS(80) 이내여야 한다`);
  } finally {
    if (original === undefined) delete process.env.COLUMNS;
    else process.env.COLUMNS = original;
  }
});

test('라인 폭 예산: COLUMNS를 몰라서 안전 여부를 판단할 수 없으면 아무 위젯도 자르지 않는다(정보를 임의로 숨기지 않음)', () => {
  const original = process.env.COLUMNS;
  delete process.env.COLUMNS;
  try {
    const out = render(fullSession(), ALL_WIDGET_TYPES, false);
    const visible = out.replace(/\x1b\[[0-9;]*m/g, '');
    assert.match(visible, /🌿/);
    assert.match(visible, /5시간/);
    assert.match(visible, /7일/);
  } finally {
    if (original === undefined) delete process.env.COLUMNS;
    else process.env.COLUMNS = original;
  }
});

test('라인 폭 예산: 터미널이 충분히 넓으면 아무것도 빠지지 않는다(불필요한 정보 손실 방지)', () => {
  const original = process.env.COLUMNS;
  process.env.COLUMNS = '200';
  try {
    const out = render(fullSession(), ALL_WIDGET_TYPES, false);
    const visible = out.replace(/\x1b\[[0-9;]*m/g, '');
    assert.match(visible, /🌿/);
    assert.match(visible, /5시간/);
    assert.match(visible, /7일/);
  } finally {
    if (original === undefined) delete process.env.COLUMNS;
    else process.env.COLUMNS = original;
  }
});

test('라인 폭 예산: 극단적으로 좁으면(COLUMNS=1) model까지 포함해 전부 빠져도 크래시하지 않는다', () => {
  const original = process.env.COLUMNS;
  process.env.COLUMNS = '1';
  try {
    assert.doesNotThrow(() => render(fullSession(), ALL_WIDGET_TYPES, false));
  } finally {
    if (original === undefined) delete process.env.COLUMNS;
    else process.env.COLUMNS = original;
  }
});
