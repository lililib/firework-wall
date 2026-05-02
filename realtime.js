// ============================================================
// 实时通信层
// - 订阅 fireworks 表 INSERT 事件（登录用户的持久化烟花）
// - 订阅 broadcast 事件（未登录用户的临时烟花）
// - Presence 在线人数
// ============================================================
import { supabase, ensureConfigured } from './supabase-client.js';

const FEED_CHANNEL = 'firework-feed';
const PRESENCE_CHANNEL = 'firework-presence';

let feedChannel = null;

// 初始化烟花消息频道（同时承载 postgres_changes 和 broadcast）
export function subscribeFireworks(onNew) {
  if (!ensureConfigured()) return null;

  feedChannel = supabase
    .channel(FEED_CHANNEL)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'fireworks' },
      (payload) => onNew({
        message: payload.new.message,
        color: payload.new.color,
        username: payload.new.username,
        user_id: payload.new.user_id,
        source: 'persisted',
      })
    )
    .on(
      'broadcast',
      { event: 'temp-launch' },
      (payload) => onNew({
        message: payload.payload.message,
        color: payload.payload.color,
        username: payload.payload.username || '匿名',
        source: 'broadcast',
      })
    )
    .subscribe();

  return feedChannel;
}

// 未登录用户用 broadcast 临时广播（不写库）
export function broadcastTempFirework(message, color, username = '匿名') {
  if (!feedChannel) return Promise.resolve();
  return feedChannel.send({
    type: 'broadcast',
    event: 'temp-launch',
    payload: { message, color, username },
  });
}

// Presence 在线人数订阅
export function subscribePresence(onCountChange) {
  if (!ensureConfigured()) return null;

  const presenceKey =
    localStorage.getItem('firework_presence_key') ||
    (() => {
      const k = crypto.randomUUID();
      localStorage.setItem('firework_presence_key', k);
      return k;
    })();

  const channel = supabase.channel(PRESENCE_CHANNEL, {
    config: { presence: { key: presenceKey } },
  });

  channel
    .on('presence', { event: 'sync' }, () => {
      const state = channel.presenceState();
      onCountChange(Object.keys(state).length);
    })
    .subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await channel.track({ joinedAt: Date.now() });
      }
    });

  return channel;
}
