// ============================================================
// 烟花动画引擎（迁移自 firework-message/public/app.js）
// 公开 API: initFireworkEngine(canvasEl, textCanvasEl), createFirework(message, color)
// ============================================================

let canvas, ctx, textCanvas, textCtx;
let width = 0, height = 0;

const fireworks = [];
const particles = [];
const stars = [];

function resizeCanvas() {
  width = window.innerWidth;
  height = window.innerHeight;
  canvas.width = width;
  canvas.height = height;
}

function initStars() {
  stars.length = 0;
  for (let i = 0; i < 150; i++) {
    stars.push({
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      r: Math.random() * 1.5,
      alpha: Math.random()
    });
  }
}

function drawStars() {
  stars.forEach(star => {
    ctx.beginPath();
    ctx.arc(star.x, star.y, star.r, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255, 255, 255, ${star.alpha})`;
    ctx.fill();
    star.alpha += (Math.random() - 0.5) * 0.05;
    if (star.alpha < 0.1) star.alpha = 0.1;
    if (star.alpha > 1) star.alpha = 1;
  });
}

// 提取文字像素坐标，作为粒子目标位置
function getTextParticles(text, centerX, centerY) {
  const fontSize = Math.min(width / Math.max(text.length, 1), 120);
  textCanvas.width = width;
  textCanvas.height = height;

  textCtx.clearRect(0, 0, width, height);
  textCtx.font = `bold ${fontSize}px "Microsoft YaHei", sans-serif`;
  textCtx.fillStyle = 'white';
  textCtx.textAlign = 'center';
  textCtx.textBaseline = 'middle';
  textCtx.fillText(text, width / 2, height / 2);

  const imgData = textCtx.getImageData(0, 0, width, height).data;
  const targetParticles = [];

  const gap = 4; // 粒子密度
  for (let y = 0; y < height; y += gap) {
    for (let x = 0; x < width; x += gap) {
      const index = (y * width + x) * 4;
      const alpha = imgData[index + 3];
      if (alpha > 128) {
        const targetX = x - width / 2 + centerX;
        const targetY = y - height / 2 + centerY;
        targetParticles.push({ x: targetX, y: targetY });
      }
    }
  }
  return targetParticles;
}

class Firework {
  constructor(message, color) {
    this.x = width / 2;
    this.y = height;
    this.targetX = width / 2 + (Math.random() - 0.5) * 200;
    this.targetY = height * 0.2 + Math.random() * (height * 0.2);
    this.color = color;
    this.message = message;
    this.speed = 12;
    this.angle = Math.atan2(this.targetY - this.y, this.targetX - this.x);
    this.vx = Math.cos(this.angle) * this.speed;
    this.vy = Math.sin(this.angle) * this.speed;
    this.exploded = false;
    this.trail = [];
  }

  update() {
    this.trail.push({ x: this.x, y: this.y });
    if (this.trail.length > 5) this.trail.shift();

    this.x += this.vx;
    this.y += this.vy;
    this.vy += 0.05; // 重力

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
    for (let i = 1; i < this.trail.length; i++) {
      ctx.lineTo(this.trail[i].x, this.trail[i].y);
    }
    ctx.strokeStyle = this.color;
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(this.x, this.y, 3, 0, Math.PI * 2);
    ctx.fillStyle = '#fff';
    ctx.fill();
  }

  explode() {
    const targetPositions = getTextParticles(this.message, this.x, this.y);

    // 文字为空或没有有效像素 → 圆形爆炸
    if (targetPositions.length === 0) {
      for (let i = 0; i < 100; i++) {
        const angle = Math.random() * Math.PI * 2;
        targetPositions.push({
          x: this.x + Math.cos(angle) * 100,
          y: this.y + Math.sin(angle) * 100
        });
      }
    }

    targetPositions.forEach(target => {
      particles.push(new Particle(this.x, this.y, target.x, target.y, this.color));
    });
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
    this.life = 270;
    this.maxLife = 270;
    this.state = 'explode'; // explode → form → fade
    this.delay = Math.random() * 20;
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
      const dx = this.targetX - this.x;
      const dy = this.targetY - this.y;
      this.x += dx * 0.05;
      this.y += dy * 0.05;
      this.y += Math.sin(Date.now() / 200 + this.x) * 0.2;

      this.life--;
      if (this.life <= 30) this.state = 'fade';
    } else if (this.state === 'fade') {
      this.y += 0.5;
      this.life--;
    }

    return this.life > 0;
  }

  draw() {
    const alpha = Math.max(0, this.life / this.maxLife);
    ctx.globalAlpha = alpha;
    ctx.beginPath();
    ctx.arc(this.x, this.y, 1.5, 0, Math.PI * 2);
    ctx.fillStyle = this.color;
    ctx.fill();
    ctx.globalAlpha = 1;
  }
}

function animate() {
  requestAnimationFrame(animate);

  // 拖尾擦除效果
  ctx.globalCompositeOperation = 'destination-out';
  ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
  ctx.fillRect(0, 0, width, height);

  ctx.globalCompositeOperation = 'lighter';

  drawStars();

  for (let i = fireworks.length - 1; i >= 0; i--) {
    if (!fireworks[i].update()) {
      fireworks.splice(i, 1);
    } else {
      fireworks[i].draw();
    }
  }

  for (let i = particles.length - 1; i >= 0; i--) {
    if (!particles[i].update()) {
      particles.splice(i, 1);
    } else {
      particles[i].draw();
    }
  }
}

// ===== 公开 API =====

export function initFireworkEngine(canvasEl, textCanvasEl) {
  canvas = canvasEl;
  ctx = canvas.getContext('2d');
  textCanvas = textCanvasEl;
  textCtx = textCanvas.getContext('2d', { willReadFrequently: true });

  resizeCanvas();
  initStars();
  window.addEventListener('resize', resizeCanvas);
  animate();
}

export function createFirework(message, color) {
  fireworks.push(new Firework(message, color));
}
