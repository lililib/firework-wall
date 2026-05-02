// ============================================================
// 烟花动画引擎 v3
// 新增：玫瑰花形状 + 图片烟花(含边缘检测) + 彩色粒子 + 白茫茫修复
// 公开 API:
//   initFireworkEngine(canvasEl, textCanvasEl)
//   createFirework(message, color)          -- 发送文字/表情烟花（🌹 自动变玫瑰花）
//   createFireworkFromImage(dataUrl, color, edgeOnly) -- 发送图片烟花
//   setScene(scene)
//   pickSceneColor()
// ============================================================

const PI_2    = Math.PI * 2;
const PI_HALF = Math.PI * 0.5;

let canvas, ctx, textCanvas, textCtx;
let width = 0, height = 0;

const fireworks = [];
const particles = [];
const sparks    = [];   // 活跃余烬粒子

let stars = [];
const _sparkPool = []; // Spark 对象池

/* ---------- 统一调色板（对齐原网站固定 6 色 + 白色限频）---------- */
const PALETTE = ['#ff0043', '#14fc56', '#1e7fff', '#e60aff', '#ffbf36', '#ffffff'];
let _lastColor = '';

export function pickSceneColor() {
  let color = PALETTE[Math.floor(Math.random() * PALETTE.length)];
  // 白色限频：抽到白色时 60% 概率重新抽，避免过多白色烟花
  if (color === '#ffffff' && Math.random() < 0.6)
    color = PALETTE[Math.floor(Math.random() * PALETTE.length)];
  return (_lastColor = color);
}

/* ---------- 当前场景（仅控制星空样式，不再控制调色板）---------- */
let currentScene = {
  key: 'default',
  starDensity: 150,
  starColor: 'rgba(255,255,255,0.9)',
};

export function setScene(scene) {
  currentScene = { ...currentScene, ...scene };
  rebuildStars();
}

/* ---------- 画布 / 星空 ---------- */
function resizeCanvas() {
  width  = window.innerWidth;
  height = window.innerHeight;
  canvas.width  = width;
  canvas.height = height;
  // canvas resize 后内容自动清空（透明），destination-out 方案不需要填黑
  rebuildStars();
}

