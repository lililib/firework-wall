// ============================================================
// 主入口：连接所有模块、绑定 UI 事件
// ============================================================
import { supabase } from './supabase-client.js';
import { loginWithGitHub, loginWithGoogle, logout, onAuthChange, getCurrentUser } from './auth.js';
import { subscribeFireworks, broadcastTempFirework, subscribePresence } from './realtime.js';
import { initFireworkEngine, createFirework, setScene, pickSceneColor } from './firework-engine.js';
import { replayAll, replayMine, loadMessageWall } from './replay.js';
import { initThemeDock, getSavedSceneKey, getSceneByKey } from './theme-dock.js';

const RATE_LIMIT_MS = 2000;
const LOCAL_HISTORY_KEY = 'myFireworks';
const LOCAL_HISTORY_MAX = 50;
const MSG_MAX = 10;

// ===== DOM =====
const $ = (id) => document.getElementById(id);
const els = {
  canvas: $('fireworksCanvas'),
  textCanvas: $('textCanvas'),
  sky: $('sky'),
  input: $('messageInput'),
  inputCounter: $('inputCounter'),
  launchBtn: $('launchBtn'),
  loginBtn: $('loginBtn'),
  loginWrap: $('loginWrap'),
  loginMenu: $('loginMenu'),
  loginGoogleBtn: $('loginGoogleBtn'),
  loginGithubBtn: $('loginGithubBtn'),
  loginChip: $('loginChip'),
  onlineCount: $('onlineCount'),
  hint: $('hint'),
  menuBtn: $('menuBtn'),
  actionMenu: $('actionMenu'),
  replayAllBtn: $('replayAllBtn'),
  replayMineBtn: $('replayMineBtn'),
  wallBtn: $('wallBtn'),
  drawer: $('messageWall'),
  drawerCloseBtn: $('drawerCloseBtn'),
  drawerList: $('drawerList'),
  toast: $('toast'),
  themeDockBtn: $('themeDockBtn'),
  themeDock: $('themeDock'),
};

// ===== Toast（必须在 initThemeDock 之前定义，否则 TDZ 报错会中止初始化）=====
let toastTimer = null;
function showToast(text, ms = 2000) {
  els.toast.textContent = text;
  els.toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => els.toast.classList.remove('show'), ms);
}

// ===== 初始化烟花引擎 =====
initFireworkEngine(els.canvas, els.textCanvas);
setScene(getSceneByKey(getSavedSceneKey()));

// ===== 初始化场景切换 Dock =====
let sceneInitialized = false;
initThemeDock({
  btn: els.themeDockBtn,
  dock: els.themeDock,
  sky: els.sky,
  onChange: (scene) => {
    setScene(scene);
    // 首次应用（页面加载恢复）不弹 toast；用户主动切换才弹
    if (sceneInitialized) showToast(`场 景 · ${scene.name}`);
    sceneInitialized = true;
  },
});

// ===== 字符计数 =====
function updateCounter() {
  const len = els.input.value.length;
  els.inputCounter.textContent = `${len} / ${MSG_MAX}`;
}
els.input.addEventListener('input', updateCounter);
updateCounter();

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
  // 用 class 切换 chip 显隐，避免 inline style 残留覆盖 stylesheet 的 display:inline-flex
  els.loginChip.classList.toggle('is-hidden', !user);

  if (user) {
    // Google 用 full_name，GitHub 用 user_name
    const name = user.user_metadata?.user_name || user.user_metadata?.full_name || user.email || '已登录';
    const avatar = user.user_metadata?.avatar_url;
    els.loginChip.innerHTML = avatar
      ? `<img src="${avatar}" class="avatar" alt=""><span>${name}</span>`
      : `<span>${name}</span>`;
    els.loginBtn.textContent = '登出';
    els.loginBtn.dataset.action = 'logout';
    closeLoginMenu();
    els.launchBtn.textContent = '燃 放 留 念';
    els.input.placeholder = '书 写 你 的 寄 语';
    els.replayMineBtn.removeAttribute('disabled');
    els.replayMineBtn.title = '重放自己发过的烟花';
    els.hint.style.display = 'none';
  } else {
    els.loginBtn.textContent = '登录';
    els.loginBtn.dataset.action = 'login';
    els.launchBtn.textContent = '即 时 燃 放';
    els.input.placeholder = '书 写 你 的 寄 语';
    els.replayMineBtn.setAttribute('disabled', '');
    els.replayMineBtn.title = '登录后可见';
    els.hint.style.display = '';
  }
});

