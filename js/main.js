/**
 * シフト希望 メイン画面ロジック
 * - ガントチャート（PC）：ドラッグ→モーダル確認→登録
 * - カレンダー（スマホ）
 * - 祝日表示
 * - その他リスト
 * - 最近の変更通知
 */

import { supabase } from './supabase-config.js';

// ============================================================
// スタッフカラーパレット（個人別色分け・カレンダー表示用）
// ============================================================
const STAFF_COLOR_PALETTE = [
  { bg: '#e0e7ff', text: '#4338ca' }, // indigo
  { bg: '#d1fae5', text: '#059669' }, // emerald
  { bg: '#fee2e2', text: '#dc2626' }, // rose
  { bg: '#fef3c7', text: '#d97706' }, // amber
  { bg: '#e0f2fe', text: '#0284c7' }, // sky
  { bg: '#ede9fe', text: '#7c3aed' }, // violet
  { bg: '#fce7f3', text: '#db2777' }, // pink
  { bg: '#ffedd5', text: '#ea580c' }, // orange
  { bg: '#cffafe', text: '#0e7490' }, // cyan
  { bg: '#ecfccb', text: '#4d7c0f' }, // lime
];

const STAFF_SPECIFIC_COLORS = {
  '鈴木': '#F35F8C',   // ピンク (オオギの小野色)
  '村上': '#E73B3B',   // 赤 (オオギの村上色)
  '福島': '#2ECC87',   // 緑 (オオギの徳永色)
  '湯本': '#47B2F7',   // 青 (オオギの木庭色)
  '服部': '#FDC02D',   // オレンジ (オオギの中村色)
  '堀口': '#B38BDC',   // 紫 (オオギの本庄色)
  '財津': '#948078',   // 茶色 (オオギの諫早色)
  '野口': '#00B8D9',   // ターコイズ
  '小野寺': '#6554C0', // インディゴ
  '笠原': '#FF5630',   // ディープオレンジ
  '山口': '#82C91E'    // ライムグリーン
};

function getStaffColor(staffId) {
  const staff = state.staffList.find(s => s.id === staffId);
  if (staff) {
    // 1. localStorageからのカスタムカラーを優先
    const customColors = JSON.parse(localStorage.getItem('staffColors') || '{}');
    if (customColors[staff.name]) {
      return { bg: customColors[staff.name], text: '#ffffff' };
    }

    // 2. 固定カラー定義をチェック
    for (const [key, hex] of Object.entries(STAFF_SPECIFIC_COLORS)) {
      if (staff.name.includes(key)) {
        return { bg: hex, text: '#ffffff' };
      }
    }
  }
  // 3. デフォルトのパステルカラーパレット
  const idx = state.staffList.findIndex(s => s.id === staffId);
  return STAFF_COLOR_PALETTE[Math.max(0, idx) % STAFF_COLOR_PALETTE.length];
}

// ============================================================
// 祝日データ（日本の祝日）
// ============================================================
function getHolidays(year) {
  // 固定祝日
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

  // 春分の日（概算）
  const shunbun = Math.floor(20.8431 + 0.242194 * (year - 1980) - Math.floor((year - 1980) / 4));
  holidays[`${year}-03-${String(shunbun).padStart(2, '0')}`] = '春分の日';

  // 秋分の日（概算）
  const shubun = Math.floor(23.2488 + 0.242194 * (year - 1980) - Math.floor((year - 1980) / 4));
  holidays[`${year}-09-${String(shubun).padStart(2, '0')}`] = '秋分の日';

  // ハッピーマンデー
  const happyMonday = (m, week) => {
    let d = new Date(year, m - 1, 1);
    let count = 0;
    while (count < week) {
      if (d.getDay() === 1) count++;
      if (count < week) d.setDate(d.getDate() + 1);
    }
    return d;
  };
  const hm = [
    [1, 2, '成人の日'], [7, 3, '海の日'], [9, 3, '敬老の日'], [10, 2, 'スポーツの日'],
  ];
  hm.forEach(([m, week, name]) => {
    const d = happyMonday(m, week);
    holidays[formatDate(d)] = name;
  });

  // 振替休日：祝日が日曜なら翌月曜
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
  requests: [],
  currentYear: new Date().getFullYear(),
  currentMonth: new Date().getMonth(),
  selectedStaffId: localStorage.getItem('selectedStaffId') || '',
  holidays: {},
  editingDates: [],
  editingStaffId: null,
  editingRequest: null,
  effectiveRequests: [], // DBの希望休 + 固定休の仮想データをマージしたもの
};

// ============================================================
// 初期化
// ============================================================
document.addEventListener('DOMContentLoaded', async () => {
  bindEvents();
  await loadStaffList();
  updateHolidays();
  renderMonth();
  await loadRequests();
});

function updateHolidays() {
  state.holidays = {
    ...getHolidays(state.currentYear),
    ...getHolidays(state.currentYear - 1),
    ...getHolidays(state.currentYear + 1),
  };
}