function rebuildStars() {
  const n = currentScene.starDensity || 150;
  stars = Array.from({ length: n }, () => ({
    x:       Math.random() * width,
    y:       Math.random() * height * 0.7,
    r:       Math.random() * 1.4 + 0.2,
    alpha:   Math.random() * 0.7 + 0.3,
    twinkle: (Math.random() - 0.5) * 0.04,
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

/* ---------- 文字/表情像素提取（提取位置 + 颜色，表情用原生色，文字用 null=烟花色） ---------- */
function getTextParticles(text, cx, cy) {
  const fontSize = Math.min(width / Math.max(text.length, 1), 120);
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
  const gap = 4;
  for (let y = 0; y < height; y += gap) {
    for (let x = 0; x < width; x += gap) {
      const i = (y * width + x) * 4;
      if (imgData[i + 3] > 128) {
        const r = imgData[i], g = imgData[i + 1], b = imgData[i + 2];
        // 表情符号渲染为原生彩色（非纯白），提取真实色；普通文字为白色 → null（使用烟花色）
        const pixelColor = (r < 200 || g < 200 || b < 200) ? `rgb(${r},${g},${b})` : null;
        targets.push({ x: x - width / 2 + cx, y: y - height / 2 + cy, pixelColor });
      }
    }
  }
  return targets;
}

/* ---------- 玫瑰花形状：将 🌹 Emoji 渲染为大图后提取像素（保留真实色彩） ---------- */
function getRoseParticles(cx, cy) {
  const size = Math.min(Math.floor(width * 0.5), Math.floor(height * 0.44), 380);
  textCanvas.width  = size;
  textCanvas.height = size;
  textCtx.clearRect(0, 0, size, size);
  textCtx.font         = `${Math.floor(size * 0.82)}px serif`;
  textCtx.textAlign    = 'center';
  textCtx.textBaseline = 'middle';
  textCtx.fillText('🌹', size / 2, size / 2);

  const { data } = textCtx.getImageData(0, 0, size, size);
  const targets = [];
  const gap = 4;
  for (let y = 0; y < size; y += gap) {
    for (let x = 0; x < size; x += gap) {
      const i = (y * size + x) * 4;
      if (data[i + 3] > 80) {
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

/* ---------- Sobel 边缘检测（人像轮廓模式） ---------- */
function sobelEdges(data, w, h) {
  const gray = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) {
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

/* ---------- 图片像素提取（完整色彩 或 仅边缘轮廓） ---------- */
function getImageParticles(img, cx, cy, edgeOnly) {
  const maxW = width * 0.42;
  const maxH = height * 0.42;
  const s = Math.min(maxW / img.width, maxH / img.height, 1);
  const w = Math.floor(img.width * s);
  const h = Math.floor(img.height * s);
  textCanvas.width  = w;
  textCanvas.height = h;
  textCtx.clearRect(0, 0, w, h);
  textCtx.drawImage(img, 0, 0, w, h);
  const { data } = textCtx.getImageData(0, 0, w, h);
  const targets = [];
  const gap = edgeOnly ? 3 : 5;
  if (edgeOnly) {
    const edges = sobelEdges(data, w, h);
    let maxE = 0;
    for (let k = 0; k < edges.length; k++) if (edges[k] > maxE) maxE = edges[k];
    const thresh = maxE * 0.18;
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
        if (data[i + 3] > 128) {
          targets.push({ x: cx - w / 2 + x, y: cy - h / 2 + y, pixelColor: `rgb(${data[i]},${data[i+1]},${data[i+2]})` });
        }
      }
    }
  }
  return targets;
}

/* ---------- createBurst — 球面均匀分布（移植自 CodePen MillerTime） ---------- */
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

/* ---------- Spark 余烬粒子 ---------- */
class Spark {
  reset(x, y, color, angle, speed, life) {
    this.x      = x;   this.prevX = x;
    this.y      = y;   this.prevY = y;
    this.color  = color;
    this.speedX = Math.sin(angle) * speed;
    this.speedY = Math.cos(angle) * speed;
    this.life   = life;
    this.maxLife = life;
    return this;
  }

  update() {
    this.prevX   = this.x;
    this.prevY   = this.y;
    this.x      += this.speedX;
    this.y      += this.speedY;
    this.speedX *= 0.88;
    this.speedY *= 0.88;
    this.speedY += 0.04;
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

/* ---------- Particle — 保留文字成形，升级爆炸方向 + 余烬 + 像素色 ---------- */
class Particle {
  constructor(x, y, targetX, targetY, color, burstAngle, burstSpeedMult, pixelColor = null) {
    this.x       = x;   this.targetX = targetX;
    this.y       = y;   this.targetY = targetY;
    this.color   = color;
    this.pixelColor = pixelColor; // 表情/图片模式下每粒子的真实像素颜色

    // 爆炸初速度：10-16 px/帧，比原来 4-8 大一倍，炸开半径更宽
    const speed  = (Math.random() * 6 + 10) * (burstSpeedMult !== undefined ? burstSpeedMult : 1);
    const angle  = burstAngle !== undefined ? burstAngle : Math.random() * PI_2;
    this.vx      = Math.sin(angle) * speed;
    this.vy      = Math.cos(angle) * speed;

    this.friction  = 0.92;
    this.gravity   = 0.05;
    this.life      = 160;
    this.maxLife   = 160;
    this.state     = 'explode';
    this.delay     = Math.random() * 10 + 28; // 28-38 帧后收敛，等粒子完全炸开再聚拢

    // 余烬参数（glitter: medium 风格）
    this.sparkFreq  = (30 + Math.random() * 30) | 0;
    this.sparkTimer = (Math.random() * this.sparkFreq) | 0;
    this.sparkSpeed = 0.5 + Math.random() * 0.8;
    this.sparkLife  = (18 + Math.random() * 14) | 0;
  }

  update() {
    if (this.state === 'explode') {
      this.vx *= this.friction;
      this.vy *= this.friction;
      this.vy += this.gravity;
      this.x  += this.vx;
      this.y  += this.vy;
      this.delay--;
      if (this.delay <= 0) {
        // 去掉速度<1的等待条件，delay 倒计时结束就立即收敛
        this.state = 'form';
      }
    } else if (this.state === 'form') {
      this.x += (this.targetX - this.x) * 0.055; // 原 0.025，提速 2.2x
      this.y += (this.targetY - this.y) * 0.055;
      this.y += Math.sin(Date.now() / 200 + this.x) * 0.2;
      this.life--;
      if (this.life <= 60) {
        this.state = 'fade';
        this.vx = (Math.random() - 0.5) * 1.2; // 随机横向初速，粒子散开掉落
        this.vy = Math.random() * 0.3;          // 微小初始向下速度
      }

      // 发射余烬 spark
      this.sparkTimer--;
      if (this.sparkTimer <= 0) {
        this.sparkTimer = this.sparkFreq;
        const sp = (_sparkPool.pop() || new Spark()).reset(
          this.x, this.y, this.color,
          Math.random() * PI_2,
          this.sparkSpeed * (0.4 + Math.random() * 0.6),
          this.sparkLife
        );
        sparks.push(sp);
      }
    } else {
      // 重力加速掉落 + 颜色随 life/maxLife 自然变浅
      this.vy += 0.08;
      this.vx *= 0.98;
      this.x  += this.vx;
      this.y  += this.vy;
      this.life--;
    }
    return this.life > 0;
  }

  draw() {
    const alpha = Math.max(0, this.life / this.maxLife);
    ctx.globalAlpha = alpha;
    ctx.beginPath();
    ctx.arc(this.x, this.y, 1.6, 0, PI_2);
    ctx.fillStyle = this.pixelColor || this.color;
    ctx.fill();
    ctx.globalAlpha = 1;
  }
}

/* ---------- Firework — 新增螺旋晃动上升（仿 CodePen spinRadius） ---------- */
class Firework {
  constructor(message, color) {
    this.x       = width / 2 + (Math.random() - 0.5) * (width * 0.5);
    this.y       = height;
    this.targetX = this.x + (Math.random() - 0.5) * 200;
    this.targetY = height * 0.2 + Math.random() * (height * 0.2);
    this.color   = color;
    this.message = message;
    this.speed   = 12;
    this.angle   = Math.atan2(this.targetY - this.y, this.targetX - this.x);
    this.vx      = Math.cos(this.angle) * this.speed;
    this.vy      = Math.sin(this.angle) * this.speed;
    this.trail   = [];

    // 螺旋晃动参数（移植自 CodePen comet.spinRadius / spinSpeed）
    this.spinRadius = 0.5 + Math.random() * 1.0;
    this.spinAngle  = Math.random() * PI_2;
    this.spinSpeed  = 0.3 + Math.random() * 0.5;

    // 炸开半径随机缩放：0.6x ~ 1.8x，偏向大值，每发烟花有大有小
    this.burstScale = 0.6 + Math.pow(Math.random(), 0.6) * 1.2;
  }

  update() {
    this.trail.push({ x: this.x, y: this.y });
    if (this.trail.length > 5) this.trail.shift();

    this.x  += this.vx;
    this.y  += this.vy;
    this.vy += 0.05;

    // 螺旋晃动叠加（与 CodePen star.spinRadius 机制相同）
    this.spinAngle += this.spinSpeed;
    this.x += Math.sin(this.spinAngle) * this.spinRadius;
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
    let targets;
    if (this.message === '🌹') {
      targets = getRoseParticles(this.x, this.y);
    } else if (this._imageEl) {
      targets = getImageParticles(this._imageEl, this.x, this.y, this._edgeOnly);
    } else {
      targets = getTextParticles(this.message, this.x, this.y);
    }

    if (targets.length === 0) {
      for (let i = 0; i < 100; i++) {
        const a = Math.random() * PI_2;
        targets.push({ x: this.x + Math.cos(a) * 100, y: this.y + Math.sin(a) * 100, pixelColor: null });
      }
    }

    // 随机爆炸形态（参考原网站 ring / sphere 两种方式）
    const burstType = Math.random();
    const dirs = [];

    if (burstType < 0.3) {
      // 环形炸开（ring）
      const ringOffset = Math.random() * PI_2;
      const tilt       = Math.pow(Math.random(), 2) * 0.8 + 0.2;
      for (let i = 0; i < targets.length; i++) {
        const a = (i / targets.length) * PI_2 + ringOffset;
        dirs.push({ angle: a, speedMult: (tilt + Math.random() * 0.2) * this.burstScale });
      }
    } else {
      // 球面均匀炸开（默认）
      createBurst(targets.length, (angle, speedMult) =>
        dirs.push({ angle, speedMult: speedMult * this.burstScale })
      );
    }

    for (let i = 0; i < targets.length; i++) {
      const d = dirs[i % dirs.length];
      particles.push(new Particle(
        this.x, this.y,
        targets[i].x, targets[i].y,
        this.color,
        d.angle, d.speedMult,
        targets[i].pixelColor || null
      ));
    }
  }
}

/* ---------- 动画循环 ---------- */
function animate() {
  requestAnimationFrame(animate);

  // destination-out：每帧用半透明黑色"擦除" canvas alpha，粒子轨迹逐渐消散到透明
  // 背景图通过透明区域自然透出，无需 CSS mix-blend-mode
  ctx.globalCompositeOperation = 'destination-out';
  ctx.fillStyle = 'rgba(0, 0, 0, 0.175)';
  ctx.fillRect(0, 0, width, height);

  // lighten = max(src, dst)，多粒子叠加不累加变白
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

/* ---------- 公开 API ---------- */
export function initFireworkEngine(canvasEl, textCanvasEl) {
  canvas     = canvasEl;
  ctx        = canvas.getContext('2d');
  textCanvas = textCanvasEl;
  textCtx    = textCanvas.getContext('2d', { willReadFrequently: true });

  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);
  animate();
}

export function createFirework(message, color) {
  fireworks.push(new Firework(message, color || pickSceneColor()));
}

// 从图片 DataURL 创建烟花；edgeOnly=true 时仅提取轮廓（人像推荐）
export function createFireworkFromImage(imgDataUrl, color, edgeOnly = false) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const fw = new Firework('', color || pickSceneColor());
      fw._imageEl  = img;
      fw._edgeOnly = edgeOnly;
      fireworks.push(fw);
      resolve();
    };
    img.onerror = reject;
    img.src = imgDataUrl;
  });
}

// 进场烟花：从屏幕底部中央缓慢螺旋上升，无文字
// 对照 yunyanhua.top 源码精确还原：
//   spinSpeed = 0.8（固定，原项目 Re.add 默认值）
//   spinRadius = gr.random(0.32, 0.85)
//   speed = Math.pow(dist * 0.04, 0.64)（距离幂函数）
export function introFirework() {
  const fw   = new Firework('', pickSceneColor());
  const dist  = height * 0.725 - 25;                  // 原项目：0.725h - 25
  const speed = Math.pow(dist * 0.04, 0.64);
  fw.x          = width / 2;
  fw.y          = height;
  fw.targetX    = width / 2;
  fw.targetY    = height * 0.275 + 25;                 // 原项目爆炸高度
  fw.speed      = speed;
  fw.angle      = Math.atan2(fw.targetY - fw.y, fw.targetX - fw.x);
  fw.vx         = Math.cos(fw.angle) * fw.speed;
  fw.vy         = Math.sin(fw.angle) * fw.speed;
  fw.spinSpeed  = 0.8;                                 // 原项目固定值（快速振荡 = 歪歪扭扭）
  fw.spinRadius = 0.32 + Math.random() * 0.53;         // 原项目 gr.random(0.32, 0.85)
  fireworks.push(fw);
}
