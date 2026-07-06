'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {
  SKILL_NAME,
  buildSkillFileContent,
  writeSkillFile,
  removeSkillFile,
  resolveSkillFilePath,
  resolveSkillsDir,
} = require('../../src/display/config/skill-file');

// 두 환경변수를 임시로 지정/해제하고 원래대로 복원한다(테스트 격리).
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

function withSkillsDirOverride(dir, fn) {
  const prev = process.env.CLAUDETOWER_SKILLS_DIR;
  process.env.CLAUDETOWER_SKILLS_DIR = dir;
  try {
    return fn();
  } finally {
    if (prev === undefined) delete process.env.CLAUDETOWER_SKILLS_DIR;
    else process.env.CLAUDETOWER_SKILLS_DIR = prev;
  }
}

test('buildSkillFileContent: allowed-tools가 정확한 exe 경로로만 좁혀져 있다(넓은 Bash 권한 금지)', () => {
  const content = buildSkillFileContent('C:/Users/Someone/.claudetower/bin/claudetower.exe');
  assert.match(content, /allowed-tools: Bash\("C:\/Users\/Someone\/\.claudetower\/bin\/claudetower\.exe" widgets \*\)/);
  assert.match(content, /\$ARGUMENTS/);
});

test('buildSkillFileContent: disable-model-invocation을 넣지 않는다(자연어 자동 호출을 막으면 안 됨 — 실사용 교훈)', () => {
  const content = buildSkillFileContent('C:/Users/Someone/.claudetower/bin/claudetower.exe');
  // 이 값이 true면 "컨텍스트 꺼줘" 같은 자연어에 이 스킬이 자동으로 안 잡혀서
  // 엉뚱한 범용 설정 스킬이 config.json을 직접 편집해버린다(실측 재현).
  assert.doesNotMatch(content, /disable-model-invocation/);
});

test('buildSkillFileContent: description에 statusline/ClaudeTower 고유 문구가 있어 범용 설정 스킬 대신 선택되게 한다', () => {
  const content = buildSkillFileContent('C:/Users/Someone/.claudetower/bin/claudetower.exe');
  assert.match(content, /statusline|상태표시줄/);
  assert.match(content, /config\.json이나 settings\.json을 직접 편집하지 마세요/);
});

// 2026-07-06: .PRD/06_FIELD_ISSUE_SPAWN_STORM_2026-07-04.md FR-1 — 갱신 주기
// 조절도 위젯 켜고 끄기처럼 채팅으로 가능해야 한다.
test('buildSkillFileContent: allowed-tools에 config 하위명령도 허용되어 있다(갱신 주기 조절용)', () => {
  const content = buildSkillFileContent('C:/Users/Someone/.claudetower/bin/claudetower.exe');
  assert.match(content, /allowed-tools:.*Bash\("C:\/Users\/Someone\/\.claudetower\/bin\/claudetower\.exe" config \*\)/);
});

test('buildSkillFileContent: 갱신 속도 조절(statusline-refresh) 사용법이 안내되어 있다', () => {
  const content = buildSkillFileContent('C:/Users/Someone/.claudetower/bin/claudetower.exe');
  assert.match(content, /config statusline-refresh/);
});

test('writeSkillFile: SKILL.md을 올바른 위치에 쓰고, 폴더가 없었으면 skillsDirExistedBefore=false를 반환한다', () => {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'claudetower-skill-test-'));
  const skillsDir = path.join(base, 'skills'); // 아직 존재하지 않는 폴더

  withSkillsDirOverride(skillsDir, () => {
    const result = writeSkillFile('/fake/claudetower');
    assert.equal(result.skillsDirExistedBefore, false);
    assert.equal(fs.existsSync(resolveSkillFilePath()), true);
    const content = fs.readFileSync(resolveSkillFilePath(), 'utf8');
    assert.match(content, /claudetower/);
  });
});

