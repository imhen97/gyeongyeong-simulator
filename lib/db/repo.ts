/**
 * 데이터 접근 함수 모음 (서버 전용).
 * API 라우트가 이 함수들을 호출한다. SQL은 전부 여기에 모아 한 곳에서 관리한다.
 */

import { getDb } from "./index";
import type { FinancialStatement, IndustryAverages, RatioCode } from "@/lib/scoring/types";

export interface Company {
  id: number;
  name: string;
  biz_reg_no: string;
  ceo_name: string | null;
  address: string | null;
  phone: string | null;
  fax: string | null;
  is_sme: number;
  is_female_ceo: number;
  bid_manager: string | null;
  biz_start_date: string | null;
  region_date: string | null;
  audit_opinion: string | null;
}

/** 업체 기본정보 입력값 (id 없이 생성/수정 공용) */
export type CompanyInput = Omit<Company, "id">;

/**
 * 부분 입력을 안전한 CompanyInput으로 정규화한다.
 * 빈 문자열은 null로, 누락된 선택 칸은 기본값으로 채워
 * better-sqlite3의 "Missing named parameter" 오류를 방지한다.
 */
export function normalizeCompany(b: Partial<CompanyInput>): CompanyInput {
  return {
    name: b.name ?? "",
    biz_reg_no: b.biz_reg_no ?? "",
    ceo_name: b.ceo_name || null,
    address: b.address || null,
    phone: b.phone || null,
    fax: b.fax || null,
    is_sme: b.is_sme ? 1 : 0,
    is_female_ceo: b.is_female_ceo ? 1 : 0,
    bid_manager: b.bid_manager || null,
    biz_start_date: b.biz_start_date || null,
    region_date: b.region_date || null,
    audit_opinion: b.audit_opinion || null,
  };
}

const FIN_FIELDS: (keyof FinancialStatement)[] = [
  "total_liabilities",
  "total_equity",
  "current_assets",
  "current_liabilities",
  "borrowings",
  "total_assets",
  "avg_total_assets",
  "operating_profit",
  "interest_expense",
  "net_profit",
  "total_revenue",
  "operating_cashflow",
  "construction_invest",
  "construction_revenue",
];

export function listCompanies(): Company[] {
  return getDb().prepare("SELECT * FROM companies ORDER BY name").all() as Company[];
}

export function getCompany(id: number): Company | undefined {
  return getDb().prepare("SELECT * FROM companies WHERE id = ?").get(id) as Company | undefined;
}

/** 업체 생성 후 id 반환 */
export function createCompany(raw: Partial<CompanyInput>): number {
  const db = getDb();
  const input = normalizeCompany(raw);
  const info = db
    .prepare(
      `INSERT INTO companies
       (name, biz_reg_no, ceo_name, address, phone, fax, is_sme, is_female_ceo,
        bid_manager, biz_start_date, region_date, audit_opinion)
       VALUES (@name, @biz_reg_no, @ceo_name, @address, @phone, @fax, @is_sme, @is_female_ceo,
        @bid_manager, @biz_start_date, @region_date, @audit_opinion)`
    )
    .run(input);
  return Number(info.lastInsertRowid);
}

export function updateCompany(id: number, raw: Partial<CompanyInput>): void {
  const input = normalizeCompany(raw);
  getDb()
    .prepare(
      `UPDATE companies SET
         name=@name, biz_reg_no=@biz_reg_no, ceo_name=@ceo_name, address=@address,
         phone=@phone, fax=@fax, is_sme=@is_sme, is_female_ceo=@is_female_ceo,
         bid_manager=@bid_manager, biz_start_date=@biz_start_date, region_date=@region_date,
         audit_opinion=@audit_opinion, updated_at=datetime('now')
       WHERE id=@id`
    )
    .run({ ...input, id });
}

/** 특정 연도 재무제표 조회 (없으면 undefined) */
export function getFinancials(
  companyId: number,
  fiscalYear: number
): FinancialStatement | undefined {
  const row = getDb()
    .prepare("SELECT * FROM financial_statements WHERE company_id=? AND fiscal_year=?")
    .get(companyId, fiscalYear) as Record<string, number> | undefined;
  if (!row) return undefined;
  const out = {} as FinancialStatement;
  for (const f of FIN_FIELDS) out[f] = row[f] ?? 0;
  return out;
}

/** 재무제표 저장 (연도별 UPSERT) */
export function upsertFinancials(
  companyId: number,
  fiscalYear: number,
  fin: FinancialStatement
): void {
  const cols = FIN_FIELDS.join(", ");
  const placeholders = FIN_FIELDS.map((f) => `@${f}`).join(", ");
  const updates = FIN_FIELDS.map((f) => `${f}=excluded.${f}`).join(", ");
  getDb()
    .prepare(
      `INSERT INTO financial_statements (company_id, fiscal_year, ${cols})
       VALUES (@company_id, @fiscal_year, ${placeholders})
       ON CONFLICT(company_id, fiscal_year) DO UPDATE SET ${updates}`
    )
    .run({ ...fin, company_id: companyId, fiscal_year: fiscalYear });
}

export interface CompanyFile {
  id: number;
  company_id: number;
  fiscal_year: number | null;
  filename: string;
  stored_path: string;
  mime: string | null;
  size: number | null;
  uploaded_at: string;
}

export function addFile(f: Omit<CompanyFile, "id" | "uploaded_at">): number {
  const info = getDb()
    .prepare(
      `INSERT INTO company_files (company_id, fiscal_year, filename, stored_path, mime, size)
       VALUES (@company_id, @fiscal_year, @filename, @stored_path, @mime, @size)`
    )
    .run(f);
  return Number(info.lastInsertRowid);
}

export function listFiles(companyId: number): CompanyFile[] {
  return getDb()
    .prepare("SELECT * FROM company_files WHERE company_id=? ORDER BY uploaded_at DESC")
    .all(companyId) as CompanyFile[];
}

export function getFile(id: number): CompanyFile | undefined {
  return getDb().prepare("SELECT * FROM company_files WHERE id=?").get(id) as
    | CompanyFile
    | undefined;
}

export function deleteFile(id: number): void {
  getDb().prepare("DELETE FROM company_files WHERE id=?").run(id);
}

/** 특정 연도·업종의 업종평균 비율 맵 반환 */
export function getIndustryAverages(
  fiscalYear: number,
  industryCode = "ELECTRIC"
): IndustryAverages {
  const rows = getDb()
    .prepare(
      "SELECT ratio_code, avg_value FROM industry_averages WHERE fiscal_year=? AND industry_code=?"
    )
    .all(fiscalYear, industryCode) as { ratio_code: RatioCode; avg_value: number }[];
  const out: IndustryAverages = {};
  for (const r of rows) out[r.ratio_code] = r.avg_value;
  return out;
}
