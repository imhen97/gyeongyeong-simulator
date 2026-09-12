-- 경영상태 시뮬레이터 로컬 DB 스키마 (SQLite)
-- 스펙 3장의 Postgres 스키마를 SQLite로 옮긴 것. 나중에 Supabase(Postgres)로 이전 가능하도록
-- 표/칸 이름을 동일하게 유지한다. (SQLite에는 BIGSERIAL 대신 INTEGER PRIMARY KEY AUTOINCREMENT 사용)
--
-- 설계 원칙 (스펙 3장):
--  1) 법령 기준표(업종평균/등급구간/배점)는 코드가 아니라 표로 보관 — 매년 바뀜
--  2) 실적·재무 데이터는 기준시점(base_month / fiscal_year)과 함께 저장
--  3) 금액은 전부 "천원" 정수

PRAGMA foreign_keys = ON;

-- 3-1. 업체 마스터
CREATE TABLE IF NOT EXISTS companies (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  name           TEXT NOT NULL,               -- 업체 상호
  biz_reg_no     TEXT UNIQUE NOT NULL,        -- 사업자 번호 (###-##-#####)
  ceo_name       TEXT,                        -- 대표 이사
  address        TEXT,                        -- 사업자 주소
  phone          TEXT,
  fax            TEXT,
  is_sme         INTEGER NOT NULL DEFAULT 0,  -- 중소기업 여부 (0/1)
  is_female_ceo  INTEGER NOT NULL DEFAULT 0,  -- 여성대표 여부 (0/1)
  bid_manager    TEXT,                        -- 입찰 담당자
  biz_start_date TEXT,                        -- 영업일자 (YYYY-MM-DD)
  region_date    TEXT,                        -- 지역일자
  audit_opinion  TEXT,                        -- 감사보고 의견
  created_at     TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at     TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 3-4. 재무제표 원천 데이터 (연도별). 금액 단위: 천원
CREATE TABLE IF NOT EXISTS financial_statements (
  id                   INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id           INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  fiscal_year          INTEGER NOT NULL,     -- 2026, 2025 ...
  total_liabilities    INTEGER,              -- 부채 총계
  total_equity         INTEGER,              -- 자기 자본
  current_assets       INTEGER,              -- 유동 자산
  current_liabilities  INTEGER,              -- 유동 부채
  borrowings           INTEGER,              -- 차입금
  total_assets         INTEGER,              -- 총 자산
  avg_total_assets     INTEGER,              -- 기초기말평균자산
  operating_profit     INTEGER,              -- 영업 이익
  interest_expense     INTEGER,              -- 이자 비용
  net_profit           INTEGER,              -- 순 이익
  total_revenue        INTEGER,              -- 총 매출액
  operating_cashflow   INTEGER,              -- 영업현금흐름
  construction_invest  INTEGER DEFAULT 0,    -- 건설개발투자
  construction_revenue INTEGER DEFAULT 0,    -- 건설 매출액
  UNIQUE (company_id, fiscal_year)
);

-- 3-5. 업종평균 비율 (기준표 ①)
CREATE TABLE IF NOT EXISTS industry_averages (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  fiscal_year   INTEGER NOT NULL,
  industry_code TEXT NOT NULL,   -- 'ELECTRIC' 등
  ratio_code    TEXT NOT NULL,   -- DEBT_RATIO 등
  avg_value     REAL NOT NULL,   -- 업종 평균값
  source        TEXT,
  UNIQUE (fiscal_year, industry_code, ratio_code)
);

-- 3-6. 등급 구간표 (기준표 ②)
CREATE TABLE IF NOT EXISTS ratio_grade_bands (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  effective_year INTEGER NOT NULL,
  agency         TEXT NOT NULL,   -- 'PPS'(조달청) | 'MOIS'(행자부)
  scale_band     TEXT NOT NULL,   -- 'OVER_100E' | 'OVER_10E' | 'UNDER_10E'
  ratio_code     TEXT NOT NULL,
  min_calc_ratio REAL,            -- 산출비율 하한 (NULL=무제한)
  max_calc_ratio REAL,            -- 산출비율 상한 (NULL=무제한)
  grade          TEXT NOT NULL,   -- A~E
  points         REAL
);

-- 3-7. 기준별 배점표 (기준표 ③)
CREATE TABLE IF NOT EXISTS scoring_rules (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  effective_year INTEGER NOT NULL,
  agency         TEXT NOT NULL,   -- 'PPS' | 'MOIS'
  scale_band     TEXT NOT NULL,   -- 'PRE_SCREEN' | 'SIMPLE' | 'OVER_50E' | 'OVER_30E' | 'OVER_10E' | 'UNDER_10E'
  total_points   REAL,
  finance_points REAL,
  credit_points  REAL
);

-- 3-8. 신용등급 이력
CREATE TABLE IF NOT EXISTS credit_ratings (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id  INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  credit_type TEXT NOT NULL,    -- '기업신용' | '회사채' | '기업어음'
  grade       TEXT NOT NULL,    -- 'A+' 등
  score       REAL,
  eval_date   TEXT NOT NULL,
  expiry_date TEXT NOT NULL,
  note        TEXT
);

-- 3-9. 신인도 항목
CREATE TABLE IF NOT EXISTS reliability_items (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  item_code  TEXT NOT NULL,
  item_name  TEXT NOT NULL,
  pps_score  REAL DEFAULT 0,   -- 조달청 가감점
  mois_score REAL DEFAULT 0,   -- 행자부 가감점
  apply_from TEXT NOT NULL,
  apply_to   TEXT NOT NULL,
  note       TEXT
);

-- 3-10. 메모
CREATE TABLE IF NOT EXISTS company_memos (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  memo       TEXT,
  reference  TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 앱 전역 설정 (반올림 방식 등). 스펙 4-3의 rounding_mode/rounding_digits 저장용
CREATE TABLE IF NOT EXISTS system_settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- 첨부 파일 (경영상태확인서 PDF/이미지 등 원본 근거자료 보관)
CREATE TABLE IF NOT EXISTS company_files (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id  INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  fiscal_year INTEGER,               -- 관련 연도(선택)
  filename    TEXT NOT NULL,         -- 원본 파일명
  stored_path TEXT NOT NULL,         -- data/uploads 하위 저장 경로
  mime        TEXT,
  size        INTEGER,
  uploaded_at TEXT NOT NULL DEFAULT (datetime('now'))
);
