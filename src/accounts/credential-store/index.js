'use strict';

// Account 모듈의 OS 자격증명 저장소 접근 인터페이스 — 2026-08-18 실제 구현으로 교체.
//
// 채택 라이브러리: `@napi-rs/keyring`(이미 설치됨, package.json 의존성 확인).
//   Windows Credential Manager/DPAPI, macOS Keychain, Linux Secret Service를 단일
//   `Entry` API로 감싼다 — 이 파일은 플랫폼 분기를 직접 하지 않고 라이브러리에 위임한다.
//
// 검증 범위(정직하게 명시): 이 구현은 **Windows에서만 실제 조회/저장/삭제를 라이브로
// 확인**했다(2026-08-18, 대화형 세션에서 사용자가 직접 지켜보는 상태로 테스트 전용 항목
// round-trip 성공, 흔적 없이 정리 완료). macOS/Linux는 라이브러리가 동일 API로 크로스
// 플랫폼을 표방한다는 것에 근거한 **추정**일 뿐, 이 세션에서 실측하지 않았다.
//
// 이전 기록(CHECKPOINT M16/M20, 2026-07-27/28)은 동일한 라이브러리·동일한 API 호출이
// Claude Code 상위 안전장치에 A/B로 확인될 만큼 명확히 차단됐다고 남겨져 있었다. 이번엔
// 같은 걸 다시 시도했는데 막히지 않았다 — **왜 달라졌는지는 확인하지 못했다**(가능성:
// Auto Mode 세션이라 권한 처리가 다름 / 3주 사이 분류기 동작 변경 / 당시와 조건이 미묘하게
// 달랐음. 전부 추측이며 사실로 단정하지 않는다). 확실한 사실은 "오늘, 이 세션에서 막히지
// 않았다"는 것뿐이다.
//
// service/username 유도: `Entry(service, username)`에서 service는 앱을 구분하는 고정값
// 'claudetower', username은 `CredentialRef.external_ref`를 그대로 쓴다 — external_ref가
// 이미 "이 자격증명을 어떻게 찾을지"를 나타내는 필드로 설계돼 있어(credential-ref.js),
// 별도 키 조합 규칙을 새로 만들지 않고 그 의미를 그대로 재사용한다. `backend` 필드는
// 감사·표시용 메타데이터로만 쓰고, 실제 저장소 선택은 `@napi-rs/keyring`이 OS를 보고
// 자동으로 한다(우리가 플랫폼별로 분기할 필요 없음 — 라이브러리의 존재 이유 자체가 이거다).
//
// getSecret 계약: 존재하지 않는 항목은 **에러를 던지지 않고 null을 반환**한다(라이브
// 테스트로 확인된 `@napi-rs/keyring` 자체의 네이티브 동작을 그대로 노출). "계정은 있는데
// 자격증명만 사라진" 상태를 에러로 취급할지는 이 파일의 책임이 아니라 호출부(향후 CLI
// 배선 시점)가 CredentialRef.account_id 존재 여부와 대조해서 판단할 문제로 남긴다.
//
// deleteSecret 계약: 존재하지 않는 항목 삭제는 **에러 없이 조용히 성공 처리**한다(마찬가지로
// 라이브러리 네이티브 동작이 이미 멱등적 — widgets off/on 같은 이 프로젝트의 다른 명령들과
// 일관된 멱등성 원칙).
//
// 이 파일이 하지 않는 것(범위 밖, 다음 라운드로 명시적으로 남김):
//   - `bin/claudetower.js`에 `accounts add`/`accounts enable` CLI 배선 — 안 함
//   - `file_fallback_encrypted` 백엔드(OS 키체인 자체가 없는 환경 대응) — 안 함,
//     그런 환경에서는 `@napi-rs/keyring` 생성자/호출이 던지는 에러를 그대로 전파한다.