// ===== 登录下拉菜单 =====
function closeLoginMenu() {
  els.loginMenu.classList.remove('open');
  els.loginMenu.setAttribute('aria-hidden', 'true');
}
function toggleLoginMenu() {
  const willOpen = !els.loginMenu.classList.contains('open');
  els.loginMenu.classList.toggle('open', willOpen);
  els.loginMenu.setAttribute('aria-hidden', String(!willOpen));
}

els.loginBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  if (els.loginBtn.dataset.action === 'logout') logout();
  else toggleLoginMenu();
});
els.loginGoogleBtn.addEventListener('click', () => { closeLoginMenu(); loginWithGoogle(); });
els.loginGithubBtn.addEventListener('click', () => { closeLoginMenu(); loginWithGitHub(); });
document.addEventListener('click', (e) => {
  if (!els.loginWrap.contains(e.target)) closeLoginMenu();
});

// ===== 燃放烟花 =====
let lastLaunchAt = 0;
async function handleLaunch() {
  const now = Date.now();
  if (now - lastLaunchAt < RATE_LIMIT_MS) {
    showToast('稍 等 一 下 再 发');
    return;
  }
  const message = els.input.value.trim().slice(0, MSG_MAX);
  if (!message) {
    els.input.focus();
    return;
  }
  lastLaunchAt = now;

  // 颜色走当前场景调色板（保留每发烟花的一致色）
  const color = pickSceneColor();

  // 1. 本地立刻燃放
  createFirework(message, color);
  els.input.value = '';
  updateCounter();
  recordToLocal(message);

  const user = getCurrentUser();
  if (user) {
    const { error } = await supabase.from('fireworks').insert({
      message,
      color,
      user_id: user.id,
      username: user.user_metadata?.user_name || user.user_metadata?.full_name || null,
      avatar_url: user.user_metadata?.avatar_url || null,
    });
    if (error) {
      console.error(error);
      showToast('保 存 失 败 · ' + error.message, 3000);
    } else {
      showToast('已 永 久 保 存');
    }
  } else {
    broadcastTempFirework(message, color, '游客');
  }
}

els.launchBtn.addEventListener('click', handleLaunch);
els.input.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') handleLaunch();
});

// ===== 订阅其他用户的烟花 =====
subscribeFireworks(({ message, color, user_id, source }) => {
  const me = getCurrentUser();
  if (source === 'persisted' && me && user_id === me.id) return;
  createFirework(message, color);
});

// ===== 在线人数 =====
subscribePresence((count) => {
  els.onlineCount.textContent = count;
});

// ===== 操作菜单（重放所有 / 重放自己 / 留言墙） =====
function setMenuOpen(open) {
  els.actionMenu.classList.toggle('open', open);
  els.actionMenu.setAttribute('aria-hidden', String(!open));
}
els.menuBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  setMenuOpen(!els.actionMenu.classList.contains('open'));
});
document.addEventListener('click', (e) => {
  if (!els.actionMenu.contains(e.target) && e.target !== els.menuBtn) {
    setMenuOpen(false);
  }
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') setMenuOpen(false);
});

els.replayAllBtn.addEventListener('click', () => { setMenuOpen(false); replayAll(); });
els.replayMineBtn.addEventListener('click', () => {
  setMenuOpen(false);
  if (els.replayMineBtn.hasAttribute('disabled')) {
    showToast('登 录 后 可 重 放 自 己 的 烟 花');
    return;
  }
  replayMine();
});
els.wallBtn.addEventListener('click', () => { setMenuOpen(false); openDrawer(); });

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
  els.drawerList.innerHTML = '<li class="loading">加 载 中</li>';
  const list = await loadMessageWall();
  if (list.length === 0) {
    els.drawerList.innerHTML = '<li class="empty">还 没 有 寄 语 · 期 待 你 的 第 一 发</li>';
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
function closeDrawer() { els.drawer.classList.remove('open'); }
els.drawerCloseBtn.addEventListener('click', closeDrawer);

// ===== 全局错误提示 =====
if (!supabase) {
  showToast('请 先 在 supabase-client.js 填 入 凭 据', 5000);
}
