'use strict';

// Account 모듈 전용 쓰기 함수(Phase 2). Display 모듈은 이 파일을 import 금지(eslint.config.js 참고).
// 계정 라벨만 쓴다 — 토큰·만료시각 등 민감정보는 절대 포함하지 않는다(.PRD/02_DATA_MODEL.md 모듈 경계 규칙).

const fs = require('fs');
const path = require('path');
const { CONFIG_DIR_NAME } = require('../constants');

function getHandlePath() {
  return path.join(require('os').homedir(), CONFIG_DIR_NAME, 'active-account.json');
}

function writeActiveAccountHandle(accountLabel) {
  if (typeof accountLabel !== 'string' || accountLabel.length === 0) {
    throw new TypeError('accountLabel must be a non-empty string');
  }
  const handlePath = getHandlePath();
  fs.mkdirSync(path.dirname(handlePath), { recursive: true });
  const payload = JSON.stringify({
    account_label: accountLabel,
    updated_at: new Date().toISOString(),
  });
  fs.writeFileSync(handlePath, payload, 'utf8');
}

module.exports = { writeActiveAccountHandle };
