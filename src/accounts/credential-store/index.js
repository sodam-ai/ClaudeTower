'use strict';

// Account 모듈의 OS 자격증명 저장소 접근 인터페이스 — 게이트 대기 스텁.
//
// 채택 라이브러리: `@napi-rs/keyring` (2026-07-11 조사 근거, .PRD/01_PRD.md §7 참고)
//   - Windows Credential Manager/DPAPI, macOS Keychain, Linux Secret Service를 Rust
//     바인딩으로 지원, keytar(2022-12 아카이브)의 활성 대체재로 업계에서 채택 중
//     (Azure SDK, Microsoft Authentication Library가 keytar에서 이걸로 이전)
//   - Linux에서 libsecret 시스템 의존성 불필요(자체 완결) — "설치 한 번으로 끝" 핵심가치와 정합
//
// 왜 아직 `npm install` 하지 않았는가: 이 프로젝트는 M6 게이트(.PRD 03_PHASES.md, Phase 1이
// 최소 1주 실사용 검증된 뒤에만 Phase 2 착수, 2026-07-14 종료 예정) 준수 중이다. 실제 라이브러리
// 설치+연동은 "실동작 준비"에 해당해 게이트 취지를 흐릴 수 있으므로, 이 파일은 인터페이스
// 모양과 결정 근거만 남기고 모든 함수가 명시적으로 거부한다. 게이트가 풀리면 이 파일 안에서만
// `@napi-rs/keyring`을 실제로 require하고 구현을 채우면 된다(호출부는 이미 이 시그니처를 씀).

const NOT_YET = 'Phase 2 게이트 대기 — 2026-07-14 이후 구현 (.PRD/03_PHASES.md M6 참고)';

function getSecret(_credentialRef) {
  throw new Error(NOT_YET);
}

function setSecret(_credentialRef, _secretValue) {
  throw new Error(NOT_YET);
}

function deleteSecret(_credentialRef) {
  throw new Error(NOT_YET);
}

module.exports = { getSecret, setSecret, deleteSecret, PLANNED_LIBRARY: '@napi-rs/keyring' };
