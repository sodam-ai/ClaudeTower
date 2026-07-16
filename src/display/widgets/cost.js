'use strict';

const { pickColor, colorize } = require('../config/thresholds');

function renderCost(session) {
  const usd = session?.cost?.total_cost_usd;
  // Number.isFinite로 NaN과 Infinity/-Infinity를 함께 걸러낸다(경계값 테스트로
  // Infinity가 "$Infinity"로 그대로 출력되는 결함 발견, context.js와 동일 패턴 수정).
  if (!Number.isFinite(usd)) {
    return null;
  }
  // 음수 비용은 실제 세션에서 발생하지 않지만, 손상된 데이터가 들어와도
  // "$-5.00"처럼 말이 안 되는 값을 그대로 보여주지 않는다(경계값 테스트로 발견,
  // context.js가 0~100을 클램핑하는 것과 동일한 방어 원칙).
  const clamped = Math.max(0, usd);
  const text = `💰 $${clamped.toFixed(2)}`;
  return colorize(text, pickColor('cost', clamped));
}

module.exports = { renderCost };
