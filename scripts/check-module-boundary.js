#!/usr/bin/env node
'use strict';

// 모듈 경계 강제(2/3중 방어: 독립 backstop 스크립트) — .PRD/04_PROJECT_SPEC.md
// ESLint와 별개 도구다. ESLint 설정 실수나 eslint-disable 우회 시도에도 걸리도록
// src/display/ 전체를 정규식으로 스캔한다.
// .PRD/04_PROJECT_SPEC.md의 `grep -r "require.*accounts" src/display` 예시는
// require(...)만 잡고 동적 import()·간접 경로 접근을 못 잡아 단독으론 불충분하므로 보강한다.

const fs = require('fs');
const path = require('path');

const DISPLAY_DIR = path.join(__dirname, '..', 'src', 'display');

const VIOLATION_PATTERNS = [
  { name: 'require(...accounts...)', re: /require\(\s*['"][^'"]*accounts[^'"]*['"]\s*\)/i },
  { name: 'import ... from "...accounts..."', re: /from\s+['"][^'"]*accounts[^'"]*['"]/i },
  { name: 'dynamic import(...accounts...)', re: /import\(\s*['"][^'"]*accounts[^'"]*['"]\s*\)/i },
  { name: 'active-account-handle/write 직접 참조', re: /active-account-handle\/write/i },
  { name: 'eslint-disable로 boundary 규칙 우회 시도', re: /eslint-disable[^\n]*no-restricted-imports/i },
];

function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  let files = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files = files.concat(walk(full));
    } else if (entry.isFile() && entry.name.endsWith('.js')) {
      files.push(full);
    }
  }
  return files;
}

function main() {
  const files = walk(DISPLAY_DIR);
  const violations = [];

  for (const file of files) {
    const content = fs.readFileSync(file, 'utf8');
    for (const pattern of VIOLATION_PATTERNS) {
      if (pattern.re.test(content)) {
        violations.push({ file: path.relative(process.cwd(), file), rule: pattern.name });
      }
    }
  }

  if (violations.length > 0) {
    console.error('FAIL: 모듈 경계 위반 발견 (src/display/ -> src/accounts/ 참조 금지)');
    for (const v of violations) {
      console.error(`  - ${v.file}: ${v.rule}`);
    }
    process.exit(1);
  }

  console.log(`PASS: src/display/ 내 ${files.length}개 파일 모두 모듈 경계 준수`);
  process.exit(0);
}

main();
