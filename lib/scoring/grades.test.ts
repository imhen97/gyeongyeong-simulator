/**
 * 등급 판정 검증 (Phase 3).
 * 예시 등급 구간이 실제 원본 프로그램 화면(㈜삼영기업)의 A등급을 재현하는지 확인한다.
 */

import { describe, it, expect } from "vitest";
import { computeAllRatios } from "./ratios";
import { gradeRatios, judgeGrade } from "./grades";
import type { FinancialStatement, IndustryAverages } from "./types";

const fin: FinancialStatement = {
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
const avgs: IndustryAverages = {
  DEBT_RATIO: 104.94, CURRENT_RATIO: 139.21, BORROWING_DEP: 20.6, INTEREST_COV: 3.35,
  NET_MARGIN: 4.49, ROA: 2.88, CASHFLOW_RATIO: 2.55, ASSET_TURNOVER: 0.67, CONST_INVEST: 0.08,
};

describe("등급 판정 — 스크린샷 A등급 재현", () => {
  const results = computeAllRatios(fin, avgs);
  const grades = gradeRatios(results);

  it("부채비율(낮을수록 우수, 산출 44.93%) → A", () => {
    expect(grades.DEBT_RATIO.grade).toBe("A");
  });
  it("유동비율(높을수록 우수, 산출 182.78%) → A", () => {
    expect(grades.CURRENT_RATIO.grade).toBe("A");
  });
  it("차입금의존도(낮을수록 우수, 산출 8.59%) → A", () => {
    expect(grades.BORROWING_DEP.grade).toBe("A");
  });
});

describe("방향성 처리", () => {
  it("HIGHER_BETTER: 산출 60%는 D", () => {
    expect(judgeGrade(60, "HIGHER_BETTER").grade).toBe("D");
  });
  it("LOWER_BETTER: 산출 60%(낮음)는 A", () => {
    expect(judgeGrade(60, "LOWER_BETTER").grade).toBe("A");
  });
  it("계산 불가(null)는 등급 null", () => {
    expect(judgeGrade(null, "HIGHER_BETTER").grade).toBeNull();
  });
});
