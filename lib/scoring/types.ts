/**
 * 계산 엔진 공통 타입 정의.
 *
 * 이 파일에는 "숫자를 어떻게 다룰지"에 대한 도메인 개념만 담는다.
 * DB나 화면(UI)에 대한 의존성은 절대 넣지 않는다 — 순수 계산 엔진으로 유지하기 위함.
 */

/** 9개 재무비율을 식별하는 코드 (스펙 4-1 표 기준) */
export type RatioCode =
  | "DEBT_RATIO" // 부채비율
  | "CURRENT_RATIO" // 유동비율
  | "BORROWING_DEP" // 차입금의존도
  | "INTEREST_COV" // 이자보상배율
  | "NET_MARGIN" // 매출순이익율
  | "ROA" // 자산순이익율(총자산순이익율)
  | "CASHFLOW_RATIO" // 현금흐름비율
  | "ASSET_TURNOVER" // 자산회전율
  | "CONST_INVEST"; // 건설투자비율

/**
 * 비율의 방향성.
 * - LOWER_BETTER: 값이 낮을수록 우수 (부채비율, 차입금의존도)
 * - HIGHER_BETTER: 값이 높을수록 우수 (나머지)
 * 등급 판정 시 어느 쪽이 좋은 성적인지 판단하는 데 쓰인다.
 */
export type Direction = "HIGHER_BETTER" | "LOWER_BETTER";

/** 표시 단위 */
export type RatioUnit = "PERCENT" | "TIMES" /* 배 */ | "ROTATIONS" /* 회 */;

/**
 * 반올림 방식.
 * 적격심사는 기관·예규에 따라 절사/반올림/올림이 다를 수 있어 반드시 설정으로 뺀다.
 * (스펙 4-3 주의사항 참조)
 */
export type RoundingMode = "TRUNCATE" | "ROUND" | "CEIL";

/** 반올림 정책 — 자리수와 방식을 함께 지정 */
export interface RoundingPolicy {
  mode: RoundingMode;
  digits: number;
}

/** 재무제표 원천 데이터 (단위: 천원 정수). 스펙 3-4 기준 */
export interface FinancialStatement {
  total_liabilities: number; // 부채 총계
  total_equity: number; // 자기 자본
  current_assets: number; // 유동 자산
  current_liabilities: number; // 유동 부채
  borrowings: number; // 차입금
  total_assets: number; // 총 자산
  avg_total_assets: number; // 기초기말평균자산
  operating_profit: number; // 영업 이익
  interest_expense: number; // 이자 비용
  net_profit: number; // 순 이익
  total_revenue: number; // 총 매출액
  operating_cashflow: number; // 영업현금흐름
  construction_invest: number; // 건설개발투자
  construction_revenue: number; // 건설 매출액
}

/** 업종평균 비율 (기준표 ①) — ratio_code -> 평균값 */
export type IndustryAverages = Partial<Record<RatioCode, number>>;

/** 단일 비율 계산 결과 */
export interface RatioResult {
  code: RatioCode;
  label: string; // 표시명 (예: "부채 비율")
  unit: RatioUnit;
  direction: Direction;
  /** 경영비율 = 재무수치로 계산한 자사 비율. 분모 0 등으로 계산 불가 시 null */
  bizRatio: number | null;
  /** 산출비율(%) = (절사된 경영비율 ÷ 업종평균) × 100. 계산 불가 시 null */
  calcRatio: number | null;
}
