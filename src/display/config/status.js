'use strict';

// "설치 여부를 확실히 알 수 있게" — setup/uninstall을 실행한 세션이 끝난 뒤에도
// 나중에 언제든 조회할 수 있는 읽기 전용 상태 확인 로직.
const fs = require('node:fs');
const { resolveSettingsPath, readExistingSettings } = require('./settings-writer');
const { resolveWidgetConfigPath, readEnabledWidgets } = require('./widget-config');

// statusline-command.js가 항상 경로를 큰따옴표로 감싸므로("...") 그 안의 경로들을
// 뽑아낸다. command 문자열에 등록된 파일이 실제로 존재하는지까지 확인해야
// "등록은 돼 있지만 실행 파일이 사라져서 사실은 고장난 상태"를 잡아낼 수 있다
// (문자열만 보고 "설치됨"이라 판단하면 이 상태를 놓친다 — 실사용 피드백으로 발견).
function extractQuotedPaths(command) {
  const matches = command.match(/"([^"]+)"/g) || [];
  return matches.map((m) => m.slice(1, -1));
}

function commandFilesExist(command) {
  const paths = extractQuotedPaths(command);
  if (paths.length === 0) return true; // 옛 버전이 만든 따옴표 없는 명령 — 판단 불가, 통과 처리
  return paths.every((p) => fs.existsSync(p));
}

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
    broken: !commandFilesExist(statusLine.command),
    command: statusLine.command,
    refreshInterval: statusLine.refreshInterval,
    enabledWidgets: readEnabledWidgets(widgetConfigPath),
    settingsPath,
    widgetConfigPath,
  };
}

module.exports = { getInstallStatus };
