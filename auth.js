// ============================================================
// 登录态管理（GitHub OAuth via Supabase Auth）
// 公开 API: login(), logout(), onAuthChange(fn), getCurrentUser()
// ============================================================
import { supabase, ensureConfigured } from './supabase-client.js';

let currentUser = null;
const listeners = [];

function emit() {
  listeners.forEach(fn => {
    try { fn(currentUser); } catch (e) { console.error(e); }
  });
}

export function onAuthChange(fn) {
  listeners.push(fn);
  // 立即推送当前状态，避免订阅者错过初始事件
  fn(currentUser);
}

export function getCurrentUser() {
  return currentUser;
}

export async function login() {
  if (!ensureConfigured()) return;
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'github',
    options: { redirectTo: window.location.href },
  });
  if (error) {
    console.error('登录失败:', error);
    alert('登录失败: ' + error.message);
  }
}

export async function logout() {
  if (!ensureConfigured()) return;
  await supabase.auth.signOut();
}

// 初始化：取已有 session + 订阅变化
if (supabase) {
  supabase.auth.getSession().then(({ data: { session } }) => {
    currentUser = session?.user ?? null;
    emit();
  });

  supabase.auth.onAuthStateChange((_event, session) => {
    currentUser = session?.user ?? null;
    emit();
  });
}
