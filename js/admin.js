/**
 * スタッフ管理画面ロジック
 * - スタッフの追加・編集・無効化
 * - 表示順の並び替え
 * - 職種・区分・配属・勤務条件の管理
 * - 月別公休数の管理
 */

import { supabase } from './supabase-config.js';

// ============================================================
// ラベル定義
// ============================================================
const ROLE_LABELS = { pharmacist: '薬剤師', office: '事務' };
const TYPE_LABELS = { full_time: '常勤', spot_worker: 'スポット' };

const COLOR_NAMES = {
  '#F35F8C': 'ピンク',
  '#E73B3B': '赤',
  '#2ECC87': '緑',
  '#47B2F7': '青',
  '#FDC02D': 'オレンジ',
  '#B38BDC': '紫',
  '#948078': '茶色',
  '#00B8D9': 'ターコイズ',
  '#6554C0': 'インディゴ',
  '#FF5630': 'ディープオレンジ',
  '#82C91E': 'ライムグリーン',
  '#212121': '黒'
};

const DEFAULT_STAFF_COLORS = {
  '鈴木': '#F35F8C',
  '村上': '#E73B3B',
  '福島': '#2ECC87',
  '湯本': '#47B2F7',
  '服部': '#FDC02D',
  '堀口': '#B38BDC',
  '財津': '#948078',
  '野口': '#00B8D9',
  '小野寺': '#6554C0',
  '笠原': '#FF5630',
  '山口': '#82C91E'
};

// ============================================================
// 状態
// ============================================================
let staffList = [];
let editingStaffId = null;
let pendingColors = {};

// ============================================================
// 初期化
// ============================================================
document.addEventListener('DOMContentLoaded', async () => {
  if (typeof supabase !== 'undefined') {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      window.location.href = 'login.html';
      return;
    }
  }

  await loadStaff();
  
  const saveBtn = document.getElementById('save-colors-btn');
  if (saveBtn) {
    saveBtn.addEventListener('click', () => {
      localStorage.setItem('staffColors', JSON.stringify(pendingColors));
      showToast('カラー設定を保存しました', 'success');
    });
  }

  // ログアウト
  document.getElementById('btn-logout')?.addEventListener('click', async () => {
    await supabase.auth.signOut();
    window.location.replace('login.html');
  });
});

// ============================================================
// データ取得
// ============================================================
async function loadStaff() {
  const { data, error } = await supabase
    .from('ringo_staff')
    .select('*')
    .order('display_order', { ascending: true });

  if (error) {
    console.error('Error loading staff:', error);
    showToast('スタッフ一覧の取得に失敗しました', 'error');
    return;
  }
  
  staffList = data || [];

  const savedColors = JSON.parse(localStorage.getItem('staffColors') || '{}');
  staffList.forEach(staff => {
    let color = savedColors[staff.name];
    if (!color) {
      for (const [key, hex] of Object.entries(DEFAULT_STAFF_COLORS)) {
        if (staff.name.includes(key)) {
          color = hex;
          break;
        }
      }
    }
    if (color) {
      pendingColors[staff.name] = color;
    }
  });

  renderStaffList();
}

// ============================================================
// スタッフ一覧描画
// ============================================================
function renderStaffList() {
  const container = document.getElementById('staff-list');

  if (staffList.length === 0) {
    container.innerHTML = '<p style="color:var(--color-text-muted);text-align:center;padding:40px 0;">スタッフが登録されていません</p>';
    return;
  }

  const usedColors = new Set();
  Object.values(pendingColors).forEach(color => {
    if (color) usedColors.add(color);
  });

  container.innerHTML = staffList.map((staff, index) => {
    const cardCls = staff.is_active ? '' : 'is-inactive';
    const currentColor = pendingColors[staff.name];
    // 勤務条件のサマリー
    const cond = staff.work_conditions || {};
    const condParts = [];
    if (cond.min_days_per_week) condParts.push(`週${cond.min_days_per_week}日〜`);
    if (cond.target_days_per_month) {
      if (cond.max_days_per_month && cond.max_days_per_month !== cond.target_days_per_month) {
        condParts.push(`月${cond.target_days_per_month}〜${cond.max_days_per_month}回`);
      } else {
        condParts.push(`月${cond.target_days_per_month}回`);
      }
    } else if (cond.max_days_per_month) {
      condParts.push(`最大月${cond.max_days_per_month}回`);
    }
    if (cond.max_sunday_per_month != null) condParts.push(`日曜${cond.max_sunday_per_month}回迄`);
    if (cond.alternating_weeks) condParts.push(`${cond.alternating_weeks.join('/')}交互`);
    const condSummary = condParts.length > 0 ? condParts.join(' / ') : '';

    return `
      <div class="staff-card ${cardCls}" data-id="${staff.id}">
        <div class="staff-card__main">
          <span class="staff-card__order">${index + 1}</span>
          <span class="staff-card__name">${escapeHtml(staff.name)}</span>
        </div>
        ${condSummary ? `<div class="staff-card__conditions">${condSummary}</div>` : ''}
        <div style="display:flex; justify-content:space-between; align-items:center; margin-top:8px; flex-wrap:wrap; gap:8px;">
          <div class="color-swatches">
            ${Object.entries(COLOR_NAMES).map(([hex, name]) => {
              const isUsedByOther = usedColors.has(hex) && currentColor !== hex;
              return `
              <button class="color-swatch ${currentColor === hex ? 'is-active' : ''} ${isUsedByOther ? 'is-disabled' : ''}" 
                      style="background:${hex};" 
                      title="${name}${isUsedByOther ? ' (他のスタッフが使用中)' : ''}"
                      ${isUsedByOther ? 'disabled' : `onclick="changeColor('${staff.name}', '${hex}')"`}></button>
              `;
            }).join('')}
          </div>
          <div class="staff-card__actions" style="margin-left:auto;">
            <button class="btn btn--ghost btn--sm" onclick="toggleActive('${staff.id}')" title="${staff.is_active ? '無効化' : '有効化'}">
              <i data-lucide="${staff.is_active ? 'eye-off' : 'eye'}"></i>
            </button>
          </div>
        </div>
      </div>`;
  }).join('');

  // 動的に追加したHTML内のLucideアイコンを初期化
  if (window.lucide) lucide.createIcons();
}

// ============================================================
// カラー変更
// ============================================================
window.changeColor = function (staffName, colorVal) {
  if (colorVal) {
    pendingColors[staffName] = colorVal;
  }
  renderStaffList();
};

// ============================================================
// スタッフ有効/無効トグル
// ============================================================
window.toggleActive = async function (staffId) {
  const staff = staffList.find(s => s.id === staffId);
  if (!staff) return;
  
  const newActiveState = !staff.is_active;

  const { error } = await supabase
    .from('ringo_staff')
    .update({ is_active: newActiveState })
    .eq('id', staffId);

  if (error) {
    console.error('Error updating staff state:', error);
    showToast('状態の更新に失敗しました', 'error');
    return;
  }

  staff.is_active = newActiveState;
  showToast(staff.is_active ? `${staff.name} を有効化しました` : `${staff.name} を無効化しました`, 'success');
  renderStaffList();
};

// ============================================================
// ユーティリティ
// ============================================================
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast toast--${type}`;
  toast.textContent = type === 'success' ? `✅ ${message}` : `❌ ${message}`;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3500);
}
