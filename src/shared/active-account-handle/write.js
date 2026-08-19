'use strict';

// Account 모듈 전용 쓰기 함수(Phase 2). Display 모듈은 이 파일을 import 금지(eslint.config.js 참고).
// 계정 라벨만 쓴다 — 토큰·만료시각 등 민감정보는 절대 포함하지 않는다(.PRD/02_DATA_MODEL.md 모듈 경계 규칙).

const fs = require('fs');
const path = require('path');
const { CONFIG_DIR_NAME } = require('../constants');

function getHandlePath() {
  return (
    process.env.CLAUDETOWER_ACTIVE_ACCOUNT_HANDLE_PATH ||
    path.join(require('os').homedir(), CONFIG_DIR_NAME, 'active-account.json')
  );
}

// filePath 인자는 CLAUDETOWER_ACTIVE_ACCOUNT_HANDLE_PATH보다 우선한다(단위테스트가
// 임시 경로를 직접 넘기는 경우) — 이 모듈 전체(다른 Account 상태 파일들)와 동일한 관례.
function writeActiveAccountHandle(accountLabel, filePath) {
  if (typeof accountLabel !== 'string' || accountLabel.length === 0) {
    throw new TypeError('accountLabel must be a non-empty string');
  }
  const handlePath = filePath || getHandlePath();
  fs.mkdirSync(path.dirname(handlePath), { recursive: true });
  const payload = JSON.stringify({
    account_label: accountLabel,
    updated_at: new Date().toISOString(),
  });
  fs.writeFileSync(handlePath, payload, 'utf8');
}

module.exports = { writeActiveAccountHandle };
