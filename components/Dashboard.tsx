"use client";

/**
 * 메인 대시보드 — 원본 경영상태 프로그램 화면을 최대한 동일하게 재현한 고밀도(dense) 단일 화면.
 * 패널: [A]업체정보 [B]보유면허 [C]10년공종 [D]경영상태+등급 [E]신용 [F]기준별점수 [G]신인도 [H]메모
 *
 * - [A][D]는 DB/엔진과 실시간 연동 (재무 입력 → 9비율·등급 즉시 계산)
 * - [B]의 면허 "등급"은 1~5 드롭다운으로 사용자가 직접 선택
 * - 파일(PDF) 첨부 시 자동 추출값을 "검증 팝업"에서 사람이 확인·수정 후 반영
 * - [B][C][E][G]는 현재 표시용 샘플(㈜삼영기업) — 저장 연동은 다음 단계
 */

import { useEffect, useMemo, useState } from "react";
import { computeAllRatios } from "@/lib/scoring/ratios";
import { judgeGrade, GRADE_SCALE_BANDS, type Grade } from "@/lib/scoring/grades";
import type { FinancialStatement, IndustryAverages, RatioUnit } from "@/lib/scoring/types";
import type { Company, CompanyInput, CompanyFile } from "@/lib/db/repo";

/* ---------- 상수/샘플 데이터 ---------- */
const YEARS = [2026, 2025];

const DEFAULT_AVGS: IndustryAverages = {
  DEBT_RATIO: 104.94, CURRENT_RATIO: 139.21, BORROWING_DEP: 20.6, INTEREST_COV: 3.35,
  NET_MARGIN: 4.49, ROA: 2.88, CASHFLOW_RATIO: 2.55, ASSET_TURNOVER: 0.67, CONST_INVEST: 0.08,
};

const SAMPLE_COMPANY: CompanyInput = {
  name: "(주)삼영기업", biz_reg_no: "229-81-19166", ceo_name: "금동흠",
  address: "서울 서초구 강남대로79길 31, KD빌딩 4~6층 (반포동)",
  phone: "02-2023-0414", fax: "02-547-0463", is_sme: 0, is_female_ceo: 0,
  bid_manager: "", biz_start_date: "2012-06-12", region_date: "2012-06-12",
  audit_opinion: "의견없음",
};

const SAMPLE_FIN: FinancialStatement = {
  total_liabilities: 90_316_995, total_equity: 191_558_842, current_assets: 224_156_743,
  current_liabilities: 88_094_288, borrowings: 5_000_000, total_assets: 281_875_837,
  avg_total_assets: 270_043_947, operating_profit: 20_823_688, interest_expense: 1_111_633,
  net_profit: 32_540_776, total_revenue: 245_628_105, operating_cashflow: 65_019_595,
  construction_invest: 0, construction_revenue: 236_641_846,
};

/** [D] 9행: 좌측/중앙 라벨-값 쌍이 어떤 재무필드에 대응하는지 + 비율코드 */
const D_ROWS: {
  leftLabel: string; leftKey: keyof FinancialStatement;
  midLabel: string; midKey: keyof FinancialStatement; code: string;
}[] = [
  { leftLabel: "부채 총계", leftKey: "total_liabilities", midLabel: "자기 자본", midKey: "total_equity", code: "DEBT_RATIO" },
  { leftLabel: "유동 자산", leftKey: "current_assets", midLabel: "유동 부채", midKey: "current_liabilities", code: "CURRENT_RATIO" },
  { leftLabel: "차 입 금", leftKey: "borrowings", midLabel: "총 자산", midKey: "total_assets", code: "BORROWING_DEP" },
  { leftLabel: "영업 이익", leftKey: "operating_profit", midLabel: "이자 비용", midKey: "interest_expense", code: "INTEREST_COV" },
  { leftLabel: "순 이 익", leftKey: "net_profit", midLabel: "총매출액", midKey: "total_revenue", code: "NET_MARGIN" },
  { leftLabel: "순 이 익", leftKey: "net_profit", midLabel: "총 자산", midKey: "total_assets", code: "ROA" },
  { leftLabel: "영업현금흐름", leftKey: "operating_cashflow", midLabel: "총 자산", midKey: "total_assets", code: "CASHFLOW_RATIO" },
  { leftLabel: "매 출 액", leftKey: "total_revenue", midLabel: "기초기말자산", midKey: "avg_total_assets", code: "ASSET_TURNOVER" },
  { leftLabel: "건설개발투자", leftKey: "construction_invest", midLabel: "건설 매출액", midKey: "construction_revenue", code: "CONST_INVEST" },
];