test('writeSkillFile: 폴더가 이미 있었으면 skillsDirExistedBefore=true를 반환한다(재시작 불필요 케이스)', () => {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'claudetower-skill-test-'));
  const skillsDir = path.join(base, 'skills');
  fs.mkdirSync(skillsDir, { recursive: true }); // 미리 존재하게 만들어둠

  withSkillsDirOverride(skillsDir, () => {
    const result = writeSkillFile('/fake/claudetower');
    assert.equal(result.skillsDirExistedBefore, true);
  });
});

test('removeSkillFile: 설치된 스킬 폴더를 완전히 제거한다', () => {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'claudetower-skill-test-'));
  const skillsDir = path.join(base, 'skills');

  withSkillsDirOverride(skillsDir, () => {
    writeSkillFile('/fake/claudetower');
    const skillDir = path.dirname(resolveSkillFilePath());
    assert.equal(fs.existsSync(skillDir), true);

    const result = removeSkillFile();
    assert.equal(result.removed, true);
    assert.equal(fs.existsSync(skillDir), false);
  });
});

test('removeSkillFile: 애초에 설치된 게 없으면 에러 없이 removed=false를 반환한다', () => {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'claudetower-skill-test-'));
  const skillsDir = path.join(base, 'skills-never-created');

  withSkillsDirOverride(skillsDir, () => {
    const result = removeSkillFile();
    assert.equal(result.removed, false);
  });
});

test('resolveSkillsDir: CLAUDE_CONFIG_DIR가 설정되면 그 아래 skills/를 쓴다(Claude Code 실제 설정 홈 존중 — 실사용 결함 수정)', () => {
  withEnv({ CLAUDETOWER_SKILLS_DIR: undefined, CLAUDE_CONFIG_DIR: '/custom/cc-home' }, () => {
    assert.equal(resolveSkillsDir(), path.join('/custom/cc-home', 'skills'));
  });
});

test('resolveSkillsDir: CLAUDE_CONFIG_DIR가 없으면 ~/.claude/skills 기본값으로 폴백한다', () => {
  withEnv({ CLAUDETOWER_SKILLS_DIR: undefined, CLAUDE_CONFIG_DIR: undefined }, () => {
    assert.equal(resolveSkillsDir(), path.join(os.homedir(), '.claude', 'skills'));
  });
});

test('resolveSkillsDir: CLAUDETOWER_SKILLS_DIR(테스트 오버라이드)가 CLAUDE_CONFIG_DIR보다 우선한다', () => {
  withEnv({ CLAUDETOWER_SKILLS_DIR: '/override/skills', CLAUDE_CONFIG_DIR: '/custom/cc-home' }, () => {
    assert.equal(resolveSkillsDir(), '/override/skills');
  });
});

