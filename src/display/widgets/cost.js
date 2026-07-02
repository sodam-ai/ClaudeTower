'use strict';

const { pickColor, colorize } = require('../config/thresholds');

function renderCost(session) {
  const usd = session?.cost?.total_cost_usd;
  // Number.isFinite로 NaN과 Infinity/-Infinity를 함께 걸러낸다(경계값 테스트로
  // Infinity가 "$Infinity"로 그대로 출력되는 결함 발견, context.js와 동일 패턴 수정).
  if (!Number.isFinite(usd)) {
    return null;
  }
  const text = `💰 $${usd.toFixed(2)}`;
  return colorize(text, pickColor('cost', usd));
}

module.exports = { renderCost };
