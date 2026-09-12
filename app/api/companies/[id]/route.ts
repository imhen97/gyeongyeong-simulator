/**
 * /api/companies/[id]
 *  GET  : 업체 기본정보 + 특정 연도(?year=) 재무제표 + 업종평균
 *  PUT  : 업체 기본정보 + 재무제표 저장. body = { company, fiscalYear, financials }
 */

import { NextResponse } from "next/server";
import {
  getCompany,
  updateCompany,
  getFinancials,
  upsertFinancials,
  getIndustryAverages,
  type CompanyInput,
} from "@/lib/db/repo";
import type { FinancialStatement } from "@/lib/scoring/types";

export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  const id = Number(params.id);
  const company = getCompany(id);
  if (!company) return NextResponse.json({ error: "업체 없음" }, { status: 404 });

  const year = Number(new URL(req.url).searchParams.get("year")) || new Date().getFullYear();
  return NextResponse.json({
    company,
    fiscalYear: year,
    financials: getFinancials(id, year) ?? null,
    industryAverages: getIndustryAverages(year),
  });
}

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const id = Number(params.id);
  if (!getCompany(id)) return NextResponse.json({ error: "업체 없음" }, { status: 404 });

  const body = (await req.json()) as {
    company: CompanyInput;
    fiscalYear: number;
    financials: FinancialStatement;
  };

  // 정규화는 repo.updateCompany 내부에서 처리한다.
  updateCompany(id, body.company);
  if (body.financials && body.fiscalYear) {
    upsertFinancials(id, body.fiscalYear, body.financials);
  }
  return NextResponse.json({ ok: true });
}
