-- ============================================================
-- KARMIQ — Supabase Database Setup
-- Multi-Tenant Schema with Row Level Security (RLS)
-- ============================================================
-- Instructions:
--   1. Supabase dashboard mein jao: https://app.supabase.com
--   2. Apna project open karo
--   3. Left sidebar mein "SQL Editor" click karo
--   4. Yeh poora script paste karo aur "Run" karo
-- ============================================================


-- ============================================================
-- STEP 1: EXTENSIONS
-- ============================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";


-- ============================================================
-- STEP 2: STORES TABLE (Multi-Tenant Root)
-- Har dukaan = ek row
-- ============================================================
CREATE TABLE IF NOT EXISTS public.stores (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shop_name           TEXT NOT NULL,
  owner_name          TEXT NOT NULL,
  phone               TEXT UNIQUE NOT NULL,
  category            TEXT DEFAULT 'Retail Shop',
  opening_time        TEXT DEFAULT '09:00',
  closing_time        TEXT DEFAULT '20:00',
  daily_target_hours  INT DEFAULT 8,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stores_phone ON public.stores(phone);


-- ============================================================
-- STEP 3: STORE USERS TABLE (Admin / Manager / Kiosk per store)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.store_users (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  store_id       UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  username       TEXT NOT NULL,
  password_hash  TEXT NOT NULL,
  role           TEXT NOT NULL CHECK (role IN ('admin', 'manager', 'kiosk')),
  kiosk_code     TEXT,
  owner_pin      TEXT,
  is_active      BOOLEAN DEFAULT TRUE,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(store_id, username),
  UNIQUE(store_id, role)
);

CREATE INDEX IF NOT EXISTS idx_store_users_store_id ON public.store_users(store_id);
CREATE INDEX IF NOT EXISTS idx_store_users_username ON public.store_users(username);


-- ============================================================
-- STEP 4: EMPLOYEES TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.employees (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  store_id       UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  emp_code       TEXT NOT NULL,
  name           TEXT NOT NULL,
  phone          TEXT,
  role           TEXT DEFAULT 'Staff',
  salary_type    TEXT DEFAULT 'monthly' CHECK (salary_type IN ('monthly', 'daily', 'hourly')),
  salary         NUMERIC(10,2) DEFAULT 0,
  join_date      DATE DEFAULT CURRENT_DATE,
  is_left        BOOLEAN DEFAULT FALSE,
  left_date      DATE,
  profile_color  TEXT DEFAULT '#6366f1',
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(store_id, emp_code)
);

CREATE INDEX IF NOT EXISTS idx_employees_store_id ON public.employees(store_id);
CREATE INDEX IF NOT EXISTS idx_employees_is_left ON public.employees(store_id, is_left);


-- ============================================================
-- STEP 5: ATTENDANCE TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.attendance (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  store_id        UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  employee_id     UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  date            DATE NOT NULL DEFAULT CURRENT_DATE,
  status          TEXT DEFAULT 'Absent' CHECK (status IN ('Present', 'Absent', 'Half Day', 'Holiday', 'Leave')),
  check_in_time   TEXT,
  check_out_time  TEXT,
  notes           TEXT,
  marked_by       TEXT DEFAULT 'admin',
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(store_id, employee_id, date)
);

CREATE INDEX IF NOT EXISTS idx_attendance_store_date ON public.attendance(store_id, date);
CREATE INDEX IF NOT EXISTS idx_attendance_employee_date ON public.attendance(employee_id, date);


-- ============================================================
-- STEP 6: BREAKS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.breaks (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  store_id     UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  employee_id  UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  date         DATE NOT NULL DEFAULT CURRENT_DATE,
  out_time     TEXT NOT NULL,
  back_time    TEXT,
  reason       TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_breaks_store_date ON public.breaks(store_id, date);
CREATE INDEX IF NOT EXISTS idx_breaks_employee_date ON public.breaks(employee_id, date);


-- ============================================================
-- STEP 7: PAYMENTS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.payments (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  store_id      UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  employee_id   UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  payment_type  TEXT DEFAULT 'salary' CHECK (payment_type IN ('salary', 'advance', 'bonus', 'deduction')),
  amount        NUMERIC(10,2) NOT NULL,
  month         TEXT,
  note          TEXT,
  paid_by       TEXT DEFAULT 'admin',
  paid_at       TIMESTAMPTZ DEFAULT NOW(),
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payments_store_id ON public.payments(store_id);
CREATE INDEX IF NOT EXISTS idx_payments_employee_id ON public.payments(employee_id);
CREATE INDEX IF NOT EXISTS idx_payments_month ON public.payments(store_id, month);


-- ============================================================
-- STEP 8: ROW LEVEL SECURITY (RLS)
-- Database level pe multi-tenant isolation!
-- ============================================================
ALTER TABLE public.stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.breaks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;


-- ============================================================
-- STEP 9: RLS POLICIES
-- ============================================================

-- STORES — service_role full access, anon signup+login allowed
CREATE POLICY "stores_service_all" ON public.stores
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "stores_anon_insert" ON public.stores
  FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "stores_anon_select" ON public.stores
  FOR SELECT TO anon USING (true);

-- STORE_USERS
CREATE POLICY "store_users_service_all" ON public.store_users
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "store_users_anon_insert" ON public.store_users
  FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "store_users_anon_select" ON public.store_users
  FOR SELECT TO anon USING (true);

-- EMPLOYEES — sirf apne store ka data
CREATE POLICY "employees_service_all" ON public.employees
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "employees_anon_own_store" ON public.employees
  FOR ALL TO anon
  USING (store_id::text = current_setting('app.current_store_id', true))
  WITH CHECK (store_id::text = current_setting('app.current_store_id', true));

-- ATTENDANCE
CREATE POLICY "attendance_service_all" ON public.attendance
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "attendance_anon_own_store" ON public.attendance
  FOR ALL TO anon
  USING (store_id::text = current_setting('app.current_store_id', true))
  WITH CHECK (store_id::text = current_setting('app.current_store_id', true));

-- BREAKS
CREATE POLICY "breaks_service_all" ON public.breaks
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "breaks_anon_own_store" ON public.breaks
  FOR ALL TO anon
  USING (store_id::text = current_setting('app.current_store_id', true))
  WITH CHECK (store_id::text = current_setting('app.current_store_id', true));

-- PAYMENTS
CREATE POLICY "payments_service_all" ON public.payments
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "payments_anon_own_store" ON public.payments
  FOR ALL TO anon
  USING (store_id::text = current_setting('app.current_store_id', true))
  WITH CHECK (store_id::text = current_setting('app.current_store_id', true));


-- ============================================================
-- STEP 10: AUTO-UPDATE TRIGGERS (updated_at column)
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_stores_updated_at
  BEFORE UPDATE ON public.stores
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_store_users_updated_at
  BEFORE UPDATE ON public.store_users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_employees_updated_at
  BEFORE UPDATE ON public.employees
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_attendance_updated_at
  BEFORE UPDATE ON public.attendance
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();


-- ============================================================
-- STEP 11: VERIFY — Yeh run karo confirm karne ke liye
-- ============================================================
SELECT 
  tablename AS table_name,
  rowsecurity AS rls_enabled
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename IN ('stores','store_users','employees','attendance','breaks','payments')
ORDER BY tablename;

-- Expected output: 6 rows, sab mein rls_enabled = true
