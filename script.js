// Procedural Zen Garden
// Modular, extensible, and GitHub Pages ready


const CANVAS_BG = '#f2efe9';
const EARTH_COLOR = '#232323'; // deep charcoal
const PLANT_GREEN = '#2e4632'; // organic green
const FOSSIL_COLOR = '#b0b0b0';
const FPS = 60;
const IDLE_TIME = 5000; // ms
const FOSSIL_OPACITY = 0.13;
const GROOVE_COLOR = 'rgba(180, 170, 140, 0.18)';
const GROOVE_WIDTH = 32;
const GROOVE_SOFT = 0.13;
const FADE_IN_TIME = 1200;


const plantTypes = [];

// --- Utility Functions ---
function lerp(a, b, t) {
  return a + (b - a) * t;
}
function easeInOutQuad(t) {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}
function randomBetween(a, b) {
  return a + Math.random() * (b - a);
}


// --- Plant Base Class ---
class Plant {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.age = 0;
    this.done = false;
    this.sway = 0; // for raking
    this.swayTarget = 0;
  }
  update(dt) {
    this.age += dt;
    // Sway physics
    this.sway += (this.swayTarget - this.sway) * 0.08;
    this.swayTarget *= 0.92;
  }
  draw(ctx, fossil) {}
  interact(type, data) {
    if (type === 'rake') {
      // Sway gently if raked nearby
      let dx = this.x - data.x, dy = this.y - data.y;
      let dist = Math.sqrt(dx*dx + dy*dy);
      if (dist < 60) {
        this.swayTarget += (Math.random() - 0.5) * 0.7;
      }
    }
  }
  toJSON() {
    return {type: this.constructor.name, x: this.x, y: this.y, age: this.age};
  }
  static fromJSON(obj) {
    if (obj.type === 'LSystemPlant') return LSystemPlant.fromJSON(obj);
    return null;
  }
}

// --- Recursive Branching Stalk Plant ---
class StalkPlant extends Plant {
  constructor(x, y) {
    super(x, y);
    this.segments = [];
    this.growth = 0; // 0..1
    this.growSpeed = randomBetween(0.012, 0.018);
    this.branchColor = Math.random() < 0.5 ? EARTH_COLOR : PLANT_GREEN;
    this.maxDepth = 5;
    this.branchEvery = 20;
    this.angleSpread = [20, 45];
    this.branchData = null;
    this._initBranch();
  }
  _initBranch() {
    // Precompute the recursive structure
    this.branchData = this._growBranch(0, 0, -Math.PI/2, 0);
  }
  _growBranch(x, y, angle, depth) {
    if (depth > this.maxDepth) return null;
    let len = 20 + randomBetween(-2, 2);
    let segs = [{x, y, angle, depth}];
    let px = x, py = y;
    let children = [];
    for (let d = 0; d < len; d += this.branchEvery) {
      px += Math.cos(angle) * this.branchEvery;
      py += Math.sin(angle) * this.branchEvery;
      segs.push({x: px, y: py, angle, depth});
      if (depth < this.maxDepth && Math.random() < 0.5) {
        let branchAngle = angle + (Math.random() < 0.5 ? 1 : -1) * randomBetween(...this.angleSpread) * Math.PI/180;
        let child = this._growBranch(px, py, branchAngle, depth+1);
        if (child) children.push(child);
      }
    }
    return {segs, children};
  }
  update(dt) {
    super.update(dt);
    if (this.done) return;
    this.growth += this.growSpeed * dt / 1000;
    if (this.growth >= 1) {
      this.growth = 1;
      this.done = true;
    }
  }
  draw(ctx, fossil = false) {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.sway * 0.2);
    ctx.globalAlpha = fossil ? FOSSIL_OPACITY : 1;
    ctx.strokeStyle = fossil ? FOSSIL_COLOR : this.branchColor;
    ctx.lineWidth = fossil ? 1.1 : 2.2;
    this._drawBranch(ctx, this.branchData, this.growth);
    ctx.restore();
  }
  _drawBranch(ctx, branch, growth) {
    if (!branch) return;
    let segs = branch.segs;
    let maxSeg = Math.floor(segs.length * growth);
    ctx.beginPath();
    ctx.moveTo(segs[0].x, segs[0].y);
    for (let i = 1; i < maxSeg; ++i) {
      ctx.lineTo(segs[i].x, segs[i].y);
    }
    ctx.stroke();
    // Draw children
    for (let child of branch.children) {
      this._drawBranch(ctx, child, growth);
    }
  }
  interact(type, data) {
    super.interact(type, data);
    if (type === 'rake') {
      this.swayTarget += (Math.random() - 0.5) * 0.5;
    }
  }
  toJSON() {
    return {...super.toJSON(), branchColor: this.branchColor, maxDepth: this.maxDepth, branchEvery: this.branchEvery, angleSpread: this.angleSpread};
  }
  static fromJSON(obj) {
    let p = new StalkPlant(obj.x, obj.y);
    p.branchColor = obj.branchColor;
    p.maxDepth = obj.maxDepth;
    p.branchEvery = obj.branchEvery;
    p.angleSpread = obj.angleSpread;
    p.growth = 1;
    p.done = true;
    p._initBranch();
    return p;
  }
}
plantTypes.length = 0;
plantTypes.push(StalkPlant);

