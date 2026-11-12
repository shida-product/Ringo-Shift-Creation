import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getPrevYearMonth,
  assignmentsContentEqual,
  requestsContentEqual,
  isGeneratedSnapshotNewer,
  collectGeneratedDiffs,
  buildDiffCsv,
  computePrevCarryover,
  maxConsecutiveWithCarry,
  consecValueText,
} from '../js/shift-snapshot.js';

const work = (staff_id, date, work_pattern = '◯終日') => ({ staff_id, date, attendance_type: '平日', work_pattern });
const off = (staff_id, date) => ({ staff_id, date, attendance_type: '所定休日', work_pattern: '' });

test('前月の年月（年跨ぎ含む）', () => {
  assert.equal(getPrevYearMonth('2026-12'), '2026-11');
  assert.equal(getPrevYearMonth('2027-01'), '2026-12');
});

test('内容比較は id や並び順を無視し、勤怠・パターン・手動フラグを見る', () => {
  const a = [{ id: 1, ...work('s1', '2026-12-01') }, off('s1', '2026-12-02')];
  const b = [off('s1', '2026-12-02'), { id: 99, ...work('s1', '2026-12-01') }];
  assert.equal(assignmentsContentEqual(a, b), true);
  assert.equal(assignmentsContentEqual(a, [work('s1', '2026-12-01'), work('s1', '2026-12-02')]), false);
  assert.equal(assignmentsContentEqual([work('s1', '2026-12-01')], [{ ...work('s1', '2026-12-01'), is_manual_override: true }]), false);
});

test('希望休の内容比較は区分・備考を見る', () => {
  const r = { staff_id: 's1', date: '2026-12-01', request_type: 'off', note: null };
  assert.equal(requestsContentEqual([r], [{ ...r, id: 'x' }]), true);
  assert.equal(requestsContentEqual([r], [{ ...r, note: '午前のみ' }]), false);
});

test('生成スナップショットの新旧比較', () => {
  const older = [{ generated_at: '2026-11-10T00:00:00Z' }];
  const newer = [{ generated_at: '2026-11-12T00:00:00Z' }];
  assert.equal(isGeneratedSnapshotNewer(newer, older), true);
  assert.equal(isGeneratedSnapshotNewer(older, newer), false);
  assert.equal(isGeneratedSnapshotNewer(newer, []), true);
  assert.equal(isGeneratedSnapshotNewer([], newer), false);
});

test('生成直後から手で変えたマスだけを、表示順→日付順で列挙する', () => {
  const staffList = [{ id: 's2', name: '服部 孝子', display_order: 4 }, { id: 's1', name: '鈴木 怜那', display_order: 1 }];
  const generated = [work('s1', '2026-12-02'), work('s1', '2026-12-01'), off('s2', '2026-12-01')];
  const current = [off('s1', '2026-12-02'), work('s1', '2026-12-01'), work('s2', '2026-12-01', '◯午前')];
  const diffs = collectGeneratedDiffs(generated, current, staffList);
  assert.deepEqual(diffs.map(d => [d.staff_name, d.date, d.from_label, d.to_label]), [
    ['鈴木 怜那', '2026-12-02', '◯終日', '所定休日'],
    ['服部 孝子', '2026-12-01', '所定休日', '◯午前'],
  ]);
  assert.deepEqual(collectGeneratedDiffs([], current, staffList), []);
});

test('差分CSVは BOM 付きでダブルクォートをエスケープする', () => {
  const csv = buildDiffCsv([{
    staff_name: '鈴木 "怜那"', date: '2026-12-01',
    from_attendance: '平日', from_pattern: '◯終日', to_attendance: '所定休日', to_pattern: '',
  }], '2026-12');
  assert.ok(csv.startsWith('﻿年月,スタッフ'));
  assert.ok(csv.includes('"鈴木 ""怜那"""'));
});

test('前月末から続く連勤を数える（前月末日が休みなら0）', () => {
  const prev = [
    off('s1', '2026-11-26'), work('s1', '2026-11-27'), work('s1', '2026-11-28'),
    work('s1', '2026-11-29'), work('s1', '2026-11-30'),
    work('s2', '2026-11-29'), off('s2', '2026-11-30'),
  ];
  assert.deepEqual(computePrevCarryover(prev, 's1', '2026-12'), { streakWork: 4, prevLastDate: '2026-11-30' });
  assert.equal(computePrevCarryover(prev, 's2', '2026-12').streakWork, 0);
  assert.equal(computePrevCarryover([], 's1', '2026-12').streakWork, 0);
  // 年跨ぎ
  assert.equal(computePrevCarryover([work('s1', '2026-12-31')], 's1', '2027-01').streakWork, 1);
});

test('最大連勤は前月末からの連勤を引き継ぎ、注記の要否も返す', () => {
  const cur = [work('s1', '2026-12-01'), work('s1', '2026-12-02'), off('s1', '2026-12-03'), work('s1', '2026-12-04')];
  const withCarry = maxConsecutiveWithCarry(cur, 4);
  assert.deepEqual(withCarry, { max: 6, carry: 4, carriedIntoMax: true });
  assert.equal(consecValueText(withCarry), '6日（前月末から+4）');

  const noCarry = maxConsecutiveWithCarry(cur, 0);
  assert.deepEqual(noCarry, { max: 2, carry: 0, carriedIntoMax: false });
  assert.equal(consecValueText(noCarry), '2日');

  // 月初が休みなら繰り越しは途切れる（前月だけで完結した連勤は当月の最大連勤に数えない）
  const startsOff = maxConsecutiveWithCarry([off('s1', '2026-12-01'), work('s1', '2026-12-02')], 4);
  assert.deepEqual(startsOff, { max: 1, carry: 4, carriedIntoMax: false });
  assert.equal(consecValueText(startsOff), '1日');
});
