'use strict';

// 어떤 위젯을 켤지 저장하는 아주 작은 설정 파일. .PRD/01_PRD.md의
// "슬래시 명령 대화형 설정 -> 표시 항목 설정"(Phase 1 MVP)을 위한 최소 구현.
// StatuslineConfig의 enabled_fields에 해당하지만, padding/refresh_interval 등
// 나머지 필드는 Phase 1에 필요하다는 요구가 없어 지금 만들지 않는다(과도한 설계 방지).

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { CONFIG_DIR_NAME } = require('../../shared/constants');
const { isPartialIsolation, assertNotPartialIsolation } = require('./test-isolation');

// model은 PulseLine 원본 설계(.PRD/.archive/PulseLine원본/02_DATA_MODEL.md 46/79행,
// enabled_fields 기본값에 model이 가장 먼저 나열됨)에 있었는데 ClaudeTower 통합 과정에서
// 빠져 있던 것을 복원(실사용 피드백으로 발견). 순서도 원본과 동일하게 맨 앞에 둔다.
const ALL_WIDGET_TYPES = ['model', 'location', 'context', 'cost', 'rate_limit'];

function resolveWidgetConfigPath() {
  return (
    process.env.CLAUDETOWER_WIDGET_CONFIG_PATH ||
    path.join(os.homedir(), CONFIG_DIR_NAME, 'config.json')
  );
}

// 이 설정 파일에 필드를 하나 더 추가(powerline_separator)하면서, 기존
// writeEnabledWidgets가 파일을 통째로 덮어써 다른 필드를 지워버리던 걸 먼저
// 고쳐야 했다 — 안 그러면 "Powerline 켜기 → 아무 위젯이나 켜고 끄기"만 해도
// Powerline 설정이 조용히 사라지는 새 회귀가 생긴다. 그래서 read-merge-write로
// 통일한다(현재 필드가 2개뿐이라 과하지 않은 범위).
function readRawConfig(filePath) {
  if (!fs.existsSync(filePath)) return {};
  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function readEnabledWidgets(filePath = resolveWidgetConfigPath()) {
  if (!fs.existsSync(filePath)) {
    return ALL_WIDGET_TYPES; // 설정 파일이 없으면(설치 직후 등) 전부 기본 활성화
  }
  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    if (!Array.isArray(parsed.enabled_widgets)) return ALL_WIDGET_TYPES;
    const valid = parsed.enabled_widgets.filter((w) => ALL_WIDGET_TYPES.includes(w));
    return valid.length > 0 ? valid : ALL_WIDGET_TYPES;
  } catch {
    return ALL_WIDGET_TYPES; // 손상된 위젯 설정은 안전하게 기본값으로(이 파일은 statusLine 구조와 달리
    // 매 렌더 호출마다 읽는 저위험 파일이라 settings-writer처럼 강하게 막지 않고 기본값 폴백)
  }
}

// 명시적 filePath 인자는 방어막을 우회한다(호출자가 경로를 직접 통제하는 경우 —
// 단위테스트가 임시 경로를 넘기는 케이스). 인자 없이 실제 기본 경로로 폴백할 때만,
// 부분 격리(다른 CLAUDETOWER_* 변수만 설정됨) 상태면 실제 파일 쓰기를 거부한다
// (2026-07-06 실측 확정 결함 부류 — test-isolation.js 참고).
function writeEnabledWidgets(enabledWidgets, filePath) {
  if (filePath === undefined) {
    assertNotPartialIsolation('CLAUDETOWER_WIDGET_CONFIG_PATH', '위젯 설정 파일');
    filePath = resolveWidgetConfigPath();
  }
  const invalid = enabledWidgets.filter((w) => !ALL_WIDGET_TYPES.includes(w));
  if (invalid.length > 0) {
    throw new Error(`알 수 없는 위젯 종류: ${invalid.join(', ')}`);
  }
  const existing = readRawConfig(filePath);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(
    filePath,
    JSON.stringify({ ...existing, enabled_widgets: enabledWidgets }, null, 2),
    'utf8'
  );
}

// Powerline 구분자(테마·색상 없이, 위젯 사이를 잇는 구분 기호만) — .PRD/01_PRD.md §Out of
// Scope가 "Phase 1은 부가 기능 배제, Phase 3로 연기"라고 적어둔 이유가 Account 모듈
// 의존이 아니라 "격리 구조부터 검증"이었음을 확인(2026-07-18)하고, 그 조건이 실사용자
// 검증까지 끝나 충족돼 가장 작은 조각(구분자만)부터 시작. 기본값은 false — 기존
// 사용자는 아무것도 안 바뀜(opt-in), Nerd Font 미설치 환경에서 글자가 깨지는 것도
// 명시적으로 켠 사람만 감수하는 구조라 별도 폰트 감지 로직 없이도 안전하다.
function readPowerlineSeparator(filePath = resolveWidgetConfigPath()) {
  return readRawConfig(filePath).powerline_separator === true;
}

function writePowerlineSeparator(enabled, filePath) {
  if (filePath === undefined) {
    assertNotPartialIsolation('CLAUDETOWER_WIDGET_CONFIG_PATH', '위젯 설정 파일');
    filePath = resolveWidgetConfigPath();
  }
  const existing = readRawConfig(filePath);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(
    filePath,
    JSON.stringify({ ...existing, powerline_separator: enabled === true }, null, 2),
    'utf8'
  );
}

// uninstall용 — 위젯 설정 파일 삭제. 부분 격리 상태에서 인자 없이 호출되면 실제
// 파일을 지우는 대신 건너뛰었음을 반환한다(uninstall이 이 결과로 정직하게 안내).
function removeWidgetConfigFile(filePath) {
  if (filePath === undefined) {
    if (isPartialIsolation('CLAUDETOWER_WIDGET_CONFIG_PATH')) {
      return { removed: false, skipped: 'partial-test-isolation', filePath: resolveWidgetConfigPath() };
    }
    filePath = resolveWidgetConfigPath();
  }
  if (!fs.existsSync(filePath)) {
    return { removed: false, filePath };
  }
  fs.unlinkSync(filePath);
  return { removed: true, filePath };
}

module.exports = {
  ALL_WIDGET_TYPES,
  resolveWidgetConfigPath,
  readEnabledWidgets,
  writeEnabledWidgets,
  removeWidgetConfigFile,
  readPowerlineSeparator,
  writePowerlineSeparator,
};
