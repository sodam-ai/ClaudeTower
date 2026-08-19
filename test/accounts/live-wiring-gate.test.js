'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// 2026-08-20 결정(사용자 확정): 실제 트래픽 프록시 배선(startProxyServer를 실행해
// Claude Code 요청을 실제로 가로채고 계정을 자동 전환하는 것)은 이 프로젝트 전체에서
// 위험도가 가장 높은 단일 지점이다 — 지금까지의 모든 안전지대 코드(quota 파싱,
// 전환 결정 로직, request-forwarder, active-account-provider)는 전부 격리된 단위
// 테스트로만 검증됐을 뿐, 실제 사용자의 실제 Claude Code 트래픽에 영향을 준 적이
// 단 한 번도 없다. 이 배선이 켜지는 순간 그 성격이 근본적으로 바뀐다 — 버그가 나면
// 그 자리에서 사용자의 실제 작업에 영향을 준다.
//
// 지금까지 사용자가 승인한 것("하이브리드로 진행", 07_OAUTH_FLOW_SPEC.md §5)은
// *원칙*에 대한 승인이지 "지금 이 순간 실전 배선을 켜도 된다"는 승인이 아니다 —
// 이 구분은 이 프로젝트 자신이 반복해서 지켜온 관례(M9 "차단벽 앞까지만",
// M24/M41/M42/M44 전부 "실제 배선은 다음 세션 몫"으로 명시적으로 미룸)와 정확히
// 일치한다.
//
// 이 테스트가 존재하는 이유: 문서(CHECKPOINT.md) 경고만으로는 이 저장소를 동시에
// 작업하는 여러 세션 중 하나가 무심코 놓칠 수 있다. ESLint 경계 규칙
// (eslint.config.js)·check-module-boundary.js가 "Display가 Account를 참조하지 않는다"를
// 기계적으로 강제하는 것과 동일한 원칙으로, 이 테스트는 "bin/claudetower.js가 실거래
// 프록시를 참조하지 않는다"를 기계적으로 강제한다.
//
// 이 게이트를 실제로 해제하려면: 사용자가 "지금 이 구체적인 단계(실거래 프록시 배선)를
// 켜도 좋다"고 원칙 승인과는 별개로 명시적으로 확인한 뒤에만, 이 테스트를 의도적으로
// 수정해야 한다 — 우회 조건(환경변수 등)을 두지 않은 것도 의도적이다.
test('bin/claudetower.js는 실거래 프록시(startProxyServer/active-account-provider)를 아직 배선하지 않았다 — 사용자의 별도 명시 승인 전까지 유지해야 하는 게이트(2026-08-20 결정)', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', '..', 'bin', 'claudetower.js'), 'utf8');

  assert.doesNotMatch(
    source,
    /startProxyServer/,
    'bin/claudetower.js가 startProxyServer를 참조합니다 — 이는 실제 사용자 트래픽을 가로채는 배선입니다. ' +
      'CHECKPOINT.md의 "실거래 배선 승인 게이트" 항목을 먼저 확인하고, 사용자의 별도 명시 승인 없이는 이 테스트를 수정하지 마세요.'
  );
  assert.doesNotMatch(
    source,
    /active-account-provider/,
    'bin/claudetower.js가 active-account-provider를 참조합니다 — 이는 실거래 배선 직전 단계입니다. 위와 동일한 승인 절차가 필요합니다.'
  );
  assert.doesNotMatch(
    source,
    /createRequestForwarder/,
    'bin/claudetower.js가 createRequestForwarder를 참조합니다 — 이는 실거래 배선의 일부입니다. 위와 동일한 승인 절차가 필요합니다.'
  );
});