// ============================================================
// イベントバインド
// ============================================================
function bindEvents() {
  document.getElementById('prev-month').addEventListener('click', () => changeMonth(-1));
  document.getElementById('next-month').addEventListener('click', () => changeMonth(1));
  document.getElementById('today-month-btn').addEventListener('click', () => {
    const now = new Date();
    state.currentYear = now.getFullYear();
    state.currentMonth = now.getMonth();
    updateHolidays();
    renderMonth();
    loadRequests();
  });

  // 月ラベルをクリックすると月選択モーダルを開く
  document.getElementById('month-label').addEventListener('click', openMonthPicker);
  document.getElementById('picker-cancel').addEventListener('click', closeMonthPicker);
  document.getElementById('month-picker-overlay').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeMonthPicker();
  });
  document.getElementById('picker-prev-year').addEventListener('click', () => {
    pickerYear--;
    renderMonthPickerGrid();
  });
  document.getElementById('picker-next-year').addEventListener('click', () => {
    pickerYear++;
    renderMonthPickerGrid();
  });

  document.getElementById('modal-cancel').addEventListener('click', closeModal);
  document.getElementById('modal-overlay').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeModal();
  });
  document.getElementById('modal-save').addEventListener('click', handleModalSave);
  document.getElementById('modal-delete').addEventListener('click', handleModalDelete);

  // ボトムシート
  document.getElementById('bottom-sheet-close').addEventListener('click', closeBottomSheet);
  document.getElementById('bottom-sheet-overlay').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeBottomSheet();
  });

  // FAB：今日の日付でモーダルを開く
  document.getElementById('fab-add').addEventListener('click', () => {
    openModal(state.selectedStaffId, [formatDate(new Date())]);
  });

  // 画面回転・リサイズ対応
  window.addEventListener('resize', updateFabVisibility);

  setupGanttDrag();
  setupGanttHover();
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
      updateHolidays();
      renderMonth();
      loadRequests();
      closeMonthPicker();
    });
  });
}

// ============================================================
// ガントチャート ドラッグ選択 → モーダル
// ============================================================
function setupGanttDrag() {
  const ganttTable = document.getElementById('gantt-table');
  const tbody = document.getElementById('gantt-body');
  let isDragging = false;
  let dragStaffId = null;
  let dragCells = [];
  let rowCells = [];
  let startIndex = -1;

  function clearHighlight() {
    ganttTable.querySelectorAll('.drag-highlight').forEach(c => c.classList.remove('drag-highlight'));
  }

  tbody.addEventListener('mousedown', (e) => {
    const cell = e.target.closest('.day-cell');
    if (!cell) return;
    e.preventDefault();
    isDragging = true;
    dragStaffId = cell.dataset.staff;
    
    // 行内のセル一覧と開始インデックスを記憶
    const tr = cell.closest('tr');
    rowCells = Array.from(tr.querySelectorAll('.day-cell'));
    startIndex = rowCells.indexOf(cell);

    dragCells = [cell];
    ganttTable.classList.add('is-dragging');
    clearHighlight();
    cell.classList.add('drag-highlight');
  });

  tbody.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    const cell = e.target.closest('.day-cell');
    if (!cell || cell.dataset.staff !== dragStaffId) return;

    const currentIndex = rowCells.indexOf(cell);
    if (currentIndex === -1) return;

    // 開始セルと現在のセルの間の要素を取得（前／後どちらにドラッグしても対応）
    const minIdx = Math.min(startIndex, currentIndex);
    const maxIdx = Math.max(startIndex, currentIndex);

    // 範囲内のセルで配列を更新
    dragCells = rowCells.slice(minIdx, maxIdx + 1);

    // 一旦全クリアして再度ハイライト
    clearHighlight();
    dragCells.forEach(c => c.classList.add('drag-highlight'));
  });

  document.addEventListener('mouseup', () => {
    if (!isDragging) return;
    isDragging = false;
    ganttTable.classList.remove('is-dragging');
    clearHighlight();
    if (dragCells.length === 0) return;

    let dates = dragCells.map(c => c.dataset.date);
    const staffId = dragStaffId;
    
    // 単回クリック時に、クリック要素がロングバーの一部の場合、同じグループ全体を選択する
    if (dragCells.length === 1) {
      const marker = dragCells[0].querySelector('.marker');
      if (marker) {
        const req = state.effectiveRequests.find(r => r.staff_id === staffId && r.date === dates[0]);
        // 固定休（is_virtual）の場合はグループ選択せず単日選択とする
        if (req && !req.is_virtual) {
          dates = getGroupDates(staffId, dates[0]);
        }
      }
    }
    
    // 初期化
    dragCells = [];
    dragStaffId = null;
    rowCells = [];
    startIndex = -1;
    
    openModal(staffId, dates);
  });
}

