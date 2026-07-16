'use strict';

// Account 모듈 전체를 여닫는 마스터 게이트. .PRD/02_DATA_MODEL.md ModuleActivationState.
// enabled가 false인 동안에는 이 모듈 어떤 코드 경로도 실행되지 않아야 한다(단순 조건문이
// 아니라 프로세스 자체를 안 띄우는 수준의 격리, .PRD/04_PROJECT_SPEC.md 보안요구사항).
// 2026-07-11 기준: `claudetower accounts enable` 등 이 값을 실제로 true로 바꾸는 코드는
// 아직 존재하지 않는다(M6 게이트, 2026-07-14 이후 착수) — 이 파일은 데이터 모양만 정의한다.

function createModuleActivationState({
  enabled = false,
  consentGivenAt = null,
  consentTextVersion = null,
} = {}) {
  if (typeof enabled !== 'boolean') {
    throw new TypeError('enabled must be a boolean');
  }
  if (consentGivenAt !== null && typeof consentGivenAt !== 'string') {
    throw new TypeError('consentGivenAt must be a string (ISO 8601) or null');
  }
  if (consentTextVersion !== null && typeof consentTextVersion !== 'string') {
    throw new TypeError('consentTextVersion must be a string or null');
  }
  return {
    enabled,
    consent_given_at: consentGivenAt,
    consent_text_version: consentTextVersion,
  };
}

function isAccountModuleEnabled(state) {
  return Boolean(state && state.enabled === true);
}

module.exports = { createModuleActivationState, isAccountModuleEnabled };
