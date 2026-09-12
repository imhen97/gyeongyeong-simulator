/**
 * 등급 판정 및 경영상태 점수 엔진 (Phase 3).
 *
 * ⚠️ 매우 중요 — 여기의 등급 구간(cutoff)과 배점은 "예시/임시값"이다.
 *   실제 조달청/행자부 예규의 정확한 구간·배점이 확인되면 DEFAULT_GRADE_SCHEME과
 *   SCORING_RULES를 교체(또는 DB 기준표로 이전)하면 된다. 법령 수치를 계산 로직에
 *   직접 박지 않고 "데이터(구간표)"로 분리한다는 원칙을 지킨다.
 *
 * 다만 이 예시 구간은 실제 원본 프로그램 화면(㈜삼영기업)의 등급을 재현하도록 맞췄다:
 *   - 부채비율 산출 44.93%(낮을수록 우수) → A
 *   - 유동비율 산출 182.78%(높을수록 우수) → A
 *   - 차입금의존도 산출 8.59%(낮을수록 우수) → A
 */

import type { Direction, RatioResult } from "./types";

export type Agency = "PPS" /* 조달청 */ | "MOIS" /* 행정안전부 */;
export type Grade = "A" | "B" | "C" | "D" | "E";

/** [D] 패널이 보여주는 3개 추정가격 구간 (등급 판정용) */
export type GradeScaleBand = "OVER_100E" /* 100억 */ | "OVER_10E" /* 10억↑ */ | "UNDER_10E" /* 10억↓ */;
export const GRADE_SCALE_BANDS: GradeScaleBand[] = ["OVER_100E", "OVER_10E", "UNDER_10E"];
export const GRADE_SCALE_LABEL: Record<GradeScaleBand, string> = {
  OVER_100E: "100억",
  OVER_10E: "10억↑",
  UNDER_10E: "10억↓",
};

/** 등급 1칸의 경계와 배점 */
export interface GradeThreshold {
  grade: Grade;
  /** 산출비율 경계값. HIGHER_BETTER는 "이 값 이상", LOWER_BETTER는 "이 값 이하" */
  boundary: number;
  /** 이 등급의 배점 비율(0~1). 재무점수 집계에 사용 (예시값) */
  weight: number;
}

/**
 * ⚠️ 예시 등급 구간표.
 * HIGHER_BETTER(높을수록 우수): 산출비율이 클수록 좋은 등급.
 * LOWER_BETTER(낮을수록 우수):  산출비율이 작을수록 좋은 등급.
 * boundary는 위에서부터 순서대로 검사한다.
 */
export const DEFAULT_GRADE_SCHEME: Record<Direction, GradeThreshold[]> = {
  HIGHER_BETTER: [
    { grade: "A", boundary: 120, weight: 1.0 },
    { grade: "B", boundary: 100, weight: 0.9 },
    { grade: "C", boundary: 80, weight: 0.8 },
    { grade: "D", boundary: 60, weight: 0.6 },
    { grade: "E", boundary: -Infinity, weight: 0.4 },
  ],
  LOWER_BETTER: [
    { grade: "A", boundary: 80, weight: 1.0 },
    { grade: "B", boundary: 100, weight: 0.9 },
    { grade: "C", boundary: 120, weight: 0.8 },
    { grade: "D", boundary: 150, weight: 0.6 },
    { grade: "E", boundary: Infinity, weight: 0.4 },
  ],
};

export interface GradeResult {
  grade: Grade | null; // 산출비율이 null(계산불가)이면 null
  weight: number;
}

/**
 * 산출비율 하나를 등급으로 판정한다.
 * 방향성에 따라 "이상/이하" 비교가 달라진다.
 * calcRatio가 null이면 계산 불가 → 최하위(E) 대신 null 등급으로 처리(호출부에서 표시 결정).
 */
