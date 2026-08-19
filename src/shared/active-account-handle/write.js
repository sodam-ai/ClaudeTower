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
  const dir = path.dirname(handlePath);
  fs.mkdirSync(dir, { recursive: true });
  const payload = JSON.stringify({
    account_label: accountLabel,
    updated_at: new Date().toISOString(),
  });
  // 통째로 덮어쓰기(writeFileSync)는 원자적이지 않다 — 이 파일은 계정 전환마다 자동
  // 갱신되므로, 다른 프로세스(Display 위젯 등)가 read.js로 읽는 순간과 겹치면 반쯤 쓰인
  // 내용을 볼 수 있다. active-account-state.js의 atomicWriteFileSync와 동일한 이유·동일한
  // 해법(임시 파일 + rename) — install.ps1이 이미 겪은 결함 부류
  // (`.PRD/05_FIELD_ISSUES_2026-07-04.md` 이슈#1)를 여기서도 미리 막는다.
  //
  // 2026-08-20 정정: rename()이 Windows에서 대상 파일을 다른 프로세스가 그 찰나에 붙잡고
  // 있으면 EPERM으로 일시 실패할 수 있음을 active-account-state.js와 동일한 실측(10개
  // 동시 프로세스 테스트, 이 PC의 배경 부하 아래서 재현)으로 확인 — 같은 재시도 해법을
  // 여기도 대칭으로 적용한다(두 파일이 코드를 공유하지 않는 이 프로젝트 관례 그대로 유지).
  const tmpPath = path.join(dir, `.${path.basename(handlePath)}.tmp-${process.pid}-${Date.now()}`);
  fs.writeFileSync(tmpPath, payload, 'utf8');

  const MAX_RETRIES = 10;
  const RETRY_DELAY_MS = 20;
  for (let attempt = 1; ; attempt++) {
    try {
      fs.renameSync(tmpPath, handlePath);
      return;
    } catch (err) {
      const isTransient = err.code === 'EPERM' || err.code === 'EBUSY';
      if (!isTransient || attempt >= MAX_RETRIES) {
        try {
          fs.unlinkSync(tmpPath);
        } catch {
          // 임시파일 정리 실패는 무시 — 원래 에러가 더 중요하므로 그대로 던진다.
        }
        throw err;
      }
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, RETRY_DELAY_MS);
    }
  }
}

module.exports = { writeActiveAccountHandle };
