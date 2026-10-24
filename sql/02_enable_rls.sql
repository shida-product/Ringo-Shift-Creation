-- ==========================================
-- セキュリティ強化：RLS（Row Level Security）の有効化（現行定義の正本）
-- ==========================================
-- 本番（shida.product）の現状（2026-10-24 にユーザーが適用・確認）:
-- - 各テーブルに残るポリシーは下記 "Allow access to Ringo user on <table>"（ringo@shift.com のみ）だけ
-- - public 全許可（sql/enable_rls.sql の旧定義）と authenticated 全許可のポリシーは削除済み
-- - anon の権限は revoke 済み（未ログインは permission denied）
-- - 新規サインアップは Supabase 側で無効

-- 1. 各テーブルのRLSを有効化
ALTER TABLE ringo_staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE ringo_shift_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE ringo_shift_assignments ENABLE ROW LEVEL SECURITY;

-- 2. 認証済みユーザー（authenticated）のみフルアクセスを許可するポリシーを作成

-- ringo_staff テーブルへのポリシー
CREATE POLICY "Allow access to Ringo user on ringo_staff"
ON ringo_staff
FOR ALL
TO authenticated
USING ( auth.jwt() ->> 'email' = 'ringo@shift.com' )
WITH CHECK ( auth.jwt() ->> 'email' = 'ringo@shift.com' );

-- ringo_shift_requests テーブルへのポリシー
CREATE POLICY "Allow access to Ringo user on ringo_shift_requests"
ON ringo_shift_requests
FOR ALL
TO authenticated
USING ( auth.jwt() ->> 'email' = 'ringo@shift.com' )
WITH CHECK ( auth.jwt() ->> 'email' = 'ringo@shift.com' );

-- ringo_shift_assignments テーブルへのポリシー
CREATE POLICY "Allow access to Ringo user on ringo_shift_assignments"
ON ringo_shift_assignments
FOR ALL
TO authenticated
USING ( auth.jwt() ->> 'email' = 'ringo@shift.com' )
WITH CHECK ( auth.jwt() ->> 'email' = 'ringo@shift.com' );

-- 3. anon（未ログイン）の権限を取り消す
REVOKE ALL ON ringo_staff FROM anon;
REVOKE ALL ON ringo_shift_requests FROM anon;
REVOKE ALL ON ringo_shift_assignments FROM anon;
