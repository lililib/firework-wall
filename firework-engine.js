// ============================================================
// 烟花动画引擎
// 公开 API:
//   initFireworkEngine(canvasEl, textCanvasEl)
//   createFirework(message, color)     // 仍兼容传入指定颜色
//   setScene(scene)                    // 切换星空密度 / 烟花调色板 / 星色
//   pickSceneColor()                   // 从当前场景调色板随机取色
// ============================================================

let canvas, ctx, textCanvas, textCtx;
let width = 0, height = 0;

const fireworks = [];
const particles = [];
let stars = [];

/* ------------------ 当前场景态（由 setScene 注入） ------------------ */
let currentScene = {
  key: 'default',
  palette: ['#ff007f', '#ff7f00', '#ffe600', '#7dffae', '#7da8ff'],
  starDensity: 150,
  starColor: 'rgba(255,255,255,0.9)',
};

export function setScene(scene) {
  currentScene = { ...currentScene, ...scene };
  rebuildStars();
}

export function pickSceneColor() {
  const p = currentScene.palette;
  return p[Math.floor(Math.random() * p.length)];
}

/* ------------------ 画布 / 星空 ------------------ */
function resizeCanvas() {
  width = window.innerWidth;
  height = window.innerHeight;
  canvas.width = width;
  canvas.height = height;
  rebuildStars();
}

function rebuildStars() {
  const n = currentScene.starDensity || 150;
  stars = new Array(n).fill(0).map(() => ({
    x: Math.random() * width,
    y: Math.random() * height * 0.7,
    r: Math.random() * 1.4 + 0.2,
    alpha: Math.random() * 0.7 + 0.3,
    twinkle: (Math.random() - 0.5) * 0.04,
  }));
}

function drawStars() {
  ctx.fillStyle = currentScene.starColor || 'rgba(255,255,255,0.9)';
  for (const star of stars) {
    star.alpha += star.twinkle;
    if (star.alpha < 0.15) { star.alpha = 0.15; star.twinkle = Math.abs(star.twinkle); }
    if (star.alpha > 1)    { star.alpha = 1;    star.twinkle = -Math.abs(star.twinkle); }
    ctx.globalAlpha = star.alpha;
    ctx.beginPath();
    ctx.arc(star.x, star.y, star.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

/* ------------------ 文字像素提取 ------------------ */
function getTextParticles(text, centerX, centerY) {
  const fontSize = Math.min(width / Math.max(text.length, 1), 120);
  textCanvas.width = width;
  textCanvas.height = height;

  textCtx.clearRect(0, 0, width, height);
  textCtx.font = `500 ${fontSize}px "Noto Serif SC", "Microsoft YaHei", sans-serif`;
  textCtx.fillStyle = 'white';
  textCtx.textAlign = 'center';
  textCtx.textBaseline = 'middle';
  textCtx.fillText(text, width / 2, height / 2);

  const imgData = textCtx.getImageData(0, 0, width, height).data;
  const targets = [];
  const gap = 4;
  for (let y = 0; y < height; y += gap) {
    for (let x = 0; x < width; x += gap) {
      const idx = (y * width + x) * 4;
      if (imgData[idx + 3] > 128) {
        targets.push({
          x: x - width / 2 + centerX,
          y: y - height / 2 + centerY,
        });
      }
    }
  }
  return targets;
}

/* ------------------ 烟花 / 粒子 ------------------ */
class Firework {
  constructor(message, color) {
    this.x = width / 2 + (Math.random() - 0.5) * (width * 0.5);
    this.y = height;
    this.targetX = this.x + (Math.random() - 0.5) * 200;
    this.targetY = height * 0.2 + Math.random() * (height * 0.2);
    this.color = color;
    this.message = message;
    this.speed = 12;
    this.angle = Math.atan2(this.targetY - this.y, this.targetX - this.x);
    this.vx = Math.cos(this.angle) * this.speed;
    this.vy = Math.sin(this.angle) * this.speed;
    this.trail = [];
  }

  update() {
    this.trail.push({ x: this.x, y: this.y });
    if (this.trail.length > 5) this.trail.shift();

    this.x += this.vx;
    this.y += this.vy;
    this.vy += 0.05;

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
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(this.x, this.y, 3, 0, Math.PI * 2);
    ctx.fillStyle = '#fff';
    ctx.fill();
  }

  explode() {
    const targets = getTextParticles(this.message, this.x, this.y);
    if (targets.length === 0) {
      for (let i = 0; i < 100; i++) {
        const a = Math.random() * Math.PI * 2;
        targets.push({
          x: this.x + Math.cos(a) * 100,
          y: this.y + Math.sin(a) * 100,
        });
      }
    }
    for (const t of targets) {
      particles.push(new Particle(this.x, this.y, t.x, t.y, this.color));
    }
  }
}

class Particle {
  constructor(x, y, targetX, targetY, color) {
    this.x = x;
    this.y = y;
    this.targetX = targetX;
    this.targetY = targetY;
    this.color = color;

    const angle = Math.random() * Math.PI * 2;
    const speed = Math.random() * 8 + 2;
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;

    this.friction = 0.92;
    this.gravity = 0.05;
    this.life = 320;
    this.maxLife = 320;
    this.state = 'explode';
    this.delay = Math.random() * 40 + 20; // 20-60 帧，让爆炸扩散更充分
  }

  update() {
    if (this.state === 'explode') {
      this.vx *= this.friction;
      this.vy *= this.friction;
      this.vy += this.gravity;
      this.x += this.vx;
      this.y += this.vy;
      this.delay--;
      if (this.delay <= 0 && Math.abs(this.vx) < 1 && Math.abs(this.vy) < 1) {
        this.state = 'form';
      }
    } else if (this.state === 'form') {
      this.x += (this.targetX - this.x) * 0.025; // 0.05→0.025：聚形慢约 2 倍
      this.y += (this.targetY - this.y) * 0.025;
      this.y += Math.sin(Date.now() / 200 + this.x) * 0.2;
      this.life--;
      if (this.life <= 30) this.state = 'fade';
    } else {
      this.y += 0.5;
      this.life--;
    }
    return this.life > 0;
  }

  draw() {
    const alpha = Math.max(0, this.life / this.maxLife);
    ctx.globalAlpha = alpha;
    ctx.beginPath();
    ctx.arc(this.x, this.y, 1.6, 0, Math.PI * 2);
    ctx.fillStyle = this.color;
    ctx.fill();
    ctx.globalAlpha = 1;
  }
}

function animate() {
  requestAnimationFrame(animate);

  // 拖尾擦除
  ctx.globalCompositeOperation = 'destination-out';
  ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
  ctx.fillRect(0, 0, width, height);

  ctx.globalCompositeOperation = 'lighter';
  drawStars();

  for (let i = fireworks.length - 1; i >= 0; i--) {
    if (!fireworks[i].update()) fireworks.splice(i, 1);
    else fireworks[i].draw();
  }
  for (let i = particles.length - 1; i >= 0; i--) {
    if (!particles[i].update()) particles.splice(i, 1);
    else particles[i].draw();
  }
}

/* ------------------ 公开 API ------------------ */
export function initFireworkEngine(canvasEl, textCanvasEl) {
  canvas = canvasEl;
  ctx = canvas.getContext('2d');
  textCanvas = textCanvasEl;
  textCtx = textCanvas.getContext('2d', { willReadFrequently: true });

  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);
  animate();
}

export function createFirework(message, color) {
  fireworks.push(new Firework(message, color || pickSceneColor()));
}
