// ============================================================
// 烟花动画引擎 / Firework Animation Engine
// 功能：烟花发射 → 粒子爆炸 → 文字/图片/玫瑰聚拢 → 消散
// Features: launch → burst → text/image/rose formation → fade
// ============================================================
import { play as playSound } from './sound.js';

const PI_2    = Math.PI * 2;
const PI_HALF = Math.PI * 0.5;

// 图片烟花粒子数上限，超出后均匀降采样 / Max particles for image fireworks; downsampled if exceeded
const MAX_IMAGE_PARTICLES = 3000;

// 屏幕上同时存在的最大烟花数（火箭阶段），超出后进入等待队列
// Max concurrent fireworks on screen (rocket phase); excess goes into a pending queue
const MAX_CONCURRENT_FIREWORKS = 5;

let canvas, ctx, textCanvas, textCtx;
let width = 0, height = 0;

const fireworks     = [];
const particles     = [];
const sparks        = [];
const _burstFlashes = []; // 爆炸瞬间径向闪光队列 / Burst flash queue

let stars = [];
const _sparkPool    = []; // 余烬粒子对象池，减少 GC 压力 / Spark object pool to reduce GC pressure
const _launchQueue  = []; // 待发射队列，并发超限时缓冲 / Pending launch queue when concurrent limit is reached

/* ---------- 统一调色板 / Unified Color Palette ---------- */
// 修改此数组可自定义烟花颜色 / Edit this array to customize firework colors
const PALETTE = ['#ff0043', '#14fc56', '#1e7fff', '#e60aff', '#ffbf36', '#ffffff'];

export function pickSceneColor() {
  let color = PALETTE[Math.floor(Math.random() * PALETTE.length)];
  // 降低纯白出现频率，避免视觉过于单调 / Reduce white frequency to improve color variety
  if (color === '#ffffff' && Math.random() < 0.6)
    color = PALETTE[Math.floor(Math.random() * PALETTE.length)];
  return color;
}

/* ---------- 场景配置 / Scene Configuration ---------- */
let currentScene = {
  key: 'default',
  starDensity: 150, // 星星数量 / Number of stars
  starColor: 'rgba(255,255,255,0.9)',
};

export function setScene(scene) {
  currentScene = { ...currentScene, ...scene };
  rebuildStars();
}

/* ---------- 画布与星空 / Canvas & Stars ---------- */
function resizeCanvas() {
  width  = window.innerWidth;
  height = window.innerHeight;
  canvas.width  = width;
  canvas.height = height;
  rebuildStars();
}

function rebuildStars() {
  const n = currentScene.starDensity || 150;
  stars = Array.from({ length: n }, () => ({
    x:       Math.random() * width,
    y:       Math.random() * height * 0.7,  // 仅在画面上方 70% 生成星星 / Stars only in top 70% of screen
    r:       Math.random() * 1.4 + 0.2,     // 半径范围 0.2–1.6px / Radius range 0.2–1.6px
    alpha:   Math.random() * 0.7 + 0.3,     // 透明度范围 0.3–1.0 / Alpha range 0.3–1.0
    twinkle: (Math.random() - 0.5) * 0.04,  // 每帧透明度变化幅度 / Alpha delta per frame
  }));
}

