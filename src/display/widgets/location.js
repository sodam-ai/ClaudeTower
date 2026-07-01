'use strict';

const path = require('node:path');

// source_field: workspace.current_dir (display_mode 기본값 dir_name_only).
// .PRD/.archive/PulseLine원본/02_DATA_MODEL.md Widget 엔티티 참고.
function renderLocation(session) {
  const currentDir = session?.workspace?.current_dir ?? session?.cwd;
  if (typeof currentDir !== 'string' || currentDir.length === 0) {
    return null;
  }
  const dirName = path.basename(currentDir) || currentDir;
  return `📁 ${dirName}`;
}

module.exports = { renderLocation };
