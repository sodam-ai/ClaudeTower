'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {
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
  assert.match(content, /config\.json을 직접 편집하지 마세요/);
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
