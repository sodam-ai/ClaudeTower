'use strict';

const { pickColor, colorize, COLOR } = require('../config/thresholds');
const { renderGauge } = require('../config/gauge');

// context_window.used_percentage는 세션 초반 null일 수 있음(공식 문서 확인,
// .PRD/.archive/PulseLine원본/RESEARCH_SOURCES.md 313~318행) — null이면 위젯 자체를 숨긴다.
function renderContext(session) {
  const pct = session?.context_window?.used_percentage;
  // Number.isFinite는 NaN뿐 아니라 Infinity/-Infinity도 함께 걸러낸다 — typeof+isNaN
  // 조합만 쓰면 Infinity가 통과해 "Infinity%"가 그대로 표시되는 결함이 있었다
  // (경계값 테스트로 발견, 실제 Claude Code stdin은 JSON이라 Infinity를 못 실어 보내지만
  // 방어적으로 수정).
  if (!Number.isFinite(pct)) {
    return null;
  }
  // stdin은 신뢰하지 않는 입력으로 취급(.PRD/04_PROJECT_SPEC.md) — 음수·100 초과 값이
  // 와도 화면에 "-10%"·"150%" 같은 있을 수 없는 숫자가 그대로 노출되지 않도록 0~100으로
  // 고정한다. renderGauge는 막대 칸수만 내부적으로 clamp하고 숫자 텍스트는 clamp하지
  // 않아서, 막대는 꽉/비어 보이는데 숫자만 범위를 벗어나 보이는 불일치가 있었다
  // (경계값 테스트로 발견).
  const clampedPct = Math.max(0, Math.min(100, pct));
  // Claude Code가 보내는 used_percentage가 부동소수점 계산 결과라 "14.000000000000002%"
  // 처럼 긴 소수로 그대로 찍히는 결함이 실사용 중 발견됨 — 반올림해서 하나의 정수값을
  // 화면 표시/게이지 채움/임계값 색상 판단에 전부 동일하게 쓴다(표시된 숫자와 색상이
  // 서로 다른 기준을 쓰면 "70%인데 왜 안전색?" 같은 혼란이 생기므로 반올림을 먼저 함).
  const rounded = Math.round(clampedPct);
  // 아이콘만으로는 처음 쓰는 사람이 뭘 뜻하는지 알기 어렵다는 실사용 피드백 반영 —
  // 한글 이름표 + 게이지바를 같이 넣어 아이콘을 몰라도 바로 이해되게 한다.
  // 아이콘 대신 한글 이름표를 쓰므로 뜻이 겹치는 🧠는 굳이 안 붙인다(공간 절약).
  const text = `컨텍스트 ${renderGauge(rounded)} ${rounded}%`;
  // "게이지바가 평범하다"는 피드백으로, 경고/위험색뿐 아니라 안전 구간도 항상 초록색을
  // 입혀 전체 줄이 더 컬러풀하게 보이도록 한다(이전엔 안전 구간이 무색이었음).
  return colorize(text, pickColor('context', rounded) || COLOR.safe);
}

module.exports = { renderContext };
