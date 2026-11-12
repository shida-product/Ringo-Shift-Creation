/**
 * 生成直後スナップショット・手動修正差分・前月からの連勤キャリー（オオギシフトから移植）
 * DOM・Supabase に依存しない純粋関数だけを置き、test/shift-snapshot.test.js で検証する。
 */

/** "YYYY-MM" の前月を "YYYY-MM" で返す */
export function getPrevYearMonth(yearMonth) {
  const [year, month] = yearMonth.split('-').map(Number);
  let py = year, pm = month - 1;
  if (pm < 1) { pm = 12; py--; }
  return `${py}-${String(pm).padStart(2, '0')}`;
}

function formatDate(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

/** 勤務あり（work_pattern が空でない）か */
export function isWorkAssignment(a) {
  return !!(a && a.work_pattern && a.work_pattern !== '');
}

// ------------------------------------------------------------
// 内容比較（表示・共有の正は DB。id や作成日時は比較しない）
// ------------------------------------------------------------
export function fingerprintAssignments(assignments) {
  return (assignments || [])
    .map(a => `${a.staff_id}|${a.date}|${a.attendance_type || ''}|${a.work_pattern || ''}|${a.is_manual_override ? 1 : 0}`)
    .sort()
    .join('\n');
}

export function assignmentsContentEqual(a, b) {
  return fingerprintAssignments(a) === fingerprintAssignments(b);
}

export function fingerprintRequests(requests) {
  return (requests || [])
    .map(r => `${r.staff_id}|${r.date}|${r.request_type}|${r.note || ''}`)
    .sort()
    .join('\n');
}

export function requestsContentEqual(a, b) {
  return fingerprintRequests(a) === fingerprintRequests(b);
}

/** リモートの生成スナップショットがローカルより新しいか */
export function isGeneratedSnapshotNewer(remoteGen, localGen) {
  const remoteAt = remoteGen?.[0]?.generated_at || '';
  const localAt = localGen?.[0]?.generated_at || '';
  if (!remoteAt) return false;
  if (!localAt) return true;
  return remoteAt > localAt;
}

// ------------------------------------------------------------
// 生成直後との差分
// ------------------------------------------------------------
export function formatAssignmentCell(a) {
  if (!a) return '（なし）';
  const pattern = a.work_pattern || '';
  if (pattern) return pattern;
  return a.attendance_type || '平日';
}

export function assignmentCellsEqual(a, b) {
  if (!a && !b) return true;
  if (!a || !b) return false;
  return (a.attendance_type || '平日') === (b.attendance_type || '平日')
    && (a.work_pattern || '') === (b.work_pattern || '');
}

/**
 * 生成直後（generated）から現在（current）で変わったマスを列挙する。
 * staffList の display_order 順 → 日付順に並べる。
 */
export function collectGeneratedDiffs(generated, current, staffList) {
  if (!generated || generated.length === 0) return [];
  const staffById = new Map((staffList || []).map(s => [s.id, s]));
  const currentByKey = new Map();
  for (const cur of current || []) currentByKey.set(`${cur.staff_id}|${cur.date}`, cur);

  const diffs = [];
  for (const gen of generated) {
    const cur = currentByKey.get(`${gen.staff_id}|${gen.date}`);
    if (assignmentCellsEqual(cur, gen)) continue;
    const staff = staffById.get(gen.staff_id);
    diffs.push({
      staff_id: gen.staff_id,
      staff_name: staff?.name || '',
      display_order: staff?.display_order ?? Number.MAX_SAFE_INTEGER,
      date: gen.date,
      from_label: formatAssignmentCell(gen),
      to_label: formatAssignmentCell(cur),
      from_attendance: gen.attendance_type || '平日',
      from_pattern: gen.work_pattern || '',
      to_attendance: cur?.attendance_type || '平日',
      to_pattern: cur?.work_pattern || '',
    });
  }
  diffs.sort((a, b) => (a.display_order - b.display_order) || a.date.localeCompare(b.date));
  return diffs;
}

/** 差分CSV（UTF-8 BOM 付き・Excel で開ける形）の本文を組み立てる */
export function buildDiffCsv(diffs, yearMonth) {
  const header = ['年月', 'スタッフ', '日付', '生成_勤怠', '生成_パターン', 'いま_勤怠', 'いま_パターン'];
  const lines = [header.join(',')];
  for (const d of diffs) {
    const cells = [yearMonth, d.staff_name, d.date, d.from_attendance, d.from_pattern, d.to_attendance, d.to_pattern];
    lines.push(cells.map(c => `"${String(c).replace(/"/g, '""')}"`).join(','));
  }
  return '﻿' + lines.join('\n');
}

// ------------------------------------------------------------
// 前月からの連勤キャリー（月跨ぎ連勤対策）
// ------------------------------------------------------------
/**
 * 前月末日から遡って連続している勤務日数を返す。前月末日が休みなら 0。
 * りんごには調剤希望が無いため、実働（work_pattern あり）だけで数える。
 */
export function computePrevCarryover(prevAssignments, staffId, yearMonth) {
  const prevYM = getPrevYearMonth(yearMonth);
  const [py, pm] = prevYM.split('-').map(Number);
  const prevDays = new Date(py, pm, 0).getDate();
  const prevLastDate = `${prevYM}-${String(prevDays).padStart(2, '0')}`;

  const workSet = new Set();
  (prevAssignments || []).forEach(a => {
    if (a.staff_id === staffId && isWorkAssignment(a)) workSet.add(a.date);
  });

  let streakWork = 0;
  const d = new Date(prevLastDate + 'T00:00:00');
  while (workSet.has(formatDate(d))) {
    streakWork++;
    d.setDate(d.getDate() - 1);
  }
  return { streakWork, prevLastDate };
}

/**
 * 当月の最大連勤を、前月末からの連勤（carry）を引き継いで数える。
 * carriedIntoMax: 最大連勤区間が前月繰り越しを含むか（注記の要否判定に使う）
 */
export function maxConsecutiveWithCarry(staffAssignments, carry = 0) {
  const sorted = [...(staffAssignments || [])].sort((a, b) => a.date.localeCompare(b.date));
  let max = 0, count = carry;
  let runHasCarry = carry > 0;
  let carriedIntoMax = false;
  for (const a of sorted) {
    if (isWorkAssignment(a)) {
      count++;
      if (count > max) { max = count; carriedIntoMax = runHasCarry; }
    } else {
      count = 0;
      runHasCarry = false;
    }
  }
  return { max, carry, carriedIntoMax };
}

/** 連勤チェック項目の表示テキスト。最大連勤区間が前月末からの連勤を含む場合だけ注記する */
export function consecValueText(detail) {
  return detail.carriedIntoMax && detail.carry > 0
    ? `${detail.max}日（前月末から+${detail.carry}）`
    : `${detail.max}日`;
}
