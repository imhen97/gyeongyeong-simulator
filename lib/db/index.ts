/**
 * 로컬 SQLite 연결 (서버 전용).
 *
 * ★ 이 파일은 절대 클라이언트(브라우저) 코드에서 import하면 안 된다.
 *   better-sqlite3는 Node 네이티브 모듈이라 API 라우트/서버 컴포넌트에서만 동작한다.
 *
 * DB 파일은 프로젝트 루트의 data/app.db 에 생성된다 (git 미추적).
 * 앱 시작 시 schema.sql을 실행해 표가 없으면 만든다(IF NOT EXISTS).
 */

import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (_db) return _db;

  const dataDir = path.join(process.cwd(), "data");
  fs.mkdirSync(dataDir, { recursive: true });

  const db = new Database(path.join(dataDir, "app.db"));
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  // 스키마 적용 (표가 없으면 생성)
  const schema = fs.readFileSync(path.join(process.cwd(), "lib", "db", "schema.sql"), "utf-8");
  db.exec(schema);

  // 최초 실행 시 시드 데이터 채우기
  seedIfEmpty(db);

  _db = db;
  return db;
}

/** 업종평균 등 기준 데이터가 비어 있으면 초기값을 넣는다. */
function seedIfEmpty(db: Database.Database) {
  const count = db.prepare("SELECT COUNT(*) AS n FROM industry_averages").get() as { n: number };
  if (count.n > 0) return;

  // 2026년 전기공사업 업종평균 (스펙 5장 검증 데이터 기준).
  // ⚠️ 실제 값은 매년 공표되는 공식 수치로 교체해야 함 — 지금은 예시/검증용.
  const avgs: Record<string, number> = {
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
  const insAvg = db.prepare(
    `INSERT INTO industry_averages (fiscal_year, industry_code, ratio_code, avg_value, source)
     VALUES (?, 'ELECTRIC', ?, ?, '검증용 예시(2026)')`
  );
  const tx = db.transaction(() => {
    for (const [code, val] of Object.entries(avgs)) insAvg.run(2026, code, val);
    // 기본 반올림 정책
    db.prepare("INSERT OR REPLACE INTO system_settings (key, value) VALUES (?, ?)").run(
      "rounding_mode",
      "TRUNCATE"
    );
    db.prepare("INSERT OR REPLACE INTO system_settings (key, value) VALUES (?, ?)").run(
      "rounding_digits",
      "2"
    );
  });
  tx();
}
