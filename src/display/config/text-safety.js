'use strict';

// stdin은 신뢰하지 않는 입력으로 취급(.PRD/04_PROJECT_SPEC.md) — 숫자 필드(퍼센트·시각)에는
// 이미 상/하한 검증이 있지만, 문자열 필드(model.display_name·workspace.current_dir 등)에는
// 길이 상한이 없어 비정상적으로 긴 값이 오면 상태표시줄 한 줄이 통째로 깨질 수 있었다
// (2026-07-11 라이브 테스트로 발견: 50만자 입력이 그대로 출력됨). 완전히 숨기면 정상 범위
// 값까지 안 보이므로, 잘라서(truncate) 최소한의 정보는 유지하는 쪽을 택했다.
const MAX_DISPLAY_LENGTH = 80;
const ELLIPSIS = '…';

// 2026-07-17 실측 발견: 길이는 자르지만 제어문자(ESC 등)는 그대로 통과시켜, workspace.
// current_dir나 model.display_name에 ANSI 이스케이프 시퀀스(예: 화면 지우기, 가짜 색상)가
// 섞여 있으면 상태표시줄에 그대로 주입됐다. C0 제어문자(0x00~0x1F)와 DEL(0x7F)만 제거하고
// 한글·이모지 등 일반 유니코드 문자는 전혀 건드리지 않는다(이 범위 밖이라 안전).
//
// 2026-07-27 재검증 발견: 위 방식은 ESC(0x1b) 바이트만 지워 실제 터미널 제어 코드 "실행"은
// 막았지만(보안 문제는 아니었음), CSI 시퀀스의 나머지("[2J"·"[31m" 등)가 그대로 화면에
// 지저분한 텍스트로 남는 결함이 있었다 — 기존 테스트(text-safety.test.js)가 이 잔여
// 텍스트를 "정상"으로 잘못 고정하고 있었음. ESC로 시작하는 CSI 시퀀스 전체를 하나의
// 단위로 먼저 제거한 뒤, 남은 단독 제어문자도 마저 제거한다.
const ANSI_CSI_SEQUENCE = /\x1b\[[0-9;]*[a-zA-Z]/g;
// 같은 재검증에서 발견: OSC 시퀀스(터미널 창 제목 변경 등, ESC ] ... BEL 또는 ESC \\로 끝남)도
// CSI와 동일한 부류의 잔여 텍스트 문제가 있었다 — 정상 종료된(BEL/ST로 닫힌) OSC 시퀀스를
// 통째로 제거한다. 종료되지 않은 비정상 시퀀스는 아래 CONTROL_CHARS가 ESC/BEL만이라도 지운다.
const ANSI_OSC_SEQUENCE = /\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)/g;
const CONTROL_CHARS = /[\x00-\x1F\x7F]/g;

function stripControlChars(text) {
  return text.replace(ANSI_OSC_SEQUENCE, '').replace(ANSI_CSI_SEQUENCE, '').replace(CONTROL_CHARS, '');
}

function truncateForDisplay(text, maxLength = MAX_DISPLAY_LENGTH) {
  const safe = stripControlChars(text);
  if (safe.length <= maxLength) return safe;
  return safe.slice(0, maxLength - ELLIPSIS.length) + ELLIPSIS;
}

module.exports = { truncateForDisplay, stripControlChars, MAX_DISPLAY_LENGTH };
