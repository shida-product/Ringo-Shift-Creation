/**
 * シフト生成 メインロジック
 * - シフト自動生成アルゴリズム（ルールベース貪欲法）
 * - ガントチャート描画
 * - セルクリック→ドロップダウン手動編集
 * - CSV出力（Shift-JIS）
 */

import { supabase } from './supabase-config.js';

// ============================================================
// 定数
// ============================================================

// 曜日ラベル（共通）
const DAY_NAMES = ['日', '月', '火', '水', '木', '金', '土'];

// リクエスト種別 → 表示ラベル
const REQUEST_TYPE_LABEL = {
  off: '休み希望',
  other: 'コメント等',
  virtual: '固定休',
};

// リクエスト種別 → ストライプCSSクラス
const REQUEST_TYPE_CSS = {
  off: 'bg-stripe-off',
  other: 'bg-stripe-other',
  virtual: 'bg-stripe-virtual',
};

// リクエスト種別 → 絵文字アイコン
const REQUEST_TYPE_ICON = { off: '🔴', other: '🟡', virtual: '⚪' };

// CSV出力時に「平日」として扱うリクエスト種別（それ以外は「所定休日」）
const CSV_WEEKDAY_REQUEST_TYPES = [];

const PATTERNS = {
  AM: '〇午前',               // 09:00-13:00
  AM_CLEAN: '〇午前（掃除）', // 08:50-13:00
  SUN: '〇日曜',             // 09:00-12:30
  SUN_CLEAN: '〇日曜（掃除）',// 08:50-12:30
  FULL: '〇終日',             // 09:00-18:30
  FULL_CLEAN: '終日（掃除）', // 08:50-18:30
  PM_YUMOTO: '湯本午後'       // 14:45-18:15
};

const PATTERN_CSS = {
  '〇午前': 'pattern-marker--am',
  '〇午前（掃除）': 'pattern-marker--am-clean',
  '〇日曜': 'pattern-marker--sun',
  '〇日曜（掃除）': 'pattern-marker--sun-clean',
  '〇終日': 'pattern-marker--full',
  '終日（掃除）': 'pattern-marker--full-clean',
  '湯本午後': 'pattern-marker--pm-yumoto',
  'りんご': 'pattern-marker--ringo', // 既存の特殊パターン
  '出張': 'pattern-marker--other',
  '応援': 'pattern-marker--other',
};

const PATTERN_DOT_CLASS = {
  '〇午前': 'legend__dot--am',
  '〇午前（掃除）': 'legend__dot--am',
  '〇日曜': 'legend__dot--sun',
  '〇日曜（掃除）': 'legend__dot--sun',
  '〇終日': 'legend__dot--full',
  '終日（掃除）': 'legend__dot--full',
  '湯本午後': 'legend__dot--pm',
  'りんご': 'legend__dot--ringo',
  '出張': 'legend__dot--other',
  '応援': 'legend__dot--other',
};

const PATTERN_LABEL = {
  '〇午前': '午前',
  '〇午前（掃除）': '午(掃)',
  '〇日曜': '日曜',
  '〇日曜（掃除）': '日(掃)',
  '〇終日': '終日',
  '終日（掃除）': '終(掃)',
  '湯本午後': '湯午後',
  'りんご': 'り',
  '出張': '出張',
  '応援': '応援',
};

function getAvailablePatterns(staff) {
  if (staff.staff_type === 'external') return [''];
  if (staff.staff_type === 'special') {
    return ['', PATTERNS.AM, PATTERNS.FULL, 'りんご', '出張', '応援'];
  }
  // 薬剤師
  if (staff.role === 'pharmacist') {
    return ['', PATTERNS.AM, PATTERNS.SUN, PATTERNS.FULL, PATTERNS.PM_YUMOTO];
  }
  // 事務
  if (staff.role === 'office') {
    return ['', PATTERNS.AM_CLEAN, PATTERNS.SUN_CLEAN, PATTERNS.FULL_CLEAN, PATTERNS.PM_YUMOTO];
  }
  return [''];
}

// ============================================================
// 祝日データ
// ============================================================
function getHolidays(year) {
  const fixed = [
    [1, 1, '元日'], [2, 11, '建国記念の日'], [2, 23, '天皇誕生日'],
    [4, 29, '昭和の日'], [5, 3, '憲法記念日'], [5, 4, 'みどりの日'],
    [5, 5, 'こどもの日'], [8, 11, '山の日'], [11, 3, '文化の日'],
    [11, 23, '勤労感謝の日'],
  ];
  const holidays = {};
  fixed.forEach(([m, d, name]) => {
    holidays[`${year}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`] = name;
  });
  const shunbun = Math.floor(20.8431 + 0.242194 * (year - 1980) - Math.floor((year - 1980) / 4));
  holidays[`${year}-03-${String(shunbun).padStart(2, '0')}`] = '春分の日';
  const shubun = Math.floor(23.2488 + 0.242194 * (year - 1980) - Math.floor((year - 1980) / 4));
  holidays[`${year}-09-${String(shubun).padStart(2, '0')}`] = '秋分の日';
  const happyMonday = (m, week) => {
    let d = new Date(year, m - 1, 1);
    let count = 0;
    while (count < week) {
      if (d.getDay() === 1) count++;
      if (count < week) d.setDate(d.getDate() + 1);
    }
    return d;
  };
  [[1, 2, '成人の日'], [7, 3, '海の日'], [9, 3, '敬老の日'], [10, 2, 'スポーツの日']].forEach(([m, week, name]) => {
    const d = happyMonday(m, week);
    holidays[formatDate(d)] = name;
  });
  Object.keys({ ...holidays }).forEach(key => {
    const d = new Date(key + 'T00:00:00');
    if (d.getDay() === 0) {
      let next = new Date(d);
      next.setDate(next.getDate() + 1);
      while (holidays[formatDate(next)]) next.setDate(next.getDate() + 1);
      holidays[formatDate(next)] = '振替休日';
    }
  });
  return holidays;
}

// ============================================================
// 状態管理
// ============================================================
const state = {
  staffList: [],
  requests: [],       // ringo_shift_requests（希望休）
  assignments: [],     // ringo_shift_assignments（生成結果）
  currentYear: new Date().getFullYear(),
  currentMonth: new Date().getMonth(),
  holidays: {},
  warnings: [],
  hasGenerated: false,
  // Undo/Redo/Reset用
  baselineAssignments: null,  // 生成直後のスナップショット（リセット先）
  history: [],                // [snapshot, snapshot, ...]
  historyIndex: -1,           // 現在のhistory位置
};

const HISTORY_MAX = 50; // 履歴の最大件数

function saveHistoryToLocal() {
  const yearMonth = getCurrentYearMonth();
  try {
    const data = {
      baseline: state.baselineAssignments,
      history: state.history,
      historyIndex: state.historyIndex
    };
    localStorage.setItem(`shift_history_${yearMonth}`, JSON.stringify(data));
  } catch (e) { console.error('ローカル履歴保存エラー', e); }
}

function loadHistoryFromLocal(yearMonth) {
  try {
    const raw = localStorage.getItem(`shift_history_${yearMonth}`);
    if (raw) return JSON.parse(raw);
  } catch (e) { console.error('ローカル履歴読込エラー', e); }
  return null;
}

// ディープコピー（assignments配列用）
function cloneAssignments(assignments) {
  return assignments.map(a => ({ ...a }));
}

// 履歴にpush（手動変更時に呼ぶ）
function pushHistory() {
  // 現在位置より先の履歴を切り捨て（redoスタックをクリア）
  state.history = state.history.slice(0, state.historyIndex + 1);
  state.history.push(cloneAssignments(state.assignments));
  if (state.history.length > HISTORY_MAX) state.history.shift();
  state.historyIndex = state.history.length - 1;
  updateUndoRedoButtons();
  saveHistoryToLocal();
}

// ============================================================
// ユーティリティ関数（上部に集約）
// ============================================================

// state の現在年月を "YYYY-MM" 形式で返す
function getCurrentYearMonth() {
  return `${state.currentYear}-${String(state.currentMonth + 1).padStart(2, '0')}`;
}

// Date オブジェクトを "M/D（曜）" 形式のラベルに変換
function formatDateLabel(dt) {
  return `${dt.getMonth() + 1}/${dt.getDate()}（${DAY_NAMES[dt.getDay()]}）`;
}

// 履歴からassignmentsを復元してUI更新
async function restoreFromHistory(index) {
  state.historyIndex = index;
  state.assignments = cloneAssignments(state.history[index]);
  const yearMonth = getCurrentYearMonth();
  await saveAssignments(yearMonth, state.assignments);
  renderGantt();
  renderConditionsCheck();
  updateUndoRedoButtons();
  saveHistoryToLocal();
}

function handleUndo() {
  if (state.historyIndex > 0) restoreFromHistory(state.historyIndex - 1);
}

function handleRedo() {
  if (state.historyIndex < state.history.length - 1) restoreFromHistory(state.historyIndex + 1);
}

async function handleReset() {
  if (!state.baselineAssignments) return;
  state.assignments = cloneAssignments(state.baselineAssignments);
  // 履歴をクリアして初期状態に戻す
  state.history = [cloneAssignments(state.assignments)];
  state.historyIndex = 0;
  await saveAssignments(getCurrentYearMonth(), state.assignments);
  renderGantt();
  renderConditionsCheck();
  updateUndoRedoButtons();
  saveHistoryToLocal();
}

function updateUndoRedoButtons() {
  const undoBtn = document.getElementById('btn-undo');
  const redoBtn = document.getElementById('btn-redo');
  const resetBtn = document.getElementById('btn-reset');
  if (undoBtn) undoBtn.disabled = state.historyIndex <= 0;
  if (redoBtn) redoBtn.disabled = state.historyIndex >= state.history.length - 1;
  if (resetBtn) resetBtn.disabled = !state.baselineAssignments || state.historyIndex <= 0;
}

// ============================================================
// 初期化
// ============================================================
document.addEventListener('DOMContentLoaded', async () => {
  bindEvents();
  state.holidays = { ...getHolidays(state.currentYear), ...getHolidays(state.currentYear + 1) };
  renderMonth();
  await loadData();
  // 既存の生成結果があれば読み込み
  await loadExistingAssignments();
});

