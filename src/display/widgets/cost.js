'use strict';

const { pickColor, colorize } = require('../config/thresholds');

function renderCost(session) {
  const usd = session?.cost?.total_cost_usd;
  if (typeof usd !== 'number' || Number.isNaN(usd)) {
    return null;
  }
  const text = `💰 $${usd.toFixed(2)}`;
  return colorize(text, pickColor('cost', usd));
}

module.exports = { renderCost };
