// Procedural Zen Garden
// Modular, extensible, and GitHub Pages ready


const CANVAS_BG = '#F0EAD6';
const EARTH_COLOR = '#5D4037';
const FOSSIL_COLOR = '#888888';
const FPS = 60;
const IDLE_TIME = 5000; // ms
const FOSSIL_OPACITY = 0.13;
const GROOVE_COLOR = 'rgba(93,64,55,0.18)';
const GROOVE_WIDTH = 18;
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

// --- L-System Fractal Plant ---
class LSystemPlant extends Plant {
  constructor(x, y) {
    super(x, y);
    this.lsys = this.generateLSystem();
    this.growth = 0; // 0..1
    this.growSpeed = randomBetween(0.012, 0.022); // meditative
    this.leafColor = `hsl(${randomBetween(90, 140)}, 32%, 38%)`;
    this.branchColor = EARTH_COLOR;
    this.maxDepth = 5;
    this.leafSize = randomBetween(7, 13);
  }
  generateLSystem() {
    // Simple L-system: F -> FF-[-F+F+F]+[+F-F-F]
    let axiom = 'F';
    let rules = [{pre: 'F', post: 'FF-[-F+F+F]+[+F-F-F]'}];
    let str = axiom;
    for (let i = 0; i < this.maxDepth; ++i) {
      let next = '';
      for (let c of str) {
        let rule = rules.find(r => r.pre === c);
        next += rule ? rule.post : c;
      }
      str = next;
    }
    return str;
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
    let stack = [];
    let len = 32;
    let angle = Math.PI / 7;
    let drawn = 0, maxDraw = Math.floor(this.lsys.length * this.growth);
    ctx.globalAlpha = fossil ? FOSSIL_OPACITY : 1;
    ctx.strokeStyle = fossil ? FOSSIL_COLOR : this.branchColor;
    ctx.lineWidth = fossil ? 1.2 : 2.2;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    for (let i = 0; i < this.lsys.length && drawn < maxDraw; ++i) {
      let c = this.lsys[i];
      if (c === 'F') {
        ctx.lineTo(0, -len);
        ctx.translate(0, -len);
        drawn++;
      } else if (c === '+') {
        ctx.rotate(angle + randomBetween(-0.04, 0.04));
      } else if (c === '-') {
        ctx.rotate(-angle + randomBetween(-0.04, 0.04));
      } else if (c === '[') {
        stack.push([ctx.getTransform()]);
      } else if (c === ']') {
        ctx.setTransform(...stack.pop()[0]);
      }
    }
    ctx.stroke();
    // Draw leaves at tips
    if (!fossil && this.growth > 0.7) {
      ctx.save();
      ctx.globalAlpha = 0.7;
      ctx.fillStyle = this.leafColor;
      for (let i = 0; i < this.lsys.length && i < maxDraw; ++i) {
        if (this.lsys[i] === 'F' && (i+1 === this.lsys.length || this.lsys[i+1] !== 'F')) {
          ctx.beginPath();
          ctx.arc(0, 0, this.leafSize, 0, 2 * Math.PI);
          ctx.fill();
        }
      }
      ctx.restore();
    }
    ctx.restore();
  }
  interact(type, data) {
    super.interact(type, data);
    // Sway all branches if raked nearby
    if (type === 'rake') {
      this.swayTarget += (Math.random() - 0.5) * 0.5;
    }
  }
  toJSON() {
    return {...super.toJSON(), lsys: this.lsys, growth: this.growth, leafColor: this.leafColor, branchColor: this.branchColor, maxDepth: this.maxDepth, leafSize: this.leafSize};
  }
  static fromJSON(obj) {
    let p = new LSystemPlant(obj.x, obj.y);
    p.lsys = obj.lsys;
    p.growth = 1; // Fossils are fully grown
    p.leafColor = obj.leafColor;
    p.branchColor = obj.branchColor;
    p.maxDepth = obj.maxDepth;
    p.leafSize = obj.leafSize;
    p.done = true;
    return p;
  }
}
plantTypes.push(LSystemPlant);

// --- App State ---

let canvas, ctx, width, height;
let grooveCanvas, grooveCtx;
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
  if (soundOn && windOsc) {
    let freq = lerp(220, 440, lastCursor.x / width);
    windOsc.frequency.setTargetAtTime(freq, audioCtx.currentTime, 0.1);
  }
}
function onPointerDown(e) {
  dragging = true;
  onPointerMove(e);
  rakeAt(lastCursor.x, lastCursor.y, true);
}
function onPointerUp(e) {
  dragging = false;
}
function onPointerDrag(e) {
  if (dragging) {
    onPointerMove(e);
    rakeAt(lastCursor.x, lastCursor.y, true);
  }
}

function rakeAt(x, y, drawGroove = false) {
  for (let p of plants) p.interact('rake', {x, y});
  if (drawGroove && grooveCtx) {
    grooveCtx.save();
    grooveCtx.globalAlpha = 0.7;
    grooveCtx.strokeStyle = GROOVE_COLOR;
    grooveCtx.lineWidth = GROOVE_WIDTH;
    grooveCtx.lineCap = 'round';
    grooveCtx.beginPath();
    grooveCtx.moveTo(x, y);
    grooveCtx.lineTo(x + 0.1, y + 0.1); // dot for tap
    grooveCtx.stroke();
    grooveCtx.restore();
  }
}

// --- Growth ---

function tryGrow() {
  if (!idle) return;
  let PlantType = plantTypes[Math.floor(Math.random() * plantTypes.length)];
  plants.push(new PlantType(lastCursor.x, lastCursor.y));
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
  let now = Date.now();
  if (!dragging && now - lastMoveTime > IDLE_TIME) {
    idle = true;
    tryGrow();
  }
  updatePlants(1000 / FPS);
  requestAnimationFrame(loop);
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

function toggleSound() {
  soundOn = !soundOn;
  let btn = document.getElementById('sound-toggle');
  btn.textContent = soundOn ? 'Sound: On' : 'Sound: Off';
  if (soundOn) {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      windOsc = audioCtx.createOscillator();
      windOsc.type = 'sine';
      windGain = audioCtx.createGain();
      windGain.gain.value = 0.13;
      windOsc.connect(windGain).connect(audioCtx.destination);
      windOsc.frequency.value = 320;
      windOsc.start();
    } else {
      windGain.gain.value = 0.13;
    }
  } else {
    if (windGain) windGain.gain.value = 0;
  }
}

window.onload = setup;