function drawStars() {
  ctx.fillStyle = currentScene.starColor || 'rgba(255,255,255,0.9)';
  for (const s of stars) {
    s.alpha += s.twinkle;
    if (s.alpha < 0.15) { s.alpha = 0.15; s.twinkle =  Math.abs(s.twinkle); }
    if (s.alpha > 1)    { s.alpha = 1;    s.twinkle = -Math.abs(s.twinkle); }
    ctx.globalAlpha = s.alpha;
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, 0, PI_2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

/* ---------- 文字/表情像素提取 / Text & Emoji Pixel Sampling ---------- */
function getTextParticles(text, cx, cy) {
  const fontSize = Math.min(width / Math.max(text.length, 1), 120); // 字体大小上限 120px / Max font size 120px
  textCanvas.width  = width;
  textCanvas.height = height;
  textCtx.clearRect(0, 0, width, height);
  textCtx.font         = `500 ${fontSize}px "Noto Serif SC", "Microsoft YaHei", sans-serif`;
  textCtx.fillStyle    = 'white';
  textCtx.textAlign    = 'center';
  textCtx.textBaseline = 'middle';
  textCtx.fillText(text, width / 2, height / 2);

  const imgData = textCtx.getImageData(0, 0, width, height).data;
  const targets = [];
  const gap = 4; // 像素采样间隔（值越大粒子越少）/ Pixel sampling gap; larger = fewer particles
  for (let y = 0; y < height; y += gap) {
    for (let x = 0; x < width; x += gap) {
      const i = (y * width + x) * 4;
      if (imgData[i + 3] > 128) { // alpha > 128 视为可见像素 / Alpha > 128 treated as visible pixel
        const r = imgData[i], g = imgData[i + 1], b = imgData[i + 2];
        const pixelColor = (r < 200 || g < 200 || b < 200) ? `rgb(${r},${g},${b})` : null;
        targets.push({ x: x - width / 2 + cx, y: y - height / 2 + cy, pixelColor });
      }
    }
  }
  return targets;
}

/* ---------- 玫瑰花形状 / Rose Shape ---------- */
function getRoseParticles(cx, cy) {
  const size = Math.min(Math.floor(width * 0.5), Math.floor(height * 0.44), 380);
  textCanvas.width  = size;
  textCanvas.height = size;
  textCtx.clearRect(0, 0, size, size);
  textCtx.font         = `${Math.floor(size * 0.82)}px serif`; // 0.82 使 emoji 充满画布 / 0.82 fills the canvas
  textCtx.textAlign    = 'center';
  textCtx.textBaseline = 'middle';
  textCtx.fillText('🌹', size / 2, size / 2);

  const { data } = textCtx.getImageData(0, 0, size, size);
  const targets = [];
  const gap = 4;
  for (let y = 0; y < size; y += gap) {
    for (let x = 0; x < size; x += gap) {
      const i = (y * size + x) * 4;
      if (data[i + 3] > 80) { // 玫瑰用较低阈值以保留花瓣细节 / Lower threshold to preserve petal detail
        targets.push({
          x: cx - size / 2 + x,
          y: cy - size / 2 + y,
          pixelColor: `rgb(${data[i]},${data[i + 1]},${data[i + 2]})`,
        });
      }
    }
  }
  return targets;
}

/* ---------- Sobel 边缘检测 / Sobel Edge Detection ---------- */
function sobelEdges(data, w, h) {
  const gray = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) {
    // ITU-R BT.601 标准亮度权重：R×0.299 + G×0.587 + B×0.114 / Standard luma weights
    gray[i] = data[i * 4] * 0.299 + data[i * 4 + 1] * 0.587 + data[i * 4 + 2] * 0.114;
  }
  const edges = new Float32Array(w * h);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const g = (ry, rx) => gray[ry * w + rx];
      const gx = -g(y-1,x-1) + g(y-1,x+1) - 2*g(y,x-1) + 2*g(y,x+1) - g(y+1,x-1) + g(y+1,x+1);
      const gy = -g(y-1,x-1) - 2*g(y-1,x) - g(y-1,x+1) + g(y+1,x-1) + 2*g(y+1,x) + g(y+1,x+1);
      edges[y * w + x] = Math.sqrt(gx * gx + gy * gy);
    }
  }
  return edges;
}

