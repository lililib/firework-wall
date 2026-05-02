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

// 预加载所有音频 buffer
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
  // 移动端 AudioContext 首次需要用户手势后才能 resume / Mobile requires user gesture to resume AudioContext
  if (ac.state === 'suspended') ac.resume();

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
