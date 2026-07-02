'use strict';

const { pickColor, colorize } = require('../config/thresholds');

// context_window.used_percentage는 세션 초반 null일 수 있음(공식 문서 확인,
// .PRD/.archive/PulseLine원본/RESEARCH_SOURCES.md 313~318행) — null이면 위젯 자체를 숨긴다.
function renderContext(session) {
  const pct = session?.context_window?.used_percentage;
  // Number.isFinite는 NaN뿐 아니라 Infinity/-Infinity도 함께 걸러낸다 — typeof+isNaN
  // 조합만 쓰면 Infinity가 통과해 "Infinity%"가 그대로 표시되는 결함이 있었다
  // (경계값 테스트로 발견, 실제 Claude Code stdin은 JSON이라 Infinity를 못 실어 보내지만
  // 방어적으로 수정).
  if (!Number.isFinite(pct)) {
    return null;
  }
  const text = `🧠 ${pct}%`;
  return colorize(text, pickColor('context', pct));
}

module.exports = { renderContext };