/* ---------- 图片像素提取 / Image Pixel Sampling ---------- */
// edgeOnly=true 使用 Sobel 轮廓模式，false 使用完整色彩模式
// edgeOnly=true uses Sobel edge mode; false uses full-color mode
function getImageParticles(img, cx, cy, edgeOnly) {
  const maxW = width * 0.42;  // 图片最大宽度为画布的 42% / Max image width is 42% of canvas
  const maxH = height * 0.42; // 图片最大高度为画布的 42% / Max image height is 42% of canvas
  const s = Math.min(maxW / img.width, maxH / img.height, 1);
  const w = Math.floor(img.width * s);
  const h = Math.floor(img.height * s);
  textCanvas.width  = w;
  textCanvas.height = h;
  textCtx.clearRect(0, 0, w, h);
  textCtx.drawImage(img, 0, 0, w, h);
  const { data } = textCtx.getImageData(0, 0, w, h);
  const targets = [];
  const gap = edgeOnly ? 3 : 5; // 轮廓模式间距更小以保留边缘细节 / Smaller gap for edge mode to preserve detail
  if (edgeOnly) {
    const edges = sobelEdges(data, w, h);
    let maxE = 0;
    for (let k = 0; k < edges.length; k++) if (edges[k] > maxE) maxE = edges[k];
    const thresh = maxE * 0.18; // 取最大边缘强度的 18% 作为阈值 / Threshold at 18% of max edge strength
    for (let y = 1; y < h - 1; y += gap) {
      for (let x = 1; x < w - 1; x += gap) {
        if (edges[y * w + x] > thresh) {
          const i = (y * w + x) * 4;
          targets.push({ x: cx - w / 2 + x, y: cy - h / 2 + y, pixelColor: `rgb(${data[i]},${data[i+1]},${data[i+2]})` });
        }
      }
    }
  } else {
    for (let y = 0; y < h; y += gap) {
      for (let x = 0; x < w; x += gap) {
        const i = (y * w + x) * 4;
        if (data[i + 3] > 128) { // alpha > 128 视为不透明像素 / Alpha > 128 treated as opaque pixel
          targets.push({ x: cx - w / 2 + x, y: cy - h / 2 + y, pixelColor: `rgb(${data[i]},${data[i+1]},${data[i+2]})` });
        }
      }
    }
  }
  if (targets.length > MAX_IMAGE_PARTICLES) {
    const step = targets.length / MAX_IMAGE_PARTICLES;
    const reduced = [];
    for (let i = 0; i < MAX_IMAGE_PARTICLES; i++) {
      reduced.push(targets[Math.floor(i * step)]);
    }
    return reduced;
  }
  return targets;
}

/* ---------- createBurst — 径向均匀分布 / Radially Uniform Distribution ---------- */
function createBurst(count, factory, startAngle = 0, arcLength = PI_2) {
  const R      = 0.5 * Math.sqrt(count / Math.PI);
  const C      = 2 * R * Math.PI;
  const C_HALF = C / 2;
  for (let i = 0; i <= C_HALF; i++) {
    const ringAngle        = (i / C_HALF) * PI_HALF;
    const ringSize         = Math.cos(ringAngle);
    const partsPerFullRing = C * ringSize;
    const partsPerArc      = partsPerFullRing * (arcLength / PI_2);
    const angleInc         = PI_2 / partsPerFullRing;
    const angleOffset      = Math.random() * angleInc + startAngle;
    const maxRandOffset    = angleInc * 0.33;
    for (let j = 0; j < partsPerArc; j++) {
      factory(angleInc * j + angleOffset + Math.random() * maxRandOffset, ringSize);
    }
  }
}

/* ---------- Spark — 余烬粒子 / Ember Particle ---------- */
class Spark {
  reset(x, y, color, angle, speed, maxLife, lifeVariation = 0.25) {
    this.x      = x;   this.prevX = x;
    this.y      = y;   this.prevY = y;
    this.color  = color;
    this.speedX = Math.sin(angle) * speed;
    this.speedY = Math.cos(angle) * speed;
    // lifeVariation 让余烬长短参差，视觉更自然 / Life variation creates staggered ember durations
    this.maxLife = maxLife * (0.8 + Math.random() * lifeVariation * 2);
    this.life   = this.maxLife;
    return this;
  }

  update() {
    this.prevX   = this.x;
    this.prevY   = this.y;
    this.x      += this.speedX;
    this.y      += this.speedY;
    this.speedX *= 0.88; // 空气阻力 / Air drag
    this.speedY *= 0.88;
    this.speedY += 0.04; // 重力 / Gravity
    this.life--;
    return this.life > 0;
  }

