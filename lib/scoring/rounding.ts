/**
 * 절사/반올림 및 안전한 나눗셈 유틸.
 *
 * ★ 왜 중요한가 (비개발자용 설명)
 * 적격심사 점수는 "소수점 몇째 자리에서 자르느냐"에 따라 등급이 갈릴 수 있다.
 * 실제 원본 프로그램을 역산해 보니 대부분의 값은 "소수점 셋째 자리에서 버림(절사)"
 * 규칙을 따랐다. 다만 일부 항목(부채비율 등)은 반올림으로 보이는 값이 있어,
 * 방식 자체를 코드에 박지 않고 "정책(RoundingPolicy)"으로 분리한다.
 * 나중에 정확한 예규가 확인되면 이 정책 값만 바꾸면 된다.
 */

import type { RoundingPolicy } from "./types";

/** 기본 반올림 정책: 소수점 셋째 자리에서 버림 → 둘째 자리까지 남김 (스펙 4-3 추정) */
export const DEFAULT_ROUNDING: RoundingPolicy = { mode: "TRUNCATE", digits: 2 };

/**
 * 소수점 n자리에서 버림(절사).
 * Math.round를 쓰면 안 된다 — 적격심사 표준은 반올림이 아닌 절사인 경우가 많다.
 * 부동소수점 오차를 피하려고 곱하기 → floor → 나누기 순으로 처리하고,
 * 아주 작은 epsilon(1e-9)을 더해 0.1*3 같은 표현 오차로 인해 한 자리 덜 잘리는 것을 막는다.
 */
export function truncate(value: number, digits = 2): number {
  const factor = 10 ** digits;
  return Math.floor(value * factor + 1e-9) / factor;
}

/** 소수점 n자리로 반올림 (round half up) */
export function roundHalfUp(value: number, digits = 2): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

/** 소수점 n자리에서 올림 */
export function ceilAt(value: number, digits = 2): number {
  const factor = 10 ** digits;
  return Math.ceil(value * factor - 1e-9) / factor;
}

/**
 * 정책에 따라 값을 정규화한다.
 * 계산 엔진의 모든 "표시/저장 직전" 지점은 반드시 이 함수를 거치게 하여
 * 반올림 규칙이 한 곳에서만 결정되도록 한다.
 */
export function applyRounding(value: number, policy: RoundingPolicy): number {
  switch (policy.mode) {
    case "TRUNCATE":
      return truncate(value, policy.digits);
    case "ROUND":
      return roundHalfUp(value, policy.digits);
    case "CEIL":
      return ceilAt(value, policy.digits);
  }
}

/**
 * 0 나누기 방어.
 * 이자비용 0, 건설매출액 0 등 분모가 0/NULL인 경우가 실제로 존재한다.
 * 이때 null을 반환하고, 호출부에서 '해당없음(-)' 또는 최하위 등급으로 처리한다.
 */
export function safeDivide(
  numerator: number | null | undefined,
  denominator: number | null | undefined
): number | null {
  if (numerator == null || denominator == null) return null;
  if (denominator === 0) return null;
  return numerator / denominator;
}