// ============================================================
// ガントチャート ホバー（クロスハイライト）
// ============================================================
function setupGanttHover() {
  const ganttTable = document.getElementById('gantt-table');
  const tbody = document.getElementById('gantt-body');

  function clearCrossHighlight() {
    ganttTable.querySelectorAll('.cross-highlight').forEach(c => c.classList.remove('cross-highlight'));
  }

  tbody.addEventListener('mouseover', (e) => {
    if (ganttTable.classList.contains('is-dragging')) return;
    clearCrossHighlight();
    
    const cell = e.target.closest('td');
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

  tbody.addEventListener('mouseleave', () => {
    clearCrossHighlight();
  });
}

// ============================================================
// データ取得
// ============================================================
async function loadStaffList() {
  // 元のオオギ薬局DBから取得する代わりに、りんご薬局の指定7名をハードコード
  state.staffList = [
    { id: 'ringo-1', name: '鈴木 怜那', role: 'pharmacist', display_order: 1 },
    { id: 'ringo-3', name: '福島 真依子', role: 'pharmacist', display_order: 2 },
    { id: 'ringo-4', name: '湯本 有美子', role: 'pharmacist', display_order: 3 },
    { id: 'ringo-5', name: '服部 孝子', role: 'pharmacist', display_order: 4 },
    { id: 'ringo-101', name: '野口 由美子', role: 'office', display_order: 5 },
    { id: 'ringo-102', name: '小野寺 美桜子', role: 'office', display_order: 6 },
    { id: 'ringo-103', name: '笠原 若菜', role: 'office', display_order: 7 }
  ];
}

async function loadRequests() {
  // UI調整完了まではDBから取得せず、現在のメモリ上の状態を維持する（初期は空）
  // 実際には何もせずに描画処理へ進む
  if (!state.requests) state.requests = [];
  
  buildEffectiveRequests();
  renderGantt();
  renderCalendar();
  renderOtherList();
}

function buildEffectiveRequests() {
  const effective = [...state.requests];
  const realReqMap = new Set();
  effective.forEach(r => realReqMap.add(`${r.staff_id}_${r.date}`));

  // 取得済みの期間（3ヶ月分）に対して固定休みを合成
  const startDateObj = new Date(state.currentYear, state.currentMonth - 1, 1);
  const endDateObj = new Date(state.currentYear, state.currentMonth + 2, 0);

  const fixedOffRules = {};
  state.staffList.forEach(s => {
    if (s.name.includes('野口'))     fixedOffRules[s.id] = [0, 1];       // 日(0)・月(1)休み
    else if (s.name.includes('小野寺')) fixedOffRules[s.id] = [3, 6];    // 水(3)・土(6)休み
    else if (s.name.includes('笠原'))   fixedOffRules[s.id] = [2, 3, 4, 5, 6]; // 火(2)〜土(6)休み（日月のみ勤務）
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
            note: '',
            is_virtual: true
          });
        }
      }
    }
  }

  effective.sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    return a.staff_id.localeCompare(b.staff_id);
  });

  state.effectiveRequests = effective;
}

// ============================================================
// 月の切り替え
// ============================================================
function changeMonth(delta) {
  closeBottomSheet();
  state.currentMonth += delta;
  if (state.currentMonth > 11) { state.currentMonth = 0; state.currentYear++; }
  else if (state.currentMonth < 0) { state.currentMonth = 11; state.currentYear--; }
  updateHolidays();
  renderMonth();
  loadRequests();
}

function renderMonth() {
  document.getElementById('month-label').textContent = `${state.currentYear}年 ${state.currentMonth + 1}月`;

  // 「今月」ボタン：当月以外を表示中のときだけ表示する
  const now = new Date();
  const isCurrentMonth = (state.currentYear === now.getFullYear() && state.currentMonth === now.getMonth());
  document.getElementById('today-month-btn').style.display = isCurrentMonth ? 'none' : 'inline-block';
}


