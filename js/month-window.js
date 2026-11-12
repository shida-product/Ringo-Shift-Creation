/**
 * 希望休・シフト生成の月窓（オオギシフト js/month-window.js と同じ開放ルール）
 * - 閲覧下限: 2026-05（運用開始）
 * - 閲覧上限: 次のうち遅い方
 *   - 2027-12（MONTH_OPEN_UNTIL。りんご固有の運用判断）
 *   - 毎月16日を境に約半年先まで自動で開放（年をまたいでも伸びる）
 *     - 1〜15日: 今日の年月 + 4ヶ月（例: 2027/9/1〜9/15 → 2028年1月まで）
 *     - 16日以降: 今日の年月 + 5ヶ月（例: 2027/9/16〜9/30 → 2028年2月まで）
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

// りんご固有: 少なくともこの月までは受付する（2026-11 運用判断）。
// 固定の上限にすると年明けに再び「翌年が選べない」問題になるため、
// 自動で伸びる上限と比べて遅い方を採用する（2027/8/16 以降は自動の上限が上回る）
export const MONTH_OPEN_UNTIL = { year: 2027, month: 11 }; // 0-indexed = 12月

export function getMonthWindow(now = new Date()) {
  const offset = now.getDate() <= 15 ? 4 : 5;
  const rolling = addMonths(now.getFullYear(), now.getMonth(), offset);
  const max = compareYearMonth(rolling, MONTH_OPEN_UNTIL) >= 0 ? rolling : { ...MONTH_OPEN_UNTIL };
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
