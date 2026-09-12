/**
 * /api/companies/[id]/files
 *  GET  : 첨부 목록
 *  POST : 파일 업로드(multipart form-data: file, [year]). PDF면 재무 자동추출 시도.
 *         응답: { file, extract }
 */

import { NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import { addFile, listFiles, getCompany } from "@/lib/db/repo";
import { extractFinancialsFromPdf, type ExtractResult } from "@/lib/extract/pdf";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const id = Number(params.id);
  return NextResponse.json(listFiles(id));
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const id = Number(params.id);
  if (!getCompany(id)) return NextResponse.json({ error: "업체 없음" }, { status: 404 });

  const form = await req.formData();
  const file = form.get("file") as File | null;
  const year = form.get("year") ? Number(form.get("year")) : null;
  if (!file) return NextResponse.json({ error: "파일이 없습니다." }, { status: 400 });

  const buf = Buffer.from(await file.arrayBuffer());

  // 저장: data/uploads/{companyId}/{timestamp-ish}-{name}
  const dir = path.join(process.cwd(), "data", "uploads", String(id));
  fs.mkdirSync(dir, { recursive: true });
  const safeName = file.name.replace(/[^\w.\-가-힣()]/g, "_");
  const stored = `${id}/${listFiles(id).length + 1}-${safeName}`;
  fs.writeFileSync(path.join(process.cwd(), "data", "uploads", stored), buf);

  const fileId = addFile({
    company_id: id,
    fiscal_year: year,
    filename: file.name,
    stored_path: stored,
    mime: file.type || null,
    size: buf.length,
  });

  // PDF면 자동추출 시도
  let extract: ExtractResult | null = null;
  if (file.type === "application/pdf" || /\.pdf$/i.test(file.name)) {
    extract = await extractFinancialsFromPdf(buf);
  }

  return NextResponse.json({ file: { id: fileId, filename: file.name, size: buf.length }, extract });
}