// ============================================================
// ガントチャート描画（PC）
// ============================================================
function renderGantt() {
  const daysInMonth = new Date(state.currentYear, state.currentMonth + 1, 0).getDate();
  const today = new Date();
  const todayStr = formatDate(today);
  const dayNames = ['日', '月', '火', '水', '木', '金', '土'];

  const thead = document.getElementById('gantt-head');
  let headHtml = '<tr><th class="staff-name">スタッフ</th>';
  for (let d = 1; d <= daysInMonth; d++) {
    const dt = new Date(state.currentYear, state.currentMonth, d);
    const dow = dt.getDay();
    const dateStr = formatDate(dt);
    const isHoliday = state.holidays[dateStr];
    const cls = [
      dateStr === todayStr && 'is-today',
      dow === 0 && 'is-sunday',
      dow === 6 && 'is-saturday',
      isHoliday && 'is-holiday',
    ].filter(Boolean).join(' ');
    const title = isHoliday ? ` title="${isHoliday}"` : '';
    headHtml += `<th class="${cls}"${title} data-date="${dateStr}">${d}<br><span style="font-size:0.6rem">${dayNames[dow]}</span></th>`;
  }
  thead.innerHTML = headHtml + '</tr>';

  const tbody = document.getElementById('gantt-body');
  let bodyHtml = '';
  state.staffList.forEach(staff => {
    bodyHtml += `<tr><td class="staff-name">${escapeHtml(staff.name)}</td>`;
    // 1ヶ月分の予定を配列化して連続判定を行いやすくする
    const staffReqs = [];
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${state.currentYear}-${String(state.currentMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      staffReqs.push({
        dateStr,
        req: state.effectiveRequests.find(r => r.staff_id === staff.id && r.date === dateStr)
      });
    }

    let currentGroupId = null;
    let currentType = null;
    let currentNote = null;

    for (let d = 0; d < daysInMonth; d++) {
      const { dateStr, req } = staffReqs[d];
      let isBarStart = false, isBarMiddle = false, isBarEnd = false;
      let groupId = null;

      if (req) {
        if (currentType === req.request_type && currentNote === req.note) {
          // 前日と同じリクエストが継続
        } else {
          // 新しいグループの開始
          currentGroupId = req.id || dateStr;
          currentType = req.request_type;
          currentNote = req.note;
        }
        groupId = currentGroupId;

        // 前後の予定を取得して連続性を判定
        const nextReq = staffReqs[d + 1]?.req;
        const hasNext = nextReq && nextReq.request_type === currentType && nextReq.note === currentNote;
        const prevReq = staffReqs[d - 1]?.req;
        const hasPrev = prevReq && prevReq.request_type === currentType && prevReq.note === currentNote;

        if (!hasPrev && hasNext) isBarStart = true;
        if (hasPrev && hasNext) isBarMiddle = true;
        if (hasPrev && !hasNext) isBarEnd = true;
      } else {
        currentGroupId = null;
        currentType = null;
        currentNote = null;
      }

      let cell = '';
      if (req) {
        let cls, label;
        switch (req.request_type) {
          case 'off': cls = 'marker--off'; label = '休'; break;
          default: cls = 'marker--other'; label = 'コ'; break;
        }
        
        // ロングバー用のクラスとデータ属性
        let extraCls = '';
        if (isBarStart) extraCls = ' is-bar-start';
        else if (isBarMiddle) extraCls = ' is-bar-middle';
        else if (isBarEnd) extraCls = ' is-bar-end';
        if (req.is_virtual) extraCls += ' is-virtual';

        cell = `<div class="marker ${cls}${extraCls}" data-group-id="${groupId}" title="${escapeHtml(req.note || '')}">${label}</div>`;
      }
      bodyHtml += `<td class="day-cell" data-staff="${staff.id}" data-date="${dateStr}">${cell}</td>`;
    }
    bodyHtml += '</tr>';
  });
  tbody.innerHTML = bodyHtml;
}

// ============================================================
// カレンダーレーン割り当て（Google Calendar 方式）
// 各スタッフの連続ブロックに「行番号(レーン)」を固定で割り当てる。
// 開始日が先のブロックから順にグリーディに最初の空きレーンを確保し、
// その期間中は常に同じ行に表示されることを保証する。
// ============================================================
function buildCalendarLanes() {
  // 1. スタッフ×連続日付のセグメントを抽出（タイプ問わず連続していれば1セグメント）
  const segments = [];
  state.staffList.forEach(staff => {
    const dates = state.effectiveRequests
      .filter(r => r.staff_id === staff.id)
      .map(r => r.date)
      .sort();
    if (dates.length === 0) return;

    let seg = { staffId: staff.id, start: dates[0], end: dates[0] };
    for (let i = 1; i < dates.length; i++) {
      const next = new Date(seg.end + 'T00:00:00');
      next.setDate(next.getDate() + 1);
      if (formatDate(next) === dates[i]) {
        seg.end = dates[i]; // 連続している → セグメント延長
      } else {
        segments.push({ ...seg });
        seg = { staffId: staff.id, start: dates[i], end: dates[i] };
      }
    }
    segments.push(seg);
  });

  // 2. 開始日昇順、同日なら終了日が遅い（長い）方を優先
  segments.sort((a, b) => {
    if (a.start !== b.start) return a.start.localeCompare(b.start);
    return b.end.localeCompare(a.end);
  });


  // 3. 空いている一番上のレーンを割り当て（グリーディ）
  const lanes = []; // lanes[i] = そのレーンが空く日（最後に使われたendDate）
  const segmentLanes = new Map(); // `${staffId}_${start}` -> laneIndex
  segments.forEach(seg => {
    let assignedLane = -1;
    for (let i = 0; i < lanes.length; i++) {
      if (lanes[i] < seg.start) {
        assignedLane = i;
        break;
      }
    }
    if (assignedLane === -1) {
      assignedLane = lanes.length; // 空きがなければ新しいレーンを追加
    }
    lanes[assignedLane] = seg.end;
    segmentLanes.set(`${seg.staffId}_${seg.start}`, assignedLane);
  });

  // 4. dateStr → staffId → laneIndex のマッピングに変換
  const dateLaneMap = new Map();
  segments.forEach(seg => {
    const lane = segmentLanes.get(`${seg.staffId}_${seg.start}`);
    const d = new Date(seg.start + 'T00:00:00');
    const endD = new Date(seg.end + 'T00:00:00');
    while (d <= endD) {
      const ds = formatDate(d);
      if (!dateLaneMap.has(ds)) dateLaneMap.set(ds, new Map());
      dateLaneMap.get(ds).set(seg.staffId, lane);
      d.setDate(d.getDate() + 1);
    }
  });

  return dateLaneMap;
}

// ============================================================
// カレンダー描画（スマホ）- Google Calendar 風
// ============================================================
function renderCalendar() {
  const wrapper = document.querySelector('.calendar-wrapper');
  if (!wrapper) return;

  const laneMap = buildCalendarLanes();

  // 月の日付リストを生成（カレンダーは前後の月の余白日も含む）
  const todayStr = formatDate(new Date());
  
  // 今月の1日と末日
  const firstDay = new Date(state.currentYear, state.currentMonth, 1);
  const lastDay = new Date(state.currentYear, state.currentMonth + 1, 0);
  
  // 開始日：今月1日の週の日曜日
  const startDate = new Date(firstDay);
  startDate.setDate(startDate.getDate() - startDate.getDay());
  
  // 終了日：今月末日の週の土曜日
  const endDate = new Date(lastDay);
  endDate.setDate(endDate.getDate() + (6 - endDate.getDay()));

  const grid = document.querySelector('.calendar-grid');
  let html = `<div class="calendar-grid__header is-sunday">日</div>
              <div class="calendar-grid__header">月</div>
              <div class="calendar-grid__header">火</div>
              <div class="calendar-grid__header">水</div>
              <div class="calendar-grid__header">木</div>
              <div class="calendar-grid__header">金</div>
              <div class="calendar-grid__header is-saturday">土</div>`;

  let dt = new Date(startDate);
  while (dt <= endDate) {
    const dateStr = formatDate(dt);
    const m = dt.getMonth();
    const d = dt.getDate();
    const dow = dt.getDay();

    const isCurrentMonth = (m === state.currentMonth);
    const isHoliday = !!state.holidays[dateStr];

    const classes = ['calendar-grid__cell'];
    if (!isCurrentMonth) classes.push('is-empty');
    if (dow === 0) classes.push('is-sunday');
    if (dow === 6) classes.push('is-saturday');
    if (isHoliday) classes.push('is-holiday');

    // 該当日のレーン情報とリクエストを取得
    const dayLaneMap = laneMap.get(dateStr) || new Map();
    const dayReqs = state.effectiveRequests.filter(r => r.date === dateStr);
    const maxLane = dayReqs.length > 0
      ? Math.max(...dayReqs.map(r => dayLaneMap.get(r.staff_id) ?? 0))
      : -1;

    let eventsHtml = '';
    const prevDateObj = new Date(dt); prevDateObj.setDate(prevDateObj.getDate() - 1);
    const prevDateStr = formatDate(prevDateObj);
    const nextDateObj = new Date(dt); nextDateObj.setDate(nextDateObj.getDate() + 1);
    const nextDateStr = formatDate(nextDateObj);

    // 最大レーン番号までループ（空きレーンにはスペーサーを入れる）
    for (let currentLane = 0; currentLane <= maxLane; currentLane++) {
      const reqsInThisLane = dayReqs.filter(r => (dayLaneMap.get(r.staff_id) ?? 0) === currentLane);
      
      if (reqsInThisLane.length === 0) {
        // 誰もいない場合は透明スペーサーを配置し、高さを潰さないように &nbsp; を入れる
        eventsHtml += '<span class="cal-evt cal-evt--spacer">&nbsp;</span>';
        continue;
      }

      // 同じ人・同じレーンに複数の希望（AM・PMなど）がある場合はすべて描画する
      reqsInThisLane.forEach(r => {
        const { bg, text } = getStaffColor(r.staff_id);
        const staffObj = state.staffList.find(s => s.id === r.staff_id);
        const fullName = staffObj?.name || r.staff?.name || '?';
        const lastName = fullName.split(/[\s　]+/)[0];

        let typeLabel = '';
        if (r.request_type !== 'off') {
          typeLabel = ' コメント';
        }

        // 前後日と繋がっているか判定し、バーの角丸・表示を調整
        const prevReq = state.effectiveRequests.find(pr => pr.staff_id === r.staff_id && pr.date === prevDateStr && pr.request_type === r.request_type && pr.note === r.note && pr.is_virtual === r.is_virtual);
        const nextReq = state.effectiveRequests.find(nr => nr.staff_id === r.staff_id && nr.date === nextDateStr && nr.request_type === r.request_type && nr.note === r.note && nr.is_virtual === r.is_virtual);

        let extraCls = '';
        if (!prevReq && nextReq) extraCls += ' is-bar-start';
        else if (prevReq && nextReq) extraCls += ' is-bar-middle';
        else if (prevReq && !nextReq) extraCls += ' is-bar-end';

        let inlineStyle = `background:${bg};color:${text};`;

        if (r.is_virtual) {
          inlineStyle = `background:transparent; color:${bg}; box-shadow: inset 0 0 0 1px ${bg};`;
        }

        eventsHtml += `<span class="cal-evt${extraCls}" style="${inlineStyle}">${escapeHtml(lastName + typeLabel)}</span>`;
      });
    }

    html += `<div class="${classes.join(' ')}" data-date="${dateStr}">
      <div class="cal-date"><span class="cal-date__num${dateStr === todayStr ? ' cal-date__num--today' : ''}">${d}</span></div>
      <div class="cal-events">${eventsHtml}</div>
    </div>`;
    dt.setDate(dt.getDate() + 1);
  }
  grid.innerHTML = html;

  grid.querySelectorAll('.calendar-grid__cell').forEach(cell => {
    cell.addEventListener('click', () => showDayDetail(cell.dataset.date));
  });
}

function showDayDetail(dateStr) {
  const dayReqs = state.effectiveRequests.filter(r => r.date === dateStr);
  const dt = new Date(dateStr + 'T00:00:00');
  const dayNames = ['日', '月', '火', '水', '木', '金', '土'];
  const title = `${dt.getMonth() + 1}/${dt.getDate()}（${dayNames[dt.getDay()]}）`;
  const holiday = state.holidays[dateStr];

  // 選択セルをハイライト
  document.querySelectorAll('.calendar-grid__cell.is-selected').forEach(c => c.classList.remove('is-selected'));
  const selectedCell = document.querySelector(`.calendar-grid__cell[data-date="${dateStr}"]`);
  if (selectedCell) selectedCell.classList.add('is-selected');

  // タイトル（祝日ラベル付き）
  const titleEl = document.getElementById('bottom-sheet-title');
  titleEl.textContent = title;
  if (holiday) {
    const badge = document.createElement('span');
    badge.textContent = ` ${holiday}`;
    badge.style.cssText = 'font-size:var(--font-size-xs);color:var(--color-danger);font-weight:500;';
    titleEl.appendChild(badge);
  }

  // ボトムシートの中身
  let bodyHtml = '';
  if (dayReqs.length === 0) {
    bodyHtml = '<p style="font-size:var(--font-size-sm);color:var(--color-text-muted);padding:4px 0 8px;">この日の希望はありません</p>';
  } else {
    bodyHtml = '<ul class="day-detail__list">';
    dayReqs.forEach(r => {
      let type, evtCls;
      switch (r.request_type) {
        case 'off':      type = '休み希望'; evtCls = 'cal-evt--off';      break;
        default:         type = 'コメント'; evtCls = 'cal-evt--other';    break;
      }
      const note = r.note
        ? `<span class="day-detail__note">${escapeHtml(r.note)}</span>`
        : '';
      const staffObj = state.staffList.find(s => s.id === r.staff_id);
      bodyHtml += `<li class="day-detail__item day-detail__item--tappable" data-staff-id="${r.staff_id}" data-date="${dateStr}">
        <span class="day-detail__name">${escapeHtml(staffObj?.name || r.staff?.name || '?')}</span>
        <span class="cal-evt ${evtCls}" style="padding:3px 10px;border-radius:var(--radius-full);flex-shrink:0;">${type}</span>
        <i data-lucide="chevron-right" class="day-detail__chevron"></i>
        ${note}
      </li>`;
    });
    bodyHtml += '</ul>';
  }

  // 新規登録ボタン（常に表示、スタッフ未選択時はモーダル内で選択）
  bodyHtml += `<button class="btn btn--primary btn--sm" style="width:100%;margin-top:14px;" id="bottom-sheet-add">
    <i data-lucide="plus" style="width:14px;height:14px;"></i> 新規登録
  </button>`;

  document.getElementById('bottom-sheet-body').innerHTML = bodyHtml;
  document.getElementById('bottom-sheet-overlay').classList.add('active');
  if (typeof lucide !== 'undefined') lucide.createIcons();

  // 既存イベントタップ → 編集モーダル（グループ全体を渡す）
  document.querySelectorAll('.day-detail__item--tappable').forEach(item => {
    item.addEventListener('click', () => {
      closeBottomSheet();
      const staffId = item.dataset.staffId;
      const dateStr = item.dataset.date;
      const req = state.effectiveRequests.find(r => r.staff_id === staffId && r.date === dateStr);
      
      let groupDates = [dateStr];
      // 固定休（is_virtual）の場合はグループ展開せず単日選択とする
      if (req && !req.is_virtual) {
        groupDates = getGroupDates(staffId, dateStr);
      }
      openModal(staffId, groupDates);
    });
  });

  // 新規登録ボタン → 登録モーダル（選択中スタッフ or 先頭スタッフ）
  document.getElementById('bottom-sheet-add').addEventListener('click', () => {
    closeBottomSheet();
    openModal(state.selectedStaffId || state.staffList[0]?.id, [dateStr]);
  });
}

function closeBottomSheet() {
  const overlay = document.getElementById('bottom-sheet-overlay');
  if (!overlay) return;
  overlay.classList.remove('active');
  document.getElementById('bottom-sheet-title').textContent = '';
  document.getElementById('bottom-sheet-body').innerHTML = '';
  document.querySelectorAll('.calendar-grid__cell.is-selected').forEach(c => c.classList.remove('is-selected'));
}

function renderStaffChips() {
  const container = document.getElementById('staff-chips');
  if (!container) return;
  container.innerHTML = state.staffList.map(s => {
    const isActive = s.id === state.selectedStaffId;
    const { text } = getStaffColor(s.id);
    return `<button class="staff-chip${isActive ? ' is-active' : ''}" data-staff-id="${s.id}"><span class="staff-chip__dot" style="background:${text};"></span>${escapeHtml(s.name)}</button>`;
  }).join('');
  container.querySelectorAll('.staff-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      state.selectedStaffId = chip.dataset.staffId;
      localStorage.setItem('selectedStaffId', state.selectedStaffId);
      document.getElementById('staff-select').value = state.selectedStaffId;
      updateDispenseVisibility(state.selectedStaffId);
      renderStaffChips();
      updateFabVisibility();
    });
  });
}

