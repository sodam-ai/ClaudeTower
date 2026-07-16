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
const { isPartialIsolation } = require('./test-isolation');

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

// 2026-07-06 통제 재현으로 확정한 근본 원인에 대한 구조적 방어막:
// e2e 검증이 CLAUDETOWER_SETTINGS_PATH/CLAUDETOWER_WIDGET_CONFIG_PATH만 격리하고
// CLAUDETOWER_SKILLS_DIR을 빠뜨린 채 실제 exe로 uninstall을 돌리면, 설정 파일은
// 격리본만 건드리면서 스킬 폴더는 "실제" 위치를 지워버린다 — 이게 실사용 중
// /claudetower-widgets가 반복적으로 사라지던 바로 그 경로였다(세션마다 "테스트/검증"
// 요청 → e2e의 uninstall이 매번 실제 스킬을 삭제). 격리 변수를 하나라도 쓰는
// 실행(=테스트)이 스킬 격리만 빠뜨렸다면, 실제 스킬 위치는 읽기든 쓰기든 삭제든
// 절대 건드리지 않는 것이 유일하게 안전한 동작이다.
// 판정 로직 자체는 test-isolation.js로 일반화했다(위젯 설정 파일에서도 같은 부류의
// 삭제 사고가 실측으로 발견되어, 모듈마다 다른 판정이 생기지 않게 한 곳으로 모음).
function isPartialTestIsolation() {
  return isPartialIsolation('CLAUDETOWER_SKILLS_DIR');
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
// 2026-07-06: .PRD/06_FIELD_ISSUE_SPAWN_STORM_2026-07-04.md FR-1(갱신 주기 조절
// 명령)이 터미널 전용이라, 위젯 켜고 끄기처럼 채팅으로도 조절할 수 있게 이 스킬의
// 책임 범위를 넓힌다. allowed-tools에 `config *`도 추가해 스킬이 그 명령을 실행할
// 수 있게 하되, widgets와 마찬가지로 이 실행 파일 하나로만 범위를 좁혀둔다.
//
// 2026-07-06 밤(실사용 피드백): 인자 없이 /claudetower-widgets만 치면 "어떤 항목을
// 켜고 끌까요?"라고 글로 묻는 대신, Claude Code 내장 선택 메뉴(AskUserQuestion)로
// 체크해서 고를 수 있게 개선. 제약: 그 도구는 질문당 선택지가 최대 4개라 위젯
// 5개를 한 질문에 못 담는다 — 두 질문으로 나눈다. "이미 명확한 자연어 요청"은
// 메뉴 없이 바로 실행하는 빠른 경로를 유지한다(본래 목적인 말로 조절이 후퇴하면
// 안 됨). 메뉴 도구가 없는 환경을 위한 텍스트 폴백도 지시문에 명시한다.
function buildSkillFileContent(exePath) {
  const quotedExe = `"${exePath.replace(/\\/g, '/')}"`;
  return `---
description: ClaudeTower 상태표시줄(statusline) 위젯을 켜고 끄거나 갱신 속도를 조절합니다. 표시 항목은 사용 모델·프로젝트 위치·컨텍스트 사용량·비용·사용률 5가지. "상태표시줄에서 컨텍스트 꺼줘", "비용 표시 꺼줘", "상태표시줄 설정 바꿔줘", "ClaudeTower 위젯 켜/꺼", "상태표시줄 갱신을 느리게/빠르게 해줘" 같은 요청이면 반드시 이 스킬을 사용하고, config.json이나 settings.json을 직접 편집하지 마세요.
argument-hint: [끄거나 켜고 싶은 항목, 또는 갱신 속도를 자연어로 — 비워두면 체크 메뉴가 뜹니다]
allowed-tools: Bash(${quotedExe} widgets *), Bash(${quotedExe} config *), AskUserQuestion
---

사용자가 ClaudeTower 상태표시줄 위젯 표시 여부 또는 갱신 속도를 바꾸고 싶어합니다. 터미널이나 명령어를 모르는 비개발자일 수 있으니 전부 자연스러운 한국어 대화로 진행하세요.

## 사용 가능한 항목 (영어 이름 → 화면 표시 이름)
- model → 사용 모델
- location → 프로젝트 위치
- context → 컨텍스트 사용량
- cost → 비용
- rate_limit → 사용률(5시간/7일)

## 진행 순서
1. \`${quotedExe} widgets\`를 실행해서 지금 어떤 항목이 켜져 있는지 먼저 확인하세요.
2. **빠른 경로**: 사용자 요청(아래 참고)이 이미 명확하면 — 예: "비용 꺼줘", "갱신 5초로" — 메뉴 없이 바로 4번으로 가서 실행하세요.
3. **체크 메뉴**: 요청이 없거나 모호하면(예: 인자 없이 호출됨) AskUserQuestion 도구 하나로 아래 두 질문을 함께 보여주세요. **선택지 label에 "무엇을 하게 되는지"를 동사로 직접 쓰는 것이 핵심입니다** — 설명을 읽지 않아도 체크의 효과가 한눈에 보이게(실사용 피드백: 상태+뒤집기 설명 방식은 알아보기 어려웠음).
   - 질문 본문(두 질문 공통): "바꿀 것만 체크하세요 (안 바꿀 항목은 그냥 두면 됩니다)"처럼 짧게.
   - 질문 1 — header "표시 항목 ①", multiSelect: true, 선택지 3개: 사용 모델 / 프로젝트 위치 / 컨텍스트 사용량. 1번에서 확인한 현재 상태를 반영해, **켜진 항목은 label을 "<이름> 끄기"로, 꺼진 항목은 "<이름> 켜기"로** 쓰세요(예: "사용 모델 끄기", "컨텍스트 사용량 켜기"). description은 "지금 켜져 있어요" / "지금 꺼져 있어요"로 짧게.
   - 질문 2 — header "표시 항목 ②", multiSelect: true, 선택지 3개: 비용 / 사용률(5시간/7일)을 질문 1과 같은 방식으로 + 마지막 선택지 "갱신 속도 조절"(description: "지금 N초마다 새로고침 — 체크하면 이어서 물어봐요").
   - "갱신 속도 조절"이 체크됐다면: 위젯 변경을 먼저 처리한 뒤, AskUserQuestion으로 속도만 한 번 더 물어보세요 — 선택지 "느리게 — 5초" / "빠르게 — 1초" / "그대로 두기", 다른 값은 기타(Other)로 직접 입력 가능하다고 안내(1 이상의 정수만 유효).
   - **체크된 항목만 실행하고, 체크하지 않은 항목은 절대 바꾸지 마세요**(현상 유지가 기본).
   - AskUserQuestion 도구를 사용할 수 없는 환경이면, 지금까지처럼 텍스트로 물어보세요.
4. 결정된 변경을 실행하세요:
   - 끌 항목: \`${quotedExe} widgets off <영어이름...>\` / 켤 항목: \`${quotedExe} widgets on <영어이름...>\` (여러 개 동시 가능)
   - 갱신 속도: \`${quotedExe} config statusline-refresh <초>\` (1 이상의 정수만 — 0·음수·소수는 명령이 거부합니다). 사용자가 숫자 없이 "느리게"/"빠르게"라고만 말한 경우에는 느리게→5초, 빠르게→1초를 제안하고 확인받은 뒤 실행하세요. 여러 창을 동시에 켜두는 사용자라면 갱신 속도를 늘리면 컴퓨터 부담이 줄어든다고 자연스럽게 안내해도 좋습니다.
5. 결과를 한국어로 짧게 알려주세요. 영어 명령어나 파일 경로는 언급하지 말고 "컨텍스트 표시를 켰고, 갱신 속도를 5초로 바꿨습니다"처럼 쉽게 설명하세요. 바꾼 것이 없으면 "변경 없이 그대로 뒀습니다"라고 알려주세요.

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
  if (isPartialTestIsolation()) return [];
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
  if (isPartialTestIsolation()) {
    // setup-wizard가 이 예외를 잡아 "건너뛰었습니다: <이유>"로 정직하게 안내한다 —
    // 조용히 성공한 척하면 테스트가 실제 환경을 안 건드렸다는 사실이 가려진다.
    throw new Error(
      '테스트 격리 변수(CLAUDETOWER_*)가 일부만 설정되어 있어 실제 스킬 폴더를 건드리지 않습니다. 테스트라면 CLAUDETOWER_SKILLS_DIR도 함께 지정하세요.'
    );
  }
  const skillsDir = resolveSkillsDir();
  const skillsDirExistedBefore = fs.existsSync(skillsDir);
  const filePath = resolveSkillFilePath();

  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, buildSkillFileContent(exePath), 'utf8');

  const cleanedStaleDirs = cleanupStaleSkillDirs();

  return { filePath, skillsDirExistedBefore, cleanedStaleDirs };
}

// 2026-07-06: 실사용 중 스킬 파일이 원인불명으로 반복 소실되는 현상을 여러 차례
// 직접 관찰했다(Windows Defender·제어된 폴더 접근은 원인에서 배제 확인, 이 PC에
// 상시 떠 있는 다중 Claude Code 세션이 유력하지만 특정은 못함 — .PRD/05_FIELD_ISSUES
// §4). 근본 원인을 아직 못 잡았어도, `claudetower statusline`이 어차피
// refreshInterval마다 계속 호출되고 있으니 그때마다 "있는지 확인 → 없으면 즉시
// 재생성"만 해도 사용자가 매번 setup을 다시 실행하거나 나(AI)를 불러 고칠 필요 없이
// 스스로 복구된다. 이미 있으면 손대지 않아(쓰기 자체를 안 함) 정상 상태에서는
// 매 호출마다 존재 확인 한 번(가벼운 stat)만 추가된다.
function ensureSkillFileExists(exePath) {
  if (isPartialTestIsolation()) {
    return { wrote: false, skipped: 'partial-test-isolation' };
  }
  if (fs.existsSync(resolveSkillFilePath())) {
    return { wrote: false };
  }
  return { wrote: true, ...writeSkillFile(exePath) };
}

function removeSkillFile() {
  if (isPartialTestIsolation()) {
    return { removed: false, skipped: 'partial-test-isolation', cleanedStaleDirs: [] };
  }
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
  ensureSkillFileExists,
  isPartialTestIsolation,
};
