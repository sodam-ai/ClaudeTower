'use strict';

const { pickColor, colorize } = require('../config/thresholds');

// context_window.used_percentage는 세션 초반 null일 수 있음(공식 문서 확인,
// .PRD/.archive/PulseLine원본/RESEARCH_SOURCES.md 313~318행) — null이면 위젯 자체를 숨긴다.
function renderContext(session) {
  const pct = session?.context_window?.used_percentage;
  if (typeof pct !== 'number' || Number.isNaN(pct)) {
    return null;
  }
  const text = `🧠 ${pct}%`;
  return colorize(text, pickColor('context', pct));
}

module.exports = { renderContext };
