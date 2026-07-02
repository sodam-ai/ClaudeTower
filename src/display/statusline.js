'use strict';

const fs = require('node:fs');
const { renderModel } = require('./widgets/model');
const { renderLocation } = require('./widgets/location');
const { renderContext } = require('./widgets/context');
const { renderCost } = require('./widgets/cost');
const { renderRateLimit } = require('./widgets/rate-limit');
const { readEnabledWidgets } = require('./config/widget-config');

// Phase 1 기본 활성 위젯 순서(.PRD/01_PRD.md §3). type은 claudetower setup이 쓰는
// widget-config.js의 enabled_widgets 값과 일치해야 한다. model이 맨 앞인 이유는
// PulseLine 원본 설계의 enabled_fields 기본 순서를 따름(widget-config.js 참고).
const WIDGETS = [
  { type: 'model', render: renderModel },
  { type: 'location', render: renderLocation },
  { type: 'context', render: renderContext },
  { type: 'cost', render: renderCost },
  { type: 'rate_limit', render: renderRateLimit },
];

function readStdinJson() {
  let raw;
  try {
    raw = fs.readFileSync(0, 'utf8');
  } catch {
    return {};
  }
  if (!raw || raw.trim().length === 0) return {};
  try {
    const parsed = JSON.parse(raw);
    // stdin을 신뢰하지 않는 입력으로 취급(.PRD/04_PROJECT_SPEC.md 입력값 검증 요구사항) —
    // 객체가 아니면(배열/문자열/숫자 등) 빈 세션으로 처리.
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      return {};
    }
    return parsed;
  } catch {
    return {};
  }
}

// 위젯 단위 격리(.PRD/04_PROJECT_SPEC.md) — 위젯 하나가 예외를 던져도
// 나머지 위젯·전체 상태표시줄 렌더링은 계속돼야 한다.
// enabledWidgets를 명시적으로 받게 해서(기본값은 실제 설정 파일 읽기) 테스트가
// 이 머신의 실제 ~/.claudetower/config.json 상태와 무관하게 결정적으로 동작하게 한다.
function render(session, enabledWidgets = readEnabledWidgets()) {
  const parts = [];
  for (const widget of WIDGETS) {
    if (!enabledWidgets.includes(widget.type)) continue;
    let result;
    try {
      result = widget.render(session);
    } catch {
      result = null;
    }
    if (typeof result === 'string' && result.length > 0) {
      parts.push(result);
    }
  }
  return parts.join('  ');
}

if (require.main === module) {
  const session = readStdinJson();
  process.stdout.write(render(session));
}

module.exports = { render, readStdinJson, WIDGETS };