  draw() {
    ctx.globalAlpha = (this.life / this.maxLife) * 0.7;
    ctx.strokeStyle = this.color;
    ctx.lineWidth   = 1.0;
    ctx.beginPath();
    ctx.moveTo(this.x,     this.y);
    ctx.lineTo(this.prevX, this.prevY);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
}

/* ---------- Particle — 爆炸 → 聚拢 → 消散 三阶段状态机 ---------- */
/* ---------- Particle — Three-phase state machine: explode → form → fade ---------- */
class Particle {
  constructor(x, y, targetX, targetY, color, burstAngle, burstSpeedMult, pixelColor = null) {
    this.x       = x;   this.prevX = x;
    this.y       = y;   this.prevY = y;
    this.targetX = targetX; // 聚拢目标坐标（文字/图片像素位置）/ Target position for formation
    this.targetY = targetY;
    this.color   = color;
    this.pixelColor = pixelColor; // 图片像素原色，null 则使用 color / Original pixel color for image fireworks

    // 初速度 8–13 px/帧，配合 airDrag=0.94 保持合理爆炸半径 / Initial speed 8–13 px/frame
    const speed  = (Math.random() * 5 + 8) * (burstSpeedMult !== undefined ? burstSpeedMult : 1);
    const angle  = burstAngle !== undefined ? burstAngle : Math.random() * PI_2;
    this.vx      = Math.sin(angle) * speed;
    this.vy      = Math.cos(angle) * speed;

    this.airDrag   = 0.94;  // 空气阻力系数，保留较长弧线轨迹 / Air drag coefficient, keeps longer arc
    this.gravity   = 0.05;  // 每帧重力加速度（px/帧²）/ Gravity per frame (px/frame²)
    this.life      = 160;   // 粒子总生命帧数 / Total particle lifetime in frames
    this.maxLife   = 160;
    this.state     = 'explode';
    this.delay     = Math.random() * 10 + 28; // explode 阶段持续帧数（28–38帧）/ Explode phase duration

    // 30% 概率启用渐变色，由 Firework 注入 secondColor / 30% chance of color transition, injected by Firework
    this.secondColor    = null;
    this.colorChanged   = false;
    this.transitionTime = Math.floor(this.maxLife * (0.25 + Math.random() * 0.15));

    // 15% 概率开启频闪效果，由 Firework 注入 / 15% chance of strobe, injected by Firework
    this.strobe     = false;
    this.strobeFreq = Math.random() * 2 + 2; // 闪烁周期 2–4 帧 / Strobe period 2–4 frames
    this.visible    = true;
    this.noForm     = false; // true 时跳过 form 阶段，直接消散（用于无文字烟花）/ Skip formation phase

    // 余烬粒子参数 / Ember spark parameters
    this.sparkFreq  = (30 + Math.random() * 30) | 0; // 每隔多少帧产生一粒余烬 / Frames between sparks
    this.sparkTimer = (Math.random() * this.sparkFreq) | 0;
    this.sparkSpeed = 0.5 + Math.random() * 0.8;     // 余烬飞散速度 / Spark scatter speed
    this.sparkLife  = (18 + Math.random() * 14) | 0; // 余烬生命帧数 18–32 / Spark lifetime 18–32 frames
  }

