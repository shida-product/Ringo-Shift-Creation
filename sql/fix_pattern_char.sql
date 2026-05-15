-- ==============================================
-- 勤務パターン文字の修正: 〇（U+3007）→ ◯（U+25EF）
-- ==============================================
-- 背景: generate.js が〇（漢数字の零, U+3007）でパターン名を定義していたが、
--       正解CSV（4月実績）では◯（大きな白丸, U+25EF）が使われていた。
--       コードを◯に統一したため、DBの既存データも合わせて修正する。
-- 実行場所: Supabase SQL Editor
-- ==============================================

-- ringo_shift_assignments テーブルの work_pattern を更新
UPDATE ringo_shift_assignments
SET work_pattern = REPLACE(work_pattern, '〇', '◯')
WHERE work_pattern LIKE '%〇%';

-- 確認クエリ（更新後の確認用）
SELECT DISTINCT work_pattern
FROM ringo_shift_assignments
ORDER BY work_pattern;
