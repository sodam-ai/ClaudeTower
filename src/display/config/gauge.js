'use strict';

// 퍼센트 값을 막대 그래프로 그린다. 아이콘만으로는 뭘 뜻하는지 알기 어렵다는
// 실사용 피드백을 반영 — 초보자도 "얼마나 찼는지"를 숫자를 안 읽어도 한눈에 알 수 있게.
// 상태표시줄은 한 줄짜리라 공간이 빠듯하다 — 6칸 적용 후에도 여전히 길다는 피드백으로
// 5칸으로 축소. 단, 폭이 좁을수록 critical 임계값(90%)과 "꽉 찬 막대" 구간이 겹쳐
// 90~100% 사이의 시각적 구분력이 떨어지는 트레이드오프가 있음(90% 이상이면 반올림으로
// 전부 5/5칸 표시) — 숫자(%)가 항상 같이 표시되므로 정보 자체가 사라지진 않는다.
// 2026-07-27: 근본 해결로 COLUMNS 환경변수 기반 동적 폭 계산(resolveGaugeWidth)을 추가.
// 터미널이 넓을 때만 칸을 늘려 구분력을 개선하고, 좁거나 값을 모를 땐 항상 이 5칸(검증된
// 최소값)으로 폴백한다 — 5칸보다 좁아지는 방향으로는 절대 움직이지 않는다.
const BAR_WIDTH = 5;
// Claude Code가 스크립트 실행 전 COLUMNS를 실제 터미널 폭으로 설정해준다(공식 문서 확인,
// .PRD/.archive/PulseLine원본/RESEARCH_SOURCES.md 165행, v2.1.153+). 이 값이 이 문턱 이상일
// 때만 게이지를 넓혀, 좁은 터미널에서 다른 위젯과 줄바꿈/잘림이 생기지 않게 보수적으로 잡았다.
const WIDE_TERMINAL_COLUMNS = 120;
const WIDE_BAR_WIDTH = 10;
// 다이아몬드형(▰▱)이 "평범하다"는 피드백으로 전통적인 솔리드 진행률 바 모양으로 교체.
const FILLED = '█';
const EMPTY = '░';

// columnsEnvValue: process.env.COLUMNS 그대로(문자열/undefined) 전달받는다 — 환경변수를
// 이 함수 안에서 직접 읽지 않고 인자로 받아, 순수 함수로 유지해 테스트에서 process.env를
// 건드리지 않고도 모든 경우를 검증할 수 있게 한다.
function resolveGaugeWidth(columnsEnvValue) {
  const columns = Number(columnsEnvValue);
  if (!Number.isFinite(columns) || columns < WIDE_TERMINAL_COLUMNS) {
    return BAR_WIDTH;
  }
  return WIDE_BAR_WIDTH;
}

function renderGauge(value, width = BAR_WIDTH) {
  if (!Number.isFinite(value)) return EMPTY.repeat(width);
  // 0~100 범위로 고정(음수·100 초과 값이 칸 수 계산을 깨지 않도록 — 경계값 테스트로 검증).
  const clamped = Math.max(0, Math.min(100, value));
  const filledCount = Math.round((clamped / 100) * width);
  return FILLED.repeat(filledCount) + EMPTY.repeat(width - filledCount);
}

module.exports = { renderGauge, resolveGaugeWidth, BAR_WIDTH, WIDE_BAR_WIDTH, WIDE_TERMINAL_COLUMNS, FILLED, EMPTY };
