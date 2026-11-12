/**
 * 希望休・シフト生成の月窓（オオギシフト js/month-window.js と同じ開放ルール）
 * - 閲覧下限: 2026-05（運用開始）
 * - 閲覧上限: 毎月16日を境に約半年先まで開放（年をまたいでも自動で伸びる）
 *   - 1〜15日: 今日の年月 + 4ヶ月（例: 11/1〜11/15 → 翌3月まで）
 *   - 16日以降: 今日の年月 + 5ヶ月（例: 11/16〜11/30 → 翌4月まで）
 * - month はすべて 0-indexed（Date#getMonth と同じ）
 */

export const MONTH_ARCHIVE_START = { year: 2026, month: 4 }; // 0-indexed = 5月

export function addMonths(year, month, delta) {
  const d = new Date(year, month + delta, 1);
  return { year: d.getFullYear(), month: d.getMonth() };
}

export function compareYearMonth(a, b) {
  if (a.year !== b.year) return a.year - b.year;
  return a.month - b.month;
}

export function getMonthWindow(now = new Date()) {
  const offset = now.getDate() <= 15 ? 4 : 5;
  const max = addMonths(now.getFullYear(), now.getMonth(), offset);
  return { min: { ...MONTH_ARCHIVE_START }, max };
}

export function isMonthInWindow(year, month, now = new Date()) {
  const { min, max } = getMonthWindow(now);
  const cur = { year, month };
  return compareYearMonth(cur, min) >= 0 && compareYearMonth(cur, max) <= 0;
}

export function clampToMonthWindow(year, month, now = new Date()) {
  const { min, max } = getMonthWindow(now);
  const cur = { year, month };
  if (compareYearMonth(cur, min) < 0) return { ...min };
  if (compareYearMonth(cur, max) > 0) return { ...max };
  return cur;
}

/** シフト生成の対象月（初期表示）。常に翌月 */
export function getDefaultGenerateMonth(now = new Date()) {
  const target = addMonths(now.getFullYear(), now.getMonth(), 1);
  return clampToMonthWindow(target.year, target.month, now);
}

/** カレンダー上の「今月」（窓内にクランプ） */
export function getCalendarMonthClamped(now = new Date()) {
  return clampToMonthWindow(now.getFullYear(), now.getMonth(), now);
}