  update() {
    this.prevX = this.x;
    this.prevY = this.y;

    if (this.state === 'explode') {
      this.vx *= this.airDrag;
      this.vy *= this.airDrag;
      this.vy += this.gravity;
      this.x  += this.vx;
      this.y  += this.vy;
      this.delay--;

      // 颜色渐变切换 / Color transition
      if (this.secondColor && !this.colorChanged && this.life < this.transitionTime) {
        this.colorChanged = true;
        this.color = this.secondColor;
      }
      // 频闪：on:off:off 模式 / Strobe: on:off:off pattern
      if (this.strobe) {
        this.visible = Math.floor(this.life / this.strobeFreq) % 3 === 0;
      }

      if (this.delay <= 0) this.state = this.noForm ? 'fade' : 'form';

    } else if (this.state === 'form') {
      // 弹簧引力：向目标位置收拢 / Spring attraction toward target position
      const dx = this.targetX - this.x;
      const dy = this.targetY - this.y;
      this.vx = this.vx * 0.75 + dx * 0.015; // 0.75 保留惯性，0.015 为引力强度 / 0.75 inertia, 0.015 attraction
      this.vy = this.vy * 0.75 + dy * 0.015;
      this.x += this.vx;
      this.y += this.vy;
      this.y += Math.sin(Date.now() / 200 + this.x) * 0.1; // 微弱波浪浮动 / Subtle wave drift
      this.visible = true; // form 阶段始终可见，确保文字清晰 / Always visible during formation
      this.life--;
      if (this.life <= 60) { // 最后 60 帧进入消散 / Enter fade in last 60 frames
        this.state = 'fade';
        this.vx = (Math.random() - 0.5) * 1.2;
        this.vy = Math.random() * 0.3;
      }

      // 产生余烬 spark / Emit ember spark
      this.sparkTimer--;
      if (this.sparkTimer <= 0) {
        this.sparkTimer = this.sparkFreq;
        const sp = (_sparkPool.pop() || new Spark()).reset(
          this.x, this.y, this.color,
          Math.random() * PI_2,
          this.sparkSpeed * (0.4 + Math.random() * 0.6),
          this.sparkLife,
          0.5 // lifeVariation 让余烬长短参差 / Life variation for natural stagger
        );
        sparks.push(sp);
      }
    } else {
      // fade：重力加速坠落 / Gravity-accelerated fall
      this.vy += 0.08;
      this.vx *= 0.98;
      this.x  += this.vx;
      this.y  += this.vy;
      this.life--;
    }
    return this.life > 0;
  }

  draw() {
    if (!this.visible) return;
    const alpha = Math.max(0, this.life / this.maxLife);
    ctx.globalAlpha = alpha;
    // 用线段替代圆点，产生彗星拖尾效果 / Line segment instead of dot for comet trail effect
    ctx.strokeStyle = this.pixelColor || this.color;
    ctx.lineWidth   = 2.5;
    ctx.lineCap     = 'round';
    ctx.beginPath();
    ctx.moveTo(this.x,     this.y);
    ctx.lineTo(this.prevX, this.prevY);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
}

/* ---------- Firework — 烟花弹体 / Firework Shell ---------- */
class Firework {
  constructor(message, color) {
    this.x       = width / 2 + (Math.random() - 0.5) * (width * 0.5); // 水平随机发射位置 / Random horizontal launch position
    this.y       = height;
    this.targetX = this.x + (Math.random() - 0.5) * 200; // 爆炸点水平偏移 ±100px / Burst X offset ±100px
    this.targetY = height * 0.2 + Math.random() * (height * 0.2); // 爆炸高度：画面上方 20–40% / Burst height: top 20–40%
    this.color   = color;
    this.message = message;
    this.speed   = 12; // 初始发射速度（px/帧）/ Initial launch speed (px/frame)
    this.angle   = Math.atan2(this.targetY - this.y, this.targetX - this.x);
    this.vx      = Math.cos(this.angle) * this.speed;
    this.vy      = Math.sin(this.angle) * this.speed;
    this.trail   = [];

    this.spinRadius = 0.5 + Math.random() * 1.0; // 螺旋半径 0.5–1.5px / Spiral radius 0.5–1.5px
    this.spinAngle  = Math.random() * PI_2;
    this.spinSpeed  = 0.3 + Math.random() * 0.5;  // 螺旋角速度 / Spiral angular velocity
    this.burstScale = 0.6 + Math.pow(Math.random(), 0.6) * 1.2; // 爆炸规模缩放 / Burst scale factor

    // 30% 概率分配渐变色，丰富视觉层次 / 30% chance of secondary color for visual variety
    const others = PALETTE.filter(c => c !== color);
    this.secondColor = Math.random() < 0.3
      ? others[Math.floor(Math.random() * others.length)]
      : null;

    // 15% 概率开启频闪效果 / 15% chance of strobe shell type
    this.shellType = Math.random() < 0.15 ? 'strobe' : 'normal';
    this.pureBlast = false; // true 时粒子跳过聚拢直接消散（用于无文字进场烟花）/ Skip formation for pure burst

    playSound('lift');
  }

