'use strict';

// 어떤 위젯을 켤지 저장하는 아주 작은 설정 파일. .PRD/01_PRD.md의
// "슬래시 명령 대화형 설정 -> 표시 항목 설정"(Phase 1 MVP)을 위한 최소 구현.
// StatuslineConfig의 enabled_fields에 해당하지만, padding/refresh_interval 등
// 나머지 필드는 Phase 1에 필요하다는 요구가 없어 지금 만들지 않는다(과도한 설계 방지).

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { CONFIG_DIR_NAME } = require('../../shared/constants');

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

function writeEnabledWidgets(enabledWidgets, filePath = resolveWidgetConfigPath()) {
  const invalid = enabledWidgets.filter((w) => !ALL_WIDGET_TYPES.includes(w));
  if (invalid.length > 0) {
    throw new Error(`알 수 없는 위젯 종류: ${invalid.join(', ')}`);
  }
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify({ enabled_widgets: enabledWidgets }, null, 2), 'utf8');
}

module.exports = { ALL_WIDGET_TYPES, resolveWidgetConfigPath, readEnabledWidgets, writeEnabledWidgets };
