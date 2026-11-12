import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getDefaultGenerateMonth,
  getMonthWindow,
  isMonthInWindow,
  clampToMonthWindow,
} from '../js/month-window.js';

// month はすべて 0-indexed（10 = 11月）

test('月窓の上限: 1〜15日は+4ヶ月、16日以降は+5ヶ月（年をまたいでも伸びる）', () => {
  assert.deepEqual(getMonthWindow(new Date(2026, 10, 12)).max, { year: 2027, month: 2 }); // 11/12 → 2027年3月
  assert.deepEqual(getMonthWindow(new Date(2026, 10, 15)).max, { year: 2027, month: 2 });
  assert.deepEqual(getMonthWindow(new Date(2026, 10, 16)).max, { year: 2027, month: 3 }); // 11/16 → 2027年4月
});

test('月窓の下限は運用開始の 2026年5月', () => {
  const now = new Date(2026, 10, 12);
  assert.equal(isMonthInWindow(2026, 3, now), false); // 4月
  assert.equal(isMonthInWindow(2026, 4, now), true);  // 5月
  assert.equal(isMonthInWindow(2027, 0, now), true);  // 2027年1月（旧実装では選べなかった）
  assert.equal(isMonthInWindow(2027, 3, now), false); // 上限超え
});

test('範囲外は窓の端にクランプする', () => {
  const now = new Date(2026, 10, 12);
  assert.deepEqual(clampToMonthWindow(2026, 0, now), { year: 2026, month: 4 });
  assert.deepEqual(clampToMonthWindow(2028, 0, now), { year: 2027, month: 2 });
});

test('シフト生成の初期表示は常に翌月（年跨ぎ含む）', () => {
  assert.deepEqual(getDefaultGenerateMonth(new Date(2026, 10, 12)), { year: 2026, month: 11 });
  assert.deepEqual(getDefaultGenerateMonth(new Date(2026, 10, 20)), { year: 2026, month: 11 });
  assert.deepEqual(getDefaultGenerateMonth(new Date(2026, 11, 16)), { year: 2027, month: 0 });
});
