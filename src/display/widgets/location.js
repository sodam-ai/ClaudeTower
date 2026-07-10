'use strict';

const path = require('node:path');
const { truncateForDisplay } = require('../config/text-safety');

// source_field: workspace.current_dir (display_mode 기본값 dir_name_only).
// .PRD/.archive/PulseLine원본/02_DATA_MODEL.md Widget 엔티티 참고.
function renderLocation(session) {
  const rawDir = session?.workspace?.current_dir ?? session?.cwd;
  if (typeof rawDir !== 'string') {
    return null;
  }
  // stdin은 신뢰하지 않는 입력으로 취급 — 앞뒤 공백이 섞여 있어도 위젯에 그대로
  // 새어 나가지 않도록 트리밍 후 처리(경계값 테스트로 발견한 결함 수정).
  const currentDir = rawDir.trim();
  if (currentDir.length === 0) {
    return null;
  }
  const dirName = path.basename(currentDir) || currentDir;
  return `📁 ${truncateForDisplay(dirName)}`;
}

module.exports = { renderLocation };
