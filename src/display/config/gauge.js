'use strict';

// 퍼센트 값을 막대 그래프로 그린다. 아이콘만으로는 뭘 뜻하는지 알기 어렵다는
// 실사용 피드백을 반영 — 초보자도 "얼마나 찼는지"를 숫자를 안 읽어도 한눈에 알 수 있게.
// 상태표시줄은 한 줄짜리라 공간이 빠듯하다 — 6칸 적용 후에도 여전히 길다는 피드백으로
// 5칸으로 축소. 단, 폭이 좁을수록 critical 임계값(90%)과 "꽉 찬 막대" 구간이 겹쳐
// 90~100% 사이의 시각적 구분력이 떨어지는 트레이드오프가 있음(90% 이상이면 반올림으로
// 전부 5/5칸 표시) — 숫자(%)가 항상 같이 표시되므로 정보 자체가 사라지진 않는다.
// 근본 해결(Claude Code가 지원하는 COLUMNS 환경변수 기반 동적 폭 계산)은 별도 후속 작업.
const BAR_WIDTH = 5;
// 다이아몬드형(▰▱)이 "평범하다"는 피드백으로 전통적인 솔리드 진행률 바 모양으로 교체.
const FILLED = '█';
const EMPTY = '░';

function renderGauge(value, width = BAR_WIDTH) {
  if (!Number.isFinite(value)) return EMPTY.repeat(width);
  // 0~100 범위로 고정(음수·100 초과 값이 칸 수 계산을 깨지 않도록 — 경계값 테스트로 검증).
  const clamped = Math.max(0, Math.min(100, value));
  const filledCount = Math.round((clamped / 100) * width);
  return FILLED.repeat(filledCount) + EMPTY.repeat(width - filledCount);
}

module.exports = { renderGauge, BAR_WIDTH, FILLED, EMPTY };
