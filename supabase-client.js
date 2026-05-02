// ============================================================
// ⚠️ 配置区 — Fork 后请替换为你自己的 Supabase 凭据
//
// 获取方式：Supabase Dashboard → Project Settings → API
//   - Project URL    → SUPABASE_URL
//   - Publishable key → SUPABASE_ANON_KEY  (公开 key，受 RLS 保护，可放前端)
//
// ⚠️ 不要使用 Secret key — 那是服务端专用，泄漏会失去所有数据保护！
//
// 详细部署步骤见 README.md
// ============================================================
export const SUPABASE_URL = 'https://snxzqmsydayzlwwbnbyy.supabase.co';
export const SUPABASE_ANON_KEY = 'sb_publishable_I4tSeypTVjOglQeAH40vMA_rznFeIuM';
// ============================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const isConfigured =
  SUPABASE_URL && !SUPABASE_URL.startsWith('<') &&
  SUPABASE_ANON_KEY && !SUPABASE_ANON_KEY.startsWith('<');

export const supabase = isConfigured
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: true,       // 持久化登录态到 localStorage / Persist session in localStorage
        autoRefreshToken: true,     // 自动续期 token / Auto-refresh expired tokens
        detectSessionInUrl: true,   // 从 OAuth 回调 URL 中解析 session / Parse session from OAuth redirect URL
      },
    })
  : null;

export function ensureConfigured() {
  if (!supabase) {
    const msg = '⚠️ 未配置 Supabase 凭据，请编辑 supabase-client.js（详见 README）';
    console.error(msg);
    return false;
  }
  return true;
}
