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
// 정직하게 명시(2026-07-28 이 PC 실측으로 확정, 2026-08-17 Windows ACL 구현으로 해소):
// Node.js의 fs mode 옵션(0o600)은 POSIX(macOS/Linux)에서는 "소유자만 읽기/쓰기"를 정확히
// 강제하지만, Windows에서는 chmodSync(0o600)가 예외 없이 "성공"하면서도 실제 파일 모드는
// 0o666로 남는다는 것을 이 PC에서 직접 확인했다(fs.statSync().mode 직접 대조) — "에러 안
// 났으니 됐다"고 판단하면 거짓 안전감을 준다. POSIX 경로는 여전히 chmod 직후 실제 모드가
// 0o600인지 재확인한다.
//
// Windows는 POSIX 모드 비트 대신 ACL(icacls)로 강제한다: `/inheritance:r`로 상속된 ACE를
// 전부 제거한 뒤(새로 만든 파일이라 그 시점엔 명시적 ACE가 없어 결과적으로 접근 목록이
// 비게 된다) `/grant:r <현재사용자>:F`로 현재 사용자에게만 전체 권한을 명시 부여한다.
// 이 PC에서 icacls 실행 자체가 classifier에 막히지 않음을 먼저 확인(2026-08-17, 임시
// 파일로 격리 테스트) — credential-store(M16)가 막힌 "OS 자격증명 저장소 I/O"와 "파일
// ACL 조작"은 서로 다른 종류의 동작이라는 가설이 다시 한번 뒷받침됨. icacls 실행 후
// 그 출력(파일 접근 목록)을 다시 조회해 "정확히 1개의 ACE만 있고, 그게 현재 사용자의
// 전체 권한(F)인지"까지 재확인한다 — chmod와 동일하게 "명령이 에러 없이 끝남" ≠ "실제로
// 의도한 상태가 됐음"을 구분한다.
// icacls 자체가 실패하면(파일시스템이 ACL을 지원 안 하는 드문 경우 등) permissionRestricted
// 를 false로 반환할 뿐 예외를 던지지 않는다 — "감사 로그를 끄거나 생략하지 마" DO NOT
// 규칙이 우선이므로, 권한 강제가 실패해도 로그 기록 자체는 항상 성공해야 한다.

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { createRotationEvent } = require('../rotation/rotation-event');
const { CONFIG_DIR_NAME } = require('../../shared/constants');

// 2026-08-21 신설(실측으로 발견): 이 파일은 지금까지 filePath를 항상 호출부가 명시적으로
// 넘겨야만 동작했다(기본 경로 해석 함수가 없었음) — active-account-state.js·
// accounts-registry.js 등 다른 모든 Account 상태 파일은 진작에 `resolve*Path()`
// 기본값을 갖고 있었는데 이 파일만 예외였다. 지금까지는 이 함수를 실제로 호출하는 CLI
// 경로가 0개였어서(applySwitch의 유일한 실사용 경로는 🛑 실거래 배선 게이트로 막힌
// active-account-provider.js뿐) 이 결함이 드러나지 않았다 — `claudetower accounts switch`
// (첫 실사용 호출부)를 실제로 실행하자 `path.dirname(undefined)` 크래시로 즉시 재현됨.
// 다른 파일들과 동일한 관례(CLAUDETOWER_* 환경변수 override + 기본 경로)로 맞춘다.
// 다른 5개 파일과 동일하게 Display 격리 변수까지 포함한 전체 목록을 기준으로 검사한다 —
// Account 변수만 보면 "CLAUDETOWER_WIDGET_CONFIG_PATH만 설정된 부분격리" 같은 실제
// 위험한 상태를 놓친다(이 파일이 처음엔 Account 변수만 검사하도록 좁게 만들어졌다가
// 회귀 테스트로 바로 발견·수정됨, 2026-08-21).
const DISPLAY_ISOLATION_VARS = [
  'CLAUDETOWER_SETTINGS_PATH',
  'CLAUDETOWER_WIDGET_CONFIG_PATH',
  'CLAUDETOWER_SKILLS_DIR',
  'CLAUDETOWER_INSTALL_DIR',
  'CLAUDETOWER_CACHE_DIR',
];
const ACCOUNTS_ISOLATION_VARS = [
  'CLAUDETOWER_ACCOUNTS_SWITCH_POLICY_PATH',
  'CLAUDETOWER_ACCOUNTS_ACTIVATION_STATE_PATH',
  'CLAUDETOWER_ACCOUNTS_REGISTRY_PATH',
  'CLAUDETOWER_ACCOUNTS_ACTIVE_ACCOUNT_PATH',
  'CLAUDETOWER_ACTIVE_ACCOUNT_HANDLE_PATH',
  'CLAUDETOWER_ACCOUNTS_QUOTA_CACHE_PATH',
  'CLAUDETOWER_ACCOUNTS_ROTATION_LOG_PATH',
];
const ALL_ISOLATION_VARS = [...DISPLAY_ISOLATION_VARS, ...ACCOUNTS_ISOLATION_VARS];