function bindEvents() {
  document.getElementById('prev-month').addEventListener('click', () => changeMonth(-1));
  document.getElementById('next-month').addEventListener('click', () => changeMonth(1));
  document.getElementById('today-month-btn').addEventListener('click', () => {
    const now = new Date();
    state.currentYear = now.getFullYear();
    state.currentMonth = now.getMonth();
    state.holidays = { ...getHolidays(state.currentYear), ...getHolidays(state.currentYear + 1) };
    renderMonth();
    loadExistingAssignments();
  });
  document.getElementById('month-label').addEventListener('click', openMonthPicker);
  document.getElementById('picker-cancel').addEventListener('click', closeMonthPicker);
  document.getElementById('month-picker-overlay').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeMonthPicker();
  });
  document.getElementById('picker-prev-year').addEventListener('click', () => { pickerYear--; renderMonthPickerGrid(); });
  document.getElementById('picker-next-year').addEventListener('click', () => { pickerYear++; renderMonthPickerGrid(); });
  document.getElementById('btn-generate').addEventListener('click', handleGenerate);
  document.getElementById('btn-csv').addEventListener('click', handleCSVExport);
  document.getElementById('btn-undo').addEventListener('click', handleUndo);
  document.getElementById('btn-redo').addEventListener('click', handleRedo);
  document.getElementById('btn-reset').addEventListener('click', handleReset);
  // セルエディタの外クリックで閉じる
  document.addEventListener('click', (e) => {
    const editor = document.getElementById('cell-editor');
    if (editor.style.display !== 'none' && !editor.contains(e.target) && !e.target.closest('.day-cell')) {
      editor.style.display = 'none';
    }
  });
  setupGanttHover();

  // 条件付き希望アコーディオンのトグル
  document.getElementById('other-reqs-header').addEventListener('click', () => {
    document.getElementById('other-reqs-accordion').classList.toggle('is-open');
  });
}

// ============================================================
// 月選択モーダル（カスタム実装）
// ============================================================
let pickerYear = new Date().getFullYear();
const MONTH_LABELS = ['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月'];

function openMonthPicker() {
  pickerYear = state.currentYear;
  renderMonthPickerGrid();
  document.getElementById('month-picker-overlay').style.display = 'flex';
}
function closeMonthPicker() {
  document.getElementById('month-picker-overlay').style.display = 'none';
}
function renderMonthPickerGrid() {
  document.getElementById('picker-year-label').textContent = `${pickerYear}年`;
  const grid = document.getElementById('picker-month-grid');
  grid.innerHTML = MONTH_LABELS.map((label, i) => {
    const isCurrent = (pickerYear === state.currentYear && i === state.currentMonth);
    return `<button class="month-picker__month-btn${isCurrent ? ' is-current' : ''}" data-month="${i}">${label}</button>`;
  }).join('');
  grid.querySelectorAll('.month-picker__month-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      state.currentYear = pickerYear;
      state.currentMonth = parseInt(btn.dataset.month, 10);
      state.holidays = { ...getHolidays(state.currentYear), ...getHolidays(state.currentYear + 1) };
      renderMonth();
      loadExistingAssignments();
      closeMonthPicker();
    });
  });
}

// ============================================================
// ガントチャート ホバー（クロスハイライト）
// ============================================================
function setupGanttHover() {
  const ganttTable = document.getElementById('gantt-table');
  if (!ganttTable) return;

  function clearCrossHighlight() {
    ganttTable.querySelectorAll('.cross-highlight').forEach(c => c.classList.remove('cross-highlight'));
  }

  ganttTable.addEventListener('mouseover', (e) => {
    clearCrossHighlight();
    const cell = e.target.closest('td.day-cell');
    if (!cell) return;

    // 行のハイライト
    const tr = cell.closest('tr');
    if (tr) {
      tr.querySelectorAll('td').forEach(td => td.classList.add('cross-highlight'));
    }

    // 列のハイライト
    const dateStr = cell.dataset.date;
    if (dateStr) {
      ganttTable.querySelectorAll(`td.day-cell[data-date="${dateStr}"]`).forEach(td => td.classList.add('cross-highlight'));
      const th = ganttTable.querySelector(`th[data-date="${dateStr}"]`);
      if (th) th.classList.add('cross-highlight');
    }
  });

  ganttTable.addEventListener('mouseleave', () => {
    clearCrossHighlight();
  });
}

function changeMonth(delta) {
  state.currentMonth += delta;
  if (state.currentMonth > 11) { state.currentMonth = 0; state.currentYear++; }
  else if (state.currentMonth < 0) { state.currentMonth = 11; state.currentYear--; }
  state.holidays = { ...getHolidays(state.currentYear), ...getHolidays(state.currentYear + 1) };
  renderMonth();
  loadExistingAssignments();
}

function renderMonth() {
  document.getElementById('month-label').textContent = `${state.currentYear}年 ${state.currentMonth + 1}月`;
  const now = new Date();
  const isCurrentMonth = (state.currentYear === now.getFullYear() && state.currentMonth === now.getMonth());
  document.getElementById('today-month-btn').style.display = isCurrentMonth ? 'none' : 'inline-block';
}

// ============================================================
// 条件付き・その他希望リスト描画（アコーディオン）
// ============================================================
function renderOtherList() {
  const accordion = document.getElementById('other-reqs-accordion');
  const listEl = document.getElementById('other-reqs-list');
  const countEl = document.getElementById('other-reqs-count');
  if (!accordion || !listEl) return;

  // 対象フィルタ：休み（備考あり）+ 条件付き全種
  const filtered = state.requests
    .filter(r => r.request_type !== 'off' || (r.request_type === 'off' && r.note))
    .sort((a, b) => {
      if (a.staff_id !== b.staff_id) return a.staff_id.localeCompare(b.staff_id);
      return a.date.localeCompare(b.date);
    });

  // 連続日付グループ化
  const grouped = [];
  filtered.forEach(r => {
    const last = grouped.length > 0 ? grouped[grouped.length - 1] : null;
    if (last && last.staff_id === r.staff_id && last.request_type === r.request_type && last.note === r.note) {
      const nextDate = new Date(new Date(last.end_date + 'T00:00:00').getTime() + 86400000);
      if (r.date === formatDate(nextDate)) { last.end_date = r.date; return; }
    }
    grouped.push({ ...r, start_date: r.date, end_date: r.date });
  });
  grouped.sort((a, b) => a.start_date.localeCompare(b.start_date));

  countEl.textContent = `${grouped.length}件`;
  accordion.style.display = '';

  if (grouped.length === 0) {
    listEl.innerHTML = '<p style="font-size:var(--font-size-sm);color:var(--color-text-muted);padding:8px 0;">条件付き希望はありません</p>';
    return;
  }

  listEl.innerHTML = grouped.map(g => {
    const staff = state.staffList.find(s => s.id === g.staff_id);
    const staffName = staff?.name?.split(/[\s　]+/)[0] || '?';

    const startDt = new Date(g.start_date + 'T00:00:00');
    const endDt = new Date(g.end_date + 'T00:00:00');
    let dateLabel = formatDateLabel(startDt);
    if (g.start_date !== g.end_date) {
      dateLabel += `〜${formatDateLabel(endDt)}`;
    }

    const typeLabel = REQUEST_TYPE_LABEL[g.request_type]?.replace(/（.*?）/, '') || 'その他';
    const itemCls = `other-list__item--${g.request_type || 'other'}`;

    const noteHtml = g.note ? `<span class="other-list__note">${g.note}</span>` : '';
    return `<div class="other-list__item ${itemCls} other-list__item--clickable" data-staff="${g.staff_id}" data-start="${g.start_date}" data-end="${g.end_date}" data-type="${g.request_type}">
      <span class="other-list__date">${dateLabel}</span>
      <span class="other-list__staff">${staffName} ${typeLabel}</span>
      ${noteHtml}
    </div>`;
  }).join('');

  // 各アイテムのホバーでガントをハイライト
  listEl.querySelectorAll('.other-list__item').forEach(item => {
    item.addEventListener('mouseenter', () => {
      const staffId = item.dataset.staff;
      const reqType = item.dataset.type;
      const startDate = new Date(item.dataset.start + 'T00:00:00');
      const endDate = new Date(item.dataset.end + 'T00:00:00');

      let d = new Date(startDate);
      while (d <= endDate) {
        const cell = document.querySelector(`.day-cell[data-staff="${staffId}"][data-date="${formatDate(d)}"]`);
        if (cell) cell.classList.add(`is-hover-${reqType}`);
        d.setDate(d.getDate() + 1);
      }
    });

    item.addEventListener('mouseleave', () => {
      const staffId = item.dataset.staff;
      const reqType = item.dataset.type;
      const startDate = new Date(item.dataset.start + 'T00:00:00');
      const endDate = new Date(item.dataset.end + 'T00:00:00');

      let d = new Date(startDate);
      while (d <= endDate) {
        const cell = document.querySelector(`.day-cell[data-staff="${staffId}"][data-date="${formatDate(d)}"]`);
        if (cell) cell.classList.remove(`is-hover-${reqType}`);
        d.setDate(d.getDate() + 1);
      }
    });
  });
}

// ============================================================
// データ取得
// ============================================================
async function loadData() {
  const { data, error } = await supabase
    .from('ringo_staff')
    .select('*')
    .eq('is_active', true)
    .order('display_order', { ascending: true });

  if (error) {
    console.error('Error loading staff:', error);
    state.staffList = [];
    return;
  }
  state.staffList = data || [];
}

async function loadRequests(yearMonth) {
  const [year, month] = yearMonth.split('-');
  const startDateStr = `${year}-${month}-01`;
  const endDateStr = new Date(year, parseInt(month), 0).toISOString().split('T')[0];

  const { data, error } = await supabase
    .from('ringo_shift_requests')
    .select('*')
    .gte('date', startDateStr)
    .lte('date', endDateStr);

  if (error) {
    console.error('Error loading requests:', error);
    return [];
  }
  
  const dbRequests = data || [];
  return buildEffectiveRequests(year, parseInt(month), dbRequests);
}

