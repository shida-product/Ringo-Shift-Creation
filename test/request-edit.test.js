import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createRequestSnapshot,
  enumerateDates,
  getRemovedRequestIds,
  getRequestChanges,
  findRequestInDates,
  hasUniformRequests,
  resolveEditingSource,
} from '../js/request-edit.js';

test('2日間の希望を1日に短縮すると、期間外になったレコードを削除対象にする', () => {
  const original = [
    { id: 'request-16', staff_id: 'staff-1', date: '2026-09-16' },
    { id: 'request-17', staff_id: 'staff-1', date: '2026-09-17' },
  ];

  assert.deepEqual(
    getRemovedRequestIds(original, 'staff-1', enumerateDates('2026-09-16', '2026-09-16')),
    ['request-17'],
  );
});

test('期間・希望区分・備考の変更内容を具体的に組み立てる', () => {
  const before = createRequestSnapshot(
    'staff-1',
    ['2026-09-16', '2026-09-17'],
    'off',
    null,
  );
  const after = createRequestSnapshot('staff-1', ['2026-09-16'], 'other', '午前のみ');

  assert.deepEqual(getRequestChanges(before, after), [
    '期間「9/16〜9/17」→「9/16」',
    '希望区分「休み希望」→「コメント」',
    '備考「なし」→「午前のみ」',
  ]);
});

test('同じ内容を保存した場合は変更なしと判定する', () => {
  const snapshot = createRequestSnapshot('staff-1', ['2026-09-16'], 'off', null);
  assert.deepEqual(getRequestChanges(snapshot, snapshot), []);
});

test('新規登録で既定スタッフ（先頭）の既存希望を変更前として扱わない', () => {
  const requests = [
    { id: 'req-murakami', staff_id: 'staff-murakami', date: '2026-09-20', request_type: 'off', note: null },
  ];

  const source = resolveEditingSource({
    mode: 'create',
    editingStaffId: 'staff-murakami',   // モーダルの既定値（一覧の先頭）
    editingRequest: null,
    editingDates: ['2026-09-20'],
    targetDates: ['2026-09-20'],
    selectedStaffId: 'staff-other',     // 実際に登録するスタッフ
    requests,
  });

  assert.equal(source.staffId, 'staff-other');
  assert.equal(source.request, null);
  assert.deepEqual(source.originalRequests, []);
  assert.deepEqual(
    getRemovedRequestIds(source.removableRequests, 'staff-other', enumerateDates('2026-09-20', '2026-09-20')),
    [],
  );
});

test('新規登録でも同じスタッフの既存希望は変更前として扱う', () => {
  const existing = { id: 'req-1', staff_id: 'staff-1', date: '2026-09-20', request_type: 'off', note: null };

  const source = resolveEditingSource({
    mode: 'create',
    editingStaffId: 'staff-1',
    editingRequest: null,
    editingDates: ['2026-09-20'],
    targetDates: ['2026-09-20'],
    selectedStaffId: 'staff-1',
    requests: [existing],
  });

  assert.equal(source.request, existing);
  assert.deepEqual(source.originalRequests, [existing]);
});

test('編集モードでスタッフを変更した場合は元スタッフのレコードを削除対象にする', () => {
  const existing = { id: 'req-1', staff_id: 'staff-1', date: '2026-09-20', request_type: 'off', note: null };

  const source = resolveEditingSource({
    mode: 'edit',
    editingStaffId: 'staff-1',
    editingRequest: existing,
    editingDates: ['2026-09-20'],
    targetDates: ['2026-09-20'],
    selectedStaffId: 'staff-2',
    requests: [existing],
  });

  assert.equal(source.staffId, 'staff-1');
  assert.deepEqual(
    getRemovedRequestIds(source.removableRequests, 'staff-2', ['2026-09-20']),
    ['req-1'],
  );
});

