'use strict';

// .PRD/.archive/PulseLine원본/02_DATA_MODEL.md의 Threshold 엔티티 기본값.
// cost는 total_cost_usd(달러 절대값)라 %인 context/rate_limit과 단위가 다르다 —
// PRD 미기재라 합리적 기본값(경고 $5, 위험 $10)으로 결정, Phase 2 `config` 명령에서 조정 가능.
const DEFAULT_THRESHOLDS = {
  context: { warn_at: 70, critical_at: 90 },
  cost: { warn_at: 5, critical_at: 10 },
  rate_limit_5h: { warn_at: 70, critical_at: 90 },
  rate_limit_7d: { warn_at: 70, critical_at: 90 },
};

const COLOR = {
  warn: '\x1b[33m',
  critical: '\x1b[31m',
  reset: '\x1b[0m',
};

// value가 null/undefined면 색상 판단 자체를 하지 않는다(누락 필드를 0으로 취급해
// 거짓으로 "안전"하다고 표시하지 않기 위함 — stdin을 신뢰하지 않는 입력으로 취급).
function pickColor(metric, value, thresholds = DEFAULT_THRESHOLDS) {
  if (value === null || value === undefined || typeof value !== 'number' || Number.isNaN(value)) {
    return null;
  }
  const rule = thresholds[metric];
  if (!rule) return null;
  if (value >= rule.critical_at) return COLOR.critical;
  if (value >= rule.warn_at) return COLOR.warn;
  return null;
}

function colorize(text, colorCode) {
  if (!colorCode) return text;
  return `${colorCode}${text}${COLOR.reset}`;
}

module.exports = { DEFAULT_THRESHOLDS, COLOR, pickColor, colorize };