function assertNotPartialIsolation(ownOverrideVar, targetLabel) {
  const partiallyIsolated =
    !process.env[ownOverrideVar] &&
    ALL_ISOLATION_VARS.some((v) => v !== ownOverrideVar && Boolean(process.env[v]));
  if (partiallyIsolated) {
    throw new Error(
      `테스트 격리 변수(CLAUDETOWER_*)가 일부만 설정되어 있어 실제 ${targetLabel}을(를) 건드리지 않습니다. 테스트라면 ${ownOverrideVar}도 함께 지정하세요.`
    );
  }
}

function resolveRotationLogPath() {
  return (
    process.env.CLAUDETOWER_ACCOUNTS_ROTATION_LOG_PATH ||
    path.join(os.homedir(), CONFIG_DIR_NAME, 'rotation-log.jsonl')
  );
}

// icacls 출력에서 실제 ACE(접근 제어 항목) 줄만 뽑아낸다 — 파일 경로+요약 문구는
// 로케일에 따라 문구가 달라지므로(이 PC는 한글) 문구 매칭 대신 ACE 형식
// "...:(권한약어[,권한약어...])"로 끝나는 줄만 구조적으로 골라낸다.
const ACL_ENTRY_PATTERN = /:\([A-Za-z,]+\)$/;

function restrictWindowsAcl(filePath) {
  try {
    const username = os.userInfo().username;
    execFileSync('icacls', [filePath, '/inheritance:r'], { stdio: 'ignore' });
    execFileSync('icacls', [filePath, '/grant:r', `${username}:F`], { stdio: 'ignore' });

    const output = execFileSync('icacls', [filePath], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    const aceLines = output.split('\n').map((line) => line.trimEnd()).filter((line) => ACL_ENTRY_PATTERN.test(line));

    // 정확히 1개의 ACE만 있어야 하고(다른 그룹이 섞이면 안 됨), 그 ACE가 현재 사용자의
    // 전체 권한(F)이어야 한다 — 둘 중 하나라도 아니면 의도한 상태가 아니므로 false.
    return aceLines.length === 1 && aceLines[0].includes(`${username}:(F)`);
  } catch {
    return false;
  }
}

function appendRotationEvent(eventFields, filePath) {
  const event = createRotationEvent(eventFields);
  const line = `${JSON.stringify(event)}\n`;

  if (filePath === undefined) {
    assertNotPartialIsolation('CLAUDETOWER_ACCOUNTS_ROTATION_LOG_PATH', '계정 전환 감사 로그 파일');
    filePath = resolveRotationLogPath();
  }

  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const fileExistedBefore = fs.existsSync(filePath);
  fs.appendFileSync(filePath, line, { encoding: 'utf8', mode: 0o600 });

  let permissionRestricted = false;
  if (!fileExistedBefore) {
    if (process.platform === 'win32') {
      // POSIX 모드 비트가 강제되지 않으므로(위 파일 상단 주석 참고) ACL로 대신 강제한다.
      permissionRestricted = restrictWindowsAcl(filePath);
    } else {
      // appendFileSync의 mode 옵션은 신규 생성 시에만 적용된다 — 명시적으로 한 번 더
      // chmod해 의도를 분명히 한다(중복이지만 안전, 실패해도 로그 자체는 이미 기록됨).
      try {
        fs.chmodSync(filePath, 0o600);
        // "에러 안 났다" ≠ "실제로 0o600이 됐다"(Windows 실측으로 확인, 이 분기는
        // macOS/Linux 전용이지만 동일 원칙 유지) — 반드시 실제 모드를 다시 읽어 검증한다.
        permissionRestricted = (fs.statSync(filePath).mode & 0o777) === 0o600;
      } catch {
        permissionRestricted = false;
      }
    }
  }

  return { event, permissionRestricted };
}

// 2026-07-28 실측으로 발견한 결함: 줄 하나가 손상되면(디스크 오류·비정상 종료 등)
// JSON.parse가 예외를 던져 파일 전체를 못 읽게 되던 것을 수정 — 감사 로그는 정의상
// "일부가 손상돼도 나머지는 읽혀야" 신뢰할 수 있는데, 정반대로 동작하고 있었다.
// 손상된 줄만 건너뛰고 나머지 정상 줄은 그대로 반환한다(반환 타입은 배열 그대로 유지).
function readRotationEvents(filePath = resolveRotationLogPath()) {
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

module.exports = { appendRotationEvent, readRotationEvents, resolveRotationLogPath };