function buildEffectiveRequests(year, month, dbRequests) {
  const effective = [...dbRequests];
  const realReqMap = new Set();
  effective.forEach(r => realReqMap.add(`${r.staff_id}_${r.date}`));

  // 取得済みの期間に対して固定休みを合成
  const startDateObj = new Date(year, month - 1, 1);
  const endDateObj = new Date(year, month, 0);

  const fixedOffRules = {};
  state.staffList.forEach(s => {
    if (s.name.includes('野口'))     fixedOffRules[s.id] = [0, 1];       // 日(0)・月(1)休み
    else if (s.name.includes('小野寺')) fixedOffRules[s.id] = [3, 6];    // 水(3)・土(6)休み
    else if (s.name.includes('笠原'))   fixedOffRules[s.id] = [2, 3, 4, 5, 6]; // 火(2)〜土(6)休み
    else if (s.name.includes('鈴木'))   fixedOffRules[s.id] = [0, 5];    // 日(0)・金(5)休み
    else if (s.name.includes('服部'))   fixedOffRules[s.id] = [1, 2];    // 月(1)・火(2)休み
  });

  for (let d = new Date(startDateObj); d <= endDateObj; d.setDate(d.getDate() + 1)) {
    const dow = d.getDay();
    const dateStr = formatDate(d);

    for (const [staffId, offDays] of Object.entries(fixedOffRules)) {
      if (offDays.includes(dow)) {
        if (!realReqMap.has(`${staffId}_${dateStr}`)) {
          effective.push({
            staff_id: staffId,
            date: dateStr,
            request_type: 'off',
            note: '固定休',
            is_virtual: true
          });
        }
      }
    }
  }

  return effective;
}

async function loadExistingAssignments() {
  const yearMonth = getCurrentYearMonth();

  // 描画のための希望休データを先にロード
  state.requests = await loadRequests(yearMonth);

  const { data, error } = await supabase
    .from('ringo_shift_assignments')
    .select('*')
    .eq('year_month', yearMonth);

  if (error) {
    console.error('Error loading assignments:', error);
    state.assignments = [];
  } else {
    state.assignments = data || [];
  }

  if (state.assignments.length > 0) {
    state.hasGenerated = true;
    document.getElementById('btn-csv').disabled = false;
    renderGantt();
    renderConditionsCheck();
    renderOtherList();

    // 初期状態を保存（リセット・Undo用）
    const localData = loadHistoryFromLocal(yearMonth);
    // DBの内容と大きく乖離していない前提で、ローカルキャッシュに履歴があれば復元
    if (localData && localData.history && localData.history.length > 0) {
      state.baselineAssignments = localData.baseline;
      state.history = localData.history;
      state.historyIndex = localData.historyIndex ?? (localData.history.length - 1);
      // DBよりもローカルの最新履歴（未保存状態など）を優先して復元する
      state.assignments = cloneAssignments(state.history[state.historyIndex]);
      // もしDBと同期させたい場合はここでsaveAssignmentsを呼ぶのもあり
    } else {
      state.baselineAssignments = cloneAssignments(state.assignments);
      state.history = [cloneAssignments(state.assignments)];
      state.historyIndex = 0;
      saveHistoryToLocal();
    }
    updateUndoRedoButtons();
  } else {
    state.hasGenerated = false;
    document.getElementById('btn-csv').disabled = true;
    document.getElementById('gantt-table').style.display = 'none';
    document.getElementById('gantt-placeholder').style.display = 'flex';
    const condPanel = document.getElementById('conditions-panel');
    if (condPanel) condPanel.style.display = 'none';
    renderOtherList(); // 月変更時にも条件付き一覧を更新

    state.baselineAssignments = null;
    state.history = [];
    state.historyIndex = -1;
    updateUndoRedoButtons();
  }
}

