'use strict';

const fs = require('node:fs');
const { renderModel } = require('./widgets/model');
const { renderLocation } = require('./widgets/location');
const { renderContext } = require('./widgets/context');
const { renderCost } = require('./widgets/cost');
const { renderRateLimit } = require('./widgets/rate-limit');
const { readEnabledWidgets, readPowerlineSeparator } = require('./config/widget-config');

// 위젯 사이 기본 구분자는 공백 2칸. Powerline 구분자를 켜면(claudetower config
// powerline on) 이 화살표로 바뀐다 — 배경색 블록은 없음(테마 시스템 아님, 순수
// 구분 기호만). U+E0B1(얇은 화살표)을 골랐다: U+E0B0(꽉 찬 삼각형)은 배경색이
// 없으면 어색해 보이지만 이건 텍스트 사이에 그대로 둬도 자연스럽다.
const DEFAULT_SEPARATOR = '  ';
const POWERLINE_SEPARATOR = '  ';

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
function render(
  session,
  enabledWidgets = readEnabledWidgets(),
  powerlineEnabled = readPowerlineSeparator()
) {
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
  return parts.join(powerlineEnabled ? POWERLINE_SEPARATOR : DEFAULT_SEPARATOR);
}

if (require.main === module) {
  const session = readStdinJson();
  process.stdout.write(render(session));
}

module.exports = { render, readStdinJson, WIDGETS };
