// ============================================================
// 历史回放 + 留言墙数据获取
// ============================================================
import { supabase, ensureConfigured } from './supabase-client.js';
import { getCurrentUser } from './auth.js';
import { createFirework } from './firework-engine.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const REPLAY_INTERVAL_MS = 600;  // 回放每发烟花的间隔（毫秒）/ Interval between replayed fireworks in ms
const REPLAY_LIMIT       = 200;  // 单次回放最多加载条数 / Max records loaded per replay session

let replaying = false;

function ensureNotReplaying() {
  if (replaying) {
    alert('正在回放中，请稍候...');
    return false;
  }
  return true;
}

async function playSequence(items) {
  replaying = true;
  try {
    for (const f of items) {
      createFirework(f.message, f.color);
      await sleep(REPLAY_INTERVAL_MS);
    }
  } finally {
    replaying = false;
  }
}

export async function replayAll() {
  if (!ensureConfigured()) return;
  if (!ensureNotReplaying()) return;

  const { data, error } = await supabase
    .from('fireworks')
    .select('message, color, created_at')
    .order('created_at', { ascending: true })
    .limit(REPLAY_LIMIT);

  if (error) {
    console.error(error);
    alert('加载失败: ' + error.message);
    return;
  }
  if (!data || data.length === 0) {
    alert('还没有烟花记录呢~ 快来发第一发吧');
    return;
  }
  await playSequence(data);
}

export async function replayMine() {
  if (!ensureConfigured()) return;
  if (!ensureNotReplaying()) return;

  const user = getCurrentUser();
  if (!user) {
    alert('请先登录 GitHub');
    return;
  }

  const { data, error } = await supabase
    .from('fireworks')
    .select('message, color, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true });

  if (error) {
    console.error(error);
    alert('加载失败: ' + error.message);
    return;
  }
  if (!data || data.length === 0) {
    alert('你还没有发过烟花呢~');
    return;
  }
  await playSequence(data);
}

// 留言墙列表数据
export async function loadMessageWall() {
  if (!ensureConfigured()) return [];
  const { data, error } = await supabase
    .from('fireworks')
    .select('id, message, username, avatar_url, created_at')
    .order('created_at', { ascending: false })
    .limit(100); // 留言墙最多显示 100 条 / Max 100 entries shown in message wall

  if (error) {
    console.error(error);
    return [];
  }
  return data || [];
}
