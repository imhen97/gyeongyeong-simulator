/**
 * /api/files/[fileId]
 *  GET    : 첨부 파일 다운로드
 *  DELETE : 첨부 삭제
 */

import { NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import { getFile, deleteFile } from "@/lib/db/repo";

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: { fileId: string } }) {
  const f = getFile(Number(params.fileId));
  if (!f) return NextResponse.json({ error: "파일 없음" }, { status: 404 });
  const abs = path.join(process.cwd(), "data", "uploads", f.stored_path);
  if (!fs.existsSync(abs)) return NextResponse.json({ error: "저장 파일 없음" }, { status: 404 });
  const buf = fs.readFileSync(abs);

  // ?download=1 이면 다운로드(attachment), 아니면 브라우저 미리보기용 인라인(inline)
  const download = new URL(req.url).searchParams.get("download") === "1";
  const disposition = download ? "attachment" : "inline";
  return new NextResponse(buf, {
    headers: {
      "Content-Type": f.mime || "application/octet-stream",
      "Content-Disposition": `${disposition}; filename*=UTF-8''${encodeURIComponent(f.filename)}`,
    },
  });
}

export async function DELETE(_req: Request, { params }: { params: { fileId: string } }) {
  const f = getFile(Number(params.fileId));
  if (f) {
    const abs = path.join(process.cwd(), "data", "uploads", f.stored_path);
    try {
      fs.unlinkSync(abs);
    } catch {}
    deleteFile(f.id);
  }
  return NextResponse.json({ ok: true });
}
