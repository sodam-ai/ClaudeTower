'use strict';

// claudetower setup의 실제 로직. readline 인터페이스를 주입받아 실행하므로
// 실제 TTY 없이도(파이프·테스트용 스트림) 재현 가능하다(Step 5에서 검증한 패턴).

const { ALL_WIDGET_TYPES, writeEnabledWidgets } = require('./config/widget-config');
const { writeStatusLineConfig } = require('./config/settings-writer');
const { buildStatuslineCommand } = require('./config/statusline-command');

const WIDGET_LABELS = {
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
  const command = buildStatuslineCommand();
  const writeResult = writeStatusLineConfig({ type: 'command', command }, settingsPath);

  log(`\n설정 완료: ${enabled.map((t) => WIDGET_LABELS[t]).join(', ')}`);
  log(`상태표시줄 명령이 Claude Code 설정에 등록됐습니다: ${writeResult.filePath}`);
  if (writeResult.backedUp) {
    log(`(기존 설정은 ${writeResult.filePath}.bak 으로 백업해뒀습니다)`);
  }
  log('다음 Claude Code 상호작용부터 상태표시줄이 표시됩니다.');

  return { enabled, command, settingsFilePath: writeResult.filePath };
}

module.exports = { runSetupWizard, WIDGET_LABELS };