test('選択範囲の先頭日が空でも、範囲内の既存希望を編集対象として見つける', () => {
  const requests = [
    { id: 'req-3', staff_id: 'staff-1', date: '2026-09-03', request_type: 'off', note: null },
    { id: 'req-2', staff_id: 'staff-1', date: '2026-09-02', request_type: 'off', note: null },
    { id: 'req-other', staff_id: 'staff-2', date: '2026-09-01', request_type: 'off', note: null },
  ];

  const found = findRequestInDates(requests, 'staff-1', enumerateDates('2026-09-01', '2026-09-03'));
  assert.equal(found.id, 'req-2');   // 範囲内で最も早い日
  assert.equal(findRequestInDates(requests, 'staff-1', ['2026-09-10']), null);
});

test('変更前の期間は、実際に希望が入っている日付だけで組み立てる', () => {
  const existing = { id: 'req-3', staff_id: 'staff-1', date: '2026-09-03', request_type: 'off', note: null };

  const source = resolveEditingSource({
    mode: 'edit',
    editingStaffId: 'staff-1',
    editingRequest: existing,
    editingDates: enumerateDates('2026-09-01', '2026-09-03'),  // ドラッグ範囲は3日分
    targetDates: enumerateDates('2026-09-01', '2026-09-03'),
    selectedStaffId: 'staff-1',
    requests: [existing],
  });

  const before = createRequestSnapshot(
    source.staffId,
    source.originalRequests.map(r => r.date),
    source.request.request_type,
    source.request.note,
  );
  assert.deepEqual(before.dates, ['2026-09-03']);
});

test('新規登録で日付を変更しても、開いた日に入っている同一スタッフの希望を削除しない', () => {
  const existing = { id: 'req-20', staff_id: 'staff-b', date: '2026-09-20', request_type: 'off', note: null };

  // 9/20 の「新規登録」を既定スタッフAで開き、スタッフBを選んで日付を 9/21 に変更したケース
  const source = resolveEditingSource({
    mode: 'create',
    editingStaffId: 'staff-a',
    editingRequest: null,
    editingDates: ['2026-09-20'],
    targetDates: ['2026-09-21'],
    selectedStaffId: 'staff-b',
    requests: [existing],
  });

  assert.equal(source.request, null);
  assert.deepEqual(source.removableRequests, []);
  assert.deepEqual(getRemovedRequestIds(source.removableRequests, 'staff-b', ['2026-09-21']), []);
});

test('区分が混在した期間の上書きは「変更なし」と判定しない', () => {
  const requests = [
    { id: 'req-1', staff_id: 'staff-1', date: '2026-09-01', request_type: 'off', note: null },
    { id: 'req-2', staff_id: 'staff-1', date: '2026-09-02', request_type: 'other', note: null },
  ];

  // 9/1〜9/2 をまとめて「休み希望」で保存するケース。
  // 変更前スナップショットは先頭(9/1, off)を代表とするため、区分の差分は検出されない
  const source = resolveEditingSource({
    mode: 'create',
    editingStaffId: 'staff-1',
    editingRequest: null,
    editingDates: ['2026-09-01'],
    targetDates: enumerateDates('2026-09-01', '2026-09-02'),
    selectedStaffId: 'staff-1',
    requests,
  });
  const before = createRequestSnapshot(
    source.staffId,
    source.originalRequests.map(r => r.date),
    source.request.request_type,
    source.request.note,
  );
  const after = createRequestSnapshot('staff-1', enumerateDates('2026-09-01', '2026-09-02'), 'off', '');
  assert.deepEqual(getRequestChanges(before, after), []);   // 差分は出ない

  // それでも 9/2 は 'other' のままなので、保存をスキップしてはいけない
  assert.equal(hasUniformRequests(source.originalRequests, 'off', ''), false);
  assert.equal(hasUniformRequests([requests[0]], 'off', ''), true);
  assert.equal(hasUniformRequests([requests[0]], 'off', 'メモ'), false);
});