const MONTH_TABS = ["2026-08", "2026-07", "2026-06", "2026-05"];

interface License {
  name: string; grade: number | null; cap: number; p3: number; p5: number; p1: number;
  d1: string; d2: string; sel: boolean;
}
const SAMPLE_LICENSES: License[] = [
  { name: "토건", grade: 3, cap: 102480000, p3: 59557000, p5: 129784000, p1: 0, d1: "2012-06-12", d2: "2015-01-19", sel: true },
  { name: "토목", grade: 3, cap: 102480000, p3: 59557000, p5: 129784000, p1: 0, d1: "2012-06-12", d2: "2013-12-02", sel: true },
  { name: "건축", grade: 3, cap: 29746000, p3: 0, p5: 0, p1: 0, d1: "2012-06-12", d2: "2015-01-19", sel: true },
  { name: "산업환경", grade: null, cap: 33971000, p3: 0, p5: 0, p1: 0, d1: "2012-06-12", d2: "", sel: false },
  { name: "전기", grade: null, cap: 757376248, p3: 1304211804, p5: 1694953372, p1: 0, d1: "1994-06-01", d2: "", sel: false },
  { name: "정보통신", grade: null, cap: 14229200, p3: 22086836, p5: 31400218, p1: 0, d1: "2000-07-06", d2: "", sel: false },
];

const WORK_TYPES: [string, number][] = [
  ["교통 시설", 234000], ["수자원 시설", 4522000], ["기타 토목", 145245000],
  ["주거 시설", 0], ["비주거 시설", 0],
];

const CREDIT_ROWS: (string | number)[][] = [
  ["기업신용", "A+", 35.0, "2026-06-02", "2027-06-01", 322, ""],
  ["기업신용", "A+", 35.0, "2025-06-02", "2026-06-01", -43, ""],
  ["기업신용", "A+", 35.0, "2025-04-21", "2026-04-20", -85, ""],
];

const RELIABILITY_ROWS: (string | number)[][] = [
  ["고용탄력성", "0.00", "+0.40", "2026-02-24", "2027-02-28", "229", "4등급"],
  ["사망만인율", "0.00", "+0.80", "2025-07-01", "2026-06-30", "-", "1,224"],
  ["재해예방", "+1.00", "+2.00", "2025-07-01", "2026-06-30", "-", "95점"],
  ["고용탄력성", "0.00", "+0.40", "2025-02-24", "2026-02-23", "-", "4등급"],
  ["안전인증", "+1.00", "0.00", "2012-11-29", "2028-02-28", "594", "A"],
];

/** [F] 기준별 경영상태점수 — 배점 참고표 (화면 그대로) */
const PPS_SCORE: string[][] = [
  ["사전심사", "", "", "통과"], ["간이종심", "10.0", "", "10.0"],
  ["50억 ↑", "15.0", "15.0", "15.0"], ["10억 ↑", "15.0", "15.0", "15.0"], ["10억 ↓", "10.0", "10.0", "10.0"],
];
const MOIS_SCORE: string[][] = [
  ["100억 ↑", "35.0", "", "34.91"], ["50억 ↑", "21.0", "21.0", "21.0"],
  ["30억 ↑", "15.0", "15.0", "15.0"], ["10억 ↑", "15.0", "15.0", "15.0"], ["10억 ↓", "10.0", "10.0", "10.0"],
];

const FIN_LABELS: Record<keyof FinancialStatement, string> = {
  total_liabilities: "부채 총계", total_equity: "자기 자본", current_assets: "유동 자산",
  current_liabilities: "유동 부채", borrowings: "차입금", total_assets: "총 자산",
  avg_total_assets: "기초기말평균자산", operating_profit: "영업 이익", interest_expense: "이자 비용",
  net_profit: "순 이익", total_revenue: "총 매출액", operating_cashflow: "영업현금흐름",
  construction_invest: "건설개발투자", construction_revenue: "건설 매출액",
};