function updateFabVisibility() {
  const fab = document.getElementById('fab-add');
  if (!fab) return;
  const isMobile = window.innerWidth <= 768;
  fab.style.display = (state.selectedStaffId && isMobile) ? 'flex' : 'none';
}

// ============================================================
// その他リスト描画（画面下部）
// ============================================================
function renderOtherList() {
  const container = document.getElementById('other-list');
  const dayNames = ['日', '月', '火', '水', '木', '金', '土'];
  const firstDay = new Date(state.currentYear, state.currentMonth, 1);
  const lastDay = new Date(state.currentYear, state.currentMonth + 1, 0);
  const startDateObj = new Date(firstDay);
  startDateObj.setDate(startDateObj.getDate() - startDateObj.getDay());
  const endDateObj = new Date(lastDay);
  endDateObj.setDate(endDateObj.getDate() + (6 - endDateObj.getDay()));
  
  const startStr = formatDate(startDateObj);
  const endStr = formatDate(endDateObj);

  const filteredReqs = state.effectiveRequests
    .filter(r => (r.request_type !== 'off' || (r.request_type === 'off' && r.note)) && r.date >= startStr && r.date <= endStr)
    .sort((a, b) => {
      if (a.staff_id !== b.staff_id) return a.staff_id.localeCompare(b.staff_id);
      return a.date.localeCompare(b.date);
    });

  // 連続する日程をグループ化
  const groupedReqs = [];
  filteredReqs.forEach(r => {
    const lastGroup = groupedReqs.length > 0 ? groupedReqs[groupedReqs.length - 1] : null;
    
    if (lastGroup 
        && lastGroup.staff_id === r.staff_id 
        && lastGroup.request_type === r.request_type 
        && lastGroup.note === r.note) {
      // 連続する日付かどうかのチェック
      const nextDateStr = formatDate(new Date(new Date(lastGroup.end_date + 'T00:00:00').getTime() + 86400000));
      if (r.date === nextDateStr) {
        lastGroup.end_date = r.date; // 期間を延長
        return;
      }
    }
    groupedReqs.push({ ...r, start_date: r.date, end_date: r.date });
  });

  // 表示用に開始日順にソート
  groupedReqs.sort((a, b) => a.start_date.localeCompare(b.start_date));

  if (groupedReqs.length === 0) {
    container.innerHTML = `<div class="other-list__title">条件付き・その他の希望 <span class="other-list__count">0件</span></div>`;
    return;
  }

  let html = `<div class="other-list__title">条件付き・その他の希望 <span class="other-list__count">${groupedReqs.length}件</span></div>`;
  html += '<div class="other-list__items">';
  groupedReqs.forEach(g => {
    const startDt = new Date(g.start_date + 'T00:00:00');
    const endDt = new Date(g.end_date + 'T00:00:00');
    let dateLabel = `${startDt.getMonth() + 1}/${startDt.getDate()}（${dayNames[startDt.getDay()]}）`;
    if (g.start_date !== g.end_date) {
      dateLabel += `〜${endDt.getMonth() + 1}/${endDt.getDate()}（${dayNames[endDt.getDay()]}）`;
    }

    const staffObj = state.staffList.find(s => s.id === g.staff_id);
    const fullName = staffObj?.name || g.staff?.name || '不明';
    const lastName = fullName.split(/[\s　]+/)[0];
    
    let typeLabel, itemCls;
    if (g.request_type === 'off') { typeLabel = '休み'; itemCls = 'other-list__item--off'; }
    else { typeLabel = 'コメント'; itemCls = 'other-list__item--other'; }

    const noteHtml = g.note ? `<span class="other-list__note">${escapeHtml(g.note)}</span>` : '';

    html += `<div class="other-list__item other-list__item--clickable ${itemCls}" data-staff-id="${g.staff_id}" data-date="${g.start_date}" data-type="${g.request_type}">
      <span class="other-list__date">${dateLabel}</span>
      <span class="other-list__staff">${escapeHtml(lastName)} ${typeLabel}</span>
      ${noteHtml}
      <i data-lucide="pencil" class="other-list__edit-icon"></i>
    </div>`;
  });
  html += '</div>';
  container.innerHTML = html;
  if (typeof lucide !== 'undefined') lucide.createIcons();

  // 各アイテム操作（クリックでモーダル、ホバーでハイライト）
  container.querySelectorAll('.other-list__item--clickable').forEach(item => {
    item.addEventListener('click', () => {
      const groupDates = getGroupDates(item.dataset.staffId, item.dataset.date);
      openModal(item.dataset.staffId, groupDates);
    });

    item.addEventListener('mouseenter', () => {
      const groupDates = getGroupDates(item.dataset.staffId, item.dataset.date);
      const reqType = item.dataset.type;
      groupDates.forEach(d => {
        const cell = document.querySelector(`.day-cell[data-staff="${item.dataset.staffId}"][data-date="${d}"]`);
        if (cell) cell.classList.add(`is-hover-${reqType}`);
      });
    });

    item.addEventListener('mouseleave', () => {
      const groupDates = getGroupDates(item.dataset.staffId, item.dataset.date);
      const reqType = item.dataset.type;
      groupDates.forEach(d => {
        const cell = document.querySelector(`.day-cell[data-staff="${item.dataset.staffId}"][data-date="${d}"]`);
        if (cell) cell.classList.remove(`is-hover-${reqType}`);
      });
    });
  });
}

