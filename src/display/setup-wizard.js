'use strict';

// claudetower setup의 실제 로직. readline 인터페이스를 주입받아 실행하므로
// 실제 TTY 없이도(파이프·테스트용 스트림) 재현 가능하다(Step 5에서 검증한 패턴).

const { ALL_WIDGET_TYPES, writeEnabledWidgets } = require('./config/widget-config');
const { writeStatusLineConfig } = require('./config/settings-writer');
const { buildStatuslineCommand } = require('./config/statusline-command');
const { ensureInstalledAtTarget } = require('./config/install-target');

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

async function runSetupWizard(rl, { widgetConfigPath, settingsPath, log = () => {} } = {}) {
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

  const command = buildStatuslineCommand();
  // Claude Code는 기본적으로 "이벤트(대화) 발생 시"에만 상태표시줄을 다시 실행한다
  // (공식 문서 확인). refreshInterval(초 단위, 최소 1)을 지정하면 이벤트와 별개로
  // 고정 주기로도 재실행되어, 프로젝트 위치 등이 조금이라도 더 빠르게 반영된다.
  // 최소값 1초로 설정 — 우리 스크립트 자체는 약 60ms만에 끝나 병목이 아니므로
  // 매초 재실행해도 체감 부담이 없다.
  const writeResult = writeStatusLineConfig({ type: 'command', command, refreshInterval: 1 }, settingsPath);

  log(`\n설정 완료: ${enabled.map((t) => WIDGET_LABELS[t]).join(', ')}`);
  log(`상태표시줄 명령이 Claude Code 설정에 등록됐습니다: ${writeResult.filePath}`);
  if (writeResult.backedUp) {
    log(`(기존 설정은 ${writeResult.filePath}.bak 으로 백업해뒀습니다)`);
  }
  log('다음 Claude Code 상호작용부터 상태표시줄이 표시됩니다.');

  return { enabled, command, settingsFilePath: writeResult.filePath };
}

module.exports = { runSetupWizard, WIDGET_LABELS };
