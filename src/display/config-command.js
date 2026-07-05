'use strict';

// claudetower config statusline-refresh <초> — .PRD/06_FIELD_ISSUE_SPAWN_STORM_2026-07-04.md
// FR-1. 지금까지는 refreshInterval이 setup에서 항상 1로 고정 기록되고 사용자가
// 바꿀 방법이 없었다(settings.json을 손으로 고쳐야 했음). statusLine이 매초 83MB
// exe를 스폰하는 게 이 PC에서 실제로 관찰된 프로세스 폭주(0x800700e8)의 상수
// 기여 요인이었으므로, 주기를 늘려 부하를 줄일 수 있는 안전한 경로를 제공한다.

const { updateRefreshInterval } = require('./config/settings-writer');

function runConfigCommand(args, { settingsPath, log = () => {} } = {}) {
  const [sub, value] = args;

  if (sub !== 'statusline-refresh') {
    log('사용법: claudetower config statusline-refresh <1 이상의 정수(초)>');
    return { applied: false };
  }

  const seconds = Number(value);
  if (!Number.isInteger(seconds) || seconds < 1) {
    log('갱신 주기는 1 이상의 정수(초)여야 합니다. 예: claudetower config statusline-refresh 5');
    return { applied: false };
  }

  try {
    const result = updateRefreshInterval(seconds, settingsPath);
    log(`상태표시줄 갱신 주기를 ${result.refreshInterval}초로 설정했습니다: ${result.filePath}`);
    log('다음 Claude Code 상호작용부터 적용됩니다.');
    return { applied: true, refreshInterval: result.refreshInterval };
  } catch (err) {
    log(err.message);
    return { applied: false };
  }
}

module.exports = { runConfigCommand };