// 2026-07-06: 05_FIELD_ISSUES_2026-07-04.md §4 "미해결"로 남았던 슬래시 명령 미등록의
// 실제 원인 — CLAUDE_CONFIG_DIR 분기가 없던 과거 버전이 ~/.claude/skills/에 남긴
// 낡은 스킬(그 시절엔 disable-model-invocation도 있었음)이, CLAUDE_CONFIG_DIR가
// 설정된 지금 정답 위치($CLAUDE_CONFIG_DIR/skills/)와 별개로 계속 남아있었던 것을
// 실제 파일로 확인. writeSkillFile/removeSkillFile이 이 낡은 후보를 정리하는지 검증.
// "기본 위치" 후보를 실제 os.homedir()가 아니라 CLAUDETOWER_DEFAULT_HOME_DIR
// 전용 오버라이드로 지정한다 — USERPROFILE/HOME 환경변수를 직접 바꿔치기하는 방식은
// os.homedir()의 실제 해석 순서가 플랫폼·Node 버전에 따라 달라질 수 있어, 테스트가
// 만에 하나라도 실제 사용자 홈 디렉터리를 계산에 끌어들일 위험이 있다(안전 최우선).
test('writeSkillFile: CLAUDE_CONFIG_DIR가 설정된 상태에서 기본 위치(~/.claude/skills)에 낡은 스킬이 남아있으면 함께 정리한다', () => {
  const fakeHome = fs.mkdtempSync(path.join(os.tmpdir(), 'claudetower-home-'));
  const fakeConfigDir = fs.mkdtempSync(path.join(os.tmpdir(), 'claudetower-config-'));
  const staleDir = path.join(fakeHome, '.claude', 'skills', SKILL_NAME);
  fs.mkdirSync(staleDir, { recursive: true });
  fs.writeFileSync(path.join(staleDir, 'SKILL.md'), 'old content with disable-model-invocation: true');

  withEnv(
    { CLAUDETOWER_SKILLS_DIR: undefined, CLAUDE_CONFIG_DIR: fakeConfigDir, CLAUDETOWER_DEFAULT_HOME_DIR: fakeHome },
    () => {
      const result = writeSkillFile('/fake/claudetower');

      assert.equal(fs.existsSync(staleDir), false, '낡은 위치가 정리되어야 한다');
      assert.deepEqual(result.cleanedStaleDirs, [staleDir]);
      assert.equal(fs.existsSync(resolveSkillFilePath()), true, '정답 위치엔 새 파일이 정상 생성되어야 한다');
      const newContent = fs.readFileSync(resolveSkillFilePath(), 'utf8');
      assert.doesNotMatch(newContent, /disable-model-invocation/);
    }
  );
});

test('writeSkillFile/removeSkillFile: CLAUDETOWER_SKILLS_DIR 테스트 오버라이드가 설정되면 다른 후보 위치는 절대 건드리지 않는다(안전장치)', () => {
  const fakeHome = fs.mkdtempSync(path.join(os.tmpdir(), 'claudetower-home-safety-'));
  const staleDir = path.join(fakeHome, '.claude', 'skills', SKILL_NAME);
  fs.mkdirSync(staleDir, { recursive: true });
  fs.writeFileSync(path.join(staleDir, 'SKILL.md'), '절대 건드리면 안 됨');

  const testSkillsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'claudetower-skill-test-'));

  withEnv({ CLAUDETOWER_DEFAULT_HOME_DIR: fakeHome }, () => {
    withSkillsDirOverride(testSkillsDir, () => {
      const writeResult = writeSkillFile('/fake/claudetower');
      assert.deepEqual(writeResult.cleanedStaleDirs, []);
      assert.equal(fs.existsSync(staleDir), true, 'CLAUDETOWER_SKILLS_DIR 오버라이드 중엔 다른 후보를 건드리면 안 된다');

      const removeResult = removeSkillFile();
      assert.deepEqual(removeResult.cleanedStaleDirs, []);
      assert.equal(fs.existsSync(staleDir), true, '제거 시에도 마찬가지로 다른 후보를 건드리면 안 된다');
    });
  });
});

test('removeSkillFile: 현재 위치엔 스킬이 없어도 다른 후보 위치에 낡은 스킬이 있으면 정리하고 알려준다', () => {
  const fakeHome = fs.mkdtempSync(path.join(os.tmpdir(), 'claudetower-home-'));
  const fakeConfigDir = fs.mkdtempSync(path.join(os.tmpdir(), 'claudetower-config-'));
  const staleDir = path.join(fakeHome, '.claude', 'skills', SKILL_NAME);
  fs.mkdirSync(staleDir, { recursive: true });
  fs.writeFileSync(path.join(staleDir, 'SKILL.md'), 'old content');

  withEnv(
    { CLAUDETOWER_SKILLS_DIR: undefined, CLAUDE_CONFIG_DIR: fakeConfigDir, CLAUDETOWER_DEFAULT_HOME_DIR: fakeHome },
    () => {
      // 정답 위치(fakeConfigDir/skills)엔 아무것도 없는 상태
      const result = removeSkillFile();
      assert.deepEqual(result.cleanedStaleDirs, [staleDir]);
      assert.equal(fs.existsSync(staleDir), false);
    }
  );
});