// ============================================================
// シフト生成アルゴリズム
// ============================================================
async function handleGenerate() {
  const btn = document.getElementById('btn-generate');
  btn.disabled = true;
  btn.innerHTML = '<span class="loader"></span> 生成中...';

  try {
    const yearMonth = getCurrentYearMonth();
    state.requests = await loadRequests(yearMonth);

    // スコアリング生成：複数回試行して最高スコアを採用
    const TRIAL_COUNT = 30;
    let bestAssignments = null;
    let bestScore = -Infinity;
    let bestBreakdown = [];
    let bestWarnings = [];

    // 1回目はランダムなし（ベースライン）
    for (let trial = 0; trial < TRIAL_COUNT; trial++) {
      const randomize = trial > 0;
      const result = generateShifts(yearMonth, [], new Set(), randomize);
      const { score, breakdown } = scoreShifts(result, yearMonth);
      if (score > bestScore) {
        bestScore = score;
        bestBreakdown = breakdown;
        bestAssignments = result;
        bestWarnings = [...state.warnings];
      }
    }

    // 常に新規生成結果を採用（気に入らなければundo/resetで戻せる）
    state.assignments = bestAssignments;
    state.warnings = bestWarnings;
    state.lastScore = bestScore;
    state.lastBreakdown = bestBreakdown;
    await saveAssignments(yearMonth, bestAssignments);
    console.log(`シフト生成完了 スコア: ${bestScore}`, bestBreakdown);

    state.hasGenerated = true;
    document.getElementById('btn-csv').disabled = false;
    renderGantt();
    renderConditionsCheck();

    // baseline保存 + 履歴初期化
    state.baselineAssignments = cloneAssignments(state.assignments);
    state.history = [cloneAssignments(state.assignments)];
    state.historyIndex = 0;
    updateUndoRedoButtons();
    saveHistoryToLocal();
  } catch (err) {
    console.error(err);
    showToast('生成エラー: ' + err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i data-lucide="sparkles" style="width:16px;height:16px;"></i> シフト生成';
    lucide.createIcons();
  }
}

// ============================================================
// チェック用ヘルパー関数（scoreShifts / renderConditionsCheck 共通）
// ============================================================
function _staffAssignments(assignments, staffId) {
  return assignments.filter(a => a.staff_id === staffId);
}
function _workDays(assignments, staffId) {
  return _staffAssignments(assignments, staffId).filter(a => a.work_pattern && a.work_pattern !== '');
}
function _restDays(assignments, staffId) {
  return _staffAssignments(assignments, staffId).filter(a => !a.work_pattern || a.work_pattern === '');
}
function _countPattern(assignments, staffId, pattern) {
  return _staffAssignments(assignments, staffId).filter(a => a.work_pattern === pattern).length;
}
function _maxConsecutiveWork(assignments, staffId) {
  const sorted = _staffAssignments(assignments, staffId).sort((a, b) => a.date.localeCompare(b.date));
  let max = 0, count = 0;
  for (const a of sorted) {
    if (a.work_pattern && a.work_pattern !== '') { count++; max = Math.max(max, count); }
    else { count = 0; }
  }
  return max;
}
function _maxConsecutiveWorkIncludingDispense(assignments, staffId, yearMonth, daysInMonth) {
  const works = _workDays(assignments, staffId).map(a => a.date);
  const dispenses = state.requests.filter(r => r.staff_id === staffId && r.request_type === 'dispense').map(r => r.date);
  const allWorkDates = new Set([...works, ...dispenses]);
  let max = 0, currentConsec = 0;
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${yearMonth}-${String(d).padStart(2, '0')}`;
    if (allWorkDates.has(dateStr)) { currentConsec++; max = Math.max(max, currentConsec); }
    else { currentConsec = 0; }
  }
  return max;
}
function _countSundays(assignments, staffId) {
  return _workDays(assignments, staffId).filter(a => new Date(a.date + 'T00:00:00').getDay() === 0).length;
}
function _checkConsecutiveRestPairs(assignments, staffId) {
  const rests = _restDays(assignments, staffId).map(a => a.date).sort();
  let pairs = 0;
  for (let i = 0; i < rests.length - 1; i++) {
    const d1 = new Date(rests[i] + 'T00:00:00');
    const d2 = new Date(rests[i + 1] + 'T00:00:00');
    if ((d2 - d1) / 86400000 === 1) { pairs++; i++; }
  }
  return pairs;
}
function _restOverlap(assignments, id1, id2) {
  const r1 = new Set(_restDays(assignments, id1).map(a => a.date));
  const r2 = new Set(_restDays(assignments, id2).map(a => a.date));
  let overlap = 0;
  for (const d of r1) {
    if (r2.has(d) && new Date(d + 'T00:00:00').getDay() !== 0) overlap++;
  }
  return overlap;
}
function _getWeeklyBreakdown(assignments, staffId) {
  const weeks = {};
  for (const a of _workDays(assignments, staffId)) {
    const dt = new Date(a.date + 'T00:00:00');
    const wk = Math.floor((dt.getDate() - 1) / 7);
    weeks[wk] = (weeks[wk] || 0) + 1;
  }
  return weeks;
}
function _dispenseCount(staffId) {
  return state.requests.filter(r => r.staff_id === staffId && r.request_type === 'dispense').length;
}

// ============================================================
// 全チェック実行（共通エンジン）
// scoreShifts と renderConditionsCheck の両方がこれを使う
// ============================================================
function runAllChecks(assignments, yearMonth) {
  const staffList = state.staffList; // りんご仕様では全員対象
  const [year, month] = yearMonth.split('-').map(Number);
  const daysInMonth = new Date(year, month, 0).getDate();

  const work = (id) => _workDays(assignments, id);
  const rest = (id) => _restDays(assignments, id);

  const globalItems = [];

  // G1. 配置充足（全体）
  let pharmShort = 0, officeShort = 0;
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${yearMonth}-${String(d).padStart(2, '0')}`;
    const dow = new Date(dateStr + 'T00:00:00').getDay();
    const dayWork = assignments.filter(a => a.date === dateStr && a.work_pattern && a.work_pattern !== '');
    
    let pharmCount = 0;
    let officeCount = 0;
    
    dayWork.forEach(a => {
      const staff = staffList.find(s => s.id === a.staff_id);
      if (staff?.role === 'pharmacist') pharmCount++;
      if (staff?.role === 'office') officeCount++;
    });

    // りんごの必要人数: 土日は2名、火曜午後は2名（ここでは全体の必要数で評価）
    // ※ 簡易的に全体で平日は1名、土日は2名として不足をカウント（実際には火曜午後も2名だがガントでは終日で集計する）
    let reqPharm = (dow === 0 || dow === 6 || dow === 2) ? 2 : 1; 
    let reqOffice = 1; // 事務は基本2名目標だが最低1名でOKとする

    if (pharmCount < reqPharm) pharmShort++;
    if (officeCount < reqOffice) officeShort++;
  }
  
  globalItems.push(
    { id: 'G1-pharm', tag: '絶対', status: pharmShort === 0 ? 'pass' : 'fail', text: '薬剤師の配置充足', value: pharmShort === 0 ? '充足' : `${pharmShort}日不足`, scoreDelta: pharmShort > 0 ? -100 * pharmShort : 0 },
    { id: 'G1-office', tag: '絶対', status: officeShort === 0 ? 'pass' : 'fail', text: '事務の配置充足', value: officeShort === 0 ? '充足' : `${officeShort}日不足`, scoreDelta: officeShort > 0 ? -100 * officeShort : 0 },
  );

  // G2. 希望休反映
  let violations = 0;
  const offRequests = state.requests.filter(r => r.request_type === 'off');
  for (const req of offRequests) {
    const assign = assignments.find(a => a.staff_id === req.staff_id && a.date === req.date);
    if (assign && assign.work_pattern && assign.work_pattern !== '') violations++;
  }
  globalItems.push(
    { id: 'G2', tag: '絶対', status: violations === 0 ? 'pass' : 'fail', text: '希望休が全て反映されている', value: violations === 0 ? '○' : `${violations}件違反`, scoreDelta: violations > 0 ? -1000 : 0 },
  );

  const staffChecks = {};
  const bonusItems = [];

  // 固定休ルール定義（仮想固定休はG2に引っかからないため個別チェック）
  const DAY_NAMES_JA = ['日', '月', '火', '水', '木', '金', '土'];
  const FIXED_OFF_RULES = [
    { key: '鈴木',   days: [0, 5]          }, // 日・金
    { key: '服部',   days: [1, 2]          }, // 月・火
    { key: '野口',   days: [0, 1]          }, // 日・月
    { key: '小野寺', days: [3, 6]          }, // 水・土
    { key: '笠原',   days: [2, 3, 4, 5, 6] }, // 火〜土
  ];

  // 各スタッフごとの個別チェック
  for (const staff of staffList) {
    const workCount = work(staff.id).length;
    const consec = _maxConsecutiveWork(assignments, staff.id);
    const items = [];
    
    // 連勤チェック（湯本は最大2、それ以外は基本5）
    const maxConsec = staff.name.includes('湯本') ? 2 : (staff.work_conditions?.max_consecutive_days || 5);
    items.push({ id: `${staff.id}-consec`, tag: '絶対', status: consec <= maxConsec ? 'pass' : 'fail', text: `連勤：${maxConsec}連勤まで`, value: `${consec}日`, scoreDelta: consec > maxConsec ? -50 * (consec - maxConsec) : 0 });

    // 勤務日数チェック
    const cond = staff.work_conditions || {};
    if (cond.target_days_per_month) {
      const maxDays = cond.max_days_per_month || cond.target_days_per_month;
      const isBelowTarget = workCount < cond.target_days_per_month;
      const baseStatus = isBelowTarget ? 'fail' : workCount <= cond.target_days_per_month ? 'pass' : workCount <= maxDays ? 'warn' : 'fail';
      const delta = isBelowTarget ? -(cond.target_days_per_month - workCount) * 100 : (workCount > maxDays ? -(workCount - maxDays) * 5 : 0);
      items.push({ id: `${staff.id}-days`, tag: '絶対', status: baseStatus, text: `勤務日数（基本${cond.target_days_per_month}日/MAX${maxDays}日）`, value: `${workCount}日`, scoreDelta: delta });
    } else {
      items.push({ id: `${staff.id}-days`, status: 'pass', text: '勤務日数', value: `${workCount}日`, scoreDelta: 0 });
    }

    // 湯本専用チェック（H4 / H6 / H7）
    if (staff.name.includes('湯本')) {
      // H6: 月勤務回数（6〜10回）
      const minDays = 6, targetDays = 8, maxDays = 10;
      const deltaH6 = workCount < minDays ? -50 * (minDays - workCount)
        : workCount > maxDays ? -50 * (workCount - maxDays) : 0;
      const statusH6 = workCount < minDays ? 'fail'
        : workCount > maxDays ? 'fail'
        : workCount === targetDays ? 'pass' : 'warn';
      items.push({
        id: `${staff.id}-monthly-range`, tag: '絶対', status: statusH6,
        text: `月勤務回数（${minDays}〜${maxDays}回）`, value: `${workCount}回`, scoreDelta: deltaH6
      });

      // H7: 同週の土日重複なし
      const workDates = work(staff.id).map(a => a.date);
      let weekendOverlapCount = 0;
      const checkedWeeks = new Set();
      for (const dateStr of workDates) {
        const dt = new Date(dateStr + 'T00:00:00');
        const dow = dt.getDay();
        if (dow === 0 || dow === 6) {
          const weekStart = new Date(dt);
          weekStart.setDate(weekStart.getDate() - dow);
          const wsStr = `${weekStart.getFullYear()}-${String(weekStart.getMonth()+1).padStart(2,'0')}-${String(weekStart.getDate()).padStart(2,'0')}`;
          if (!checkedWeeks.has(wsStr)) {
            checkedWeeks.add(wsStr);
            const sat = new Date(weekStart);
            sat.setDate(sat.getDate() + 6);
            const satStr = `${sat.getFullYear()}-${String(sat.getMonth()+1).padStart(2,'0')}-${String(sat.getDate()).padStart(2,'0')}`;
            if (workDates.includes(satStr) && workDates.includes(wsStr)) {
              weekendOverlapCount++;
            }
          }
        }
      }
      items.push({
        id: `${staff.id}-weekend-overlap`, tag: '絶対',
        status: weekendOverlapCount === 0 ? 'pass' : 'fail',
        text: '同週の土日重複なし',
        value: weekendOverlapCount === 0 ? '○' : `${weekendOverlapCount}週で重複`,
        scoreDelta: weekendOverlapCount > 0 ? -100 * weekendOverlapCount : 0
      });

      // H4: 1人勤務なし（服部か鈴木と必ずペア）
      const hattoriId = staffList.find(s => s.name.includes('服部'))?.id;
      const suzukiId = staffList.find(s => s.name.includes('鈴木'))?.id;
      let aloneCount = 0;
      for (const a of work(staff.id)) {
        const hasPair = assignments.find(
          a2 => a2.date === a.date
            && (a2.staff_id === hattoriId || a2.staff_id === suzukiId)
            && a2.work_pattern && a2.work_pattern !== ''
        );
        if (!hasPair) aloneCount++;
      }
      items.push({
        id: `${staff.id}-alone`, tag: '絶対',
        status: aloneCount === 0 ? 'pass' : 'fail',
        text: '1人勤務なし（服部or鈴木とペア）',
        value: aloneCount === 0 ? '○' : `${aloneCount}日単独`,
        scoreDelta: aloneCount > 0 ? -100 * aloneCount : 0
      });
    }

    // 固定休の遵守チェック（仮想固定休はG2に引っかからないため個別にチェック）
    const fixedRule = FIXED_OFF_RULES.find(r => staff.name.includes(r.key));
    if (fixedRule) {
      const violations = work(staff.id).filter(a => {
        const dow = new Date(a.date + 'T00:00:00').getDay();
        return fixedRule.days.includes(dow);
      }).length;
      const offLabel = fixedRule.days.map(d => DAY_NAMES_JA[d]).join('・');
      items.push({
        id: `${staff.id}-fixed-off`, tag: '絶対',
        status: violations === 0 ? 'pass' : 'fail',
        text: `固定休：${offLabel}`,
        value: violations === 0 ? '○' : `${violations}日違反`,
        scoreDelta: violations > 0 ? -200 * violations : 0
      });
    }

    if (items.length > 0) {
      staffChecks[staff.id] = { name: staff.name, section: staff.role === 'pharmacist' ? '薬剤師' : '事務', items };
    }
  }

  return { globalItems, staffChecks, bonusItems };
}

// ============================================================
// スコアリング関数（runAllChecksの結果からスコアを算出）
// ============================================================
function scoreShifts(assignments, yearMonth) {
  const { globalItems, staffChecks, bonusItems } = runAllChecks(assignments, yearMonth);

  let score = 100;
  const breakdown = [];
  const addDelta = (category, label, delta) => {
    if (delta === 0) return;
    score += delta;
    breakdown.push({ category, label, delta });
  };

  // 全体チェックのスコア反映
  for (const item of globalItems) {
    addDelta(item.id, item.text, item.scoreDelta);
  }

  // スタッフ別チェックのスコア反映
  for (const [, check] of Object.entries(staffChecks)) {
    for (const item of check.items) {
      addDelta(item.id, `${check.name}: ${item.text}`, item.scoreDelta);
    }
  }

  // ボーナス/ペナルティ
  for (const item of bonusItems) {
    addDelta(item.id, item.label, item.scoreDelta);
  }

  return { score: Math.round(score), breakdown };
}

