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

// 실사용 검증 중 발견한 근본 결함: Claude Code는 설정 홈을 CLAUDE_CONFIG_DIR
// 환경변수로 바꿀 수 있고(Windows npm-global 설치 등에서 실제로
// C:\Users\<이름>\AppData\Roaming\claude-code 로 지정돼 있음), 그럴 때
// 네이티브 개인 스킬은 ~/.claude/skills/ 가 아니라 $CLAUDE_CONFIG_DIR/skills/
// 에서 읽힌다. 실측으로 확정: ~/.claude/skills/ 에 넣은 스킬은 며칠간 한 번도
// 인식되지 않았고, 같은 스킬을 $CLAUDE_CONFIG_DIR/skills/ 로 옮기자 그 즉시
// 세션 스킬 목록에 나타났다. 그래서 CLAUDE_CONFIG_DIR가 설정돼 있으면 반드시
// 그쪽을 쓰고, 없을 때만(기본 설치) ~/.claude/skills/ 로 폴백한다.
function resolveSkillsDir() {
  if (process.env.CLAUDETOWER_SKILLS_DIR) {
    return process.env.CLAUDETOWER_SKILLS_DIR;
  }
  if (process.env.CLAUDE_CONFIG_DIR) {
    return path.join(process.env.CLAUDE_CONFIG_DIR, 'skills');
  }
  return path.join(os.homedir(), '.claude', 'skills');
}

function resolveSkillFilePath() {
  return path.join(resolveSkillsDir(), SKILL_NAME, 'SKILL.md');
}

