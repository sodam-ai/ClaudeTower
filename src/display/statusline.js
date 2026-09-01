'use strict';

const fs = require('node:fs');
const { renderModel } = require('./widgets/model');
const { renderLocation } = require('./widgets/location');
const { renderGit } = require('./widgets/git');
const { renderContext } = require('./widgets/context');
const { renderCost } = require('./widgets/cost');
const { renderRateLimit } = require('./widgets/rate-limit');
const { renderActiveAccount } = require('./widgets/active-account');
const { readEnabledWidgets, readPowerlineSeparator } = require('./config/widget-config');
const { stripControlChars } = require('./config/text-safety');

// 위젯 사이 기본 구분자는 공백 2칸. Powerline 구분자를 켜면(claudetower config
// powerline on) 이 화살표로 바뀐다 — 배경색 블록은 없음(테마 시스템 아님, 순수
// 구분 기호만). U+E0B1(얇은 화살표)을 골랐다: U+E0B0(꽉 찬 삼각형)은 배경색이
// 없으면 어색해 보이지만 이건 텍스트 사이에 그대로 둬도 자연스럽다.
const DEFAULT_SEPARATOR = '  ';
const POWERLINE_SEPARATOR = '  ';

// Phase 1 기본 활성 위젯 순서(.PRD/01_PRD.md §3). type은 claudetower setup이 쓰는
// widget-config.js의 enabled_widgets 값과 일치해야 한다. model이 맨 앞인 이유는
// PulseLine 원본 설계의 enabled_fields 기본 순서를 따름(widget-config.js 참고).
const WIDGETS = [
  { type: 'model', render: renderModel },
  { type: 'location', render: renderLocation },
  { type: 'git', render: renderGit },
  { type: 'context', render: renderContext },
  { type: 'cost', render: renderCost },
  { type: 'rate_limit', render: renderRateLimit },
  { type: 'active_account', render: renderActiveAccount },
];

// 2026-08-03 실사용 발견("10칸이 깨져서 보임" 라이브 리포트): 개별 위젯 텍스트는
// truncateForDisplay로 80자 상한이 있지만, 위젯을 전부 합친 "한 줄 전체" 길이에는
// 지금까지 상한이 없었다. Git 위젯 배선(오늘)과 게이지 10칸 확장(2026-07-27)이 겹치면서,
// 흔한 터미널 폭(COLUMNS 120~150, VS Code 기본 터미널 등)에서 위젯 6개를 다 켜면 실제
// 줄 길이가 터미널 폭을 넘어 줄바꿈이 발생했다(실측: COLUMNS=120에서 161자, 41자 초과).
// 상태표시줄은 한 줄이어야 한다는 전제가 깨진 것 — 개별 위젯 값 자체는 정상이므로
// "잘라서라도 최소한의 정보는 유지한다"(text-safety.js와 동일 철학)를 위젯 단위로 적용한다.
//
// 낮은 우선순위 위젯부터 뺀다. active_account가 git보다도 먼저 빠지는 이유: git과 같은
// 부가 정보 성격이면서(세션 정체성이 아님, CHECKPOINT.md "다음 세션 작업 계획"의 권고
// 그대로 채택) Account 모듈을 쓰는 사용자 자체가 소수라 실제로 이 우선순위가 작동할
// 상황(줄이 넘치는데 active_account까지 켜져 있는 경우)이 git보다도 드물다. git이 그
// 다음으로 빠지는 이유: PulseLine 원본 설계(01_PRD.md §3)에 없던 Phase 3 신규 위젯이라
// "본래 구현 목적"의 핵심이 아니고, git 저장소가 아닌 프로젝트에서는 애초에 항상
// 숨겨지는 부가 정보다. 나머지는 원본 5개 위젯 중 "지금 당장 조치가 필요한 정보"가
// 아닌 순서 — model/location은 세션 정체성 자체라 최후까지 유지한다.
const WIDGET_DROP_PRIORITY = ['active_account', 'git', 'rate_limit', 'cost', 'context', 'location', 'model'];

function visibleLength(text) {
  return stripControlChars(text).length;
}

function totalVisibleLength(entries, separator) {
  if (entries.length === 0) return 0;
  const textLength = entries.reduce((sum, entry) => sum + visibleLength(entry.text), 0);
  return textLength + separator.length * (entries.length - 1);
}

// COLUMNS를 모르면(구버전 Claude Code, 파싱 불가 등) 절대 자르지 않는다 — 실제로 넘쳤는지
// 확인할 방법이 없는데 임의로 위젯을 지우면, 좁혀야 할 필요가 없었던 경우까지 정보를
// 잃을 수 있다(gauge.js resolveGaugeWidth와 동일하게 "모르면 건드리지 않는다" 원칙).
function fitToLineBudget(entries, separator) {
  const columns = Number(process.env.COLUMNS);
  if (!Number.isFinite(columns) || columns <= 0) return entries;

  let current = entries;
  for (const dropType of WIDGET_DROP_PRIORITY) {
    if (totalVisibleLength(current, separator) <= columns) break;
    current = current.filter((entry) => entry.type !== dropType);
  }
  return current;
}

function readStdinJson() {
  let raw;
  try {
    raw = fs.readFileSync(0, 'utf8');
  } catch {
    return {};
  }
  if (!raw || raw.trim().length === 0) return {};
  try {
    const parsed = JSON.parse(raw);
    // stdin을 신뢰하지 않는 입력으로 취급(.PRD/04_PROJECT_SPEC.md 입력값 검증 요구사항) —
    // 객체가 아니면(배열/문자열/숫자 등) 빈 세션으로 처리.
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      return {};
    }
    return parsed;
  } catch {
    return {};
  }
}

// 위젯 단위 격리(.PRD/04_PROJECT_SPEC.md) — 위젯 하나가 예외를 던져도
// 나머지 위젯·전체 상태표시줄 렌더링은 계속돼야 한다.
// enabledWidgets를 명시적으로 받게 해서(기본값은 실제 설정 파일 읽기) 테스트가
// 이 머신의 실제 ~/.claudetower/config.json 상태와 무관하게 결정적으로 동작하게 한다.
function render(
  session,
  enabledWidgets = readEnabledWidgets(),
  powerlineEnabled = readPowerlineSeparator()
) {
  const separator = powerlineEnabled ? POWERLINE_SEPARATOR : DEFAULT_SEPARATOR;
  const entries = [];
  for (const widget of WIDGETS) {
    if (!enabledWidgets.includes(widget.type)) continue;
    let result;
    try {
      result = widget.render(session);
    } catch {
      result = null;
    }
    if (typeof result === 'string' && result.length > 0) {
      entries.push({ type: widget.type, text: result });
    }
  }
  return fitToLineBudget(entries, separator)
    .map((entry) => entry.text)
    .join(separator);
}

if (require.main === module) {
  const session = readStdinJson();
  process.stdout.write(render(session));
}

module.exports = { render, readStdinJson, WIDGETS };