// --- App State ---

let canvas, ctx, width, height;
let grooveCanvas, grooveCtx;
let grooveLast = null;
let grooveBrushImg = null;
let sandParticles = [];
let plants = [];
let fossils = [];
let lastCursor = {x: 0, y: 0};
let lastMoveTime = Date.now();
let idle = false;
let dragging = false;
let fadeInStart = null;
let soundOn = false;
let audioCtx, windOsc, windGain;

// --- Persistence ---

function saveGarden() {
  localStorage.setItem('zen_fossil', JSON.stringify(plants.map(p => p.toJSON())));
}
function loadFossil() {
  let fossil = localStorage.getItem('zen_fossil');
  if (fossil) {
    try {
      let arr = JSON.parse(fossil);
      fossils = arr.map(Plant.fromJSON).filter(Boolean);
    } catch {}
  }
}

// --- Idle Detection ---
function onPointerMove(e) {
  let rect = canvas.getBoundingClientRect();
  lastCursor.x = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left;
  lastCursor.y = (e.touches ? e.touches[0].clientY : e.clientY) - rect.top;
  lastMoveTime = Date.now();
  idle = false;
}
function onPointerDown(e) {
  dragging = true;
  onPointerMove(e);
  grooveLast = {x: lastCursor.x, y: lastCursor.y};
  rakeAt(lastCursor.x, lastCursor.y, true);
}
function onPointerUp(e) {
  dragging = false;
  grooveLast = null;
}
function onPointerDrag(e) {
  if (dragging) {
    onPointerMove(e);
    if (grooveLast) {
      drawGroove(grooveLast.x, grooveLast.y, lastCursor.x, lastCursor.y);
      let speed = Math.sqrt(Math.pow(lastCursor.x-grooveLast.x,2)+Math.pow(lastCursor.y-grooveLast.y,2));
      if (speed > 8) {
        playRakeChime();
        spawnSandParticles(lastCursor.x, lastCursor.y, speed);
      }
    }
    grooveLast = {x: lastCursor.x, y: lastCursor.y};
    rakeAt(lastCursor.x, lastCursor.y, true);
  }
}
function rakeAt(x, y, drawGroove = false) {
  for (let p of plants) p.interact('rake', {x, y});
  if (drawGroove && grooveCtx) {
    if (grooveLast) drawGroove(grooveLast.x, grooveLast.y, x, y);
  }
}

function drawGroove(x0, y0, x1, y1) {
  if (!grooveBrushImg) grooveBrushImg = makeGrooveBrush();
  grooveCtx.save();
  grooveCtx.globalAlpha = GROOVE_SOFT;
  grooveCtx.globalCompositeOperation = 'destination-out';
  let dx = x1-x0, dy = y1-y0, dist = Math.sqrt(dx*dx+dy*dy);
  let steps = Math.ceil(dist / (GROOVE_WIDTH*0.5));
  for (let i=0; i<=steps; ++i) {
    let t = i/steps;
    let x = lerp(x0, x1, t), y = lerp(y0, y1, t);
    grooveCtx.drawImage(grooveBrushImg, x-GROOVE_WIDTH/2, y-GROOVE_WIDTH/2);
  }
  grooveCtx.restore();
  grooveCtx.globalCompositeOperation = 'source-over';
}