// ============================================================
// モーダル操作
// ============================================================


function openModal(staffId, dates) {
  state.editingStaffId = staffId;
  state.editingDates = dates;

  const staffSelect = document.getElementById('modal-staff-select');
  staffSelect.innerHTML = '';
  state.staffList.forEach(s => {
    const opt = document.createElement('option');
    opt.value = s.id;
    opt.textContent = s.name;
    if (s.id === staffId) opt.selected = true;
    staffSelect.appendChild(opt);
  });

  const dayNames = ['日', '月', '火', '水', '木', '金', '土'];
  if (dates.length === 1) {
    const dt = new Date(dates[0] + 'T00:00:00');
    const holiday = state.holidays[dates[0]];
    document.getElementById('modal-title').textContent =
      `${dt.getMonth() + 1}/${dt.getDate()}（${dayNames[dt.getDay()]}）${holiday ? ' ' + holiday : ''}`;
  } else {
    const first = new Date(dates[0] + 'T00:00:00');
    const last = new Date(dates[dates.length - 1] + 'T00:00:00');
    document.getElementById('modal-title').textContent =
      `${first.getMonth() + 1}/${first.getDate()} 〜 ${last.getMonth() + 1}/${last.getDate()}（${dates.length}日間）`;
  }

  // 日付の初期値をセット
  const startDate = dates[0];
  const endDate = dates[dates.length - 1];
  const startInput = document.getElementById('modal-date-start');
  const endInput = document.getElementById('modal-date-end');
  startInput.value = startDate;
  endInput.value = endDate;

  // 複数日でも先頭日付に既存データがあれば編集モード
  const existing = state.requests.find(r => r.staff_id === staffId && r.date === dates[0]);
  state.editingRequest = existing || null;

  if (existing) {
    startInput.disabled = false;
    endInput.disabled = false;
    document.querySelector(`input[name="request-type"][value="${existing.request_type}"]`).checked = true;
    document.getElementById('modal-note').value = existing.note || '';
    document.getElementById('modal-delete').style.display = 'inline-flex';
    
    // 変更履歴の生成
    const historyList = document.getElementById('modal-history-list');
    historyList.innerHTML = '';
    if (existing.created_at) {
      historyList.innerHTML += `<li>${formatDateTime(existing.created_at)} に登録</li>`;
    }
    if (existing.updated_at && existing.updated_at !== existing.created_at) {
      historyList.innerHTML += `<li>${formatDateTime(existing.updated_at)} に更新</li>`;
    }
    document.getElementById('modal-history').style.display = 'block';
  } else {
    startInput.disabled = false;
    endInput.disabled = false;
    document.querySelector('input[name="request-type"][value="off"]').checked = true;
    document.getElementById('modal-note').value = '';
    document.getElementById('modal-delete').style.display = 'none';
    document.getElementById('modal-history').style.display = 'none';
  }

  document.getElementById('modal-overlay').classList.add('active');
}

