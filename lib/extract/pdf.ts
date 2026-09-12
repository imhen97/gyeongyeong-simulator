/**
 * PDF에서 경영상태확인서의 재무 수치를 추출한다 (서버 전용, 베스트-에포트).
 *
 * ★ 한계
 *  - 협회 발급 확인서 중 상당수는 "스캔 이미지"라 텍스트 레이어가 없다.
 *    이 경우 추출 텍스트가 거의 비어 있어 found=false를 반환한다 → 사용자가 직접 입력.
 *  - 텍스트가 있는 "디지털 PDF"면 라벨 뒤의 숫자를 찾아 프리필을 시도한다.
 *  - 어떤 경우든 최종 값은 사용자가 화면에서 검토·수정한다(혼합 방식).
 */

import type { FinancialStatement } from "@/lib/scoring/types";

/** 확인서 산출근거 라벨 → 재무제표 필드 매핑 (라벨은 공백 제거 후 비교) */
const LABEL_MAP: { field: keyof FinancialStatement; labels: string[] }[] = [
  { field: "total_liabilities", labels: ["부채총계", "부채총액"] },
  { field: "total_equity", labels: ["자기자본"] },
  { field: "current_assets", labels: ["유동자산"] },
  { field: "current_liabilities", labels: ["유동부채"] },
  { field: "total_assets", labels: ["총자산", "자산총계"] },
  { field: "operating_profit", labels: ["영업이익"] },
  { field: "interest_expense", labels: ["이자비용"] },
  { field: "net_profit", labels: ["순이익", "당기순이익"] },
  { field: "total_revenue", labels: ["총매출액", "매출액"] },
  { field: "borrowings", labels: ["차입금"] },
  { field: "operating_cashflow", labels: ["영업활동현금흐름", "영업현금흐름"] },
  { field: "construction_revenue", labels: ["건설매출액"] },
];

/** "161,740" 같은 숫자 문자열 → 정수(천원). 콤마 제거. */
function toInt(s: string): number | null {
  const n = Number(s.replace(/[,\s]/g, ""));
  return Number.isFinite(n) ? Math.round(n) : null;
}

/**
 * 텍스트에서 라벨 바로 뒤(같은 줄 또는 근접)에 나오는 첫 숫자를 뽑는다.
 * 라벨과 숫자 사이에 단위/기호가 섞여도 첫 번째 큰 숫자를 취한다.
 */
function findNumberAfterLabel(text: string, labels: string[]): number | null {
  // 공백을 제거한 압축 텍스트에서 라벨 위치를 찾고, 그 뒤 40자 내의 첫 숫자(3자리 이상 or 콤마 포함)를 취함
  const compact = text.replace(/\s+/g, " ");
  for (const label of labels) {
    const idx = compact.indexOf(label);
    if (idx === -1) continue;
    const after = compact.slice(idx + label.length, idx + label.length + 40);
    const m = after.match(/-?\d{1,3}(?:,\d{3})+|-?\d{4,}/);
    if (m) {
      const v = toInt(m[0]);
      if (v != null) return v;
    }
  }
  return null;
}

export interface ExtractResult {
  /** 텍스트 레이어가 충분히 있었는지 (스캔본이면 false) */
  found: boolean;
  /** 추출된 원문 텍스트 길이 (디버깅용) */
  textLength: number;
  /** 프리필 후보 (있는 것만) */
  fields: Partial<FinancialStatement>;
  /** 사용자 안내 메시지 */
  message: string;
}

/** PDF 버퍼에서 재무 필드 추출 시도 */
export async function extractFinancialsFromPdf(buf: Buffer): Promise<ExtractResult> {
  let text = "";
  try {
    const { PDFParse } = await import("pdf-parse");
    const parser = new PDFParse({ data: buf });
    const r = await parser.getText();
    text = r.text ?? "";
  } catch (e: any) {
    return {
      found: false,
      textLength: 0,
      fields: {},
      message: "PDF 텍스트 추출 실패: " + (e?.message ?? e),
    };
  }

  // 텍스트가 거의 없으면 스캔 이미지로 판단
  if (text.replace(/\s/g, "").length < 30) {
    return {
      found: false,
      textLength: text.length,
      fields: {},
      message:
        "이 PDF는 스캔 이미지로 보여 자동 추출이 어렵습니다. 재무 수치를 직접 입력해 주세요. (파일은 첨부되어 보관됩니다.)",
    };
  }

  const fields: Partial<FinancialStatement> = {};
  for (const { field, labels } of LABEL_MAP) {
    const v = findNumberAfterLabel(text, labels);
    if (v != null) fields[field] = v;
  }

  const n = Object.keys(fields).length;
  return {
    found: n > 0,
    textLength: text.length,
    fields,
    message:
      n > 0
        ? `자동 추출 성공: ${n}개 항목을 채웠습니다. 값이 맞는지 반드시 확인·수정하세요.`
        : "텍스트는 있으나 알려진 항목을 찾지 못했습니다. 직접 입력해 주세요.",
  };
}