function generateShifts(yearMonth, manualOverrides, manualSet, randomize = false) {
  const [year, month] = yearMonth.split('-').map(Number);
  const daysInMonth = new Date(year, month, 0).getDate();

  const activeStaff = state.staffList.filter(s => s.is_active);
  const pharmacists = activeStaff.filter(s => s.role === 'pharmacist');
  const officeStaff = activeStaff.filter(s => s.role === 'office');

  const dates = [];
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const dt = new Date(year, month - 1, d);
    dates.push({ dateStr, dow: dt.getDay(), day: d });
  }

  const requestMap = {};
  state.requests.forEach(r => { requestMap[`${r.staff_id}_${r.date}`] = r; });

  const fukushimaOffCountsPerWeek = {};
  const fukushimaObj = activeStaff.find(s => s.name.includes('福島'));
  if (fukushimaObj) {
    for (const { dateStr, dow } of dates) {
      if (dow >= 1 && dow <= 5) { // 月〜金
        const req = requestMap[`${fukushimaObj.id}_${dateStr}`];
        if (req && req.request_type === 'off') {
          const dt = new Date(dateStr + 'T00:00:00');
          dt.setDate(dt.getDate() - dow); // 日曜日の日付を取得
          const wsStr = `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}-${String(dt.getDate()).padStart(2,'0')}`;
          fukushimaOffCountsPerWeek[wsStr] = (fukushimaOffCountsPerWeek[wsStr] || 0) + 1;
        }
      }
    }
  }

  const result = [];
  const warnings = [];

  const workCounts = {};
  activeStaff.forEach(s => {
    workCounts[s.id] = { total: 0, consecutiveDays: 0, lastWorkedDate: null };
  });

  function canWork(staffId, dateStr) {
    if (manualSet.has(`${staffId}_${dateStr}`)) return false;
    const req = requestMap[`${staffId}_${dateStr}`];
    if (req && req.request_type === 'off') return false;
    
    const staff = activeStaff.find(s => s.id === staffId);
    let maxConsecutive = staff?.name.includes('湯本') ? 2 : (staff?.work_conditions?.max_consecutive_days || 5);
    
    const wc = workCounts[staffId];
    if (wc.lastWorkedDate) {
      const last = new Date(wc.lastWorkedDate + 'T00:00:00');
      const curr = new Date(dateStr + 'T00:00:00');
      const diff = (curr - last) / (1000 * 60 * 60 * 24);
      if (diff === 1 && wc.consecutiveDays >= maxConsecutive) return false;
    }
    return true;
  }

  function addAssignment(staffId, dateStr, attendanceType, workPattern, isManual = false) {
    result.push({
      year_month: yearMonth,
      staff_id: staffId,
      date: dateStr,
      attendance_type: attendanceType,
      work_pattern: workPattern,
      is_manual_override: isManual,
    });
    if (workPattern && workPattern !== '') {
      const wc = workCounts[staffId];
      wc.total++;

      const dt = new Date(dateStr + 'T00:00:00');
      const weekNum = Math.floor((dt.getDate() - 1) / 7);
      wc.weekly = wc.weekly || {};
      wc.weekly[weekNum] = (wc.weekly[weekNum] || 0) + 1;
      
      const dayOfWeek = dt.getDay();
      if (dayOfWeek >= 1 && dayOfWeek <= 5) wc.weekdays = (wc.weekdays || 0) + 1;
      if (dayOfWeek === 6) wc.saturdays = (wc.saturdays || 0) + 1;
      if (dayOfWeek === 0) wc.sundays = (wc.sundays || 0) + 1;

      if (dayOfWeek === 0 || dayOfWeek === 6) {
        const weekStartDt = new Date(dt);
        weekStartDt.setDate(weekStartDt.getDate() - dayOfWeek);
        const wsStr = `${weekStartDt.getFullYear()}-${String(weekStartDt.getMonth()+1).padStart(2,'0')}-${String(weekStartDt.getDate()).padStart(2,'0')}`;
        wc.weekEndWorked = wc.weekEndWorked || {};
        wc.weekEndWorked[wsStr] = (wc.weekEndWorked[wsStr] || 0) + 1;
      }

      if (wc.lastWorkedDate) {
        const last = new Date(wc.lastWorkedDate + 'T00:00:00');
        const curr = new Date(dateStr + 'T00:00:00');
        const diff = (curr - last) / (1000 * 60 * 60 * 24);
        if (diff === 1) {
          wc.consecutiveDays++;
        } else {
          wc.consecutiveDays = 1;
        }
      } else {
        wc.consecutiveDays = 1;
      }
      wc.lastWorkedDate = dateStr;
    }
  }

  // ============ メインループ ============
  for (const { dateStr, dow } of dates) {
    // 手動オーバーライドがある場合はそれを使う
    for (const manual of manualOverrides) {
      if (manual.date === dateStr) {
        addAssignment(manual.staff_id, dateStr, manual.attendance_type, manual.work_pattern, true);
      }
    }

    let assignedPharm = 0;
    let assignedOffice = 0;

    // ----- 事務の配置 -----
    // 平日は⑥終日(掃除)、土曜は②〇午前(掃除)、日曜は④〇日曜(掃除)
    const assignOffice = (staffName, scheduleMap) => {
      const staff = officeStaff.find(s => s.name.includes(staffName));
      if (!staff || manualSet.has(`${staff.id}_${dateStr}`)) return;
      if (result.find(a => a.staff_id === staff.id && a.date === dateStr)) return;

      const pattern = scheduleMap[dow];
      if (pattern && canWork(staff.id, dateStr)) {
        addAssignment(staff.id, dateStr, '平日', pattern);
        assignedOffice++;
      } else {
        addAssignment(staff.id, dateStr, '所定休日', '');
      }
    };

    const isWeekday = dow >= 1 && dow <= 5;
    const weekdayPattern = PATTERNS.FULL_CLEAN;
    const satPattern = PATTERNS.AM_CLEAN;
    const sunPattern = PATTERNS.SUN_CLEAN;

    // 野口 (日曜・月曜休み)
    assignOffice('野口', { 2: weekdayPattern, 3: weekdayPattern, 4: weekdayPattern, 5: weekdayPattern, 6: satPattern });

    // 小野寺 (水曜・土曜休み)
    assignOffice('小野寺', { 0: sunPattern, 1: weekdayPattern, 2: weekdayPattern, 4: weekdayPattern, 5: weekdayPattern });

    // 笠原 (火曜〜土曜休み)
    assignOffice('笠原', { 0: sunPattern, 1: weekdayPattern });

    // 山口 (手動入力のみ)
    const yamaguchi = officeStaff.find(s => s.name.includes('山口'));
    if (yamaguchi && !manualSet.has(`${yamaguchi.id}_${dateStr}`) && !result.find(a => a.staff_id === yamaguchi.id && a.date === dateStr)) {
      addAssignment(yamaguchi.id, dateStr, '所定休日', '');
    }

    // ----- 薬剤師の配置 -----
    let reqPharm = (dow === 0 || dow === 6) ? 2 : 1; // 休日2名、平日1名
    const weekNum = Math.floor((new Date(dateStr + 'T00:00:00').getDate() - 1) / 7);

    const fukushima = pharmacists.find(s => s.name.includes('福島'));
    const hattori = pharmacists.find(s => s.name.includes('服部'));
    const yumoto = pharmacists.find(s => s.name.includes('湯本'));
    const suzuki = pharmacists.find(s => s.name.includes('鈴木'));
    const murakami = pharmacists.find(s => s.name.includes('村上'));
    const spots = pharmacists.filter(s => s.name.includes('堀口') || s.name.includes('財津'));

    // 割り当てヘルパー
    const assignPharm = (staff, pattern) => {
      if (!staff || manualSet.has(`${staff.id}_${dateStr}`)) return false;
      if (result.find(a => a.staff_id === staff.id && a.date === dateStr)) return false;
      if (canWork(staff.id, dateStr)) {
        addAssignment(staff.id, dateStr, '平日', pattern);
        assignedPharm++;
        return true;
      }
      return false;
    };

    if (dow === 0) {
      // 日曜日 (必要人数: 2名)
      // 鈴木は休み。服部は「土日どちらか1回」、福島は勤務(条件付き)。
      const weekStartDt = new Date(dateStr + 'T00:00:00');
      weekStartDt.setDate(weekStartDt.getDate() - dow);
      const wsStr = `${weekStartDt.getFullYear()}-${String(weekStartDt.getMonth()+1).padStart(2,'0')}-${String(weekStartDt.getDate()).padStart(2,'0')}`;

      let fukushimaCanWorkWeekend = true;
      const offCount = fukushimaOffCountsPerWeek[wsStr] || 0;
      if (offCount < 2) {
        const wcF = workCounts[fukushima?.id] || {};
        if ((wcF.weekEndWorked?.[wsStr] || 0) >= 1) fukushimaCanWorkWeekend = false;
      }
      if (fukushimaCanWorkWeekend) assignPharm(fukushima, PATTERNS.SUN);

      const wcH = workCounts[hattori?.id] || {};
      if ((wcH.saturdays || 0) === 0) {
        assignPharm(hattori, PATTERNS.SUN);
      }
    } else if (dow === 6) {
      // 土曜日 (必要人数: 2名)
      assignPharm(suzuki, PATTERNS.AM);

      const weekStartDt = new Date(dateStr + 'T00:00:00');
      weekStartDt.setDate(weekStartDt.getDate() - dow);
      const wsStr = `${weekStartDt.getFullYear()}-${String(weekStartDt.getMonth()+1).padStart(2,'0')}-${String(weekStartDt.getDate()).padStart(2,'0')}`;

      let fukushimaCanWorkWeekend = true;
      const offCount = fukushimaOffCountsPerWeek[wsStr] || 0;
      if (offCount < 2) {
        const wcF = workCounts[fukushima?.id] || {};
        if ((wcF.weekEndWorked?.[wsStr] || 0) >= 1) fukushimaCanWorkWeekend = false;
      }
      if (fukushimaCanWorkWeekend) assignPharm(fukushima, PATTERNS.AM);

      const wcH = workCounts[hattori?.id] || {};
      if ((wcH.saturdays || 0) + (wcH.sundays || 0) < 1) {
        assignPharm(hattori, PATTERNS.AM);
      }
    } else if (dow === 5) {
      // 金曜日 (鈴木は休み)
      assignPharm(fukushima, PATTERNS.AM);
      assignPharm(hattori, PATTERNS.FULL);
    } else {
      // 月〜木曜日
      assignPharm(suzuki, PATTERNS.FULL);
      
      // 服部は水・木・金の終日
      if (dow === 3 || dow === 4) {
        assignPharm(hattori, PATTERNS.FULL);
      }

      // 福島は週4〜5日なので、水曜を基本休みにして週5日を目指す（週末に出やすくする）
      const wcF = workCounts[fukushima?.id] || {};
      if (dow !== 3 && (wcF.weekly?.[weekNum] || 0) < 5) {
        assignPharm(fukushima, PATTERNS.AM);
      }
    }

    // 湯本の配置 (月8回目標、最大10回。同じ週の土日はどちらかのみ。服部または鈴木がいる日)
    if (yumoto) {
      const wcY = workCounts[yumoto.id] || {};
      // 週2回ペースで配置すると月8〜9回になる。最大10回でストップ。
      if ((wcY.weekly?.[weekNum] || 0) < 2 && (wcY.total || 0) < 10) {
        let yumotoCanWorkWeekend = true;
        if (dow === 0 || dow === 6) {
          const weekStartDt = new Date(dateStr + 'T00:00:00');
          weekStartDt.setDate(weekStartDt.getDate() - dow);
          const wsStr = `${weekStartDt.getFullYear()}-${String(weekStartDt.getMonth()+1).padStart(2,'0')}-${String(weekStartDt.getDate()).padStart(2,'0')}`;
          if ((wcY.weekEndWorked?.[wsStr] || 0) >= 1) yumotoCanWorkWeekend = false;
        }

        if (yumotoCanWorkWeekend) {
          // 今日、服部か鈴木がアサインされているか確認
          const hasPair = result.find(a => a.date === dateStr && (a.staff_id === hattori?.id || a.staff_id === suzuki?.id));
          if (hasPair) {
            assignPharm(yumoto, PATTERNS.PM_YUMOTO);
          }
        }
      }
    }

    // 薬剤師が不足している場合の警告のみ（村上やスポットワーカーは手動入力のみ）
    if (assignedPharm < reqPharm) {
      warnings.push(`${dateStr}: 薬剤師不足（${assignedPharm}/${reqPharm}）`);
    }

    // 未配置の薬剤師を休みに設定
    for (const staff of pharmacists) {
      if (!manualSet.has(`${staff.id}_${dateStr}`) && !result.find(a => a.staff_id === staff.id && a.date === dateStr)) {
        addAssignment(staff.id, dateStr, '所定休日', '');
      }
    }
    
    if (assignedOffice < 1) {
      warnings.push(`${dateStr}: 事務不足`);
    }
  }

  state.warnings = warnings;
  return result;
}

