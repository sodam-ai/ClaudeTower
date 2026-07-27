'use strict';

// claudetower config statusline-refresh <초> — .PRD/06_FIELD_ISSUE_SPAWN_STORM_2026-07-04.md
// FR-1. 지금까지는 refreshInterval이 setup에서 항상 1로 고정 기록되고 사용자가
// 바꿀 방법이 없었다(settings.json을 손으로 고쳐야 했음). statusLine이 매초 83MB
// exe를 스폰하는 게 이 PC에서 실제로 관찰된 프로세스 폭주(0x800700e8)의 상수
// 기여 요인이었으므로, 주기를 늘려 부하를 줄일 수 있는 안전한 경로를 제공한다.

const { updateRefreshInterval, updatePadding } = require('./config/settings-writer');
const { writePowerlineSeparator } = require('./config/widget-config');

// claudetower config powerline <on|off> — 위젯 사이 구분자를 공백 2칸에서 Powerline
// 화살표로 바꾸는 opt-in 설정. 색상 테마·위젯 재배치는 범위 밖(별도 논의 전까지는
// 만들지 않음, PRD가 "복잡"으로 분류한 부분).
function runConfigCommand(args, { settingsPath, widgetConfigPath, log = () => {} } = {}) {
  const [sub, value] = args;

  if (sub === 'powerline') {
    if (value !== 'on' && value !== 'off') {
      log('사용법: claudetower config powerline <on|off>');
      return { applied: false };
    }
    try {
      writePowerlineSeparator(value === 'on', widgetConfigPath);
      log(`Powerline 구분자를 ${value === 'on' ? '켰습니다' : '껐습니다'}.`);
      log('다음 상태표시줄 갱신부터 적용됩니다.');
      return { applied: true, powerlineSeparator: value === 'on' };
    } catch (err) {
      log(err.message);
      return { applied: false };
    }
  }

  if (sub === 'padding') {
    // 공식 statusLine 스펙: "선택적 padding 필드는 상태 표시줄 콘텐츠에 추가 수평
    // 간격(문자 단위)을 추가합니다. 기본값은 0입니다"(RESEARCH_SOURCES.md 73행) —
    // refreshInterval(최소 1)과 달리 0이 유효한 기본값이라 하한이 다르다.
    // Number('')는 NaN이 아니라 0이라(JS 특유의 함정), refreshInterval처럼 "< 1"로
    // 우연히 걸러지지 않는다 — 빈/공백 문자열을 Number() 호출 전에 명시적으로 거부한다
    // (경계값 테스트로 발견한 결함).
    if (typeof value !== 'string' || value.trim() === '') {
      log('padding은 0 이상의 정수여야 합니다. 예: claudetower config padding 2');
      return { applied: false };
    }
    const padding = Number(value);
    if (!Number.isInteger(padding) || padding < 0) {
      log('padding은 0 이상의 정수여야 합니다. 예: claudetower config padding 2');
      return { applied: false };
    }
    try {
      const result = updatePadding(padding, settingsPath);
      log(`상태표시줄 padding을 ${result.padding}(으)로 설정했습니다: ${result.filePath}`);
      log('다음 Claude Code 상호작용부터 적용됩니다.');
      return { applied: true, padding: result.padding };
    } catch (err) {
      log(err.message);
      return { applied: false };
    }
  }

  if (sub !== 'statusline-refresh') {
    log(
      '사용법: claudetower config statusline-refresh <1 이상의 정수(초)> 또는 ' +
        'claudetower config powerline <on|off> 또는 claudetower config padding <0 이상의 정수>'
    );
    return { applied: false };
  }

  // padding과 동일한 이유로 명시적 방어를 추가한다(M18에서 발견): 지금은 하한이 1이라
  // Number('')===0이 "< 1"에 우연히 걸려 안전하지만, 그건 우연이지 의도가 아니다 — 하한이
  // 나중에 바뀌면 padding이 실제로 겪었던 결함이 여기서도 재현될 수 있다. 동작은 바뀌지
  // 않는다(빈/공백 문자열은 지금도 거부됨), 의도를 코드로 명시할 뿐이다.
  if (typeof value !== 'string' || value.trim() === '') {
    log('갱신 주기는 1 이상의 정수(초)여야 합니다. 예: claudetower config statusline-refresh 5');
    return { applied: false };
  }
  const seconds = Number(value);
  if (!Number.isInteger(seconds) || seconds < 1) {
    log('갱신 주기는 1 이상의 정수(초)여야 합니다. 예: claudetower config statusline-refresh 5');
    return { applied: false };
  }

  try {
    const result = updateRefreshInterval(seconds, settingsPath);
    log(`상태표시줄 갱신 주기를 ${result.refreshInterval}초로 설정했습니다: ${result.filePath}`);
    log('다음 Claude Code 상호작용부터 적용됩니다.');
    return { applied: true, refreshInterval: result.refreshInterval };
  } catch (err) {
    log(err.message);
    return { applied: false };
  }
}

module.exports = { runConfigCommand };
