// ============================================================
// 主入口：连接所有模块、绑定 UI 事件
// ============================================================
import { supabase, ensureConfigured } from './supabase-client.js';
import { login, logout, onAuthChange, getCurrentUser } from './auth.js';
import { subscribeFireworks, broadcastTempFirework, subscribePresence } from './realtime.js';
import { initFireworkEngine, createFirework } from './firework-engine.js';
import { replayAll, replayMine, loadMessageWall } from './replay.js';

const RATE_LIMIT_MS = 2000;
const LOCAL_HISTORY_KEY = 'myFireworks';
const LOCAL_HISTORY_MAX = 50;

// ===== DOM =====
const $ = (id) => document.getElementById(id);
const els = {
  canvas: $('fireworksCanvas'),
  textCanvas: $('textCanvas'),
  input: $('messageInput'),
  launchBtn: $('launchBtn'),
  loginBtn: $('loginBtn'),
  loginStatus: $('loginStatus'),
  onlineCount: $('onlineCount'),
  hint: $('hint'),
  replayAllBtn: $('replayAllBtn'),
  replayMineBtn: $('replayMineBtn'),
  wallBtn: $('wallBtn'),
  drawer: $('messageWall'),
  drawerCloseBtn: $('drawerCloseBtn'),
  drawerList: $('drawerList'),
  toast: $('toast'),
};

// ===== 初始化烟花动画引擎 =====
initFireworkEngine(els.canvas, els.textCanvas);

// ===== Toast =====
let toastTimer = null;
function showToast(text, ms = 2000) {
  els.toast.textContent = text;
  els.toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => els.toast.classList.remove('show'), ms);
}

// ===== 本地历史 =====
function recordToLocal(message) {
  try {
    const list = JSON.parse(localStorage.getItem(LOCAL_HISTORY_KEY) || '[]');
    list.push({ msg: message, at: Date.now() });
    while (list.length > LOCAL_HISTORY_MAX) list.shift();
    localStorage.setItem(LOCAL_HISTORY_KEY, JSON.stringify(list));
  } catch (_) { /* localStorage 满或被禁用 */ }
}

// ===== 登录态 → UI 同步 =====
onAuthChange((user) => {
  if (user) {
    const name = user.user_metadata?.user_name || user.email || '已登录';
    const avatar = user.user_metadata?.avatar_url;
    els.loginStatus.innerHTML = avatar
      ? `<img src="${avatar}" class="avatar" alt=""><span>${name}</span>`
      : `<span>${name}</span>`;
    els.loginBtn.textContent = '登出';
    els.loginBtn.dataset.action = 'logout';
    els.launchBtn.textContent = '🎆 燃放并永久留念';
    els.input.placeholder = '输入寄语 (最多10字)...';
    els.replayMineBtn.removeAttribute('disabled');
    els.replayMineBtn.title = '重放自己发过的烟花';
    els.hint.style.display = 'none';
  } else {
    els.loginStatus.innerHTML = '<span class="muted">未登录</span>';
    els.loginBtn.textContent = '登录 GitHub';
    els.loginBtn.dataset.action = 'login';
    els.launchBtn.textContent = '🎆 即时燃放';
    els.input.placeholder = '输入寄语 (登录后可永久保存)...';
    els.replayMineBtn.setAttribute('disabled', '');
    els.replayMineBtn.title = '登录后可见';
    els.hint.style.display = '';
  }
});

// ===== 登录/登出按钮 =====
els.loginBtn.addEventListener('click', () => {
  if (els.loginBtn.dataset.action === 'logout') {
    logout();
  } else {
    login();
  }
});

// ===== 燃放烟花 =====
let lastLaunchAt = 0;

async function handleLaunch() {
  const now = Date.now();
  if (now - lastLaunchAt < RATE_LIMIT_MS) {
    showToast('稍等一下再发哦~');
    return;
  }
  const message = els.input.value.trim().slice(0, 10);
  if (!message) {
    els.input.focus();
    return;
  }
  lastLaunchAt = now;

  const color = `hsl(${Math.floor(Math.random() * 360)}, 100%, 60%)`;

  // 1. 本地立刻燃放（无延迟体验）
  createFirework(message, color);
  els.input.value = '';
  recordToLocal(message);

  const user = getCurrentUser();
  if (user) {
    // 2a. 已登录：写库 → Realtime 自动广播 INSERT
    const { error } = await supabase.from('fireworks').insert({
      message,
      color,
      user_id: user.id,
      username: user.user_metadata?.user_name || null,
      avatar_url: user.user_metadata?.avatar_url || null,
    });
    if (error) {
      console.error(error);
      showToast('保存失败: ' + error.message, 3000);
    } else {
      showToast('✨ 寄语已永久保存');
    }
  } else {
    // 2b. 未登录：临时广播
    broadcastTempFirework(message, color, '游客');
  }
}

els.launchBtn.addEventListener('click', handleLaunch);
els.input.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') handleLaunch();
});

// ===== 订阅其他用户的烟花 =====
subscribeFireworks(({ message, color, user_id, source }) => {
  // 自己发的持久化消息会通过 Realtime 回声 → 跳过避免重复渲染
  // (本地已即时渲染过；broadcast 默认不回声故无需处理)
  const me = getCurrentUser();
  if (source === 'persisted' && me && user_id === me.id) {
    return;
  }
  createFirework(message, color);
});

// ===== 在线人数 =====
subscribePresence((count) => {
  els.onlineCount.textContent = count;
});

// ===== 重放按钮 =====
els.replayAllBtn.addEventListener('click', replayAll);
els.replayMineBtn.addEventListener('click', () => {
  if (els.replayMineBtn.hasAttribute('disabled')) {
    showToast('登录后可重放自己的烟花');
    return;
  }
  replayMine();
});

// ===== 留言墙抽屉 =====
function formatRelativeTime(iso) {
  const t = new Date(iso).getTime();
  const diff = Date.now() - t;
  const m = Math.floor(diff / 60000);
  if (m < 1) return '刚刚';
  if (m < 60) return `${m} 分钟前`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} 小时前`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d} 天前`;
  return new Date(iso).toLocaleDateString();
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
  );
}

async function openDrawer() {
  els.drawer.classList.add('open');
  els.drawerList.innerHTML = '<li class="loading">加载中...</li>';
  const list = await loadMessageWall();
  if (list.length === 0) {
    els.drawerList.innerHTML = '<li class="empty">还没有人发过烟花，期待你的第一发 🎆</li>';
    return;
  }
  els.drawerList.innerHTML = list
    .map((it) => `
      <li>
        <img src="${it.avatar_url || ''}" class="avatar" alt="" onerror="this.style.visibility='hidden'">
        <div class="meta">
          <span class="username">${escapeHtml(it.username || '匿名')}</span>
          <time>${formatRelativeTime(it.created_at)}</time>
        </div>
        <p class="message">${escapeHtml(it.message)}</p>
      </li>`)
    .join('');
}

function closeDrawer() {
  els.drawer.classList.remove('open');
}

els.wallBtn.addEventListener('click', openDrawer);
els.drawerCloseBtn.addEventListener('click', closeDrawer);

// ===== 全局错误提示（未配置 Supabase）=====
if (!supabase) {
  showToast('⚠️ 请先在 supabase-client.js 填入凭据', 5000);
}