// exePath: 지금 설치된(또는 설치될) claudetower 실행 파일의 절대경로 — 그 경로만
// Bash 실행을 허용해서(allowed-tools), 이 스킬이 임의의 명령을 실행할 수 있는
// 넓은 권한을 갖지 않도록 범위를 좁힌다(비개발자 대상 기능이 최소 권한 원칙에서
// 벗어나 넓은 Bash 권한 문을 여는 건 금지).
//
// disable-model-invocation은 일부러 넣지 않는다(실사용 검증에서 발견한 교훈):
// 이 값을 true로 두면 사용자가 "컨텍스트 표시 꺼줘"처럼 자연어로 말했을 때 AI가
// 이 스킬을 자동으로 못 쓰고, 엉뚱한 범용 설정 스킬이 config.json을 직접 손으로
// 편집해버리는 상황이 실제로 재현됐다. 위젯 켜고 끄기는 위험하지도 비가역적이지도
// 않으므로(설계상 최소 1개 유지 규칙 등 안전장치는 widgets 명령에 이미 있음),
// AI 자동 호출을 막을 이유가 없다. 오히려 "비개발자가 말로 설정"이라는 본래
// 목적을 위해 자동 호출이 반드시 열려 있어야 한다. 대신 description에 ClaudeTower
// 상태표시줄 고유 문구를 강하게 넣어, 범용 설정 스킬이 아니라 이 스킬이 선택되게 한다.
function buildSkillFileContent(exePath) {
  const quotedExe = `"${exePath.replace(/\\/g, '/')}"`;
  return `---
description: ClaudeTower 상태표시줄(statusline) 위젯을 켜고 끕니다. 표시 항목은 사용 모델·프로젝트 위치·컨텍스트 사용량·비용·사용률 5가지. "상태표시줄에서 컨텍스트 꺼줘", "비용 표시 꺼줘", "상태표시줄 설정 바꿔줘", "ClaudeTower 위젯 켜/꺼" 같은 요청이면 반드시 이 스킬을 사용하고, config.json을 직접 편집하지 마세요.
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

// resolveSkillsDir()과 별개로 "기본(홈 디렉터리 기준) 위치"만 따로 계산한다.
// os.homedir()를 이 함수 하나에만 모아두고 테스트 전용 오버라이드
// (CLAUDETOWER_DEFAULT_HOME_DIR)를 둔 이유: 정리(cleanup) 로직 테스트가 실수로
// os.homedir()가 가리키는 실제 사용자 홈을 계산에 끌어들일 위험을 코드 차원에서
// 원천 차단하기 위해서다(USERPROFILE/HOME 환경변수를 직접 바꿔치기하는 방식은
// os.homedir()의 실제 해석 순서에 플랫폼·Node 버전 의존적인 불확실성이 있어
// 이 프로젝트의 다른 설정 함수들처럼 전용 오버라이드 변수를 쓰는 쪽이 더 안전하다).
function resolveDefaultSkillsDir() {
  if (process.env.CLAUDETOWER_DEFAULT_HOME_DIR) {
    return path.join(process.env.CLAUDETOWER_DEFAULT_HOME_DIR, '.claude', 'skills');
  }
  return path.join(os.homedir(), '.claude', 'skills');
}

// resolveSkillsDir()의 분기(CLAUDE_CONFIG_DIR 유무)가 나중에 추가된 로직이라,
// 그 분기가 없던 과거 버전이나 CLAUDE_CONFIG_DIR 설정이 그때와 달랐던 과거 실행이
// "지금 기준 정답이 아닌" 다른 후보 위치에 스킬을 남겨뒀을 수 있다(2026-07-04
// 필드이슈 §4 "미해결"로 남았던 원인을 2026-07-06 재조사로 확정: 이 PC의
// ~/.claude/skills/claudetower-widgets/SKILL.md가 CLAUDE_CONFIG_DIR 반영 이전
// 버전이 쓴 낡은 파일로, disable-model-invocation:true까지 그대로 남아있었다).
// 두 위치에 파일이 공존하면 어느 쪽이 실제로 읽히는지 불확실해지므로, 정답 위치가
// 아닌 다른 후보는 항상 정리한다. 테스트 오버라이드(CLAUDETOWER_SKILLS_DIR)가
// 설정된 동안에는 실제 사용자 홈 디렉터리를 절대 건드리면 안 되므로 통째로 건너뛴다.
function otherCandidateSkillDirs() {
  if (process.env.CLAUDETOWER_SKILLS_DIR) return [];
  const current = resolveSkillsDir();
  const candidates = [resolveDefaultSkillsDir()];
  if (process.env.CLAUDE_CONFIG_DIR) {
    candidates.push(path.join(process.env.CLAUDE_CONFIG_DIR, 'skills'));
  }
  return candidates.filter((dir) => dir !== current).map((dir) => path.join(dir, SKILL_NAME));
}

function cleanupStaleSkillDirs() {
  const cleaned = [];
  for (const dir of otherCandidateSkillDirs()) {
    if (fs.existsSync(dir)) {
      fs.rmSync(dir, { recursive: true, force: true });
      cleaned.push(dir);
    }
  }
  return cleaned;
}

// 반환값의 skillsDirExistedBefore로 "이번에 처음 생긴 폴더인지"를 판단할 수 있게 해서,
// 호출자(setup-wizard)가 재시작 필요 여부를 사실대로 안내할 수 있게 한다.
function writeSkillFile(exePath) {
  const skillsDir = resolveSkillsDir();
  const skillsDirExistedBefore = fs.existsSync(skillsDir);
  const filePath = resolveSkillFilePath();

  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, buildSkillFileContent(exePath), 'utf8');

  const cleanedStaleDirs = cleanupStaleSkillDirs();

  return { filePath, skillsDirExistedBefore, cleanedStaleDirs };
}

function removeSkillFile() {
  const skillDir = path.dirname(resolveSkillFilePath());
  const removed = fs.existsSync(skillDir);
  if (removed) {
    fs.rmSync(skillDir, { recursive: true, force: true });
  }
  const cleanedStaleDirs = cleanupStaleSkillDirs();
  if (!removed) {
    return { removed: false, cleanedStaleDirs };
  }
  return { removed: true, skillDir, cleanedStaleDirs };
}

module.exports = {
  SKILL_NAME,
  resolveSkillsDir,
  resolveSkillFilePath,
  buildSkillFileContent,
  writeSkillFile,
  removeSkillFile,
};
