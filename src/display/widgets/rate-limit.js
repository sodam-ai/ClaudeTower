'use strict';

const { pickColor, colorize } = require('../config/thresholds');

// rate_limits 자체가 통째로 없을 수 있고(Pro/Max 구독자만, 첫 API 응답 전엔 없음),
// five_hour/seven_day도 각각 독립적으로 없을 수 있음(공식 문서 확인,
// .PRD/.archive/PulseLine원본/RESEARCH_SOURCES.md 311행). 하나가 없어도 있는 것만 표시.
function renderRateLimit(session) {
  const fiveHour = session?.rate_limits?.five_hour?.used_percentage;
  const sevenDay = session?.rate_limits?.seven_day?.used_percentage;

  // Number.isFinite로 NaN과 Infinity/-Infinity를 함께 걸러낸다(context.js/cost.js와
  // 동일한 결함이 여기도 있었음 — 경계값 테스트로 발견).
  const parts = [];
  if (Number.isFinite(fiveHour)) {
    parts.push(colorize(`5h ${fiveHour}%`, pickColor('rate_limit_5h', fiveHour)));
  }
  if (Number.isFinite(sevenDay)) {
    parts.push(colorize(`7d ${sevenDay}%`, pickColor('rate_limit_7d', sevenDay)));
  }

  if (parts.length === 0) return null;
  return `⏱ ${parts.join(' ')}`;
}

module.exports = { renderRateLimit };
