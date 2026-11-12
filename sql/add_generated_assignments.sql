-- ============================================================
-- 生成直後スナップショット（リセット先・手動修正との差分の基準）
-- 実行対象: Supabase SQL Editor（本番DB）
-- 現行シフト ringo_shift_assignments は手直し後の最終形のまま。
-- このテーブルは「最後にシフト生成した時点」だけを持つ。
-- 再生成するとその月のスナップショットは上書きされる。
-- 既存テーブル・既存データは変更しない。未適用でも画面は動く（記録なしとして扱う）。
-- ============================================================

CREATE TABLE IF NOT EXISTS public.ringo_shift_generated_assignments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  year_month TEXT NOT NULL,
  staff_id UUID NOT NULL REFERENCES public.ringo_staff(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  attendance_type TEXT NOT NULL DEFAULT '平日',
  work_pattern TEXT DEFAULT '',
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(staff_id, date)
);

CREATE INDEX IF NOT EXISTS idx_ringo_shift_generated_assignments_yearmonth
  ON public.ringo_shift_generated_assignments(year_month);

-- 既存テーブルと同じく ringo@shift.com のみ読み書き可（sql/02_enable_rls.sql と同じ方針）
ALTER TABLE public.ringo_shift_generated_assignments ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'ringo_shift_generated_assignments'
      AND policyname = 'Allow access to Ringo user on ringo_shift_generated_assignments'
  ) THEN
    CREATE POLICY "Allow access to Ringo user on ringo_shift_generated_assignments"
      ON public.ringo_shift_generated_assignments
      FOR ALL TO authenticated
      USING ( auth.jwt() ->> 'email' = 'ringo@shift.com' )
      WITH CHECK ( auth.jwt() ->> 'email' = 'ringo@shift.com' );
  END IF;
END $$;

REVOKE ALL ON public.ringo_shift_generated_assignments FROM anon;