function closeModal() {
  document.getElementById('modal-overlay').classList.remove('active');
  state.editingDates = [];
  state.editingStaffId = null;
  state.editingRequest = null;
}

async function handleModalSave() {
  const staffId = document.getElementById('modal-staff-select').value;
  const type = document.querySelector('input[name="request-type"]:checked').value;
  const note = document.getElementById('modal-note').value.trim();

  if (type === 'other' && !note) {
    alert('「コメント」の場合は備考を入力してください');
    return;
  }

  const startStr = document.getElementById('modal-date-start').value;
  const endStr = document.getElementById('modal-date-end').value;
  
  if (!startStr || !endStr) {
    alert('対象日を選択してください');
    return;
  }
  if (startStr > endStr) {
    alert('終了日は開始日以降の日付を選択してください');
    return;
  }

  const targetDates = [];
  const currDt = new Date(startStr + 'T00:00:00');
  const endDt = new Date(endStr + 'T00:00:00');
  
  while (currDt <= endDt) {
    targetDates.push(formatDate(currDt));
    currDt.setDate(currDt.getDate() + 1);
  }

  // DB接続をオフにしているため、オンメモリで配列を操作する
  for (const d of targetDates) {
    const existingReqIndex = state.requests.findIndex(r => r.staff_id === staffId && r.date === d);
    
    if (existingReqIndex !== -1) {
      // Update
      state.requests[existingReqIndex].request_type = type;
      state.requests[existingReqIndex].note = note || null;
    } else {
      // Insert
      state.requests.push({
        id: 'mock-id-' + Date.now() + Math.floor(Math.random() * 1000), // 仮のID
        staff_id: staffId,
        date: d,
        request_type: type,
        note: note || null
      });
    }
  }

  closeModal();
  await loadRequests();
}

