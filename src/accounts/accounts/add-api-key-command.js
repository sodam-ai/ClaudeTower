'use strict';

// `claudetower accounts add --api-key <라벨> <키값>` — API키 계정을 실제로 등록한다.
// (로그인 계정 자동화는 Anthropic ToS §3-1/§3-3 이중 금지로 여전히 미구현 — 이 파일은
// API키 경로만 다룬다.)
//
// add-api-key-request.js(순수 검증·조립 로직)가 만든 secretToStore를 실제로
// credential-store(OS 키체인)에 쓰고, Account 레코드(비밀값 제외)를 레지스트리에
// 남긴다. 두 쓰기 사이에 완벽한 트랜잭션은 없지만, 두 번째(레지스트리) 쓰기가
// 실패하면 첫 번째(키체인) 쓰기를 되돌리려 시도하고, 그것도 실패하면 사람이 놓칠 수
// 없게 명시적으로 경고한다 — "키는 저장됐는데 목록엔 없는" 상태를 조용히 넘기지 않는다.

const crypto = require('node:crypto');
const { buildAddApiKeyRequest } = require('./add-api-key-request');
const { createCredentialRef } = require('../credential-store/credential-ref');
const { setSecret, deleteSecret } = require('../credential-store');
const { readActivationState } = require('../module-activation-state-store');
const { existingLabels, appendAccount } = require('./accounts-registry');

function backendForPlatform() {
  if (process.platform === 'win32') return 'windows_dpapi';
  if (process.platform === 'darwin') return 'macos_keychain';
  if (process.platform === 'linux') return 'linux_libsecret';
  throw new Error(`지원하지 않는 플랫폼입니다: ${process.platform} (Windows/macOS/Linux만 지원)`);
}

// API 키는 OAuth 토큰과 달리 전통적인 만료 개념이 없다(Anthropic API 키는 수동으로
// 폐기하기 전까지 유효). CredentialRef.token_expires_at은 스키마상 비어있지 않은 ISO
// 문자열을 요구한다(credential-ref.js, 이미 review 끝난 파일이라 스키마를 바꾸지
// 않음) — "만료 없음"을 나타내는 먼 미래 sentinel 값으로 그 의미를 표현한다.
const NO_EXPIRY_SENTINEL = '9999-12-31T23:59:59.999Z';

function runAddApiKeyCommand(
  { label, apiKeyValue },
  { activationStatePath, registryPath, log = () => {} } = {}
) {
  const activationState = readActivationState(activationStatePath);

  let request;
  try {
    request = buildAddApiKeyRequest({
      label,
      apiKeyValue,
      accountId: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      activationState,
      existingLabels: existingLabels(registryPath),
    });
  } catch (err) {
    log(err.message);
    return { applied: false };
  }

  const { account, secretToStore } = request;
  const credentialRef = createCredentialRef({
    accountId: account.account_id,
    backend: backendForPlatform(),
    externalRef: account.account_id,
    tokenExpiresAt: NO_EXPIRY_SENTINEL,
    lastRefreshedAt: null,
  });

  setSecret(credentialRef, secretToStore);

  try {
    appendAccount(account, registryPath);
  } catch (registryErr) {
    try {
      deleteSecret(credentialRef);
      log(`계정 등록 실패(목록 저장 오류로 방금 저장한 키를 롤백했습니다): ${registryErr.message}`);
    } catch (rollbackErr) {
      log(
        `심각: 자격증명은 저장됐지만 목록 등록에 실패했고 자동 롤백도 실패했습니다. ` +
          `수동 확인이 필요합니다. (목록 오류: ${registryErr.message} / 롤백 오류: ${rollbackErr.message})`
      );
    }
    return { applied: false };
  }

  log(`계정 "${label}"을(를) 등록했습니다 (API 키, 이 컴퓨터의 OS 자격증명 저장소에 안전하게 저장됨).`);
  return { applied: true, accountId: account.account_id };
}

module.exports = { runAddApiKeyCommand, backendForPlatform, NO_EXPIRY_SENTINEL };
