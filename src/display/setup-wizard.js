'use strict';

// claudetower setup의 실제 로직. readline 인터페이스를 주입받아 실행하므로
// 실제 TTY 없이도(파이프·테스트용 스트림) 재현 가능하다(Step 5에서 검증한 패턴).

const { ALL_WIDGET_TYPES, writeEnabledWidgets } = require('./config/widget-config');
const { writeStatusLineConfig, readExistingStatusLineConfig } = require('./config/settings-writer');
const { buildStatuslineCommand, resolveUsableExePath } = require('./config/statusline-command');
const { ensureInstalledAtTarget, resolveInstallDir } = require('./config/install-target');
const { writeSkillFile } = require('./config/skill-file');
const { addDirToUserPath } = require('./config/path-registration');

const WIDGET_LABELS = {
  model: '사용 모델',
  location: '프로젝트 위치',
  context: '컨텍스트 사용량',
  cost: '비용',
  rate_limit: '사용률(5시간/7일)',
};

// rl.question()을 연속으로 여러 번 호출하면 파이프 입력이 EOF에 도달한 뒤
// 두 번째 호출부터 콜백이 영영 오지 않고 프로세스가 조용히 종료되는 실제 버그를
// 재현·확인했다(실제 사람이 터미널에 치는 경우엔 stdin이 안 끝나서 안 나타나지만,
// 스크립트로 답을 흘려보내는 자동화·무인 설치 시나리오에서는 그대로 재현된다).
// 비동기 이터레이터(for-await 패턴)는 같은 조건에서 4개 질문 전부 정상 처리됨을 실측 확인.
//
// 프롬프트는 반드시 rl에 주입된 output 스트림에 써야 한다 — process.stdout에 직접 쓰면
// (실제로 그렇게 짰다가 발견) node --test 하위 프로세스에서 테스트 러너 자신의 stdout
// 기반 IPC 채널과 경합해 "Unable to deserialize cloned data" 오류로 테스트 러너가
// 간헐적으로 깨지는 실제 버그가 있었다(재현율 약 3/5, 실측 확인).
function askQuestion(rl, lineIterator, prompt) {
  rl.output.write(prompt);
  return lineIterator.next().then(({ value, done }) => (done ? '' : value));
}

