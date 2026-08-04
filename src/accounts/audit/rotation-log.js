'use strict';

// RotationEvent 감사 로그를 JSON Lines 파일에 실제로 기록/조회하는 함수.
// .PRD/04_PROJECT_SPEC.md "DB/스토리지 권한(ASVS V12) — Must Have": "RotationEvent 감사
// 로그 파일은 소유자만 읽기 가능한 권한으로 생성(POSIX 0600, Windows ACL)".
// DO NOT 규칙: "RotationEvent 로그를 끄거나 생략하지 마".
//
// credential-store와 무관: RotationEvent 스키마 자체가 화이트리스트(rotation-event.js)라
// event_id/from_account_id/to_account_id/project_path/reason/occurred_at 외의 필드(토큰 등)가
// 섞일 방법이 구조적으로 없다 — account.js/credential-ref.js와 동일한 원칙.
//
// 정직하게 명시(완전 해결 아님, 2026-07-28 이 PC 실측으로 확정): Node.js의 fs mode
// 옵션(0o600)은 POSIX(macOS/Linux)에서는 "소유자만 읽기/쓰기"를 정확히 강제하지만,
// Windows에서는 chmodSync(0o600)가 예외 없이 "성공"하면서도 실제 파일 모드는 0o666로
// 남는다는 것을 이 PC에서 직접 확인했다(fs.statSync().mode 직접 대조) — "에러 안 났으니
// 됐다"고 판단하면 거짓 안전감을 준다. 그래서 chmod 성공 여부가 아니라 chmod 직후
// 실제 모드가 0o600인지를 다시 읽어 확인한다. 진짜 Windows ACL(icacls 등)로 다른
// 사용자 접근을 차단하는 것은 이 세션 범위 밖으로 남긴다(라이브 검증 없이 구현하면
// "된다"고 잘못 표시할 위험이 더 크다고 판단) — [NEEDS CLARIFICATION]으로 남김
// (CHECKPOINT 참고). permissionRestricted는 이 PC(Windows)에서는 항상 false가 맞다.

const fs = require('node:fs');
const path = require('node:path');
const { createRotationEvent } = require('../rotation/rotation-event');

function appendRotationEvent(eventFields, filePath) {
  const event = createRotationEvent(eventFields);
  const line = `${JSON.stringify(event)}\n`;

  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const fileExistedBefore = fs.existsSync(filePath);
  fs.appendFileSync(filePath, line, { encoding: 'utf8', mode: 0o600 });

  let permissionRestricted = false;
  if (!fileExistedBefore) {
    // appendFileSync의 mode 옵션은 신규 생성 시에만 적용된다 — 명시적으로 한 번 더
    // chmod해 의도를 분명히 한다(중복이지만 안전, 실패해도 로그 자체는 이미 기록됨).
    try {
      fs.chmodSync(filePath, 0o600);
      // "에러 안 났다" ≠ "실제로 0o600이 됐다"(Windows 실측으로 확인) — 반드시
      // 실제 모드를 다시 읽어 검증한다.
      permissionRestricted = (fs.statSync(filePath).mode & 0o777) === 0o600;
    } catch {
      permissionRestricted = false;
    }
  }

  return { event, permissionRestricted };
}

// 2026-07-28 실측으로 발견한 결함: 줄 하나가 손상되면(디스크 오류·비정상 종료 등)
// JSON.parse가 예외를 던져 파일 전체를 못 읽게 되던 것을 수정 — 감사 로그는 정의상
// "일부가 손상돼도 나머지는 읽혀야" 신뢰할 수 있는데, 정반대로 동작하고 있었다.
// 손상된 줄만 건너뛰고 나머지 정상 줄은 그대로 반환한다(반환 타입은 배열 그대로 유지).
function readRotationEvents(filePath) {
  if (!fs.existsSync(filePath)) return [];
  const events = [];
  for (const line of fs.readFileSync(filePath, 'utf8').split('\n')) {
    if (line.trim().length === 0) continue;
    try {
      events.push(JSON.parse(line));
    } catch {
      // 손상된 한 줄 때문에 나머지 감사 기록 전체를 못 읽게 되는 것을 막는다 —
      // 이 줄만 건너뛴다(silent fallback과는 다르다: "무시"가 아니라 "전체 로그
      // 접근성을 지키기 위한 격리"가 목적).
    }
  }
  return events;
}

module.exports = { appendRotationEvent, readRotationEvents };
