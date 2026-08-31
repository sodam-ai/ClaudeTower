'use strict';

const { truncateForDisplay } = require('../config/text-safety');
const { readActiveAccountHandle } = require('../../shared/active-account-handle/read');

// Account 모듈이 기록한 ActiveAccountHandle(.PRD/02_DATA_MODEL.md — account_label만,
// 토큰·ID 없음)을 읽어 지금 활성 계정 라벨을 보여준다. src/shared/는 Display↔Account의
// 유일한 연결점이라 이 import는 모듈 경계 위반이 아니다(02_DATA_MODEL.md 모듈 경계 규칙,
// read.js 자신의 주석 참고 — write.js는 Display에서 import 금지, read.js는 허용).
//
// Account 모듈을 한 번도 켠 적 없는 사용자(=파일 자체가 없음, 절대다수)에게는
// readActiveAccountHandle이 항상 null을 반환해 이 위젯이 완전히 비표시된다
// (CHECKPOINT.md "다음 세션 작업 계획" 완료 기준 — "설치 후 Account 미사용 시
// Display 동작 완전히 무관"이라는 01_PRD.md §5 성공 기준과 직결).
//
// 두 번째 인자는 git.js와 동일한 관례(단위테스트가 실제 홈 디렉터리 대신 임시 경로를
// 주입하기 위함) — statusline.js는 session 하나만 넘기므로 실제 렌더 경로에서는
// 항상 기본 경로(readActiveAccountHandle 내부 getHandlePath())를 쓴다.
function renderActiveAccount(session, { filePath } = {}) {
  const handle = readActiveAccountHandle(filePath);
  if (!handle) {
    return null;
  }
  const trimmed = handle.account_label.trim();
  if (trimmed.length === 0) {
    // ActiveAccountHandle 스키마상 account_label은 문자열 필수지만, 빈 문자열까지
    // 막지는 않는다(read.js는 파싱만 담당) — model.js와 동일한 원칙으로 빈 라벨은
    // 표시할 정보가 없는 것으로 취급해 숨긴다(크래시 대신 안전한 폴백).
    return null;
  }
  return `👤 ${truncateForDisplay(trimmed)}`;
}

module.exports = { renderActiveAccount };