function makeGrooveBrush() {
  let c = document.createElement('canvas');
  c.width = c.height = GROOVE_WIDTH;
  let g = c.getContext('2d');
  let grad = g.createRadialGradient(GROOVE_WIDTH/2, GROOVE_WIDTH/2, 2, GROOVE_WIDTH/2, GROOVE_WIDTH/2, GROOVE_WIDTH/2);
  grad.addColorStop(0, 'rgba(0,0,0,0.18)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grad;
  g.beginPath();
  g.arc(GROOVE_WIDTH/2, GROOVE_WIDTH/2, GROOVE_WIDTH/2, 0, 2*Math.PI);
  g.fill();
  return c;
}

// --- Growth ---
function tryGrow() {
  if (!idle) return;
  let PlantType = plantTypes[Math.floor(Math.random() * plantTypes.length)];
  let plant = new PlantType(lastCursor.x, lastCursor.y);
  plants.push(plant);
  playBranchChime();
  saveGarden();
  idle = false;
  lastMoveTime = Date.now();
}

// --- Animation Loop ---
function resize() {
  width = window.innerWidth;
  height = window.innerHeight;
  canvas.width = width;
  canvas.height = height;
  if (grooveCanvas) {
    grooveCanvas.width = width;
    grooveCanvas.height = height;
  }
}
function drawFossils() {
  for (let f of fossils) f.draw(ctx, true);
}
function drawPlants() {
  for (let p of plants) p.draw(ctx, false);
}
function updatePlants(dt) {
  for (let p of plants) p.update(dt);
}
function drawFadeIn() {
  if (!fadeInStart) fadeInStart = Date.now();
  let t = (Date.now() - fadeInStart) / FADE_IN_TIME;
  if (t < 1) {
    ctx.save();
    ctx.globalAlpha = 1 - easeInOutQuad(t);
    ctx.fillStyle = CANVAS_BG;
    ctx.fillRect(0, 0, width, height);
    ctx.restore();
    requestAnimationFrame(drawFadeIn);
  }
}
function loop() {
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = CANVAS_BG;
  ctx.fillRect(0, 0, width, height);
  // Draw grooves (raked sand)
  if (grooveCanvas) ctx.drawImage(grooveCanvas, 0, 0);
  drawFossils();
  drawPlants();
  updateSandParticles();
  drawSandParticles();
  let now = Date.now();
  if (!dragging && now - lastMoveTime > IDLE_TIME) {
    idle = true;
    tryGrow();
  }
  updatePlants(1000 / FPS);
  requestAnimationFrame(loop);
}

// --- Sand Particles ---
function spawnSandParticles(x, y, speed) {
  let n = Math.floor(randomBetween(3, 6));
  for (let i = 0; i < n; ++i) {
    let angle = randomBetween(-Math.PI/3, Math.PI/3);
    let v = speed * randomBetween(0.12, 0.22);
    sandParticles.push({
      x, y,
      vx: Math.cos(angle) * v,
      vy: Math.sin(angle) * v - randomBetween(0.5, 1.2),
      r: randomBetween(1.2, 2.2),
      life: 0,
      maxLife: randomBetween(0.7, 1.2)
    });
  }
}
function updateSandParticles() {
  let dt = 1/FPS;
  for (let p of sandParticles) {
    p.x += p.vx;
    p.y += p.vy;
    p.vy += 0.18; // gravity
    p.vx *= 0.97;
    p.vy *= 0.97;
    p.life += dt;
  }
  sandParticles = sandParticles.filter(p => p.life < p.maxLife);
}
function drawSandParticles() {
  ctx.save();
  ctx.globalAlpha = 0.32;
  ctx.fillStyle = '#e2d7b7';
  for (let p of sandParticles) {
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, 2*Math.PI);
    ctx.fill();
  }
  ctx.restore();
}

// --- Init ---