async function runSetupWizard(
  rl,
  { widgetConfigPath, settingsPath, log = () => {}, registerPath = addDirToUserPath } = {}
) {
  log('claudetower setup — 상태표시줄에 표시할 항목을 골라주세요.\n');

  const lineIterator = rl[Symbol.asyncIterator]();
  const enabled = [];
  for (const type of ALL_WIDGET_TYPES) {
    const answer = await askQuestion(rl, lineIterator, `${WIDGET_LABELS[type]} 표시할까요? (Y/n): `);
    const normalized = answer.trim().toLowerCase();
    if (normalized !== 'n' && normalized !== 'no') {
      enabled.push(type);
    }
  }

  if (enabled.length === 0) {
    log('\n하나도 선택하지 않으셨습니다 — 최소 1개는 켜야 해서 기본값(전체)으로 진행합니다.');
    enabled.push(...ALL_WIDGET_TYPES);
  }

  writeEnabledWidgets(enabled, widgetConfigPath);

  // "이름/위치를 바꾸거나 지워도 안 깨지게" — SEA 바이너리로 실행 중이면 고정 설치
  // 위치(~/.claudetower/bin)로 자기 자신을 복사해 정착시킨다. 이후 사용자가 원래
  // 다운로드한 파일을 지우거나 옮겨도 등록된 명령은 이 고정 복사본을 가리키므로
  // 영향받지 않는다(실사용 중 발견된 "고장난 명령어" 문제의 근본 해결책).
  const installResult = await ensureInstalledAtTarget({
    // Claude Code가 이 파일을 초 단위로 계속 실행 중이면 교체가 몇 차례 밀릴 수
    // 있다 — 화면이 멈춘 것처럼 보이지 않도록 재시도 중임을 알린다.
    onRetry: (attempt, maxAttempts) => {
      log(`Claude Code가 파일을 사용 중이라 잠시 기다립니다... (${attempt}/${maxAttempts})`);
    },
  });
  if (installResult.copied) {
    log(`\n설치 파일을 안전한 위치로 복사했습니다: ${installResult.targetPath}`);
    log('(원래 다운로드하신 파일은 이제 지우거나 옮기셔도 상관없습니다)');
  } else if (installResult.error) {
    // Claude Code가 이 위치의 파일을 주기적으로 실행 중이라 그 순간과 겹치면 Windows가
    // 파일을 잠가 교체가 실패할 수 있다(여러 차례 재시도까지 다 실패한 드문 경우 —
    // 예: 백신 검사가 새 파일을 오래 붙잡는 경우) - 중단하지 않고 계속 진행하되
    // 사용자에게 명확히 알린다. 이 경우 지금 실행 중인 파일의 위치가 그대로 등록되어
    // "고장 위험"이 남아있는 상태로 진행됨을 알려야 한다.
    log(`\n안전한 위치로 파일을 교체하는 데 실패했습니다: ${installResult.error.message}`);
    log('(Claude Code를 잠깐 닫아두고 claudetower setup을 다시 실행해보시면 대부분 해결됩니다. 지금은 현재 파일 위치로 등록됩니다.)');
  }

  // .PRD/05_FIELD_ISSUES_2026-07-04.md 이슈#3(P2): 지금까지는 설치 폴더를
  // PATH에 "등록하라고 안내만" 했고 실제로 등록하지는 않아서, 비개발자는 이 단계를
  // 건너뛰고 터미널에서 bare `claudetower` 명령을 못 쓰는 문제가 있었다. PATH는
  // 이 프로그램 전용이 아니라 시스템 전체가 공유하는 값이라(다른 모든 프로그램에
  // 영향), 위젯 질문과 달리 **명확하게 "y"라고 답했을 때만** 진행한다 — 엔터만
  // 치거나 애매하게 답하면 안전하게 "안 함"으로 처리한다(위젯 질문의 기본값 Y와
  // 의도적으로 다른 정책). macOS/Linux는 셸 rc 파일(.bashrc 등)마다 방식이 달라
  // 안전하게 자동화하기 어려워 이번 범위에서 제외하고 Windows만 지원한다.
  if (process.platform === 'win32') {
    const pathAnswer = await askQuestion(
      rl,
      lineIterator,
      '\n터미널에서 "claudetower"라고 짧게만 입력해도 실행되게 만들까요? (Y/n): '
    );
    if (pathAnswer.trim().toLowerCase() === 'y' || pathAnswer.trim().toLowerCase() === 'yes') {
      try {
        const pathResult = registerPath(resolveInstallDir());
        if (pathResult.changed) {
          log('등록했습니다. (지금 열려 있는 터미널이 아니라, 새로 여는 터미널부터 적용됩니다)');
        } else if (pathResult.reason === 'already-present') {
          log('이미 등록되어 있어서 따로 할 일이 없습니다.');
        }
      } catch (err) {
        log(`PATH 등록에 실패했습니다: ${err.message} (터미널 없이 "/claudetower-widgets" 대화형 설정으로도 충분히 쓰실 수 있습니다)`);
      }
    }
  }

  const command = buildStatuslineCommand();
  // Claude Code는 기본적으로 "이벤트(대화) 발생 시"에만 상태표시줄을 다시 실행한다
  // (공식 문서 확인). refreshInterval(초 단위, 최소 1)을 지정하면 이벤트와 별개로
  // 고정 주기로도 재실행되어, 프로젝트 위치 등이 조금이라도 더 빠르게 반영된다.
  // 신규 설치 기본값은 3초다(.PRD/06_FIELD_ISSUE_SPAWN_STORM_2026-07-04.md FR-3,
  // 2026-07-06 갱신) — 원래 1초였으나, 여러 Claude Code 세션을 동시에 띄우는
  // 실사용 환경에서 "매초·세션수만큼 exe 재실행"이 프로세스 생성 폭주(0x800700e8
  // 오류)에 상수로 기여하는 걸 실측 확인했고, 실제로 3초로 늘려도 체감 지연 없이
  // (턴마다 이벤트 기반으로도 갱신되므로) 안정적으로 동작함을 확인했다. 사용자가
  // `claudetower config statusline-refresh`로 이미 값을 바꿔둔 적이 있다면 setup을
  // 다시 실행해도 그 값을 그대로 유지한다 — 그러지 않으면 재설치할 때마다 애써
  // 늘려둔 주기가 기본값으로 되돌아가 버린다(FR-2, 같은 이유로 이미 수정됨).
  const DEFAULT_REFRESH_INTERVAL_SECONDS = 3;
  const existingStatusLine = readExistingStatusLineConfig(settingsPath);
  const refreshInterval =
    existingStatusLine && Number.isInteger(existingStatusLine.refreshInterval) && existingStatusLine.refreshInterval >= 1
      ? existingStatusLine.refreshInterval
      : DEFAULT_REFRESH_INTERVAL_SECONDS;
  const writeResult = writeStatusLineConfig({ type: 'command', command, refreshInterval }, settingsPath);

  log(`\n설정 완료: ${enabled.map((t) => WIDGET_LABELS[t]).join(', ')}`);
  log(`상태표시줄 명령이 Claude Code 설정에 등록됐습니다: ${writeResult.filePath}`);
  if (writeResult.backedUp) {
    log(`(기존 설정은 ${writeResult.filePath}.bak 으로 백업해뒀습니다)`);
  }
  log('다음 Claude Code 상호작용부터 상태표시줄이 표시됩니다.');

  // 터미널을 열 줄 모르는 사용자도 클로드코드 채팅창에서 그냥 /claudetower-widgets라고
  // 치면 위젯을 켜고 끌 수 있게, Personal Skill 파일을 함께 심어둔다(.PRD/01_PRD.md
  // §3의 원래 P1 요구사항 "슬래시 명령 대화형 설정"). SEA로 실행 중일 때만 의미가
  // 있다(개발 모드는 단일 실행 파일이 없어 스킬이 실행할 명령을 못 만듦) — 이 단계가
  // 실패해도(권한 문제 등) setup 자체는 이미 끝난 상태이므로 조용히 건너뛰고
  // 계속 진행한다(통계표시줄 핵심 기능과 무관한 부가 기능이 설치 전체를 막으면 안 됨).
  const usableExePath = resolveUsableExePath();
  if (usableExePath) {
    try {
      const skillResult = writeSkillFile(usableExePath);
      // 원래는 "~/.claude/skills/ 폴더가 이미 있었으면 재시작 없이 바로 인식된다"는
      // 공식 문서를 근거로 조건부 안내였다 — 그런데 실사용 테스트에서 폴더가 이미
      // 있던 환경에서도 재시작 전까지는 인식되지 않는 게 2회 재현됐다(setup을 실행한
      // 바로 그 세션에서 곧바로 "/claudetower-widgets"를 시도 → "No commands match").
      // 문서의 조건과 실측 결과가 어긋난 이상, 조건부로 안내를 생략해 사용자가
      // "왜 안 되지"에 갇히게 하는 것보다 매번 안내하는 쪽이 안전하다.
      log(`\n클로드코드 채팅창에서 "/claudetower-widgets"라고 치면 위젯을 대화로 켜고 끌 수 있습니다.`);
      log('(지금 이 창에서는 바로 안 될 수 있습니다 — 이 창을 완전히 닫고 클로드코드를 새로 시작한 뒤에 써보세요.)');
      if (skillResult.cleanedStaleDirs.length > 0) {
        // 과거 버전이 다른 위치(예: CLAUDE_CONFIG_DIR 미반영 시절의 ~/.claude/skills)에
        // 남긴 낡은 스킬 파일이 새 파일과 공존하면 어느 쪽이 실제로 읽히는지 불확실해져
        // "설치했는데도 안 됨"이 재현된다(2026-07-04 필드이슈 §4 → 2026-07-06 근본원인 확정).
        log(`(이전 버전이 다른 위치에 남겨둔 낡은 설정을 정리했습니다: ${skillResult.cleanedStaleDirs.join(', ')})`);
      }
    } catch (err) {
      log(`\n("/claudetower-widgets" 대화형 설정 등록은 건너뛰었습니다: ${err.message} — 상태표시줄 자체는 정상 작동합니다)`);
    }
  }

  return { enabled, command, settingsFilePath: writeResult.filePath };
}

module.exports = { runSetupWizard, WIDGET_LABELS };