async function handleModalDelete() {
  if (!state.editingRequest) return;

  const staffId = document.getElementById('modal-staff-select').value;
  const startStr = document.getElementById('modal-date-start').value;
  const endStr = document.getElementById('modal-date-end').value;

  // 対象日付の配列を生成
  const deleteDates = [];
  const cur = new Date(startStr + 'T00:00:00');
  const end = new Date(endStr + 'T00:00:00');
  while (cur <= end) { deleteDates.push(formatDate(cur)); cur.setDate(cur.getDate() + 1); }

  const deleteIds = state.requests
    .filter(r => r.staff_id === staffId && deleteDates.includes(r.date))
    .map(r => r.id);

  if (deleteIds.length === 0) return;

  const label = deleteDates.length === 1 ? 'この希望を削除しますか？' : `${deleteDates.length}日分の希望をまとめて削除しますか？`;
  if (!confirm(label)) return;

  // DB接続をオフにしているため、オンメモリの配列から削除する
  state.requests = state.requests.filter(r => !deleteIds.includes(r.id));

  closeModal();
  await loadRequests();
}

// ============================================================
// グループ日付抽出ヘルパー
// 指定スタッフ・日付から同一条件（種類＋備考）で連続する日付の配列を返す
// ============================================================
function getGroupDates(staffId, dateStr) {
  const anchor = state.effectiveRequests.find(r => r.staff_id === staffId && r.date === dateStr);
  if (!anchor) return [dateStr];

  if (anchor.is_virtual) return [dateStr];

  const dates = [dateStr];
  // 前方に探索
  let d = new Date(dateStr + 'T00:00:00');
  while (true) {
    d.setDate(d.getDate() - 1);
    const ds = formatDate(d);
    const r = state.effectiveRequests.find(r => r.staff_id === staffId && r.date === ds);
    if (r && !r.is_virtual && r.request_type === anchor.request_type && r.note === anchor.note) {
      dates.unshift(ds);
    } else break;
  }
  // 後方に探索
  d = new Date(dateStr + 'T00:00:00');
  while (true) {
    d.setDate(d.getDate() + 1);
    const ds = formatDate(d);
    const r = state.effectiveRequests.find(r => r.staff_id === staffId && r.date === ds);
    if (r && !r.is_virtual && r.request_type === anchor.request_type && r.note === anchor.note) {
      dates.push(ds);
    } else break;
  }
  return dates;
}

function getLastDayOfMonth(year, month) {
  return formatDate(new Date(year, month + 1, 0));
}
function formatDate(dt) {
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}
function formatDateTime(isoStr) {
  const dt = new Date(isoStr);
  return `${dt.getMonth() + 1}/${dt.getDate()} ${String(dt.getHours()).padStart(2, '0')}:${String(dt.getMinutes()).padStart(2, '0')}`;
}
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