export function judgeGrade(
  calcRatio: number | null,
  direction: Direction,
  scheme: Record<Direction, GradeThreshold[]> = DEFAULT_GRADE_SCHEME
): GradeResult {
  if (calcRatio == null) return { grade: null, weight: 0 };
  const thresholds = scheme[direction];
  for (const t of thresholds) {
    if (direction === "HIGHER_BETTER") {
      if (calcRatio >= t.boundary) return { grade: t.grade, weight: t.weight };
    } else {
      if (calcRatio <= t.boundary) return { grade: t.grade, weight: t.weight };
    }
  }
  // 이론상 마지막 E(-Inf/Inf)에서 반드시 잡히지만, 안전망
  const last = thresholds[thresholds.length - 1];
  return { grade: last.grade, weight: last.weight };
}

/** ratio_code -> 등급 (한 구간에 대해 9개 비율 전부) */
export function gradeRatios(
  results: RatioResult[],
  scheme: Record<Direction, GradeThreshold[]> = DEFAULT_GRADE_SCHEME
): Record<string, GradeResult> {
  const out: Record<string, GradeResult> = {};
  for (const r of results) out[r.code] = judgeGrade(r.calcRatio, r.direction, scheme);
  return out;
}

/** 기준별(조달청/행자부) 배점표 — 추정가격 구간별 재무/신용 만점 (예시값, 스크린샷 참고) */
export interface ScoringRule {
  scaleBand: string;
  label: string;
  totalPoints: number; // 배점(경영상태 총 배점)
  financePoints: number; // 재무 만점
  creditPoints: number; // 신용 만점
}

/** ⚠️ 예시 배점표. 스크린샷의 배점(35/21/15/10 등)을 참고한 임시값. 실제 예규로 교체 필요. */
export const SCORING_RULES: Record<Agency, ScoringRule[]> = {
  PPS: [
    { scaleBand: "OVER_100E", label: "100억↑", totalPoints: 35.0, financePoints: 35.0, creditPoints: 34.91 },
    { scaleBand: "OVER_50E", label: "50억↑", totalPoints: 21.0, financePoints: 21.0, creditPoints: 21.0 },
    { scaleBand: "OVER_30E", label: "30억↑", totalPoints: 15.0, financePoints: 15.0, creditPoints: 15.0 },
    { scaleBand: "OVER_10E", label: "10억↑", totalPoints: 15.0, financePoints: 15.0, creditPoints: 15.0 },
    { scaleBand: "UNDER_10E", label: "10억↓", totalPoints: 10.0, financePoints: 10.0, creditPoints: 10.0 },
  ],
  MOIS: [
    { scaleBand: "PRE_SCREEN", label: "사전심사", totalPoints: 0, financePoints: 0, creditPoints: 0 },
    { scaleBand: "SIMPLE", label: "간이종심", totalPoints: 10.0, financePoints: 0, creditPoints: 10.0 },
    { scaleBand: "OVER_50E", label: "50억↑", totalPoints: 15.0, financePoints: 15.0, creditPoints: 15.0 },
    { scaleBand: "OVER_10E", label: "10억↑", totalPoints: 15.0, financePoints: 15.0, creditPoints: 15.0 },
    { scaleBand: "UNDER_10E", label: "10억↓", totalPoints: 10.0, financePoints: 10.0, creditPoints: 10.0 },
  ],
};

/**
 * 재무점수(예시 집계).
 * 9개 비율의 등급 배점비율(weight) 평균 × 재무 만점.
 * ⚠️ 실제 예규의 집계 방식(등급별 고정점 합산 등)과 다를 수 있어 임시 산식임을 명시한다.
 * 계산불가(null 등급)인 비율은 평균에서 제외한다.
 */
export function computeFinanceScore(
  grades: Record<string, GradeResult>,
  financePoints: number
): number {
  const weights = Object.values(grades)
    .filter((g) => g.grade != null)
    .map((g) => g.weight);
  if (weights.length === 0) return 0;
  const avg = weights.reduce((a, b) => a + b, 0) / weights.length;
  return Math.round(avg * financePoints * 100) / 100;
}