/* ---------- 유틸 ---------- */
const fmt = (n: number | null | undefined) => (n == null ? "" : n.toLocaleString("en-US"));
const unit = (u: RatioUnit) => (u === "PERCENT" ? "%" : u === "TIMES" ? "배" : "회");
const parseNum = (s: string) => {
  const n = Number(s.replace(/[^0-9-]/g, ""));
  return Number.isFinite(n) ? n : 0;
};
const gradeColor = (g: Grade | null) =>
  g === "A" ? "text-blue-700" : g === "E" ? "text-red-600" : g === "D" ? "text-orange-600" : "text-neutral-900";

/* ================= 컴포넌트 ================= */
export default function Dashboard() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [year, setYear] = useState(2026);
  const [monthTab, setMonthTab] = useState("2026-07");
  const [company, setCompany] = useState<CompanyInput>(SAMPLE_COMPANY);
  const [fin, setFin] = useState<FinancialStatement>(SAMPLE_FIN);
  const [avgs, setAvgs] = useState<IndustryAverages>(DEFAULT_AVGS);
  const [licenses, setLicenses] = useState<License[]>(SAMPLE_LICENSES);
  const [files, setFiles] = useState<CompanyFile[]>([]);
  const [memo, setMemo] = useState("");
  const [reference, setReference] = useState("");
  const [status, setStatus] = useState("");
  const [extract, setExtract] = useState<null | {
    fields: Partial<FinancialStatement>; message: string;
  }>(null);
  const [preview, setPreview] = useState<CompanyFile | null>(null);

  const reloadList = async () => setCompanies(await (await fetch("/api/companies")).json());
  useEffect(() => { reloadList(); }, []);

  useEffect(() => {
    if (selectedId == null) return;
    (async () => {
      const data = await (await fetch(`/api/companies/${selectedId}?year=${year}`)).json();
      const { id, ...rest } = data.company as Company;
      setCompany(rest);
      setFin(data.financials ?? SAMPLE_FIN);
      setAvgs(data.industryAverages ?? DEFAULT_AVGS);
      setFiles(await (await fetch(`/api/companies/${selectedId}/files`)).json());
    })();
  }, [selectedId, year]);

  const results = useMemo(() => computeAllRatios(fin, avgs), [fin, avgs]);
  const byCode = useMemo(
    () => Object.fromEntries(results.map((r) => [r.code, r])),
    [results]
  );

  async function handleSave() {
    if (!company.name || !company.biz_reg_no) { setStatus("⚠️ 상호·사업자번호 필수"); return; }
    setStatus("저장 중...");
    try {
      let id = selectedId;
      if (id == null) {
        const res = await fetch("/api/companies", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify(company),
        });
        if (!res.ok) throw new Error((await res.json()).error);
        id = (await res.json()).id;
      }
      const res2 = await fetch(`/api/companies/${id}`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ company, fiscalYear: year, financials: fin }),
      });
      if (!res2.ok) throw new Error((await res2.json()).error);
      await reloadList();
      setSelectedId(id);
      setStatus("✅ 저장 완료");
    } catch (e: any) { setStatus("❌ " + (e?.message ?? e)); }
  }

  async function handleUpload(f: File) {
    if (selectedId == null) { setStatus("⚠️ 먼저 업체를 저장한 뒤 첨부하세요."); return; }
    setStatus("업로드/추출 중...");
    const fd = new FormData();
    fd.append("file", f);
    fd.append("year", String(year));
    const res = await fetch(`/api/companies/${selectedId}/files`, { method: "POST", body: fd });
    if (!res.ok) { setStatus("❌ 업로드 실패"); return; }
    const data = await res.json();
    setFiles(await (await fetch(`/api/companies/${selectedId}/files`)).json());
    setStatus("첨부 완료");
    if (data.extract) {
      // 자동추출 결과가 있으면 검증 팝업을 띄운다 (사람이 확인/수정 후 반영)
      setExtract({ fields: data.extract.fields ?? {}, message: data.extract.message });
    }
  }

  return (
    <div className="min-h-screen bg-neutral-100 p-2 text-[12px]">
      {/* 상단 툴바 (원본 화면엔 없던 조작부 — 슬림하게) */}
      <div className="flex items-center gap-2 mb-2 flex-wrap">
        <select className="inp w-56" value={selectedId ?? ""}
          onChange={(e) => setSelectedId(e.target.value ? Number(e.target.value) : null)}>
          <option value="">— 업체 선택 —</option>
          {companies.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.biz_reg_no})</option>)}
        </select>
        <button className="btn" onClick={() => { setSelectedId(null); setCompany(SAMPLE_COMPANY); setFin(SAMPLE_FIN); setStatus(""); }}>+ 새 업체</button>
        <select className="inp w-20" value={year} onChange={(e) => setYear(Number(e.target.value))}>
          {YEARS.map((y) => <option key={y} value={y}>{y}년</option>)}
        </select>
        <button className="btn btn-primary" onClick={handleSave}>저장</button>
        <label className="btn cursor-pointer">
          📎 파일 첨부
          <input type="file" className="hidden" accept=".pdf,.png,.jpg,.jpeg"
            onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0])} />
        </label>
        {files.length > 0 && (
          <span className="text-neutral-500 flex items-center gap-1 flex-wrap">
            첨부 {files.length}건:
            {files.map((f) => (
              <span key={f.id} className="inline-flex items-center gap-0.5 border border-neutral-300 rounded px-1 bg-white">
                <button className="text-blue-700 hover:underline" onClick={() => setPreview(f)} title="미리보기로 원본과 대조">🔍 {f.filename}</button>
                <a className="text-neutral-400 hover:text-neutral-700" href={`/api/files/${f.id}?download=1`} title="다운로드">⬇</a>
              </span>
            ))}
          </span>
        )}
        <span className="text-neutral-600">{status}</span>
      </div>

      <div className="max-w-[1100px] mx-auto space-y-1">
        {/* ===== [A] 업체 기본정보 ===== */}
        <table className="grid-tbl w-full">
          <tbody>
            <tr>
              <TdL>업체 상호</TdL>
              <td className="cell" colSpan={2}><input className="cellinp" value={company.name} onChange={(e) => setCompany({ ...company, name: e.target.value })} /></td>
              <td className="cell text-center"><label className="inline-flex gap-1 items-center"><input type="checkbox" checked={!!company.is_sme} onChange={(e) => setCompany({ ...company, is_sme: e.target.checked ? 1 : 0 })} />중소기업</label></td>
              <TdL>사업자 번호</TdL>
              <td className="cell"><input className="cellinp" value={company.biz_reg_no} onChange={(e) => setCompany({ ...company, biz_reg_no: e.target.value })} /></td>
              <td className="cell" />
              <TdL>영업일자</TdL>
              <td className="cell"><input className="cellinp" value={company.biz_start_date ?? ""} onChange={(e) => setCompany({ ...company, biz_start_date: e.target.value })} /></td>
            </tr>
            <tr>
              <TdL>대표 이사</TdL>
              <td className="cell" colSpan={2}><input className="cellinp" value={company.ceo_name ?? ""} onChange={(e) => setCompany({ ...company, ceo_name: e.target.value })} /></td>
              <td className="cell text-center"><label className="inline-flex gap-1 items-center"><input type="checkbox" checked={!!company.is_female_ceo} onChange={(e) => setCompany({ ...company, is_female_ceo: e.target.checked ? 1 : 0 })} />여성대표</label></td>
              <TdL>입찰 담당자</TdL>
              <td className="cell"><input className="cellinp" value={company.bid_manager ?? ""} onChange={(e) => setCompany({ ...company, bid_manager: e.target.value })} /></td>
              <TdL>전화번호</TdL>
              <td className="cell"><input className="cellinp" value={company.phone ?? ""} onChange={(e) => setCompany({ ...company, phone: e.target.value })} /></td>
              <TdL>지역일자</TdL>
              <td className="cell"><input className="cellinp" value={company.region_date ?? ""} onChange={(e) => setCompany({ ...company, region_date: e.target.value })} /></td>
            </tr>
            <tr>
              <TdL>사업자 주소</TdL>
              <td className="cell" colSpan={4}><input className="cellinp" value={company.address ?? ""} onChange={(e) => setCompany({ ...company, address: e.target.value })} /></td>
              <TdL>팩스번호</TdL>
              <td className="cell"><input className="cellinp" value={company.fax ?? ""} onChange={(e) => setCompany({ ...company, fax: e.target.value })} /></td>
              <TdL>감사보고</TdL>
              <td className="cell"><input className="cellinp" value={company.audit_opinion ?? ""} onChange={(e) => setCompany({ ...company, audit_opinion: e.target.value })} /></td>
            </tr>
          </tbody>
        </table>

        {/* ===== [B] 보유면허 + [C] 10년공종 ===== */}
        <div className="flex gap-1">
          <div className="panel flex-1">
            <div className="ptitle flex items-center gap-2">
              <span>보유면허 시공실적</span><span className="text-neutral-500 font-normal">(단위:천원)</span>
              <span className="ml-2 flex gap-0.5">
                {MONTH_TABS.map((m) => (
                  <button key={m} onClick={() => setMonthTab(m)}
                    className={`px-1.5 py-0.5 rounded text-[11px] ${monthTab === m ? "bg-fuchsia-500 text-white" : "bg-fuchsia-100 text-neutral-600"}`}>{m}</button>
                ))}
              </span>
              <button className="ml-auto btn-xs">업역면허조회</button>
            </div>
            <table className="grid-tbl w-full">
              <thead><tr className="hd">
                <Th>보유면허</Th><Th>등급</Th><Th>시공 능력액</Th><Th>3년간 실적</Th><Th>5년간 실적</Th><Th>최근 1년</Th><Th>영업산정일</Th><Th>면허등록일</Th>
              </tr></thead>
              <tbody>
                {licenses.map((l, i) => (
                  <tr key={i} className={l.sel ? "bg-blue-50" : ""}>
                    <td className="cell">{l.name}</td>
                    <td className="cell text-center">
                      {/* 면허 등급: 1~5 드롭다운 (회사별 직접 선택) */}
                      <select className="cellinp text-center" value={l.grade ?? ""}
                        onChange={(e) => setLicenses(licenses.map((x, j) => j === i ? { ...x, grade: e.target.value ? Number(e.target.value) : null } : x))}>
                        <option value=""></option>
                        {[1, 2, 3, 4, 5].map((g) => <option key={g} value={g}>{g}</option>)}
                      </select>
                    </td>
                    <td className="cell num">{fmt(l.cap)}</td>
                    <td className="cell num">{fmt(l.p3)}</td>
                    <td className="cell num">{fmt(l.p5)}</td>
                    <td className="cell num">{fmt(l.p1)}</td>
                    <td className="cell text-center">{l.d1}</td>
                    <td className="cell text-center">{l.d2}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="panel w-[240px]">
            <div className="ptitle">10년간 동일공종 실적합</div>
            <table className="grid-tbl w-full">
              <thead><tr className="hd"><Th>평가공종</Th><Th>10년 실적</Th></tr></thead>
              <tbody>
                {WORK_TYPES.map(([n, v]) => (
                  <tr key={n}><td className="cell">{n}</td><td className="cell num">{fmt(v)}</td></tr>
                ))}
                <tr><td className="cell text-neutral-400 text-center" colSpan={2}>실적 변경안된 경우 연한색</td></tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* ===== [D] 경영상태 평가자료 ===== */}
        <div className="panel">
          <div className="ptitle flex items-center gap-2">
            <span>경영상태 평가자료</span><span className="text-neutral-500 font-normal">(단위:천원)</span>
            <span className="ml-2 flex gap-0.5">
              {YEARS.map((y) => (
                <button key={y} onClick={() => setYear(y)}
                  className={`px-2 py-0.5 rounded text-[11px] ${year === y ? "bg-fuchsia-500 text-white" : "bg-neutral-200 text-neutral-500"}`}>{y}</button>
              ))}
            </span>
          </div>
          <table className="grid-tbl w-full">
            <thead><tr className="hd">
              <Th></Th><Th>항 목</Th><Th></Th><Th>항 목</Th><Th>항 목</Th>
              <Th>경영비율</Th><Th>평균비율</Th><Th>산출비율</Th>
              <Th>100억</Th><Th>10억↑</Th><Th>10억↓</Th>
            </tr></thead>
            <tbody>
              {D_ROWS.map((row, i) => {
                const r = byCode[row.code];
                const grade = judgeGrade(r?.calcRatio ?? null, r?.direction ?? "HIGHER_BETTER").grade;
                return (
                  <tr key={i}>
                    <td className="cell lbl">{row.leftLabel}</td>
                    <td className="cell"><input className="cellinp num" value={fmt(fin[row.leftKey])}
                      onChange={(e) => setFin({ ...fin, [row.leftKey]: parseNum(e.target.value) })} /></td>
                    <td className="cell lbl">{row.midLabel}</td>
                    <td className="cell"><input className="cellinp num" value={fmt(fin[row.midKey])}
                      onChange={(e) => setFin({ ...fin, [row.midKey]: parseNum(e.target.value) })} /></td>
                    <td className="cell text-blue-700">{r?.label}</td>
                    <td className="cell num">{r?.bizRatio == null ? "-" : `${fmt(r.bizRatio)}${unit(r.unit)}`}</td>
                    <td className="cell num text-neutral-500">{avgs[row.code as keyof IndustryAverages] != null ? `${fmt(avgs[row.code as keyof IndustryAverages]!)}${unit(r?.unit ?? "PERCENT")}` : "-"}</td>
                    <td className="cell num font-semibold">{r?.calcRatio == null ? "-" : `${fmt(r.calcRatio)}%`}</td>
                    {GRADE_SCALE_BANDS.map((b) => (
                      <td key={b} className={`cell text-center font-bold ${gradeColor(grade)}`}>{grade ?? ""}</td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="px-2 py-0.5 text-[11px] text-neutral-500">
            ※ 산출비율 = (경영비율 ÷ 업종평균) × 100. 등급 구간·배점은 예시값(예규 확정 시 교체).
          </div>
        </div>

        {/* ===== [E]/[G] 좌측 · [F]/[H] 우측 ===== */}
        <div className="flex gap-1 items-start">
          <div className="flex-1 space-y-1">
            {/* [E] 신용등급 */}
            <div className="panel">
              <div className="ptitle flex"><span>신용등급 평가자료</span><button className="ml-auto btn-xs">추가 / 삭제</button></div>
              <table className="grid-tbl w-full">
                <thead><tr className="hd"><Th>신용구분</Th><Th>등급</Th><Th>점수</Th><Th>평가일</Th><Th>유효일</Th><Th>기간</Th><Th>비고</Th></tr></thead>
                <tbody>
                  {CREDIT_ROWS.map((c, i) => (
                    <tr key={i}>
                      <td className="cell">{c[0]}</td><td className="cell text-center text-blue-700">{c[1]}</td>
                      <td className="cell num">{Number(c[2]).toFixed(1)}</td><td className="cell text-center">{c[3]}</td>
                      <td className="cell text-center">{c[4]}</td>
                      <td className={`cell num ${Number(c[5]) < 0 ? "text-red-600" : "text-blue-700"}`}>{c[5]}</td>
                      <td className="cell">{c[6]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {/* [G] 신인도 */}
            <div className="panel">
              <div className="ptitle flex"><span>신인도 평가자료</span><span className="text-neutral-500 font-normal ml-1">(신인도항목은 50억이상 공사 적용)</span><button className="ml-auto btn-xs">추가 / 삭제</button></div>
              <table className="grid-tbl w-full">
                <thead><tr className="hd"><Th>평가 항목</Th><Th>조달</Th><Th>행자</Th><Th>적용일</Th><Th>만료일</Th><Th>기간</Th><Th>비고</Th></tr></thead>
                <tbody>
                  {RELIABILITY_ROWS.map((c, i) => (
                    <tr key={i}>
                      <td className="cell">{c[0]}</td><td className="cell num">{c[1]}</td><td className="cell num">{c[2]}</td>
                      <td className="cell text-center">{c[3]}</td><td className="cell text-center">{c[4]}</td>
                      <td className="cell text-center">{c[5]}</td><td className="cell">{c[6]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="w-[430px] space-y-1">
            {/* [F] 기준별 경영상태점수 */}
            <div className="panel">
              <div className="ptitle">기준별 경영상태점수</div>
              <div className="flex gap-1 p-1">
                <ScoreTable title="조달청" rows={PPS_SCORE} />
                <ScoreTable title="행자부" rows={MOIS_SCORE} />
              </div>
            </div>
            {/* [H] 메모 / 참고 */}
            <div className="panel p-1 flex gap-1">
              <div className="flex flex-col gap-1 w-14">
                <div className="lbl text-center py-1">메 모</div>
                <button className="btn-xs" onClick={handleSave}>저장</button>
                <div className="lbl text-center py-1">참 고</div>
              </div>
              <div className="flex-1 flex flex-col gap-1">
                <textarea className="cellinp h-14 resize-none" value={memo} onChange={(e) => setMemo(e.target.value)} />
                <textarea className="cellinp h-14 resize-none" value={reference} onChange={(e) => setReference(e.target.value)} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ===== 첨부파일 미리보기(원본 ↔ 입력값 대조) ===== */}
      {preview && (
        <PreviewModal file={preview} fin={fin} results={results} onClose={() => setPreview(null)} />
      )}

      {/* ===== 파일 추출 검증 팝업 ===== */}
      {extract && (
        <ExtractModal
          fields={extract.fields}
          message={extract.message}
          currentFin={fin}
          onCancel={() => setExtract(null)}
          onApply={(vals) => { setFin({ ...fin, ...vals }); setExtract(null); setStatus("✅ 추출값 반영됨 — [D]에서 최종 확인하세요."); }}
        />
      )}
    </div>
  );
}

/* ---------- 작은 컴포넌트 ---------- */
function TdL({ children }: { children: React.ReactNode }) {
  return <td className="cell lbl whitespace-nowrap">{children}</td>;
}
function Th({ children }: { children?: React.ReactNode }) {
  return <th className="cell hd-cell">{children}</th>;
}
function ScoreTable({ title, rows }: { title: string; rows: string[][] }) {
  return (
    <div className="flex-1">
      <table className="grid-tbl w-full">
        <thead>
          <tr className="hd"><Th>추정가격</Th><Th>배점</Th><Th>재무</Th><Th>신용</Th></tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              <td className="cell lbl text-center">{r[0]}</td>
              <td className="cell num">{r[1]}</td><td className="cell num">{r[2]}</td><td className="cell num">{r[3]}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="text-center text-[11px] text-neutral-500">{title}</div>
    </div>
  );
}

/** 첨부 원본 파일 미리보기 — 왼쪽 원본 문서, 오른쪽 입력된 재무값/비율을 나란히 놓고 대조 */
function PreviewModal({
  file, fin, results, onClose,
}: {
  file: CompanyFile;
  fin: FinancialStatement;
  results: ReturnType<typeof computeAllRatios>;
  onClose: () => void;
}) {
  const url = `/api/files/${file.id}`;
  const isImage = (file.mime ?? "").startsWith("image/") || /\.(png|jpe?g|gif|webp)$/i.test(file.filename);
  const isPdf = (file.mime ?? "") === "application/pdf" || /\.pdf$/i.test(file.filename);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded shadow-xl w-full max-w-[1200px] h-[88vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 px-3 py-2 border-b">
          <h2 className="text-sm font-bold">🔍 원본 대조 — {file.filename}</h2>
          <a className="btn-xs" href={`${url}?download=1`}>다운로드</a>
          <button className="ml-auto btn" onClick={onClose}>닫기 ✕</button>
        </div>
        <div className="flex-1 flex min-h-0">
          {/* 왼쪽: 원본 파일 */}
          <div className="flex-1 bg-neutral-200 min-w-0">
            {isPdf ? (
              <iframe src={url} className="w-full h-full" title="원본 미리보기" />
            ) : isImage ? (
              <div className="w-full h-full overflow-auto flex items-start justify-center p-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt={file.filename} className="max-w-full" />
              </div>
            ) : (
              <div className="p-4 text-[12px] text-neutral-600">
                이 형식은 미리보기를 지원하지 않습니다. <a className="text-blue-600 underline" href={`${url}?download=1`}>다운로드</a>해서 확인하세요.
              </div>
            )}
          </div>
          {/* 오른쪽: 입력된 값 + 계산 결과 (대조용) */}
          <div className="w-[380px] border-l overflow-auto p-2 shrink-0">
            <div className="text-[12px] font-bold mb-1">현재 입력된 재무값 (천원)</div>
            <table className="grid-tbl w-full mb-3">
              <tbody>
                {(Object.keys(FIN_LABELS) as (keyof FinancialStatement)[]).map((k) => (
                  <tr key={k}>
                    <td className="cell lbl">{FIN_LABELS[k]}</td>
                    <td className="cell num">{fmt(fin[k])}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="text-[12px] font-bold mb-1">계산된 비율</div>
            <table className="grid-tbl w-full">
              <thead><tr className="hd"><Th>항목</Th><Th>경영비율</Th><Th>산출비율</Th></tr></thead>
              <tbody>
                {results.map((r) => (
                  <tr key={r.code}>
                    <td className="cell text-blue-700">{r.label}</td>
                    <td className="cell num">{r.bizRatio == null ? "-" : `${fmt(r.bizRatio)}${unit(r.unit)}`}</td>
                    <td className="cell num">{r.calcRatio == null ? "-" : `${fmt(r.calcRatio)}%`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="text-[11px] text-neutral-500 mt-2">
              왼쪽 원본 문서의 수치와 오른쪽 입력값이 일치하는지 눈으로 대조하세요.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

/** 파일 추출값 검증 팝업 — 사람이 각 값을 확인·수정 후 반영 */
function ExtractModal({
  fields, message, currentFin, onCancel, onApply,
}: {
  fields: Partial<FinancialStatement>; message: string; currentFin: FinancialStatement;
  onCancel: () => void; onApply: (vals: Partial<FinancialStatement>) => void;
}) {
  const keys = Object.keys(fields) as (keyof FinancialStatement)[];
  const [checked, setChecked] = useState<Record<string, boolean>>(
    Object.fromEntries(keys.map((k) => [k, true]))
  );
  const [vals, setVals] = useState<Record<string, number>>(
    Object.fromEntries(keys.map((k) => [k, fields[k] as number]))
  );

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={onCancel}>
      <div className="bg-white rounded shadow-xl w-[560px] max-h-[80vh] overflow-auto p-4" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-sm font-bold mb-1">📄 자동 추출값 확인</h2>
        <p className="text-[12px] text-neutral-600 mb-3">{message}</p>
        {keys.length === 0 ? (
          <p className="text-[12px] text-neutral-500">추출된 항목이 없습니다. 값을 직접 입력해 주세요.</p>
        ) : (
          <table className="w-full text-[12px] border-collapse">
            <thead><tr className="bg-neutral-100">
              <th className="cell w-8">반영</th><th className="cell text-left">항목</th>
              <th className="cell text-right">현재값</th><th className="cell text-right">추출값(수정가능)</th>
            </tr></thead>
            <tbody>
              {keys.map((k) => (
                <tr key={k}>
                  <td className="cell text-center"><input type="checkbox" checked={!!checked[k]} onChange={(e) => setChecked({ ...checked, [k]: e.target.checked })} /></td>
                  <td className="cell">{FIN_LABELS[k]}</td>
                  <td className="cell num text-neutral-500">{fmt(currentFin[k])}</td>
                  <td className="cell"><input className="cellinp num" value={fmt(vals[k])} onChange={(e) => setVals({ ...vals, [k]: parseNum(e.target.value) })} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <div className="flex justify-end gap-2 mt-4">
          <button className="btn" onClick={onCancel}>취소</button>
          <button className="btn btn-primary" onClick={() => {
            const out: Partial<FinancialStatement> = {};
            for (const k of keys) if (checked[k]) out[k] = vals[k];
            onApply(out);
          }}>선택 항목 반영</button>
        </div>
      </div>
    </div>
  );
}
