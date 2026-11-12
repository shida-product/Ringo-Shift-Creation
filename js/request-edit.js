/**
 * 希望休モーダルの保存・削除の判定ロジック（オオギシフト js/request-edit.js から移植）
 * DOM・Supabase に依存しない純粋関数だけを置き、test/request-edit.test.js で検証する。
 */

export const REQUEST_TYPE_LABELS = {
  off: '休み希望',
  other: 'コメント',
};

export function enumerateDates(startStr, endStr) {
  const dates = [];
  const current = new Date(`${startStr}T00:00:00`);
  const end = new Date(`${endStr}T00:00:00`);

  while (current <= end) {
    dates.push(formatDate(current));
    current.setDate(current.getDate() + 1);
  }
  return dates;
}

export function createRequestSnapshot(staffId, dates, requestType, note) {
  return {
    staff_id: staffId,
    dates: [...dates],
    request_type: requestType,
    note: note || null,
  };
}

export function getRequestChanges(before, after, getStaffName = id => id) {
  const changes = [];

  if (before.staff_id !== after.staff_id) {
    changes.push(`スタッフ「${getStaffName(before.staff_id)}」→「${getStaffName(after.staff_id)}」`);
  }
  if (before.dates.join(',') !== after.dates.join(',')) {
    changes.push(`期間「${formatPeriod(before.dates)}」→「${formatPeriod(after.dates)}」`);
  }
  if (before.request_type !== after.request_type) {
    changes.push(`希望区分「${REQUEST_TYPE_LABELS[before.request_type] || before.request_type}」→「${REQUEST_TYPE_LABELS[after.request_type] || after.request_type}」`);
  }
  if ((before.note || '') !== (after.note || '')) {
    changes.push(`備考「${before.note || 'なし'}」→「${after.note || 'なし'}」`);
  }

  return changes;
}

export function getRemovedRequestIds(originalRequests, targetStaffId, targetDates) {
  const targetDateSet = new Set(targetDates);
  return originalRequests
    .filter(request => request.staff_id !== targetStaffId || !targetDateSet.has(request.date))
    .map(request => request.id);
}

export function formatPeriod(dates) {
  if (!dates.length) return '';
  const first = formatShortDate(dates[0]);
  const last = formatShortDate(dates[dates.length - 1]);
  return first === last ? first : `${first}〜${last}`;
}

function formatShortDate(dateStr) {
  const [, month, day] = dateStr.split('-');
  return `${Number(month)}/${Number(day)}`;
}

function formatDate(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

// 指定スタッフ・指定日付群のうち、最も早い日の既存希望を返す。
export function findRequestInDates(requests, staffId, dates) {
  const dateSet = new Set(dates);
  return requests
    .filter(r => r.staff_id === staffId && dateSet.has(r.date))
    .sort((a, b) => a.date.localeCompare(b.date))[0] || null;
}

// 対象レコードがすべて同じ区分・備考かどうか。
// 「変更前」スナップショットは代表1件の区分・備考しか持たないため、
// 区分が混在した期間をまとめて上書きするときに「変更なし」と誤判定しないよう、
// 保存をスキップしてよいかの判定に使う。
export function hasUniformRequests(requests, requestType, note) {
  return (requests || []).every(r => r.request_type === requestType && (r.note || '') === (note || ''));
}

// 保存時に「変更前」として扱うレコードを解決する。
// mode='edit'（既存の希望をタップして開いた）のときだけ、開いた時点のスタッフ・対象日を
// 変更前として扱う（＝スタッフ変更や期間短縮は付け替えとみなし、元レコードを削除する）。
// mode='create'（新規登録）のときは、モーダルの初期値はあくまで既定値なので、
//   - スタッフは保存時に選択されているスタッフ
//   - 日付はこれから保存する日（開いた日ではない）
// だけを見る。これをしないと、
//   - 既定スタッフ（一覧の先頭）の希望休が別スタッフの新規登録で削除される
//   - 新規登録中に日付を変えると、開いた日に入っていた希望が削除される
// といった誤削除が起きる。
export function resolveEditingSource({
  mode,
  editingStaffId,
  editingRequest,
  editingDates = [],
  targetDates = [],
  selectedStaffId,
  requests = [],
}) {
  const isEdit = mode === 'edit' && !!editingRequest;
  const staffId = isEdit ? editingStaffId : selectedStaffId;
  const scopeDates = new Set(isEdit ? editingDates : targetDates);
  const scoped = requests
    .filter(r => r.staff_id === staffId && scopeDates.has(r.date))
    .sort((a, b) => a.date.localeCompare(b.date));
  const request = isEdit ? editingRequest : (scoped[0] || null);

  return {
    staffId,
    request,
    originalRequests: request ? scoped : [],
    // 新規登録では既存レコードを削除しない（保存対象日のものは UPDATE で上書きされる）
    removableRequests: isEdit && request ? scoped : [],
  };
}
