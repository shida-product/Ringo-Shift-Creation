/**
 * ログアウト処理の共通化（オオギシフト js/auth.js を参考）
 * 以前は main.js / generate.js / admin.js がそれぞれ signOut の失敗を無視して login.html へ移動していた。
 */
import { supabase } from './supabase-config.js';

export async function logout() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
  window.location.replace('login.html');
}

/** ログアウトボタン（ID: btn-logout）があればクリック時の処理を登録する */
export function setupLogoutButton() {
  const btn = document.getElementById('btn-logout');
  if (!btn) return;
  btn.addEventListener('click', async (e) => {
    e.preventDefault();
    if (btn.disabled) return;
    btn.disabled = true;
    try {
      await logout();
    } catch (error) {
      console.error('ログアウトエラー:', error);
      alert('ログアウトに失敗しました。通信状況を確認して再度お試しください。');
      btn.disabled = false;
    }
  });
}
