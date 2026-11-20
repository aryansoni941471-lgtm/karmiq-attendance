-- ============================================================
-- KARMIQ — Supabase RLS Full Update (Run this in SQL Editor)
-- Allows full CRUD access for anon role on all tables
-- ============================================================

-- 1. STORES: Allow anon full access (select, insert, update)
DROP POLICY IF EXISTS "stores_anon_select" ON public.stores;
DROP POLICY IF EXISTS "stores_anon_insert" ON public.stores;
DROP POLICY IF EXISTS "stores_anon_all" ON public.stores;
CREATE POLICY "stores_anon_all" ON public.stores
  FOR ALL TO anon USING (true) WITH CHECK (true);

-- 2. STORE_USERS: Allow anon full access (select, insert, update)
DROP POLICY IF EXISTS "store_users_anon_select" ON public.store_users;
DROP POLICY IF EXISTS "store_users_anon_insert" ON public.store_users;
DROP POLICY IF EXISTS "store_users_anon_all" ON public.store_users;
CREATE POLICY "store_users_anon_all" ON public.store_users
  FOR ALL TO anon USING (true) WITH CHECK (true);

-- 3. EMPLOYEES: Drop old policy, allow anon full access
DROP POLICY IF EXISTS "employees_anon_own_store" ON public.employees;
DROP POLICY IF EXISTS "employees_anon_all" ON public.employees;
CREATE POLICY "employees_anon_all" ON public.employees
  FOR ALL TO anon USING (true) WITH CHECK (true);

-- 4. ATTENDANCE: Drop old policy, allow anon full access  
DROP POLICY IF EXISTS "attendance_anon_own_store" ON public.attendance;
DROP POLICY IF EXISTS "attendance_anon_all" ON public.attendance;
CREATE POLICY "attendance_anon_all" ON public.attendance
  FOR ALL TO anon USING (true) WITH CHECK (true);

-- 5. BREAKS: Drop old policy, allow anon full access
DROP POLICY IF EXISTS "breaks_anon_own_store" ON public.breaks;
DROP POLICY IF EXISTS "breaks_anon_all" ON public.breaks;
CREATE POLICY "breaks_anon_all" ON public.breaks
  FOR ALL TO anon USING (true) WITH CHECK (true);

-- 6. PAYMENTS: Drop old policy, allow anon full access
DROP POLICY IF EXISTS "payments_anon_own_store" ON public.payments;
DROP POLICY IF EXISTS "payments_anon_all" ON public.payments;
CREATE POLICY "payments_anon_all" ON public.payments
  FOR ALL TO anon USING (true) WITH CHECK (true);

-- VERIFY: Check all policies
SELECT tablename, policyname, roles, cmd
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
