'use strict';

// Account 엔티티. .PRD/.archive/QuotaSwitch원본/02_DATA_MODEL.md "Account" 절 그대로 —
// 실제 토큰 값은 절대 담지 않는다(자격증명은 CredentialRef가 OS 저장소를 "가리키기"만 함).

const AUTH_TYPES = ['oauth', 'api_key'];
const STATUSES = ['active', 'cooldown', 'disabled'];

function createAccount({
  accountId,
  label,
  authType,
  status,
  createdAt,
  lastProjectPath = null,
  lastUsedAt = null,
}) {
  if (typeof accountId !== 'string' || accountId.length === 0) {
    throw new TypeError('accountId must be a non-empty string');
  }
  if (typeof label !== 'string' || label.length === 0) {
    throw new TypeError('label must be a non-empty string');
  }
  if (!AUTH_TYPES.includes(authType)) {
    throw new TypeError(`authType must be one of: ${AUTH_TYPES.join(', ')}`);
  }
  if (!STATUSES.includes(status)) {
    throw new TypeError(`status must be one of: ${STATUSES.join(', ')}`);
  }
  if (typeof createdAt !== 'string' || createdAt.length === 0) {
    throw new TypeError('createdAt must be a non-empty string (ISO 8601)');
  }
  if (lastProjectPath !== null && typeof lastProjectPath !== 'string') {
    throw new TypeError('lastProjectPath must be a string or null');
  }
  if (lastUsedAt !== null && typeof lastUsedAt !== 'string') {
    throw new TypeError('lastUsedAt must be a string or null');
  }

  return {
    account_id: accountId,
    label,
    auth_type: authType,
    status,
    created_at: createdAt,
    last_project_path: lastProjectPath,
    last_used_at: lastUsedAt,
  };
}

module.exports = { createAccount, AUTH_TYPES, STATUSES };
