'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { ISOLATION_VARS, isPartialIsolation } = require('../../src/display/config/test-isolation');
const { removeWidgetConfigFile, writeEnabledWidgets } = require('../../src/display/config/widget-config');

// 환경변수를 임시로 지정/해제하고 원래대로 복원한다(테스트 격리).
function withEnv(vars, fn) {
  const prev = {};
  for (const [k, v] of Object.entries(vars)) {
    prev[k] = process.env[k];
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  try {
    return fn();
  } finally {
    for (const [k, v] of Object.entries(prev)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
}

// 네 격리 변수 전부를 지운 깨끗한 상태를 기본으로 깔아준다 — 테스트 러너 자신이
// 어떤 격리 변수를 갖고 실행되든 결과가 흔들리지 않게.
function withCleanIsolationEnv(extra, fn) {
  const cleared = Object.fromEntries(ISOLATION_VARS.map((v) => [v, undefined]));
  return withEnv({ ...cleared, ...extra }, fn);
}

test('isPartialIsolation: 격리 변수가 하나도 없으면(실사용) false', () => {
  withCleanIsolationEnv({}, () => {
    for (const own of ISOLATION_VARS) {
      assert.equal(isPartialIsolation(own), false);
    }
  });
});

test('isPartialIsolation: 자기 전용 변수가 설정돼 있으면 다른 변수와 무관하게 false(완전 격리)', () => {
  withCleanIsolationEnv(
    { CLAUDETOWER_SKILLS_DIR: 'X:/t/skills', CLAUDETOWER_SETTINGS_PATH: 'X:/t/s.json' },
    () => {
      assert.equal(isPartialIsolation('CLAUDETOWER_SKILLS_DIR'), false);
      assert.equal(isPartialIsolation('CLAUDETOWER_SETTINGS_PATH'), false);
    }
  );
});

test('isPartialIsolation: 다른 격리 변수만 설정돼 있으면 true(부분 격리 — 실측 확정 결함 조합)', () => {
  // 실사례 1(스킬 소실): 설정만 격리, 스킬 미격리
  withCleanIsolationEnv({ CLAUDETOWER_SETTINGS_PATH: 'X:/t/s.json' }, () => {
    assert.equal(isPartialIsolation('CLAUDETOWER_SKILLS_DIR'), true);
    // 실사례 2(위젯 설정 소실): 같은 조합에서 위젯도 미격리
    assert.equal(isPartialIsolation('CLAUDETOWER_WIDGET_CONFIG_PATH'), true);
  });
  // 반대 방향: 스킬만 격리된 채 설정 미격리
  withCleanIsolationEnv({ CLAUDETOWER_SKILLS_DIR: 'X:/t/skills' }, () => {
    assert.equal(isPartialIsolation('CLAUDETOWER_SETTINGS_PATH'), true);
  });
});

test('isPartialIsolation: CLAUDETOWER_DEFAULT_HOME_DIR은 트리거가 아니다(정리 테스트의 정당한 조합 보호)', () => {
  withCleanIsolationEnv({ CLAUDETOWER_DEFAULT_HOME_DIR: 'X:/t/home' }, () => {
    assert.equal(isPartialIsolation('CLAUDETOWER_SKILLS_DIR'), false);
  });
});

test('removeWidgetConfigFile: 명시적 경로가 오면 방어막 없이 그 파일만 지운다(의도된 삭제 보존)', () => {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'claudetower-isolation-test-'));
  const target = path.join(base, 'config.json');
  fs.writeFileSync(target, '{"enabled_widgets":["model"]}', 'utf8');

  withCleanIsolationEnv({ CLAUDETOWER_SETTINGS_PATH: 'X:/t/s.json' }, () => {
    const result = removeWidgetConfigFile(target);
    assert.equal(result.removed, true);
    assert.equal(fs.existsSync(target), false);
  });
});

test('removeWidgetConfigFile: 부분 격리 + 인자 없음이면 실제 파일을 건드리지 않고 skipped를 반환한다', () => {
  withCleanIsolationEnv({ CLAUDETOWER_SETTINGS_PATH: 'X:/t/s.json' }, () => {
    const result = removeWidgetConfigFile();
    assert.equal(result.removed, false);
    assert.equal(result.skipped, 'partial-test-isolation');
    // 안전장치 검증: skipped일 때는 대상 경로만 알려주고 파일시스템에 어떤 쓰기도
    // 하지 않아야 한다 — 위에서 removed=false 확인으로 충분(존재 여부는 실제 사용자
    // 환경에 의존하므로 여기서 단정하지 않는다).
  });
});

test('writeEnabledWidgets: 부분 격리 + 인자 없음이면 이유를 담은 예외를 던진다(조용한 실제 파일 변조 금지)', () => {
  withCleanIsolationEnv({ CLAUDETOWER_SETTINGS_PATH: 'X:/t/s.json' }, () => {
    assert.throws(() => writeEnabledWidgets(['model']), /CLAUDETOWER_WIDGET_CONFIG_PATH/);
  });
});

test('writeEnabledWidgets: 명시적 경로가 오면 부분 격리 중에도 그 경로에 정상 기록한다', () => {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'claudetower-isolation-test-'));
  const target = path.join(base, 'config.json');

  withCleanIsolationEnv({ CLAUDETOWER_SETTINGS_PATH: 'X:/t/s.json' }, () => {
    writeEnabledWidgets(['model', 'location'], target);
    const parsed = JSON.parse(fs.readFileSync(target, 'utf8'));
    assert.deepEqual(parsed.enabled_widgets, ['model', 'location']);
  });
});
