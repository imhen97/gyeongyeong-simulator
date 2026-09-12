/**
 * 9개 재무비율 계산 엔진 ★ 계산의 핵심.
 *
 * 두 종류의 비율을 구분한다.
 *  - 경영비율(bizRatio): 재무제표 수치로 직접 계산한 자사의 비율.
 *  - 산출비율(calcRatio): 자사 비율이 업종평균 대비 몇 %인지. 등급 판정의 입력값.
 *
 * ★ 중요한 발견 (실제 원본 프로그램 화면을 역산하여 확인):
 *   산출비율은 "원본(무한소수) 경영비율"이 아니라 "화면에 표시되는(절사된) 경영비율"을
 *   업종평균으로 나눈 값이다.
 *   예) 차입금의존도 원본 1.7738 → 절사 1.77 → 1.77/20.60×100 = 8.59  (원본으로 계산하면 8.61)
 *   따라서 calcRatio 계산 시 반드시 "정책으로 절사한 bizRatio"를 사용한다.
 */

import { applyRounding, safeDivide, DEFAULT_ROUNDING } from "./rounding";
import type {
  Direction,
  FinancialStatement,
  IndustryAverages,
  RatioCode,
  RatioResult,
  RatioUnit,
  RoundingPolicy,
} from "./types";

/**
 * 각 비율의 정의.
 * scale=100 이면 백분율(%), scale=1 이면 배·회 단위.
 * pick() 은 재무제표에서 분자/분모를 뽑아낸다 — 계산식을 데이터로 표현해 한 곳에서 관리한다.
 */
interface RatioDef {
  code: RatioCode;
  label: string;
  unit: RatioUnit;
  direction: Direction;
  scale: 1 | 100;
  numerator: (f: FinancialStatement) => number;
  denominator: (f: FinancialStatement) => number;
}

export const RATIO_DEFS: RatioDef[] = [
  {
    code: "DEBT_RATIO",
    label: "부채 비율",
    unit: "PERCENT",
    direction: "LOWER_BETTER",
    scale: 100,
    numerator: (f) => f.total_liabilities,
    denominator: (f) => f.total_equity,
  },
  {
    code: "CURRENT_RATIO",
    label: "유동 비율",
    unit: "PERCENT",
    direction: "HIGHER_BETTER",
    scale: 100,
    numerator: (f) => f.current_assets,
    denominator: (f) => f.current_liabilities,
  },
  {
    code: "BORROWING_DEP",
    label: "차입금의존도",
    unit: "PERCENT",
    direction: "LOWER_BETTER",
    scale: 100,
    numerator: (f) => f.borrowings,
    denominator: (f) => f.total_assets,
  },
  {
    code: "INTEREST_COV",
    label: "이자보상배율",
    unit: "TIMES",
    direction: "HIGHER_BETTER",
    scale: 1,
    numerator: (f) => f.operating_profit,
    denominator: (f) => f.interest_expense,
  },
  {
    code: "NET_MARGIN",
    label: "매출순이익율",
    unit: "PERCENT",
    direction: "HIGHER_BETTER",
    scale: 100,
    numerator: (f) => f.net_profit,
    denominator: (f) => f.total_revenue,
  },
  {
    code: "ROA",
    label: "자산순이익율",
    unit: "PERCENT",
    direction: "HIGHER_BETTER",
    scale: 100,
    numerator: (f) => f.net_profit,
    denominator: (f) => f.total_assets,
  },
  {
    code: "CASHFLOW_RATIO",
    label: "현금흐름비율",
    unit: "PERCENT",
    direction: "HIGHER_BETTER",
    scale: 100,
    numerator: (f) => f.operating_cashflow,
    denominator: (f) => f.total_assets,
  },
  {
    code: "ASSET_TURNOVER",
    label: "자산회전율",
    unit: "ROTATIONS",
    direction: "HIGHER_BETTER",
    scale: 1,
    numerator: (f) => f.total_revenue,
    denominator: (f) => f.avg_total_assets,
  },
  {
    code: "CONST_INVEST",
    label: "건설투자비율",
    unit: "PERCENT",
    direction: "HIGHER_BETTER",
    scale: 100,
    numerator: (f) => f.construction_invest,
    denominator: (f) => f.construction_revenue,
  },
];

/** code -> 정의 빠른 조회용 */
const DEF_BY_CODE: Record<RatioCode, RatioDef> = Object.fromEntries(
  RATIO_DEFS.map((d) => [d.code, d])
) as Record<RatioCode, RatioDef>;

/**
 * 단일 경영비율(bizRatio)을 계산해 정책에 따라 정규화한다.
 * 분모가 0/NULL이면 null (해당없음).
 */
export function computeBizRatio(
  code: RatioCode,
  f: FinancialStatement,
  policy: RoundingPolicy = DEFAULT_ROUNDING
): number | null {
  const def = DEF_BY_CODE[code];
  const raw = safeDivide(def.numerator(f), def.denominator(f));
  if (raw === null) return null;
  return applyRounding(raw * def.scale, policy);
}

/**
 * 산출비율(calcRatio, %) 계산.
 * ★ 위 주석대로 "이미 절사된 bizRatio"를 업종평균으로 나눈다.
 * bizRatio가 null 이거나 업종평균이 없거나 0이면 null.
 */
export function computeCalcRatio(
  code: RatioCode,
  bizRatio: number | null,
  industryAvg: number | null | undefined,
  policy: RoundingPolicy = DEFAULT_ROUNDING
): number | null {
  const raw = safeDivide(bizRatio, industryAvg);
  if (raw === null) return null;
  return applyRounding(raw * 100, policy);
}

/**
 * 9개 비율을 한 번에 계산해 결과 배열로 반환한다.
 * 화면 [D] 패널과 등급 판정 단계가 모두 이 결과를 입력으로 사용한다.
 */
export function computeAllRatios(
  f: FinancialStatement,
  avgs: IndustryAverages,
  policy: RoundingPolicy = DEFAULT_ROUNDING
): RatioResult[] {
  return RATIO_DEFS.map((def) => {
    const bizRatio = computeBizRatio(def.code, f, policy);
    const calcRatio = computeCalcRatio(def.code, bizRatio, avgs[def.code], policy);
    return {
      code: def.code,
      label: def.label,
      unit: def.unit,
      direction: def.direction,
      bizRatio,
      calcRatio,
    };
  });
}