  update() {
    this.trail.push({ x: this.x, y: this.y });
    if (this.trail.length > 5) this.trail.shift();

    this.x  += this.vx;
    this.y  += this.vy;
    this.vy += 0.05; // 重力减速 / Gravity deceleration

    this.spinAngle += this.spinSpeed;
    this.x += Math.sin(this.spinAngle) * this.spinRadius; // 螺旋运动 / Spiral motion
    this.y += Math.cos(this.spinAngle) * this.spinRadius;

    if (this.vy >= 0 || this.y <= this.targetY) {
      this.explode();
      return false;
    }
    return true;
  }

  draw() {
    if (this.trail.length === 0) return;
    ctx.beginPath();
    ctx.moveTo(this.trail[0].x, this.trail[0].y);
    for (let i = 1; i < this.trail.length; i++) ctx.lineTo(this.trail[i].x, this.trail[i].y);
    ctx.strokeStyle = this.color;
    ctx.lineWidth   = 3;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(this.x, this.y, 3, 0, PI_2);
    ctx.fillStyle = '#fff';
    ctx.fill();
  }

  explode() {
    playSound('burst');

    let targets;
    if (this.message === '🌹') {
      targets = getRoseParticles(this.x, this.y);
    } else if (this._imageEl) {
      targets = getImageParticles(this._imageEl, this.x, this.y, this._edgeOnly);
    } else {
      targets = getTextParticles(this.message, this.x, this.y);
    }

    // 无文字内容时降级为随机圆形散射 / Fallback to random circle when no text content
    if (targets.length === 0) {
      for (let i = 0; i < 100; i++) {
        const a = Math.random() * PI_2;
        targets.push({ x: this.x + Math.cos(a) * 100, y: this.y + Math.sin(a) * 100, pixelColor: null });
      }
    }

    const burstType = Math.random();
    const dirs = [];

    if (burstType < 0.3) {
      // 30% 概率：环形爆炸模式 / 30% chance: ring burst pattern
      const ringOffset = Math.random() * PI_2;
      const tilt       = Math.pow(Math.random(), 2) * 0.8 + 0.2;
      for (let i = 0; i < targets.length; i++) {
        const a = (i / targets.length) * PI_2 + ringOffset;
        dirs.push({ angle: a, speedMult: (tilt + Math.random() * 0.2) * this.burstScale });
      }
    } else {
      // 70% 概率：径向均匀分布爆炸 / 70% chance: radially uniform burst
      createBurst(targets.length, (angle, speedMult) =>
        dirs.push({ angle, speedMult: speedMult * this.burstScale })
      );
    }

    for (let i = 0; i < targets.length; i++) {
      const d = dirs[i % dirs.length];
      const p = new Particle(
        this.x, this.y,
        targets[i].x, targets[i].y,
        this.color,
        d.angle, d.speedMult,
        targets[i].pixelColor || null
      );
      // 将烟花级别的属性传递给粒子 / Pass shell-level properties down to particles
      p.secondColor = this.secondColor;
      p.strobe      = this.shellType === 'strobe';
      p.noForm      = this.pureBlast;
      particles.push(p);
    }

    // 爆炸瞬间径向闪光 / Radial burst flash at explosion moment
    _burstFlashes.push({
      x: this.x,
      y: this.y,
      r: 0,
      maxR: 60 + this.burstScale * 40,
    });
  }
}

/* ---------- 发射队列 / Launch Queue ---------- */
// 每帧尝试从队列补发烟花，直到并发数达到上限
// Each frame tries to flush pending launches until the concurrent limit is reached
function _tryFlushQueue() {
  while (_launchQueue.length > 0 && fireworks.length < MAX_CONCURRENT_FIREWORKS) {
    _launchQueue.shift()();
  }
}

/* ---------- 动画循环 / Animation Loop ---------- */
function animate() {
  requestAnimationFrame(animate);
  _tryFlushQueue(); // 每帧尝试补发队列中的烟花 / Try to launch queued fireworks each frame

  ctx.globalCompositeOperation = 'destination-out';
  ctx.fillStyle = 'rgba(0, 0, 0, 0.175)'; // 每帧轻微擦除产生拖尾效果 / Slight erase per frame for trail effect
  ctx.fillRect(0, 0, width, height);

  // BurstFlash 用 source-over 叠加（径向渐变，不参与 lighten 混合）
  // BurstFlash uses source-over blending to avoid interference with lighten composite
  if (_burstFlashes.length > 0) {
    ctx.globalCompositeOperation = 'source-over';
    for (let i = _burstFlashes.length - 1; i >= 0; i--) {
      const bf = _burstFlashes[i];
      bf.r += 8; // 每帧膨胀速度 / Expansion speed per frame
      if (bf.r >= bf.maxR) { _burstFlashes.splice(i, 1); continue; }
      const a = 1 - bf.r / bf.maxR;
      const g = ctx.createRadialGradient(bf.x, bf.y, 0, bf.x, bf.y, bf.r);
      g.addColorStop(0.024, `rgba(255,255,255,${a})`);
      g.addColorStop(0.15,  `rgba(255,160,20,${a * 0.4})`);
      g.addColorStop(1,     'rgba(255,120,20,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(bf.x, bf.y, bf.r, 0, PI_2);
      ctx.fill();
    }
  }

  ctx.globalCompositeOperation = 'lighten';
  drawStars();

  for (let i = fireworks.length - 1; i >= 0; i--) {
    if (!fireworks[i].update()) fireworks.splice(i, 1);
    else fireworks[i].draw();
  }
  for (let i = particles.length - 1; i >= 0; i--) {
    if (!particles[i].update()) particles.splice(i, 1);
    else particles[i].draw();
  }
  for (let i = sparks.length - 1; i >= 0; i--) {
    const s = sparks[i];
    if (!s.update()) {
      sparks.splice(i, 1);
      _sparkPool.push(s);
    } else {
      s.draw();
    }
  }
}

/* ---------- 公开 API / Public API ---------- */
export function initFireworkEngine(canvasEl, textCanvasEl) {
  canvas     = canvasEl;
  ctx        = canvas.getContext('2d');
  textCanvas = textCanvasEl;
  textCtx    = textCanvas.getContext('2d', { willReadFrequently: true }); // 频繁读取像素时的性能优化 / Performance hint for frequent pixel reads

  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);
  animate();
}

export function createFirework(message, color) {
  const launch = () => fireworks.push(new Firework(message, color || pickSceneColor()));
  if (fireworks.length < MAX_CONCURRENT_FIREWORKS) {
    launch();
  } else {
    _launchQueue.push(launch); // 并发已满，加入等待队列 / Concurrent limit reached, enqueue
  }
}

export function createFireworkFromImage(imgDataUrl, color, edgeOnly = false) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const launch = () => {
        const fw = new Firework('', color || pickSceneColor());
        fw._imageEl  = img;
        fw._edgeOnly = edgeOnly;
        fireworks.push(fw);
      };
      if (fireworks.length < MAX_CONCURRENT_FIREWORKS) {
        launch();
      } else {
        _launchQueue.push(launch);
      }
      resolve();
    };
    img.onerror = reject;
    img.src = imgDataUrl;
  });
}

export function introFirework() {
  const fw   = new Firework('', pickSceneColor());
  const dist  = height * 0.725 - 25;
  const speed = Math.pow(dist * 0.04, 0.64);
  fw.x          = width / 2;
  fw.y          = height;
  fw.targetX    = width / 2;
  fw.targetY    = height * 0.275 + 25;
  fw.speed      = speed;
  fw.angle      = Math.atan2(fw.targetY - fw.y, fw.targetX - fw.x);
  fw.vx         = Math.cos(fw.angle) * fw.speed;
  fw.vy         = Math.sin(fw.angle) * fw.speed;
  fw.spinSpeed  = 0.8;
  fw.spinRadius = 0.32 + Math.random() * 0.53;
  fw.pureBlast  = true; // 进场烟花无文字，直接绽放不聚拢 / Intro firework blooms without formation
  fireworks.push(fw);
}
