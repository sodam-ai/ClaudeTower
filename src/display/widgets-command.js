'use strict';

// claudetower widgets [on|off] [항목...] — 위젯 5개 질문을 처음부터 다시 답하지 않고
// 지정한 항목만 켜고/끄는 빠른 경로. setup 마법사와 동일한 저장 함수를 재사용하므로
// settings.json(상태표시줄 등록)은 건드리지 않는다(위젯 표시 여부만 config.json에 반영).

const { ALL_WIDGET_TYPES, readEnabledWidgets, writeEnabledWidgets } = require('./config/widget-config');
const { WIDGET_LABELS } = require('./setup-wizard');

function formatStatusLines(enabled) {
  return ALL_WIDGET_TYPES.map((type) => {
    const mark = enabled.includes(type) ? '켜짐' : '꺼짐';
    return `  ${WIDGET_LABELS[type]}: ${mark}`;
  }).join('\n');
}

// setup의 "Y/n 5개 질문 전부" 명령과 달리, 이미 켜진 나머지 항목의 상태는 그대로
// 두고 사용자가 지정한 항목만 바꾼다 — "설정을 쉽게 켜고 끄고 싶다"는 실사용
// 피드백의 근본 요구사항(전체 재설정이 아니라 부분 변경).
function applyWidgetChange(action, names, { widgetConfigPath, log = () => {} } = {}) {
  const invalid = names.filter((n) => !ALL_WIDGET_TYPES.includes(n));
  if (invalid.length > 0) {
    log(`알 수 없는 항목: ${invalid.join(', ')}`);
    log(`사용 가능한 항목: ${ALL_WIDGET_TYPES.join(', ')}`);
    return { applied: false };
  }

  const current = new Set(readEnabledWidgets(widgetConfigPath));
  if (action === 'on') {
    names.forEach((n) => current.add(n));
  } else {
    names.forEach((n) => current.delete(n));
  }

  if (current.size === 0) {
    // setup 마법사와 동일한 안전장치 — 최소 1개는 항상 켜져 있어야 한다.
    log('모든 항목을 끌 수는 없습니다 — 최소 1개는 켜져 있어야 합니다.');
    return { applied: false };
  }

  const enabled = ALL_WIDGET_TYPES.filter((t) => current.has(t));
  writeEnabledWidgets(enabled, widgetConfigPath);
  log(`변경 완료:\n${formatStatusLines(enabled)}`);
  return { applied: true, enabled };
}

function showStatus({ widgetConfigPath, log = () => {} } = {}) {
  const enabled = readEnabledWidgets(widgetConfigPath);
  log(`지금 상태:\n${formatStatusLines(enabled)}`);
  return { enabled };
}

// bin/claudetower.js에서 `widgets on context cost` 형태의 args를 그대로 넘겨받는다.
function runWidgetsCommand(args, opts = {}) {
  const [action, ...names] = args;
  if (action !== 'on' && action !== 'off') {
    return showStatus(opts);
  }
  return applyWidgetChange(action, names, opts);
}

module.exports = { runWidgetsCommand, applyWidgetChange, showStatus, formatStatusLines };