// ============================================================
// DB保存
// ============================================================
async function saveAssignments(yearMonth, assignments) {
  const { error: delError } = await supabase
    .from('ringo_shift_assignments')
    .delete()
    .eq('year_month', yearMonth);

  if (delError) {
    console.error('Error deleting old assignments:', delError);
    return false;
  }

  if (assignments.length === 0) return true;

  const insertData = assignments.map(a => ({
    year_month: yearMonth,
    staff_id: a.staff_id,
    date: a.date,
    attendance_type: a.attendance_type,
    work_pattern: a.work_pattern,
    is_manual_override: a.is_manual_override || false
  }));

  const { error: insError } = await supabase
    .from('ringo_shift_assignments')
    .insert(insertData);

  if (insError) {
    console.error('Error saving assignments:', insError);
    return false;
  }
  
  return true;
}

// ============================================================
// ガントチャート描画
// ============================================================
function renderGantt() {
  const daysInMonth = new Date(state.currentYear, state.currentMonth + 1, 0).getDate();
  const today = new Date();
  const todayStr = formatDate(today);
  const dayNames = ['日', '月', '火', '水', '木', '金', '土'];

  document.getElementById('gantt-placeholder').style.display = 'none';
  document.getElementById('gantt-table').style.display = 'table';

  // ヘッダー
  const thead = document.getElementById('gantt-head');
  let headHtml = '<tr><th class="staff-name">スタッフ</th><th class="gantt-summary-col">集計</th>';
  for (let d = 1; d <= daysInMonth; d++) {
    const dt = new Date(state.currentYear, state.currentMonth, d);
    const dow = dt.getDay();
    const dateStr = formatDate(dt);
    const isHoliday = state.holidays[dateStr];
    const isSunday = dow === 0;
    const cls = [
      dateStr === todayStr && 'is-today',
      isSunday && 'is-sunday',
      dow === 6 && 'is-saturday',
      isHoliday && 'is-holiday',
    ].filter(Boolean).join(' ');
    const title = isHoliday ? ` title="${isHoliday}"` : '';
    headHtml += `<th class="${cls}"${title}>${d}<br><span style="font-size:0.55rem">${dayNames[dow]}</span></th>`;
  }
  thead.innerHTML = headHtml + '</tr>';

  // ボディ
  const tbody = document.getElementById('gantt-body');
  let bodyHtml = '';
  // display_order 順で表示
  const sortedStaff = [...state.staffList].filter(s => s.is_active).sort((a, b) => a.display_order - b.display_order);

  // 集計欄の色分け用定数
  const ym = getCurrentYearMonth();

  // 薬剤師グループの最終インデックスを検出（roleがpharmacistの最後の行）
  let lastPharmacistIdx = -1;
  sortedStaff.forEach((s, i) => {
    if (s.role === 'pharmacist') lastPharmacistIdx = i;
  });

  for (let idx = 0; idx < sortedStaff.length; idx++) {
    const staff = sortedStaff[idx];
    // 薬剤師グループの最終行に境界線クラスを付与
    const trClass = (idx === lastPharmacistIdx) ? ' class="is-group-divider"' : '';
    bodyHtml += `<tr${trClass} data-staff-name="${escapeHtml(staff.name)}"><td class="staff-name">${escapeHtml(staff.name)}</td>`;
    // スタッフ名の右横に集計列
    const staffAssigns = state.assignments.filter(a => a.staff_id === staff.id);
    const workCount = staffAssigns.filter(a => a.work_pattern && a.work_pattern !== '').length;
    const restCount = staffAssigns.filter(a => !a.work_pattern || a.work_pattern === '').length;
    const sn = staff.name;

    // 表示値：基本は出勤日数
    let summaryLabel = `${workCount}日`;
    if (staff.staff_type === 'external') {
      summaryLabel = '-';
    }

    // 色分け：スタッフの勤務条件（work_conditions）で判定
    let cellColor = ''; 
    const cond = staff.work_conditions || {};

    if (cond.max_days_per_month && workCount > cond.max_days_per_month) {
      cellColor = 'ng';
    } else if (cond.target_days_per_month && workCount > cond.target_days_per_month) {
      cellColor = 'warn';
    } else if (cond.target_days_per_month && workCount < cond.target_days_per_month) {
      cellColor = 'warn'; // 目標日数に届いていない場合も警告色
    }

    let ngStyle = '';
    if (cellColor === 'ng') ngStyle = 'background:#fee2e2;color:#dc2626;';
    else if (cellColor === 'warn') ngStyle = 'background:#fef9c3;color:#a16207;';
    bodyHtml += `<td class="gantt-summary-col" style="text-align:center;font-weight:700;font-size:0.75rem;${ngStyle}">${summaryLabel}</td>`;
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${state.currentYear}-${String(state.currentMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const dt = new Date(state.currentYear, state.currentMonth, d);
      const isSunday = dt.getDay() === 0;
      const isEbisuClosed = isSunday;

      const assign = state.assignments.find(a => a.staff_id === staff.id && a.date === dateStr);
      const pattern = assign?.work_pattern || '';
      const attendance = assign?.attendance_type || '平日';
      const isManual = assign?.is_manual_override || false;

      // 希望休チェック → 種類別ストライプクラス付与
      const request = state.requests.find(r => r.staff_id === staff.id && r.date === dateStr);

      let cellContent = '';
      let cellClass = 'day-cell';

      // 希望があればストライプクラス付与
      if (request) {
        if (request.is_virtual) {
          cellClass += ' bg-stripe-virtual';
        } else if (REQUEST_TYPE_CSS[request.request_type]) {
          cellClass += ` ${REQUEST_TYPE_CSS[request.request_type]}`;
        }
      }

      if (staff.staff_type === 'external') {
        // 外部スタッフ：クリック不可、空セル
        cellClass += ' is-external';
      }

      if (isManual) cellClass += ' is-manual';

      if (pattern && PATTERN_CSS[pattern]) {
        const cssClass = PATTERN_CSS[pattern];
        const label = PATTERN_LABEL[pattern] || pattern;
        cellContent = `<div class="pattern-marker ${cssClass}">${label}</div>`;
      } else if (pattern) {
        // 特殊パターン（りんご、出張等）
        cellContent = `<div class="pattern-marker pattern-marker--special">${escapeHtml(pattern.substring(0, 2))}</div>`;
      } else if (attendance === '所定休日' || attendance === '法定休日') {
        const isExplicitOff = isManual || (request && !CSV_WEEKDAY_REQUEST_TYPES.includes(request.request_type));
        if (isExplicitOff) {
          cellContent = `<div class="pattern-marker pattern-marker--off">休</div>`;
        }
      }

      // ストライプがあればdata属性にリクエスト情報を埋め込む
      let requestAttrs = '';
      if (request && REQUEST_TYPE_CSS[request.request_type]) {
        requestAttrs = ` data-request-type="${request.request_type}" data-request-note="${escapeHtml(request.note || '')}"`;
      }

      bodyHtml += `<td class="${cellClass}" data-staff="${staff.id}" data-date="${dateStr}"${requestAttrs}>${cellContent}</td>`;
    }
    bodyHtml += '</tr>';
  }
  tbody.innerHTML = bodyHtml;

  // フッター（充足集計）
  renderGanttFooter(daysInMonth, sortedStaff);

  // セルクリックイベント
  tbody.querySelectorAll('.day-cell').forEach(cell => {
    cell.addEventListener('click', (e) => {
      const staffId = cell.dataset.staff;
      const staff = state.staffList.find(s => s.id === staffId);
      if (staff?.staff_type === 'external') return;
      openCellEditor(cell, staff, cell.dataset.date);
    });
  });

  // ストライプセル：ホバーツールチップ（REQUEST_TYPE_LABEL / REQUEST_TYPE_ICON を使用）
  const tooltip = document.getElementById('stripe-tooltip');
  const tooltipType = document.getElementById('stripe-tooltip-type');
  const tooltipNote = document.getElementById('stripe-tooltip-note');

  tbody.querySelectorAll('[data-request-type]').forEach(cell => {
    cell.addEventListener('mouseenter', () => {
      const type = cell.dataset.requestType;
      const note = cell.dataset.requestNote || '';
      tooltipType.textContent = `${REQUEST_TYPE_ICON[type] || ''} ${REQUEST_TYPE_LABEL[type] || type}`;
      tooltipNote.textContent = note;
      tooltip.style.display = 'block';
    });
    cell.addEventListener('mousemove', (e) => {
      const x = e.clientX + 14;
      const y = e.clientY - 10;
      // 画面端に出ないよう調整
      const tw = tooltip.offsetWidth;
      const th = tooltip.offsetHeight;
      tooltip.style.left = (x + tw > window.innerWidth ? e.clientX - tw - 10 : x) + 'px';
      tooltip.style.top = (y + th > window.innerHeight ? e.clientY - th - 10 : y) + 'px';
    });
    cell.addEventListener('mouseleave', () => {
      tooltip.style.display = 'none';
    });
  });
}

function renderGanttFooter(daysInMonth, sortedStaff) {
  const tfoot = document.getElementById('gantt-foot');
  let summaryRow = '<td class="staff-name" style="font-size:0.75rem;">出勤数</td>';

  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${state.currentYear}-${String(state.currentMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const dt = new Date(state.currentYear, state.currentMonth, d);

    const todayAssigns = state.assignments.filter(a => a.date === dateStr && a.work_pattern);
    let pharmCount = 0, officeCount = 0;

    todayAssigns.forEach(a => {
      const staff = state.staffList.find(s => s.id === a.staff_id);
      if (!staff) return;
      if (staff.role === 'pharmacist') pharmCount++;
      else if (staff.role === 'office') officeCount++;
    });

    function getSpan(val, role) {
      if (val === 0) return `<span class="count-ng">${role}${val}</span>`;
      if (role === '薬' && val === 1) return `<span class="count-warn">${role}${val}</span>`;
      return `${role}${val}`;
    }

    let cellClass = '';
    if (pharmCount === 0 || officeCount === 0) {
      cellClass = 'cell-ng';
    } else if (pharmCount === 1) {
      cellClass = 'cell-warn';
    }

    summaryRow += `<td class="${cellClass}">${getSpan(pharmCount, '薬')}/${getSpan(officeCount, '事')}</td>`;
  }

  const summaryCol = '<td class="gantt-summary-col"></td>';
  summaryRow = summaryRow.replace(/(<td class="staff-name"[^>]*>[^<]*<\/td>)/, '$1' + summaryCol);
  tfoot.innerHTML = `<tr>${summaryRow}</tr>`;
}

// ============================================================
// 警告表示
// ============================================================
function renderWarnings() {
  const panel = document.getElementById('warnings-panel');
  if (state.warnings.length === 0) {
    panel.style.display = 'none';
    return;
  }
  panel.style.display = 'block';
  document.getElementById('warnings-count').textContent = `${state.warnings.length}件の警告`;
  document.getElementById('warnings-list').innerHTML = state.warnings.map(w => `<li>${escapeHtml(w)}</li>`).join('');
}

// ============================================================
// セル編集ドロップダウン
// ============================================================
function openCellEditor(cell, staff, dateStr) {
  const editor = document.getElementById('cell-editor');
  const patterns = getAvailablePatterns(staff);
  const currentAssign = state.assignments.find(a => a.staff_id === staff.id && a.date === dateStr);
  const currentPattern = currentAssign?.work_pattern || '';
  const currentAttendance = currentAssign?.attendance_type || '平日';

  const dt = new Date(dateStr + 'T00:00:00');
  document.getElementById('cell-editor-title').textContent =
    `${staff.name} - ${formatDateLabel(dt)}`;

  const optionsHtml = [];
  // 所定休日オプション
  optionsHtml.push(buildEditorOption('所定休日', '', currentAttendance === '所定休日' && currentPattern === ''));

  // 平日+空欄（勤務なし）
  optionsHtml.push(buildEditorOption('平日（勤務なし）', '__empty__', currentAttendance === '平日' && currentPattern === ''));

  // 各パターン
  for (const p of patterns) {
    if (p === '') continue;
    const isActive = currentPattern === p;
    optionsHtml.push(buildEditorOption(p, p, isActive));
  }

  document.getElementById('cell-editor-options').innerHTML = optionsHtml.join('');

  // 位置決め
  const rect = cell.getBoundingClientRect();
  editor.style.left = `${rect.left}px`;
  editor.style.top = `${rect.bottom + 4}px`;
  // 画面外にはみ出す場合の補正
  editor.style.display = 'block';
  const editorRect = editor.getBoundingClientRect();
  if (editorRect.right > window.innerWidth) {
    editor.style.left = `${window.innerWidth - editorRect.width - 8}px`;
  }
  if (editorRect.bottom > window.innerHeight) {
    editor.style.top = `${rect.top - editorRect.height - 4}px`;
  }

  // オプションクリック
  editor.querySelectorAll('.cell-editor__option').forEach(opt => {
    opt.addEventListener('click', async () => {
      const value = opt.dataset.value;
      let newAttendance, newPattern;
      if (value === '所定休日') {
        newAttendance = '所定休日';
        newPattern = '';
      } else if (value === '__empty__') {
        newAttendance = '平日';
        newPattern = '';
      } else {
        newAttendance = '平日';
        newPattern = value;
      }

      // ローカル更新
      const idx = state.assignments.findIndex(a => a.staff_id === staff.id && a.date === dateStr);
      if (idx >= 0) {
        state.assignments[idx].attendance_type = newAttendance;
        state.assignments[idx].work_pattern = newPattern;
        state.assignments[idx].is_manual_override = true;
      } else {
        state.assignments.push({
          year_month: getCurrentYearMonth(),
          staff_id: staff.id,
          date: dateStr,
          attendance_type: newAttendance,
          work_pattern: newPattern,
          is_manual_override: true,
        });
      }

      // DB更新
      try {
        const { error } = await supabase
          .from('ringo_shift_assignments')
          .upsert({
            year_month: getCurrentYearMonth(),
            staff_id: staff.id,
            date: dateStr,
            attendance_type: newAttendance,
            work_pattern: newPattern,
            is_manual_override: true
          }, { onConflict: 'staff_id, date' });

        if (error) throw error;
        showToast('更新しました', 'success');
      } catch (err) {
        console.error(err);
        showToast('更新に失敗', 'error');
      }

      editor.style.display = 'none';
      // 手動変更後にスコアを再計算して内訳も更新
      const yearMonthNow = getCurrentYearMonth();
      const { score: newScore, breakdown: newBreakdown } = scoreShifts(state.assignments, yearMonthNow);
      state.lastScore = newScore;
      state.lastBreakdown = newBreakdown;
      renderGantt();
      renderConditionsCheck();
      pushHistory();
    });
  });
}

function buildEditorOption(label, value, isActive) {
  let markerHtml = '';
  if (PATTERN_CSS[label]) {
    markerHtml = `<div class="pattern-marker ${PATTERN_CSS[label]}" style="width:20px;height:20px;font-size:0.45rem;margin:0;">${PATTERN_LABEL[label] || label.substring(0,2)}</div>`;
  } else if (value === '所定休日') {
    markerHtml = `<div class="pattern-marker pattern-marker--off" style="width:20px;height:20px;font-size:0.45rem;margin:0;">休</div>`;
  } else {
    markerHtml = `<div class="pattern-marker" style="width:20px;height:20px;background:transparent;border:1px solid #ccc;margin:0;"></div>`;
  }
  const displayLabel = label.replace(/^[○〇☆]/, '');
  return `<div class="cell-editor__option ${isActive ? 'is-active' : ''}" data-value="${escapeHtml(value || label)}">
    ${markerHtml}
    ${escapeHtml(displayLabel)}
  </div>`;
}

// ============================================================
// CSV出力（Shift-JIS）
// ============================================================
function handleCSVExport() {
  const yearMonth = getCurrentYearMonth();
  const [year, month] = yearMonth.split('-').map(Number);
  const daysInMonth = new Date(year, month, 0).getDate();

  // スタッフを employee_no 順にソート
  const sortedStaff = [...state.staffList]
    .filter(s => s.is_active)
    .sort((a, b) => (a.employee_no || '99').localeCompare(b.employee_no || '99'));

  // ヘッダー行
  const headers = ['従業員番号', '苗字', '名前', '日付', '勤怠区分', '勤務パターン',
    '開始時刻', '終了時刻', '休憩開始時刻1', '休憩終了時刻1',
    '休憩開始時刻2', '休憩終了時刻2', '休憩開始時刻3', '休憩終了時刻3'];

  const rows = [headers.join(',')];

  for (const staff of sortedStaff) {
    // 名前を姓名に分割
    const nameParts = staff.name.replace(/\s+/g, '　').split('　');
    const lastName = nameParts[0] || staff.name;
    const firstName = nameParts.slice(1).join('') || '';

    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const assign = state.assignments.find(a => a.staff_id === staff.id && a.date === dateStr);
      let attendance = assign?.attendance_type || '平日';
      const pattern = assign?.work_pattern || '';

      // CSV出力時のみ、CSV_WEEKDAY_REQUEST_TYPES以外の希望が出ている日は「所定休日」として出力
      if (attendance === '所定休日') {
        const isHolidayRequest = state.requests.some(r => r.staff_id === staff.id && r.date === dateStr && !CSV_WEEKDAY_REQUEST_TYPES.includes(r.request_type));
        if (!isHolidayRequest) {
          attendance = '平日';
        }
      }

      // 日付フォーマット: YYYY/M/D
      const csvDate = `${year}/${month}/${d}`;
      const row = [
        staff.employee_no || '',
        lastName,
        firstName,
        csvDate,
        attendance,
        pattern,
        '', '', '', '', '', '', '', ''  // 時刻系は空欄
      ];
      rows.push(row.join(','));
    }
  }

  const csvContent = rows.join('\n');

  // Shift-JIS エンコード（TextEncoderを使えないのでUint8Arrayで手動変換）
  // ブラウザ側ではencoding.jsライブラリを使うか、UTF-8のままにするか
  // ここではシンプルにBlobでUTF-8出力し、ユーザーがExcelで開く際にShift-JISを選べるようにする
  // → 既存CSVがShift-JISなので、encoding-japanese ライブラリを使用
  downloadAsShiftJIS(csvContent, `シフト_${year}年${month}月.csv`);
}

async function downloadAsShiftJIS(text, filename) {
  // encoding-japanese CDN を動的ロード
  if (!window.Encoding) {
    await loadScript('https://cdn.jsdelivr.net/npm/encoding-japanese@2.2.0/encoding.min.js');
  }

  const unicodeArray = [];
  for (let i = 0; i < text.length; i++) {
    unicodeArray.push(text.charCodeAt(i));
  }
  const sjisArray = window.Encoding.convert(unicodeArray, {
    to: 'SJIS',
    from: 'UNICODE',
  });
  const uint8Array = new Uint8Array(sjisArray);
  const blob = new Blob([uint8Array], { type: 'application/octet-stream' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
  showToast('CSVを出力しました', 'success');
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

// ============================================================
// ユーティリティ
// ============================================================
function formatDate(dt) {
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast toast--${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

// ============================================================
// 過去勤務実績パネル
// ============================================================
async function loadHistoryData() {
  // 直近6ヶ月分の year_month リストを生成（今月含む）
  const months = [];
  for (let i = 5; i >= 0; i--) {
    let y = state.currentYear;
    let m = state.currentMonth - i;
    while (m < 0) { m += 12; y--; }
    while (m > 11) { m -= 12; y++; }
    months.push(`${y}-${String(m + 1).padStart(2, '0')}`);
  }

  const { data, error } = await supabase
    .from('ringo_shift_assignments')
    .select('year_month, staff_id, attendance_type, work_pattern')
    .in('year_month', months);
  if (error) { console.error(error); return { months, byStaffMonth: {} }; }

  // [staffId][yearMonth] = 出勤日数
  const byStaffMonth = {};
  (data || []).forEach(a => {
    if (!a.work_pattern || a.work_pattern === '') return; // 休日は除外
    if (!byStaffMonth[a.staff_id]) byStaffMonth[a.staff_id] = {};
    byStaffMonth[a.staff_id][a.year_month] = (byStaffMonth[a.staff_id][a.year_month] || 0) + 1;
  });

  return { months, byStaffMonth };
}

async function renderHistoryPanel() {
  const panel = document.getElementById('history-panel');
  const thead = document.getElementById('history-thead');
  const tbody = document.getElementById('history-tbody');
  const subtitle = document.getElementById('history-subtitle');
  const note = document.getElementById('history-note');
  if (!panel || !thead || !tbody) return;

  const { months, byStaffMonth } = await loadHistoryData();
  const currentYM = getCurrentYearMonth();
  const activeStaff = state.staffList.filter(s => s.is_active);

  // どの月にもデータがなければパネルを隠す
  const hasAnyData = Object.keys(byStaffMonth).length > 0;
  if (!hasAnyData) {
    panel.style.display = 'none';
    return;
  }
  panel.style.display = 'block';

  subtitle.textContent = `直近 ${months.length} ヶ月`;

  // ヘッダー行
  let headHtml = '<tr><th class="history-name">スタッフ</th>';
  months.forEach(ym => {
    const [y, m] = ym.split('-').map(Number);
    const isCurrent = ym === currentYM;
    const cls = isCurrent ? ' is-current-month' : '';
    headHtml += `<th class="${cls}">${m}月${isCurrent ? '（今月）' : ''}</th>`;
  });
  headHtml += '<th class="is-avg">過去平均</th></tr>';
  thead.innerHTML = headHtml;

  // 各スタッフ行
  let bodyHtml = '';
  activeStaff.forEach(staff => {
    const staffData = byStaffMonth[staff.id] || {};

    // 今月以外の過去月の平均を計算
    const pastMonths = months.filter(ym => ym !== currentYM);
    const pastValues = pastMonths.map(ym => staffData[ym]).filter(v => v !== undefined);
    const avg = pastValues.length > 0
      ? Math.round(pastValues.reduce((s, v) => s + v, 0) / pastValues.length * 10) / 10
      : null;

    bodyHtml += `<tr><td class="history-name">${escapeHtml(staff.name)}</td>`;
    months.forEach(ym => {
      const isCurrent = ym === currentYM;
      const tdCls = isCurrent ? ' is-current-month' : '';
      const val = staffData[ym];

      if (val === undefined) {
        bodyHtml += `<td class="${tdCls}"><span class="history-cell history-cell--none">-</span></td>`;
        return;
      }

      // ヒートマップ判定（平均との差）
      let heatCls = 'history-cell--normal';
      if (avg !== null && !isCurrent) {
        const diff = val - avg;
        if (diff >= 2) heatCls = 'history-cell--high';
        else if (diff >= 1) heatCls = 'history-cell--above';
        else if (diff <= -2) heatCls = 'history-cell--low';
        else if (diff <= -1) heatCls = 'history-cell--below';
      }

      bodyHtml += `<td class="${tdCls}"><span class="history-cell ${heatCls}">${val}日</span></td>`;
    });

    // 平均列
    const avgText = avg !== null ? `${avg}日` : '-';
    bodyHtml += `<td class="is-avg"><span class="history-cell history-cell--normal">${avgText}</span></td>`;
    bodyHtml += '</tr>';
  });
  tbody.innerHTML = bodyHtml;

  note.textContent = '色：紫 = 平均より多い / 赤 = 平均より少ない (今月列は比較除外)';
}

// ============================================================
// 条件チェックパネル（runAllChecksの結果を描画するだけ）
// ============================================================
function renderConditionsCheck() {
  const panel = document.getElementById('conditions-panel');
  const grid = document.getElementById('conditions-grid');
  if (!panel || !grid) return;
  if (!state.assignments || state.assignments.length === 0) {
    panel.style.display = 'none';
    grid.innerHTML = '';
    return;
  }
  panel.style.display = 'block';
  grid.innerHTML = '';

  const yearMonth = getCurrentYearMonth();
  const { globalItems, staffChecks } = runAllChecks(state.assignments, yearMonth);

  // 未達成サマリー収集用
  const summaryProblems = [];

  let currentSection = null;
  function createSection(icon, title) {
    const section = document.createElement('div');
    section.className = 'conditions-section';
    const titleEl = document.createElement('div');
    titleEl.className = 'conditions-section__title';
    titleEl.innerHTML = `<span class="conditions-section__title-icon">${icon}</span>${title}`;
    const sectionGrid = document.createElement('div');
    sectionGrid.className = 'conditions-section__grid';
    section.appendChild(titleEl);
    section.appendChild(sectionGrid);
    grid.appendChild(section);
    currentSection = sectionGrid;
  }

  // カード描画
  function appendCard(title, items) {
    const icons = { pass: '✅', fail: '❌', warn: '⚠️' };
    // 優先順位ソート（絶対 > 高 > 中 > 低 > なし）
    const rank = { '絶対': 1, '高': 2, '中': 3, '低': 4 };
    items.sort((a, b) => (rank[a.tag] || 99) - (rank[b.tag] || 99));

    const card = document.createElement('div');
    card.className = 'staff-conditions-card';
    card.setAttribute('data-target-staff', title);
    const titleEl = document.createElement('div');
    titleEl.className = 'staff-conditions-card__title';
    titleEl.textContent = title;
    const ul = document.createElement('ul');
    ul.className = 'staff-conditions-card__list';
    for (const { status, text, value, tag } of items) {
      const li = document.createElement('li');
      li.className = `condition-item condition-item--${status}`;
      const tagMap = { '絶対': 'absolute', '高': 'high', '中': 'mid', '低': 'low' };
      const tagClass = tag ? (tagMap[tag] || tag.toLowerCase()) : '';
      const tagHtml = tag ? `<span class="condition-item__tag condition-item__tag--${tagClass}">${tag}</span>` : '';
      li.innerHTML = `
        <span class="condition-item__icon">${icons[status]}</span>
        ${tagHtml}
        <span class="condition-item__text">${text}</span>
        <span class="condition-item__value">${value}</span>
      `;
      ul.appendChild(li);
      if (status === 'fail' || status === 'warn') {
        summaryProblems.push({ staff: title, status, tag, text, value });
      }
    }
    card.appendChild(titleEl);
    card.appendChild(ul);
    (currentSection || grid).appendChild(card);
  }

  // ===== 全体チェック（店舗充足・希望休） =====
  appendCard('店舗充足', globalItems.filter(i => i.id.startsWith('G1')));
  appendCard('希望休', globalItems.filter(i => i.id === 'G2'));

  // ===== 薬剤師セクション =====
  const pharmStaff = Object.entries(staffChecks).filter(([, v]) => v.section === '薬剤師');
  if (pharmStaff.length > 0) {
    createSection('💊', '薬剤師');
    for (const [, check] of pharmStaff) {
      appendCard(check.name, check.items);
    }
  }

  // ===== 事務セクション =====
  const officeStaffChecks = Object.entries(staffChecks).filter(([, v]) => v.section === '事務');
  if (officeStaffChecks.length > 0) {
    createSection('📝', '事務');
    for (const [, check] of officeStaffChecks) {
      appendCard(check.name, check.items);
    }
  }

  lucide.createIcons();

  // ヘッダーバッジ更新
  const badge = document.getElementById('conditions-header-badge');
  if (badge) {
    const failCount = summaryProblems.filter(p => p.status === 'fail').length;
    const warnCount = summaryProblems.filter(p => p.status === 'warn').length;
    if (failCount === 0 && warnCount === 0) {
      badge.textContent = '✅ 全クリア';
      badge.className = 'conditions-header-badge conditions-header-badge--ok';
    } else {
      const parts = [];
      if (failCount > 0) parts.push(`❌ ${failCount}件`);
      if (warnCount > 0) parts.push(`⚠️ ${warnCount}件`);
      badge.textContent = parts.join('　');
      badge.className = 'conditions-header-badge conditions-header-badge--ng';
    }
  }

  // ===== ホバー時のハイライト処理 =====
  grid.addEventListener('mouseover', (e) => {
    const item = e.target.closest('.condition-item');
    if (!item) return;
    const card = e.target.closest('.staff-conditions-card');
    if (!card) return;
    
    const isNg = item.classList.contains('condition-item--fail') || item.classList.contains('condition-item--warn');
    if (!isNg) return;

    const staffName = card.getAttribute('data-target-staff');

    // 全体カードの「希望休」エラー時にピンポイントでハイライト
    if (staffName === '希望休') {
      const offRequests = state.requests.filter(r => r.request_type === 'off');
      for (const req of offRequests) {
        const assign = state.assignments.find(a => a.staff_id === req.staff_id && a.date === req.date);
        if (assign && assign.work_pattern && assign.work_pattern !== '') {
          // 該当スタッフ×該当日のセルを検索してハイライト
          const cell = document.querySelector(`#gantt-body td[data-staff="${req.staff_id}"][data-date="${req.date}"]`);
          if (cell) cell.classList.add('is-hover-highlight-cell');
        }
      }
    }
  });

  grid.addEventListener('mouseout', (e) => {
    // どの要素から外れたかに関わらず、セルハイライトを全削除
    document.querySelectorAll('.is-hover-highlight-cell').forEach(c => c.classList.remove('is-hover-highlight-cell'));
  });
}

