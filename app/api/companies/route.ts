/**
 * /api/companies
 *  GET  : 업체 목록
 *  POST : 업체 생성 (기본정보). body = CompanyInput
 */

import { NextResponse } from "next/server";
import { listCompanies, createCompany, type CompanyInput } from "@/lib/db/repo";

export const dynamic = "force-dynamic"; // DB 조회는 항상 최신

export async function GET() {
  return NextResponse.json(listCompanies());
}

export async function POST(req: Request) {
  const body = (await req.json()) as CompanyInput;
  if (!body?.name || !body?.biz_reg_no) {
    return NextResponse.json({ error: "상호와 사업자번호는 필수입니다." }, { status: 400 });
  }
  try {
    // 정규화(빈문자→null, 누락칸 기본값)는 repo.createCompany 내부에서 처리한다.
    const id = createCompany(body);
    return NextResponse.json({ id }, { status: 201 });
  } catch (e: any) {
    // 사업자번호 중복 등
    return NextResponse.json({ error: String(e?.message ?? e) }, { status: 400 });
  }
}
