'use strict';

const fs = require('node:fs');
const { renderLocation } = require('./widgets/location');
const { renderContext } = require('./widgets/context');
const { renderCost } = require('./widgets/cost');
const { renderRateLimit } = require('./widgets/rate-limit');

// Phase 1 기본 활성 위젯 순서(.PRD/01_PRD.md §3). QuickSetup(Step 7)이 생기기 전까지는
// 사용자 설정 없이 이 기본값만 쓴다 — 설정 파일을 미리 읽는 코드를 만들지 않는다(과도한 설계 방지).
const WIDGETS = [renderLocation, renderContext, renderCost, renderRateLimit];

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
function render(session) {
  const parts = [];
  for (const widget of WIDGETS) {
    let result;
    try {
      result = widget(session);
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
