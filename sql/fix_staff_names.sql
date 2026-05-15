-- ==============================================
-- スタッフ氏名の姓名分割対応（スペース区切りに統一）
-- ==============================================
-- 背景: DBの name カラムに「鈴木怜那」のようにスペースなしで入っており、
--       CSV出力時に苗字・名前カラムが正しく分割されない。
--       正解CSV（4月実績）の姓名に合わせてスペース区切りに修正する。
-- 実行場所: Supabase SQL Editor
-- ==============================================

UPDATE ringo_staff SET name = '鈴木 怜那'   WHERE employee_no = '01';
UPDATE ringo_staff SET name = '福島 真依子' WHERE employee_no = '06';
UPDATE ringo_staff SET name = '湯本 有美子' WHERE employee_no = '07';
UPDATE ringo_staff SET name = '服部 孝子'   WHERE employee_no = '08';
UPDATE ringo_staff SET name = '野口 由美子' WHERE employee_no = '15';
UPDATE ringo_staff SET name = '小野寺 美桜子' WHERE employee_no = '17';
UPDATE ringo_staff SET name = '笠原 若菜'   WHERE employee_no = '19';

-- 確認クエリ
SELECT employee_no, name FROM ringo_staff ORDER BY employee_no;
