'use strict';

// Display 모듈이 사용하는 읽기 전용 함수. write.js는 Display에서 import 금지(eslint.config.js 참고).
// .PRD/02_DATA_MODEL.md ActiveAccountHandle: { account_label, updated_at } — 토큰/ID 없음.

const fs = require('fs');
const path = require('path');
const { CONFIG_DIR_NAME } = require('../constants');

function getHandlePath() {
  return (
    process.env.CLAUDETOWER_ACTIVE_ACCOUNT_HANDLE_PATH ||
    path.join(require('os').homedir(), CONFIG_DIR_NAME, 'active-account.json')
  );
}

// filePath 인자는 write.js와 동일한 관례(단위테스트용 우회) — 읽기라 격리 방어막은
// 필요 없다(쓰기가 아니므로 실제 파일을 변조할 위험이 없음, test-isolation.js와 동일 원칙).
function readActiveAccountHandle(filePath) {
  const handlePath = filePath || getHandlePath();
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
