'use strict';

// 2026-07-06 통제 재현으로 확정한 결함 부류에 대한 공용 방어막.
//
// e2e 검증이 격리 변수(CLAUDETOWER_*)를 "일부만" 설정한 채 실제 exe를 돌리면,
// 격리 안 된 나머지 실제 파일이 테스트에 의해 삭제/변조된다. 실측 사례 두 건:
//  1) 스킬 폴더 삭제 — /claudetower-widgets가 세션마다 반복 소실되던 근본 원인
//     (설정 경로만 격리한 uninstall이 실제 스킬 폴더를 지움, 직접 재현으로 확정)
//  2) 위젯 설정 파일 삭제 — 같은 구조의 uninstall이 실제 config.json을 지워
//     표시 항목이 전부 기본값(전체 켜짐)으로 되돌아감(방어막 검증 중 실측 발견)
//
// 규칙: 격리 변수가 하나라도 설정된 프로세스(=테스트)에서, 자기 전용 격리 변수가
// 없는 실제 경로는 쓰기/삭제하면 안 된다. 읽기는 안전하므로 막지 않는다.
//
// CLAUDETOWER_DEFAULT_HOME_DIR은 트리거 목록에 넣지 않는다 — 그 변수 자체가 스킬
// 기본 후보 경로를 격리하는 변수라서, 그걸 쓰는 정리(cleanup) 테스트는 이미 스킬
// 경로를 안전하게 돌려둔 상태다.
const ISOLATION_VARS = [
  'CLAUDETOWER_SETTINGS_PATH',
  'CLAUDETOWER_WIDGET_CONFIG_PATH',
  'CLAUDETOWER_SKILLS_DIR',
  'CLAUDETOWER_INSTALL_DIR',
];

function isPartialIsolation(ownOverrideVar) {
  if (process.env[ownOverrideVar]) return false;
  return ISOLATION_VARS.some((v) => v !== ownOverrideVar && Boolean(process.env[v]));
}

// 쓰기/삭제 진입점에서 던질 공통 에러 — 메시지에 해결법(자기 전용 변수 지정)을 담는다.
function assertNotPartialIsolation(ownOverrideVar, targetLabel) {
  if (isPartialIsolation(ownOverrideVar)) {
    throw new Error(
      `테스트 격리 변수(CLAUDETOWER_*)가 일부만 설정되어 있어 실제 ${targetLabel}을(를) 건드리지 않습니다. 테스트라면 ${ownOverrideVar}도 함께 지정하세요.`
    );
  }
}

module.exports = { ISOLATION_VARS, isPartialIsolation, assertNotPartialIsolation };
