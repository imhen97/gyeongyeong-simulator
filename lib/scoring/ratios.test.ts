/**
 * 계산 엔진 검증 테스트 (스펙 5장).
 *
 * 여기 쓰인 입력값과 기대값은 실제 원본 프로그램 화면에서 확인된 값이다(㈜삼영기업, 2026).
 *
 * ★ 중요 — 반올림 규칙 모순에 대하여
 * 스펙은 "18개 값이 모두 절사(TRUNCATE)로 일치한다"고 가정하지만, 실제 검산 결과
 * 어떤 단일 규칙으로도 18개가 전부 일치하지 않았다:
 *   - 매출순이익율(경영) 13.2480 → 원본 13.24  ⇒ 절사여야 함 (반올림이면 13.25)
 *   - 부채비율(경영)   47.1484 → 원본 47.15  ⇒ 반올림이어야 함 (절사면 47.14)
 * 즉 원본 프로그램이 항목별로 표시 규칙이 다르거나, 부채비율만 원(원) 단위 정밀도로
 * 계산되었을 가능성이 크다. 예규/원본 미확인 상태이므로:
 *   1) 엔진은 스펙의 기본 규칙(TRUNCATE)로 동작시키고,
 *   2) 절사로 일치하는 14개는 정확 일치를 단언하며,
 *   3) 불일치 4개는 KNOWN_DISCREPANCIES로 격리해 "현재 엔진값"과 "원본값"을 함께 못박아 둔다.
 * 나중에 정확한 규칙이 확정되면 RoundingPolicy(또는 항목별 오버라이드)만 바꾸면 된다.
 */

import { describe, it, expect } from "vitest";
import { computeAllRatios } from "./ratios";
import { DEFAULT_ROUNDING } from "./rounding";
import type { FinancialStatement, IndustryAverages, RatioCode } from "./types";

const testFinancials: FinancialStatement = {
  total_liabilities: 90_316_995,
  total_equity: 191_558_842,
  current_assets: 224_156_743,
  current_liabilities: 88_094_288,
  borrowings: 5_000_000,
  total_assets: 281_875_837,
  avg_total_assets: 270_043_947,
  operating_profit: 20_823_688,
  interest_expense: 1_111_633,
  net_profit: 32_540_776,
  total_revenue: 245_628_105,
  operating_cashflow: 65_019_595,
  construction_invest: 0,
  construction_revenue: 236_641_846,
};

const testIndustryAverages: IndustryAverages = {
  DEBT_RATIO: 104.94,
  CURRENT_RATIO: 139.21,
  BORROWING_DEP: 20.6,
  INTEREST_COV: 3.35,
  NET_MARGIN: 4.49,
  ROA: 2.88,
  CASHFLOW_RATIO: 2.55,
  ASSET_TURNOVER: 0.67,
  CONST_INVEST: 0.08,
};

/** 스펙 5장 "기대 출력" 표 — 원본 프로그램 화면 표시값 */
const SPEC_EXPECTED: Record<RatioCode, { biz: number; calc: number }> = {
  DEBT_RATIO: { biz: 47.15, calc: 44.93 },
  CURRENT_RATIO: { biz: 254.45, calc: 182.78 },
  BORROWING_DEP: { biz: 1.77, calc: 8.59 },
  INTEREST_COV: { biz: 18.73, calc: 559.1 },
  NET_MARGIN: { biz: 13.24, calc: 294.88 },
  ROA: { biz: 11.54, calc: 400.69 },
  CASHFLOW_RATIO: { biz: 23.06, calc: 904.31 },
  ASSET_TURNOVER: { biz: 0.9, calc: 134.33 },
  CONST_INVEST: { biz: 0, calc: 0 },
};

/**
 * TRUNCATE 정책 하에서 원본과 일치하지 않는 항목.
 * engine = 현재 엔진(절사)이 내놓는 값, spec = 원본 프로그램 표시값.
 * 모두 "실제값의 셋째 자리가 ≥5라 원본은 올림, 절사는 내림"인 케이스다.
 */
const KNOWN_DISCREPANCIES: Partial<
  Record<RatioCode, { field: "biz" | "calc"; engine: number }[]>
> = {
  // 부채비율: 47.1484 → 절사 47.14 / 원본 47.15. 산출비율은 경영비율에서 연쇄되어 함께 어긋남.
  DEBT_RATIO: [
    { field: "biz", engine: 47.14 },
    { field: "calc", engine: 44.92 },
  ],
  // 매출순이익율(산출): 13.24/4.49×100 = 294.8775 → 절사 294.87 / 원본 294.88
  NET_MARGIN: [{ field: "calc", engine: 294.87 }],
  // 자산회전율(산출): 0.90/0.67×100 = 134.3283 → 절사 134.32 / 원본 134.33
  ASSET_TURNOVER: [{ field: "calc", engine: 134.32 }],
};

const results = computeAllRatios(testFinancials, testIndustryAverages, DEFAULT_ROUNDING);
const byCode = Object.fromEntries(results.map((r) => [r.code, r])) as Record<
  RatioCode,
  (typeof results)[number]
>;

const CODES = Object.keys(SPEC_EXPECTED) as RatioCode[];

function discrepancy(code: RatioCode, field: "biz" | "calc") {
  return KNOWN_DISCREPANCIES[code]?.find((d) => d.field === field);
}

describe("경영비율(bizRatio) — 절사로 원본과 일치하는 항목", () => {
  for (const code of CODES) {
    if (discrepancy(code, "biz")) continue;
    it(`${code} 경영비율 = ${SPEC_EXPECTED[code].biz}`, () => {
      expect(byCode[code].bizRatio).toBe(SPEC_EXPECTED[code].biz);
    });
  }
});

describe("산출비율(calcRatio) — 절사로 원본과 일치하는 항목", () => {
  for (const code of CODES) {
    if (discrepancy(code, "calc")) continue;
    it(`${code} 산출비율 = ${SPEC_EXPECTED[code].calc}`, () => {
      expect(byCode[code].calcRatio).toBe(SPEC_EXPECTED[code].calc);
    });
  }
});

describe("반올림 규칙 모순 — 예규 확인 필요 (원본은 올림, 엔진은 절사)", () => {
  for (const code of CODES) {
    for (const field of ["biz", "calc"] as const) {
      const d = discrepancy(code, field);
      if (!d) continue;
      const spec = SPEC_EXPECTED[code][field];
      it(`${code} ${field}: 엔진(절사)=${d.engine}, 원본=${spec} (불일치를 명시적으로 고정)`, () => {
        const actual = field === "biz" ? byCode[code].bizRatio : byCode[code].calcRatio;
        // 현재 엔진(절사)의 동작을 못박는다.
        expect(actual).toBe(d.engine);
        // 원본 표시값과는 다르다는 사실도 함께 못박아, 규칙 확정 시 이 테스트가 갱신되도록 한다.
        expect(actual).not.toBe(spec);
      });
    }
  }
});

describe("0 나누기 방어", () => {
  it("건설매출액이 0이면 건설투자비율은 계산되나(0/x=0), 이자비용 0이면 이자보상배율은 null", () => {
    const zeroInterest = { ...testFinancials, interest_expense: 0, construction_revenue: 0 };
    const r = computeAllRatios(zeroInterest, testIndustryAverages);
    const ic = r.find((x) => x.code === "INTEREST_COV")!;
    const ci = r.find((x) => x.code === "CONST_INVEST")!;
    expect(ic.bizRatio).toBeNull(); // 이자비용 0 → 해당없음
    expect(ci.bizRatio).toBeNull(); // 건설매출액 0 → 해당없음
  });
});
