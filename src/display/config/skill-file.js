'use strict';

// claudetower setup이 Claude Code의 "Personal Skill"(~/.claude/skills/) 자리에
// SKILL.md를 하나 심어둔다 — 그러면 사용자가 클로드코드 채팅창에서 그냥
// `/claudetower-widgets`라고 치면, AI가 대화하면서 위젯 on/off를 대신 실행해준다.
// 목적: 비개발자에게 "터미널 열고 영어 명령어 타이핑"을 강요하지 않기 위함
// (.PRD/01_PRD.md §3의 원래 P1 요구사항 "슬래시 명령 대화형 설정"을 구현).
//
// 공식 문서(code.claude.com/docs/en/slash-commands) 확인: ~/.claude/skills/<name>/SKILL.md는
// 설치되는 즉시(재시작 없이) 모든 프로젝트에서 사용 가능하다 — 단, ~/.claude/skills/
// 폴더 자체가 이번에 처음 생기는 경우(지금 세션 시작 시점엔 없었던 최상위 폴더)에는
// 예외적으로 재시작이 필요하다("Live change detection" 섹션). 그래서 폴더가 이미
// 있었는지 미리 확인해, 정확한 안내 문구를 골라줄 수 있게 결과에 포함시킨다.

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const SKILL_NAME = 'claudetower-widgets';

function resolveSkillsDir() {
  return process.env.CLAUDETOWER_SKILLS_DIR || path.join(os.homedir(), '.claude', 'skills');
}

function resolveSkillFilePath() {
  return path.join(resolveSkillsDir(), SKILL_NAME, 'SKILL.md');
}

// exePath: 지금 설치된(또는 설치될) claudetower 실행 파일의 절대경로 — 그 경로만
// Bash 실행을 허용해서(allowed-tools), 이 스킬이 임의의 명령을 실행할 수 있는
// 넓은 권한을 갖지 않도록 범위를 좁힌다(비개발자 대상 기능이 넓은 Bash 권한 문을
// 여는 건 이 프로젝트의 최소 권한 원칙에서 벗어남).
function buildSkillFileContent(exePath) {
  const quotedExe = `"${exePath.replace(/\\/g, '/')}"`;
  return `---
description: ClaudeTower 상태표시줄에 표시할 항목(사용 모델/프로젝트 위치/컨텍스트/비용/사용률)을 대화로 켜고 끕니다. "상태표시줄 설정 바꿔줘", "컨텍스트 표시 꺼줘" 같은 요청에 사용하세요.
disable-model-invocation: true
argument-hint: [끄거나 켜고 싶은 항목을 자연어로]
allowed-tools: Bash(${quotedExe} widgets *)
---

사용자가 ClaudeTower 상태표시줄 위젯 표시 여부를 바꾸고 싶어합니다. 터미널이나 명령어를 모르는 비개발자일 수 있으니 전부 자연스러운 한국어 대화로 진행하세요.

## 사용 가능한 항목 (영어 이름 → 화면 표시 이름)
- model → 사용 모델
- location → 프로젝트 위치
- context → 컨텍스트 사용량
- cost → 비용
- rate_limit → 사용률(5시간/7일)

## 지금 해야 할 일
1. \`${quotedExe} widgets\`를 실행해서 지금 어떤 항목이 켜져 있는지 먼저 확인하세요.
2. 사용자 요청(아래 참고)이 이미 명확하면 바로 반영하고, 모호하거나 없으면 "어떤 항목을 켜고 끌까요?"처럼 자연스럽게 물어보세요.
3. 위 목록의 영어 이름으로 \`${quotedExe} widgets off <이름...>\` 또는 \`${quotedExe} widgets on <이름...>\`을 실행하세요(여러 개 동시 가능).
4. 결과를 한국어로 짧게 알려주세요. 영어 명령어나 파일 경로는 언급하지 말고 "컨텍스트 표시를 껐습니다" 처럼 쉽게 설명하세요.

사용자 요청: $ARGUMENTS
`;
}

// 반환값의 skillsDirExistedBefore로 "이번에 처음 생긴 폴더인지"를 판단할 수 있게 해서,
// 호출자(setup-wizard)가 재시작 필요 여부를 사실대로 안내할 수 있게 한다.
function writeSkillFile(exePath) {
  const skillsDir = resolveSkillsDir();
  const skillsDirExistedBefore = fs.existsSync(skillsDir);
  const filePath = resolveSkillFilePath();

  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, buildSkillFileContent(exePath), 'utf8');

  return { filePath, skillsDirExistedBefore };
}

function removeSkillFile() {
  const skillDir = path.dirname(resolveSkillFilePath());
  if (!fs.existsSync(skillDir)) {
    return { removed: false };
  }
  fs.rmSync(skillDir, { recursive: true, force: true });
  return { removed: true, skillDir };
}

module.exports = {
  SKILL_NAME,
  resolveSkillsDir,
  resolveSkillFilePath,
  buildSkillFileContent,
  writeSkillFile,
  removeSkillFile,
};
