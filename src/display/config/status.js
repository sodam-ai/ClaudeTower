'use strict';

// "설치 여부를 확실히 알 수 있게" — setup/uninstall을 실행한 세션이 끝난 뒤에도
// 나중에 언제든 조회할 수 있는 읽기 전용 상태 확인 로직.
const { resolveSettingsPath, readExistingSettings } = require('./settings-writer');
const { resolveWidgetConfigPath, readEnabledWidgets } = require('./widget-config');

// statusLine이 등록돼 있어도 그게 claudetower가 만든 게 아닐 수 있다(사용자가 직접
// 다른 스크립트를 등록해뒀을 가능성) — "설치 안 됨"과 "다른 도구가 설치돼 있음"을
// 구분해야 사용자가 원인을 오해하지 않는다. 우리가 생성하는 command는 항상
// bin/claudetower.js 경로 또는 claudetower-<os>-<arch> 바이너리 이름을 포함한다.
function getInstallStatus({
  settingsPath = resolveSettingsPath(),
  widgetConfigPath = resolveWidgetConfigPath(),
} = {}) {
  const settings = readExistingSettings(settingsPath);
  const statusLine = settings.statusLine;

  if (!statusLine || typeof statusLine.command !== 'string') {
    return { installed: false, foreign: false, settingsPath };
  }

  const isOurs = statusLine.command.toLowerCase().includes('claudetower');
  if (!isOurs) {
    return { installed: false, foreign: true, command: statusLine.command, settingsPath };
  }

  return {
    installed: true,
    foreign: false,
    command: statusLine.command,
    refreshInterval: statusLine.refreshInterval,
    enabledWidgets: readEnabledWidgets(widgetConfigPath),
    settingsPath,
    widgetConfigPath,
  };
}

module.exports = { getInstallStatus };
