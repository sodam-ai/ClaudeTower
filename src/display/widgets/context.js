'use strict';

const { pickColor, colorize } = require('../config/thresholds');
const { renderGauge } = require('../config/gauge');

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
  // 아이콘만으로는 처음 쓰는 사람이 뭘 뜻하는지 알기 어렵다는 실사용 피드백 반영 —
  // 한글 이름표 + 게이지바를 같이 넣어 아이콘을 몰라도 바로 이해되게 한다.
  // 아이콘 대신 한글 이름표를 쓰므로 뜻이 겹치는 🧠는 굳이 안 붙인다(공간 절약).
  const text = `컨텍스트 ${renderGauge(pct)} ${pct}%`;
  return colorize(text, pickColor('context', pct));
}

module.exports = { renderContext };
