'use strict';

const { pickColor, colorize, COLOR } = require('../config/thresholds');
const { renderGauge } = require('../config/gauge');

// rate_limits 자체가 통째로 없을 수 있고(Pro/Max 구독자만, 첫 API 응답 전엔 없음),
// five_hour/seven_day도 각각 독립적으로 없을 수 있음(공식 문서 확인,
// .PRD/.archive/PulseLine원본/RESEARCH_SOURCES.md 311행). 하나가 없어도 있는 것만 표시.
function renderRateLimit(session) {
  const fiveHour = session?.rate_limits?.five_hour?.used_percentage;
  const sevenDay = session?.rate_limits?.seven_day?.used_percentage;

  // Number.isFinite로 NaN과 Infinity/-Infinity를 함께 걸러낸다(context.js/cost.js와
  // 동일한 결함이 여기도 있었음 — 경계값 테스트로 발견).
  // 아이콘만으로는 처음 쓰는 사람이 뭘 뜻하는지 알기 어렵다는 실사용 피드백 반영 —
  // "5시간"/"7일" 한글 이름표 + 게이지바를 같이 넣는다.
  // "게이지바가 평범하다"는 피드백으로, 안전 구간도 항상 초록색을 입힌다(context.js와 동일 패턴).
  const parts = [];
  if (Number.isFinite(fiveHour)) {
    parts.push(colorize(`5시간 ${renderGauge(fiveHour)} ${fiveHour}%`, pickColor('rate_limit_5h', fiveHour) || COLOR.safe));
  }
  if (Number.isFinite(sevenDay)) {
    parts.push(colorize(`7일 ${renderGauge(sevenDay)} ${sevenDay}%`, pickColor('rate_limit_7d', sevenDay) || COLOR.safe));
  }

  // "5시간"/"7일" 이름표 자체가 이미 뜻을 설명하므로 ⏱·"사용률" 접두어는 생략(공간 절약).
  if (parts.length === 0) return null;
  return parts.join('  ');
}

module.exports = { renderRateLimit };
