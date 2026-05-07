// ============================================================
// 音效管理器 / Sound Manager
// 基于 Web Audio API 实现烟花升空与爆炸音效的预加载与播放
// Preloads and plays firework launch/burst sounds via Web Audio API
// ============================================================

// 音效资源目录 / Audio assets base path
const BASE = './assets/yyh/audio/';

// 音效配置 / Sound sources config
// volume: 播放音量 0–1 / Playback volume 0–1
// rateRange: 随机音调范围（低, 高）/ Random pitch range [min, max]
const SOURCES = {
  lift:  { volume: 1, rateRange: [0.85, 0.95], files: ['lift1.mp3', 'lift2.mp3', 'lift3.mp3'] }, // 升空音效 / Launch sound
  burst: { volume: 1, rateRange: [0.80, 0.90], files: ['burst1.mp3', 'burst2.mp3'] },             // 爆炸音效 / Burst sound
};

let _ctx = null;
let _enabled = true;
const _buffers = {};

function getCtx() {
  if (!_ctx) _ctx = new (window.AudioContext || window.webkitAudioContext)();
  return _ctx;
}

// 在用户首次交互（pointerdown 早于 click）时提前解锁 AudioContext
// Pre-unlock AudioContext on first user interaction (pointerdown fires before click)
// 避免后续在 rAF 回调中播放时因上下文 suspended 而静默失败
// Prevents silent failures when sounds are triggered from rAF (non-gesture) callbacks
function _earlyUnlock() {
  const ac = getCtx();
  if (ac.state === 'suspended') ac.resume();
}
document.addEventListener('pointerdown', _earlyUnlock, { once: true });

// 预加载所有音频 buffer / Preload all audio buffers
(async () => {
  try {
    const ac = getCtx();
    await Promise.all(
      Object.entries(SOURCES).map(async ([type, src]) => {
        _buffers[type] = await Promise.all(
          src.files.map(name =>
            fetch(BASE + name)
              .then(r => r.arrayBuffer())
              .then(buf => ac.decodeAudioData(buf))
          )
        );
      })
    );
  } catch (_) { /* 预加载失败时降级为静音，不阻断主功能 / Audio preload failure silently degrades to mute */ }
})();

export function play(type) {
  if (!_enabled) return;
  const bufs = _buffers[type];
  if (!bufs?.length) return;
  const src = SOURCES[type];
  const ac = getCtx();
  // 上下文未就绪时尝试 resume；若仍未 running 则跳过此次播放（首次手势前的进场烟花不播声）
  // Try to resume if not running; skip if still suspended (e.g., intro firework before any user gesture)
  if (ac.state === 'suspended') {
    ac.resume();
    return; // 等待下次调用时上下文已就绪 / Wait for context to be running on next call
  }

  const buf = bufs[Math.floor(Math.random() * bufs.length)];
  const [min, max] = src.rateRange;

  const gain = ac.createGain();
  gain.gain.value = src.volume;
  gain.connect(ac.destination);

  const node = ac.createBufferSource();
  node.buffer = buf;
  node.playbackRate.value = min + Math.random() * (max - min);
  node.connect(gain);
  node.start(0);
}

export function setEnabled(val) {
  _enabled = Boolean(val);
  if (_enabled && _ctx?.state === 'suspended') _ctx.resume();
}

export function isEnabled() { return _enabled; }

export function toggle() {
  setEnabled(!_enabled);
  return _enabled;
}