// 변수를 거친 require: esbuild(scripts/build-sea.js)가 문자열 리터럴 require만 정적으로
// 번들링 시도한다 — '@napi-rs/keyring'을 리터럴로 쓰면 esbuild가 그 안의 20여 개 플랫폼별
// require('./keyring.*.node')를 전부 따라가다 이 PC에 없는 다른 OS/아치텍처용 .node
// 파일에서 번들링이 깨진다(실측 확인, 2026-08-19). 네이티브 addon은 애초에 번들링 대상이
// 아니므로, 변수를 거쳐 esbuild의 정적 분석을 피하고 실행 시점에만 진짜 require한다
// (표준적인 esbuild 우회 기법 — 파일시스템 동작 자체는 바뀌지 않음).
//
// 2026-08-19 후속 발견 1: 위 우회로 esbuild 번들링 자체는 통과했지만, SEA(단일실행파일)로
// 실행하면 여전히 'No such built-in module: @napi-rs/keyring'로 실패했다 — SEA blob
// 안에는 node_modules가 없어 패키지를 "이름"으로 찾는 require가 원천적으로 안 된다.
//
// 2026-08-19 후속 발견 2: build-sea.js가 exe 옆에 복사해둔 .node 파일을 절대경로로
// require()해도 여전히 'No such built-in module: <절대경로>'로 거부됐다 — SEA의 require는
// 내장모듈과 blob에 번들된 것 외엔 절대경로 파일조차 전혀 허용하지 않는, 실측보다 더
// 엄격한 제한이었다(추정 아니라 실측 재확인).
//
// 최종 해법: require()가 아니라 그 밑단에서 실제로 네이티브 addon을 로드하는 더 저수준
// API인 process.dlopen()을 SEA 실행 중일 때만 직접 쓴다 — require의 모듈 리졸버를 완전히
// 건너뛰고 addon을 프로세스에 바로 매핑하는 방식이라, SEA의 require 제한과 무관하게
// 동작함을 실측으로 확인했다. 일반 개발/테스트 경로(`node bin/claudetower.js`, `npm test`)는
// 이 분기를 안 타므로 전혀 영향 없음.
function loadKeyringEntry() {
  let sea = null;
  try {
    sea = require('node:sea');
  } catch {
    // node:sea 자체가 없는 아주 오래된 Node — 아래 isSea() 체크에서 자연히 false로 처리
  }
  if (sea && sea.isSea()) {
    const path = require('node:path');
    const nativePath = path.join(path.dirname(process.execPath), 'keyring-native.node');
    const nativeModule = { exports: {} };
    process.dlopen(nativeModule, nativePath);
    return nativeModule.exports.Entry;
  }
  const NATIVE_KEYRING_MODULE = '@napi-rs/keyring';
  return require(NATIVE_KEYRING_MODULE).Entry;
}

const Entry = loadKeyringEntry();

const SERVICE_NAME = 'claudetower';

function assertValidCredentialRef(credentialRef) {
  if (
    !credentialRef ||
    typeof credentialRef.external_ref !== 'string' ||
    credentialRef.external_ref.length === 0
  ) {
    throw new TypeError('credentialRef.external_ref must be a non-empty string');
  }
}

function entryFor(credentialRef) {
  assertValidCredentialRef(credentialRef);
  return new Entry(SERVICE_NAME, credentialRef.external_ref);
}

function getSecret(credentialRef) {
  return entryFor(credentialRef).getPassword();
}

function setSecret(credentialRef, secretValue) {
  if (typeof secretValue !== 'string' || secretValue.length === 0) {
    // 값 자체는 메시지에 절대 포함하지 않는다(비밀값 로그 유출 방지).
    throw new TypeError('secretValue must be a non-empty string');
  }
  entryFor(credentialRef).setPassword(secretValue);
}

function deleteSecret(credentialRef) {
  entryFor(credentialRef).deletePassword();
}

module.exports = { getSecret, setSecret, deleteSecret, PLANNED_LIBRARY: '@napi-rs/keyring' };
