'use strict';

// Display 모듈이 사용하는 읽기 전용 함수. write.js는 Display에서 import 금지(eslint.config.js 참고).
// .PRD/02_DATA_MODEL.md ActiveAccountHandle: { account_label, updated_at } — 토큰/ID 없음.

const fs = require('fs');
const path = require('path');
const { CONFIG_DIR_NAME } = require('../constants');

function getHandlePath() {
  return path.join(require('os').homedir(), CONFIG_DIR_NAME, 'active-account.json');
}

function readActiveAccountHandle() {
  const handlePath = getHandlePath();
  if (!fs.existsSync(handlePath)) {
    return null;
  }
  try {
    const raw = fs.readFileSync(handlePath, 'utf8');
    const parsed = JSON.parse(raw);
    if (typeof parsed.account_label !== 'string' || typeof parsed.updated_at !== 'string') {
      return null;
    }
    return { account_label: parsed.account_label, updated_at: parsed.updated_at };
  } catch {
    return null;
  }
}

module.exports = { readActiveAccountHandle };