function setup() {
  canvas = document.getElementById('zen-canvas');
  ctx = canvas.getContext('2d');
  // Groove canvas for raked sand
  grooveCanvas = document.createElement('canvas');
  grooveCanvas.width = window.innerWidth;
  grooveCanvas.height = window.innerHeight;
  grooveCanvas.style.display = 'none';
  grooveCtx = grooveCanvas.getContext('2d');
  document.body.appendChild(grooveCanvas);

  resize();
  loadFossil();
  window.addEventListener('resize', resize);
  canvas.addEventListener('mousemove', onPointerMove);
  canvas.addEventListener('mousedown', onPointerDown);
  canvas.addEventListener('mouseup', onPointerUp);
  canvas.addEventListener('mouseleave', onPointerUp);
  canvas.addEventListener('touchstart', onPointerDown, {passive: false});
  canvas.addEventListener('touchmove', onPointerDrag, {passive: false});
  canvas.addEventListener('touchend', onPointerUp);
  canvas.addEventListener('touchcancel', onPointerUp);
  canvas.addEventListener('mousemove', onPointerDrag);
  canvas.addEventListener('drag', onPointerDrag);
  window.addEventListener('beforeunload', saveGarden);


    // Sound toggle button
    let btn = document.createElement('button');
    btn.textContent = 'Toggle Sound';
    btn.id = 'sound-toggle';
    btn.style.position = 'fixed';
    btn.style.top = '18px';
    btn.style.right = '24px';
    btn.style.zIndex = 10;
    btn.style.background = '#fff8';
    btn.style.border = 'none';
    btn.style.borderRadius = '8px';
    btn.style.padding = '8px 18px';
    btn.style.fontSize = '1.1em';
    btn.style.cursor = 'pointer';
    btn.style.boxShadow = '0 2px 8px #0001';
    btn.style.transition = 'background 0.2s';
    btn.addEventListener('mouseenter', () => btn.style.background = '#fff');
    btn.addEventListener('mouseleave', () => btn.style.background = '#fff8');
    btn.addEventListener('click', toggleSound);
    document.body.appendChild(btn);

    requestAnimationFrame(loop);
    setTimeout(drawFadeIn, 80);
  }

  // --- Pentatonic Chime Sound ---
  const PENTATONIC = [261.63, 293.66, 329.63, 392.00, 440.00, 523.25];
  function playBranchChime() {
    if (!soundOn) return;
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    let osc = audioCtx.createOscillator();
    let gain = audioCtx.createGain();
    let reverb = audioCtx.createConvolver();
    reverb.buffer = makeImpulseResponse(audioCtx, 1.2, 2.2);
    osc.type = 'triangle';
    osc.frequency.value = PENTATONIC[Math.floor(Math.random()*PENTATONIC.length)];
    gain.gain.value = 0.13;
    osc.connect(gain).connect(reverb).connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 1.2);
    gain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 1.2);
  }
  function playRakeChime() {
    if (!soundOn) return;
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    let osc = audioCtx.createOscillator();
    let gain = audioCtx.createGain();
    let reverb = audioCtx.createConvolver();
    reverb.buffer = makeImpulseResponse(audioCtx, 0.7, 1.7);
    osc.type = 'sine';
    osc.frequency.value = PENTATONIC[Math.floor(Math.random()*PENTATONIC.length)] * randomBetween(0.5, 1.5);
    gain.gain.value = 0.09;
    osc.connect(gain).connect(reverb).connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.7);
    gain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.7);
  }
  function makeImpulseResponse(ctx, duration, decay) {
    let rate = ctx.sampleRate;
    let length = rate * duration;
    let impulse = ctx.createBuffer(2, length, rate);
    for (let c = 0; c < 2; ++c) {
      let ch = impulse.getChannelData(c);
      for (let i = 0; i < length; ++i) {
        ch[i] = (Math.random()*2-1) * Math.pow(1-i/length, decay);
      }
    }
    return impulse;
  }

  function toggleSound() {
    soundOn = !soundOn;
    let btn = document.getElementById('sound-toggle');
    btn.textContent = soundOn ? 'Sound: On' : 'Sound: Off';
  }

window.onload = setup;
