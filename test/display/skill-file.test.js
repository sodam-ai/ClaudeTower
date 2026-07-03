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
} = require('../../src/display/config/skill-file');

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
  assert.match(content, /disable-model-invocation: true/);
  assert.match(content, /\$ARGUMENTS/);
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
