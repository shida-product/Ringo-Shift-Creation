-- ==========================================
-- セキュリティ強化：RLS（Row Level Security）の有効化
-- ==========================================

-- 1. 各テーブルのRLSを有効化
ALTER TABLE ringo_staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE ringo_shift_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE ringo_shift_assignments ENABLE ROW LEVEL SECURITY;

-- 2. 認証済みユーザー（authenticated）のみフルアクセスを許可するポリシーを作成

-- ringo_staff テーブルへのポリシー
CREATE POLICY "Allow full access to authenticated users on ringo_staff"
ON ringo_staff
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- ringo_shift_requests テーブルへのポリシー
CREATE POLICY "Allow full access to authenticated users on ringo_shift_requests"
ON ringo_shift_requests
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- ringo_shift_assignments テーブルへのポリシー
CREATE POLICY "Allow full access to authenticated users on ringo_shift_assignments"
ON ringo_shift_assignments
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);
