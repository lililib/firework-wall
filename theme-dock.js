// ============================================================
// 场景切换 Dock
// - 右下角圆形按钮 + 横向缩略图面板
// - 切换时通知 firework-engine（背景 / 烟花调色板 / 星空密度）
// 公开 API: initThemeDock({ btn, dock, sky, onChange })
// ============================================================

export const SCENES = [
  {
    key: 'gradient',
    name: '暗夜渐变',
    bg: './assets/yyh/scenes/gradient_bg.png',
    palette: ['#ff6b9d', '#c084fc', '#7dd3fc', '#fbbf24', '#f472b6'],
    starDensity: 150,
    starColor: 'rgba(255,255,255,0.9)',
  },
  {
    key: 'starry',
    name: '极简星空',
    bg: './assets/yyh/scenes/starry_bg.png',
    palette: ['#ffffff', '#fef3c7', '#dbeafe', '#fbbf24', '#fde68a'],
    starDensity: 260,
    starColor: 'rgba(255,255,255,1)',
  },
  {
    key: 'realistic',
    name: '写实城市',
    bg: './assets/yyh/scenes/realistic_bg.png',
    palette: ['#fb923c', '#facc15', '#ef4444', '#f97316', '#fbbf24'],
    starDensity: 60,
    starColor: 'rgba(255,220,180,0.7)',
  },
  {
    key: 'cyberpunk',
    name: '赛博朋克',
    bg: './assets/yyh/scenes/cyberpunk_bg.png',
    palette: ['#00f3ff', '#ff00d4', '#a855f7', '#22d3ee', '#f472b6'],
    starDensity: 90,
    starColor: 'rgba(0,243,255,0.85)',
  },
  {
    key: 'aurora',
    name: '极光雪原',
    bg: './assets/yyh/scenes/aurora_bg.png',
    palette: ['#86efac', '#67e8f9', '#a7f3d0', '#bae6fd', '#fde68a'],
    starDensity: 200,
    starColor: 'rgba(186,230,253,0.9)',
  },
  {
    key: 'moon',
    name: '海上明月',
    bg: './assets/yyh/scenes/moon_bg.png',
    palette: ['#fef3c7', '#fbbf24', '#fde68a', '#fff7ed', '#fed7aa'],
    starDensity: 120,
    starColor: 'rgba(254,243,199,0.85)',
  },
  {
    key: 'papercut',
    name: '新年窗花',
    bg: './assets/yyh/scenes/papercut_bg.png',
    palette: ['#dc2626', '#fbbf24', '#f97316', '#ef4444', '#facc15'],
    starDensity: 80,
    starColor: 'rgba(254,215,170,0.8)',
  },
  {
    key: 'ink',
    name: '水墨山水',
    bg: './assets/yyh/scenes/ink_bg.png',
    palette: ['#e5e7eb', '#9ca3af', '#fef3c7', '#ffffff', '#d1d5db'],
    starDensity: 100,
    starColor: 'rgba(229,231,235,0.7)',
  },
];

const STORAGE_KEY = 'fw_scene_key';

export function getSavedSceneKey() {
  return localStorage.getItem(STORAGE_KEY) || SCENES[0].key;
}

export function getSceneByKey(key) {
  return SCENES.find((s) => s.key === key) || SCENES[0];
}

/**
 * 初始化场景切换 Dock
 * @param {Object} opts
 * @param {HTMLElement} opts.btn         触发按钮（圆形）
 * @param {HTMLElement} opts.dock        缩略图容器
 * @param {HTMLElement} opts.sky         背景层 #sky
 * @param {(scene:Object)=>void} opts.onChange  场景切换回调
 */
export function initThemeDock({ btn, dock, sky, onChange }) {
  // 渲染缩略图
  dock.innerHTML = SCENES.map(
    (s) => `
      <div class="theme-thumb" data-key="${s.key}" role="option" tabindex="0">
        <div class="thumb-preview" style="background-image:url('${s.bg}')"></div>
        <span class="thumb-label">${s.name}</span>
      </div>`
  ).join('');

  const thumbs = dock.querySelectorAll('.theme-thumb');

  // 应用场景
  function applyScene(key, fireOnChange = true) {
    const scene = getSceneByKey(key);
    sky.style.backgroundImage = `url('${scene.bg}')`;
    sky.classList.add('scene-image');

    thumbs.forEach((t) =>
      t.classList.toggle('is-active', t.dataset.key === scene.key)
    );

    localStorage.setItem(STORAGE_KEY, scene.key);
    if (fireOnChange && typeof onChange === 'function') onChange(scene);
  }

  // 缩略图点击
  thumbs.forEach((t) => {
    t.addEventListener('click', () => applyScene(t.dataset.key));
    t.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        applyScene(t.dataset.key);
      }
    });
  });

  // Dock 展开 / 收起
  function setOpen(open) {
    dock.classList.toggle('open', open);
    btn.classList.toggle('is-active', open);
    btn.setAttribute('aria-expanded', String(open));
  }
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    setOpen(!dock.classList.contains('open'));
  });
  document.addEventListener('click', (e) => {
    if (!dock.contains(e.target) && e.target !== btn) setOpen(false);
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') setOpen(false);
  });

  // 初始：恢复上次场景
  applyScene(getSavedSceneKey(), true);
}
