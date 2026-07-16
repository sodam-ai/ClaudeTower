'use strict';

// QuotaState 엔티티. .PRD/.archive/QuotaSwitch원본/02_DATA_MODEL.md "QuotaState" 절 그대로.
// teamclaude의 "session (5h) quota"/"weekly (7d) quota" 용어 채택 — 공식 API 값이라
// 별도 로컬 집계 없이 이 필드만으로 충분하다(2026-07-04 재확인).

function isPercent(value) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 100;
}

function createQuotaState({
  accountId,
  fiveHourUsedPct,
  sevenDayUsedPct,
  fiveHourResetsAt,
  sevenDayResetsAt,
  lastCheckedAt,
}) {
  if (typeof accountId !== 'string' || accountId.length === 0) {
    throw new TypeError('accountId must be a non-empty string');
  }
  if (!isPercent(fiveHourUsedPct)) {
    throw new TypeError('fiveHourUsedPct must be a number between 0 and 100');
  }
  if (!isPercent(sevenDayUsedPct)) {
    throw new TypeError('sevenDayUsedPct must be a number between 0 and 100');
  }
  for (const [name, value] of [
    ['fiveHourResetsAt', fiveHourResetsAt],
    ['sevenDayResetsAt', sevenDayResetsAt],
    ['lastCheckedAt', lastCheckedAt],
  ]) {
    if (typeof value !== 'string' || value.length === 0) {
      throw new TypeError(`${name} must be a non-empty string (ISO 8601)`);
    }
  }

  return {
    account_id: accountId,
    five_hour_used_pct: fiveHourUsedPct,
    seven_day_used_pct: sevenDayUsedPct,
    five_hour_resets_at: fiveHourResetsAt,
    seven_day_resets_at: sevenDayResetsAt,
    last_checked_at: lastCheckedAt,
  };
}

module.exports = { createQuotaState };
