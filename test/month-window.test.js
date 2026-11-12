import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getDefaultGenerateMonth,
  getMonthWindow,
  isMonthInWindow,
  clampToMonthWindow,
} from '../js/month-window.js';

// month はすべて 0-indexed（10 = 11月）

test('月窓の上限: 2027年12月までは常に受付する', () => {
  assert.deepEqual(getMonthWindow(new Date(2026, 10, 12)).max, { year: 2027, month: 11 }); // 2026/11/12 → 2027年12月
  assert.deepEqual(getMonthWindow(new Date(2027, 6, 31)).max, { year: 2027, month: 11 });  // 2027/7/31（自動は12月）
  assert.deepEqual(getMonthWindow(new Date(2027, 7, 15)).max, { year: 2027, month: 11 });  // 2027/8/15（自動も12月）
});

test('月窓の上限: 自動の上限（1〜15日は+4ヶ月、16日以降は+5ヶ月）が上回れば年をまたいで伸びる', () => {
  assert.deepEqual(getMonthWindow(new Date(2027, 7, 16)).max, { year: 2028, month: 0 }); // 2027/8/16 → 2028年1月
  assert.deepEqual(getMonthWindow(new Date(2027, 8, 1)).max, { year: 2028, month: 0 });  // 2027/9/1 → 2028年1月
  assert.deepEqual(getMonthWindow(new Date(2027, 11, 20)).max, { year: 2028, month: 4 }); // 2027/12/20 → 2028年5月
});

test('月窓の下限は運用開始の 2026年5月', () => {
  const now = new Date(2026, 10, 12);
  assert.equal(isMonthInWindow(2026, 3, now), false); // 4月
  assert.equal(isMonthInWindow(2026, 4, now), true);  // 5月
  assert.equal(isMonthInWindow(2027, 0, now), true);  // 2027年1月（旧実装では選べなかった）
  assert.equal(isMonthInWindow(2027, 11, now), true); // 2027年12月
  assert.equal(isMonthInWindow(2028, 0, now), false); // 上限超え
});

test('範囲外は窓の端にクランプする', () => {
  const now = new Date(2026, 10, 12);
  assert.deepEqual(clampToMonthWindow(2026, 0, now), { year: 2026, month: 4 });
  assert.deepEqual(clampToMonthWindow(2028, 0, now), { year: 2027, month: 11 });
});

test('シフト生成の初期表示は常に翌月（年跨ぎ含む）', () => {
  assert.deepEqual(getDefaultGenerateMonth(new Date(2026, 10, 12)), { year: 2026, month: 11 });
  assert.deepEqual(getDefaultGenerateMonth(new Date(2026, 10, 20)), { year: 2026, month: 11 });
  assert.deepEqual(getDefaultGenerateMonth(new Date(2026, 11, 16)), { year: 2027, month: 0 });
});
