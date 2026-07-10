'use strict';

// CredentialRef 엔티티. .PRD/.archive/QuotaSwitch원본/02_DATA_MODEL.md "CredentialRef" 절.
// 원칙: "비밀값 자체는 여기 없음" — 이 팩토리는 문서화된 필드만 받는 화이트리스트 구조라,
// token/secret/password 같은 이름의 필드를 실수로라도 저장할 방법이 애초에 없다
// (.PRD/02_DATA_MODEL.md 모듈 경계 규칙, aurakit-security.md "시크릿 하드코딩 금지"를
// 데이터 모델 레벨에서부터 구조적으로 강제).

const BACKENDS = ['windows_dpapi', 'macos_keychain', 'linux_libsecret', 'file_fallback_encrypted'];

function createCredentialRef({ accountId, backend, externalRef, tokenExpiresAt, lastRefreshedAt = null }) {
  if (typeof accountId !== 'string' || accountId.length === 0) {
    throw new TypeError('accountId must be a non-empty string');
  }
  if (!BACKENDS.includes(backend)) {
    throw new TypeError(`backend must be one of: ${BACKENDS.join(', ')}`);
  }
  if (typeof externalRef !== 'string' || externalRef.length === 0) {
    throw new TypeError('externalRef must be a non-empty string');
  }
  if (typeof tokenExpiresAt !== 'string' || tokenExpiresAt.length === 0) {
    throw new TypeError('tokenExpiresAt must be a non-empty string (ISO 8601)');
  }
  if (lastRefreshedAt !== null && typeof lastRefreshedAt !== 'string') {
    throw new TypeError('lastRefreshedAt must be a string or null');
  }

  return {
    account_id: accountId,
    backend,
    external_ref: externalRef,
    token_expires_at: tokenExpiresAt,
    last_refreshed_at: lastRefreshedAt,
  };
}

module.exports = { createCredentialRef, BACKENDS };
