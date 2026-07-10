'use strict';

// stdin은 신뢰하지 않는 입력으로 취급(.PRD/04_PROJECT_SPEC.md) — 숫자 필드(퍼센트·시각)에는
// 이미 상/하한 검증이 있지만, 문자열 필드(model.display_name·workspace.current_dir 등)에는
// 길이 상한이 없어 비정상적으로 긴 값이 오면 상태표시줄 한 줄이 통째로 깨질 수 있었다
// (2026-07-11 라이브 테스트로 발견: 50만자 입력이 그대로 출력됨). 완전히 숨기면 정상 범위
// 값까지 안 보이므로, 잘라서(truncate) 최소한의 정보는 유지하는 쪽을 택했다.
const MAX_DISPLAY_LENGTH = 80;
const ELLIPSIS = '…';

function truncateForDisplay(text, maxLength = MAX_DISPLAY_LENGTH) {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - ELLIPSIS.length) + ELLIPSIS;
}

module.exports = { truncateForDisplay, MAX_DISPLAY_LENGTH };
