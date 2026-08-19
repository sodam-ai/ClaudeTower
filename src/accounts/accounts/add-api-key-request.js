'use strict';

// `claudetower accounts add --api-key <라벨> <키값>` 요청을 검증·조립하는 순수 로직.
// 04_PROJECT_SPEC.md "계정 관리(CRUD) 요구사항"(라벨 충돌 방지)과 08_ACCOUNTS_ENABLE_
// CONSENT_DRAFT.md 동의 게이트를 결합한다.
//
// credential-store 실제 OS 키체인 I/O는 여전히 throw-스텁이다(2026-07-27 M16 — 실제
// I/O·그 통합테스트만 Claude Code 상위 안전장치가 차단함을 A/B로 확인). 이 함수는
// "무엇을 저장해야 하는지"까지만 결정하고, 실제 저장은 호출부가 credential-store에
// 위임한다(secretToStore를 반환값으로 넘길 뿐, 이 파일 자체는 OS 저장소에 접근하지 않음).
// accountId/createdAt은 호출부가 주입한다(crypto.randomUUID/현재시각 생성은 이 파일의
// 책임이 아님 — account.js와 동일하게 순수 함수 원칙 유지, Math.random() 금지 규칙은
// 실제 ID 생성 시점인 호출부에서 지켜야 함).
//
// 아직 bin/claudetower.js에 연결되지 않았다 — CLI 라우팅 연결("해제 스위치")은
// credential-store 실동작 준비 이후로 보류.

const { createAccount } = require('./account');
const { isAccountModuleEnabled } = require('../module-activation-state');

// src/display/config/text-safety.js와 같은 부류의 제어문자 정규식이지만, Account↔Display
// 모듈은 서로 import하지 않는다는 경계 원칙(M36에서 재확인)에 따라 독립적으로 정의한다.
const MAX_LABEL_LENGTH = 100;
const CONTROL_CHARS = /[\x00-\x1F\x7F]/;

function buildAddApiKeyRequest({
  label,
  apiKeyValue,
  accountId,
  createdAt,
  activationState,
  existingLabels = [],
}) {
  if (!isAccountModuleEnabled(activationState)) {
    throw new Error(
      'Account 모듈이 아직 켜지지 않았습니다. 먼저 claudetower accounts enable로 동의 후 켜주세요.'
    );
  }
  if (typeof label !== 'string' || label.trim().length === 0) {
    throw new TypeError('계정 라벨을 입력해주세요.');
  }
  // 2026-08-19 실측 발견: 길이 상한·제어문자 검증이 없어 2000자 라벨이나 개행이 포함된
  // 라벨이 그대로 accepts-registry.json에 저장됐다 — 나중에 accounts list 같은 걸 만들면
  // 터미널 출력이 깨질 위험(text-safety.js가 다루는 것과 같은 부류의 문제이나, 그건 렌더
  // 시점에 신뢰 못 할 stdin을 잘라내는 용도이고 이건 등록 시점 입력이라 여기서는 조용히
  // 자르는 대신 명확히 거부해 사용자가 의도한 라벨이 아닌 값으로 저장되지 않게 한다).
  if (label.length > MAX_LABEL_LENGTH) {
    throw new TypeError(`계정 라벨은 ${MAX_LABEL_LENGTH}자를 넘을 수 없습니다.`);
  }
  if (CONTROL_CHARS.test(label)) {
    throw new TypeError('계정 라벨에는 줄바꿈 등 제어문자를 쓸 수 없습니다.');
  }
  if (typeof apiKeyValue !== 'string' || apiKeyValue.trim().length === 0) {
    throw new TypeError('API 키 값을 입력해주세요.');
  }
  if (existingLabels.includes(label)) {
    // 04_PROJECT_SPEC.md "슬롯/라벨 충돌 방지" — 자동으로 바꾸지 않고 사용자에게 알림
    throw new Error(`"${label}" 라벨이 이미 등록되어 있습니다. 다른 라벨을 쓰거나 먼저 삭제해주세요.`);
  }

  const account = createAccount({
    accountId,
    label,
    authType: 'api_key',
    status: 'active',
    createdAt,
  });

  return { account, secretToStore: apiKeyValue };
}

module.exports = { buildAddApiKeyRequest };
