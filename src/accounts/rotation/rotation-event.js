'use strict';

// RotationEvent 엔티티. .PRD/.archive/QuotaSwitch원본/02_DATA_MODEL.md "RotationEvent" 절.
// 계정이 언제·왜 전환됐는지 남기는 감사 로그 — 자격증명을 다루는 도구라 필수(문제 발생 시
// 추적 가능해야 함). fromAccountId는 최초 선택 시에는 없을 수 있다(nullable).

const REASONS = ['quota_threshold', 'http_429_failover', 'manual'];

function createRotationEvent({
  eventId,
  fromAccountId = null,
  toAccountId,
  projectPath = null,
  reason,
  occurredAt,
}) {
  if (typeof eventId !== 'string' || eventId.length === 0) {
    throw new TypeError('eventId must be a non-empty string');
  }
  if (fromAccountId !== null && (typeof fromAccountId !== 'string' || fromAccountId.length === 0)) {
    throw new TypeError('fromAccountId must be a non-empty string or null');
  }
  if (typeof toAccountId !== 'string' || toAccountId.length === 0) {
    throw new TypeError('toAccountId must be a non-empty string');
  }
  if (projectPath !== null && typeof projectPath !== 'string') {
    throw new TypeError('projectPath must be a string or null');
  }
  if (!REASONS.includes(reason)) {
    throw new TypeError(`reason must be one of: ${REASONS.join(', ')}`);
  }
  if (typeof occurredAt !== 'string' || occurredAt.length === 0) {
    throw new TypeError('occurredAt must be a non-empty string (ISO 8601)');
  }

  return {
    event_id: eventId,
    from_account_id: fromAccountId,
    to_account_id: toAccountId,
    project_path: projectPath,
    reason,
    occurred_at: occurredAt,
  };
}

module.exports = { createRotationEvent, REASONS };
