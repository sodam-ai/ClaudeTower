'use strict';

// Git 브랜치/변경사항 위젯(.PRD/01_PRD.md §3 "Git/PR 위젯 + 캐싱", Phase 3).
// PR 상태는 이번 범위에서 제외한다 — GitHub API(gh CLI 설치·로그인 여부 등) 라는
// 완전히 새로운 외부 의존성이 필요해 실패 모드가 크게 늘어난다(Simplicity First
// 판단, 사용자에게 사전 고지 후 진행). 브랜치+staged/modified만 우선 구현한다.
//
// 명령어 주입 방지(.PRD/04_PROJECT_SPEC.md ASVS V5.3, DO NOT 규칙): git이 반환하는
// 문자열을 셸 명령에 절대 재조합하지 않는다 — execFileSync(인자 배열)만 쓰고
// exec는 쓰지 않는다.
//
// 경로 신뢰 문제: workspace.current_dir는 표시 전용이며 파일 시스템 접근에 재사용
// 하지 않는다(신뢰 안 되는 stdin 입력으로 실제 명령 실행 위치를 결정하지 않는다는
// 원칙 — 02_DATA_MODEL.md 모듈 경계 규칙과 같은 취지). 그래서 git 명령은 stdin JSON이
// 아니라 이 프로세스 자신의 실제 작업 디렉터리(process.cwd())에서 실행한다 —
// [NEEDS CLARIFICATION] Claude Code가 statusLine 명령을 정말 프로젝트 디렉터리에서
// 실행하는지는 실제 빌드된 exe로 아직 실측 확인 전이다(CHECKPOINT.md 참고).
//
// 캐싱(.PRD/02_DATA_MODEL.md CacheEntry, DO NOT 규칙 "느린 작업을 캐싱 없이 매 호출마다
// 실행하지 마"): session_id 기준 5초 TTL. 값 형식은 PulseLine원본 예시("main|2|0")를
// 그대로 따른다 — branch|staged|modified 파이프 결합 문자열 하나로 캐시한다(한 번의
// git 조회로 셋 다 나오므로 3개 캐시 항목으로 나누지 않는 단순화, 명시적 판단).
// untracked(??) 파일은 staged/modified 어느 쪽에도 안 센다 — PRD가 2개 필드만
// 정의해서 이렇게 해석했다(후속 확장 여지로 남김, 임의 추측 아님을 밝혀둠).

const { execFileSync } = require('node:child_process');
const { readCachedValue, writeCachedValue } = require('../cache/file-cache');

const CACHE_KEY = 'git_status';
const CACHE_TTL_SEC = 5;
// timeout 없이는 느린 네트워크 드라이브·멈춘 git 훅·손상된 인덱스 등에서 git 명령이
// 무한정 멈출 수 있고, 그러면 이 execFileSync가 상태표시줄 렌더 전체를 함께 멈춰
// 세운다(100ms 성능 목표와 직접 충돌하는 실패 모드). 정상 케이스(~35ms 실측,
// CHECKPOINT M29)보다 넉넉히 여유를 둔 1초로 상한을 걸어, 멈추더라도 위젯 하나가
// 숨겨지는 선에서 그치게 한다(기존 try/catch가 이미 처리하는 "git 없음/저장소 아님"과
// 동일한 폴백 경로를 그대로 탄다 — 새 에러 처리 없이 안전하게 통합됨).
const EXEC_OPTS = { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 1000 };

function queryGitStatus(cwd) {
  let branch;
  try {
    branch = execFileSync('git', ['branch', '--show-current'], { ...EXEC_OPTS, cwd }).trim();
  } catch {
    // git 미설치 / 저장소 아님 / 기타 오류 — 위젯을 조용히 숨긴다(위젯 격리 원칙).
    return null;
  }
  if (branch.length === 0) {
    branch = '(detached)'; // detached HEAD 상태에서 --show-current는 빈 문자열을 준다
  }

  let staged = 0;
  let modified = 0;
  try {
    const porcelain = execFileSync('git', ['status', '--porcelain'], { ...EXEC_OPTS, cwd });
    for (const line of porcelain.split('\n')) {
      if (line.length < 2) continue;
      if (line[0] !== ' ' && line[0] !== '?') staged += 1;
      if (line[1] !== ' ' && line[1] !== '?') modified += 1;
    }
  } catch {
    // status 실패해도 branch는 이미 확보했으니 0|0으로 부분 표시(전체를 숨기지 않음).
  }

  return `${branch}|${staged}|${modified}`;
}

// 정규식으로 뒤에서부터 파싱하는 이유: git 브랜치명에 파이프(|)가 들어가는 것을
// git 자체가 명시적으로 금지하지 않는다(check-ref-format 규칙에 |가 없음) — 그런
// 드문 브랜치명이 실제로 있으면 단순 split('|')은 필드가 밀려 잘못 표시된다.
// .*는 탐욕적으로 매칭되므로 branch 안에 |가 섞여 있어도 마지막 "|숫자|숫자"만
// staged/modified로 정확히 분리된다.
function formatGitValue(value) {
  const match = /^(.*)\|(-?\d+)\|(-?\d+)$/.exec(value);
  if (!match) {
    return `🌿 ${value}`; // 예상 밖 형식이면 그대로 표시(방어적 폴백, 크래시 방지)
  }
  const [, branch, stagedStr, modifiedStr] = match;
  const staged = Number(stagedStr);
  const modified = Number(modifiedStr);
  const suffix = staged > 0 || modified > 0 ? ` +${staged}~${modified}` : '';
  return `🌿 ${branch}${suffix}`;
}

function renderGit(session, { cwd = process.cwd() } = {}) {
  const sessionId = session?.session_id;

  if (typeof sessionId === 'string' && sessionId.length > 0) {
    const cached = readCachedValue({ sessionId, key: CACHE_KEY });
    if (cached !== null) {
      return formatGitValue(cached);
    }
  }

  const value = queryGitStatus(cwd);
  if (value === null) {
    return null;
  }

  if (typeof sessionId === 'string' && sessionId.length > 0) {
    writeCachedValue({ sessionId, key: CACHE_KEY, value, ttlSec: CACHE_TTL_SEC });
  }

  return formatGitValue(value);
}

module.exports = { renderGit, queryGitStatus, formatGitValue, CACHE_KEY, CACHE_TTL_SEC };
