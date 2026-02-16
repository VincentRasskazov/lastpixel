// Procedural Zen Garden
// Modular, extensible, and GitHub Pages ready

const CANVAS_BG = '#F0EAD6';
const EARTH_COLOR = '#5D4037';
const FPS = 60;
const IDLE_TIME = 5000; // ms
const FOSSIL_OPACITY = 0.15;

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
  }
  update(dt) {
    this.age += dt;
  }
  draw(ctx) {}
  interact(type, data) {}
  toJSON() {
    return {type: this.constructor.name, x: this.x, y: this.y, age: this.age};
  }
  static fromJSON(obj) {
    if (obj.type === 'Vine') return Vine.fromJSON(obj);
    // Add more plant types here
    return null;
  }
}

// --- Vine Plant Example ---
class Vine extends Plant {
  constructor(x, y) {
    super(x, y);
    this.segments = [{x, y, t: 0}];
    this.length = randomBetween(80, 160);
    this.angle = randomBetween(-Math.PI, Math.PI);
    this.growSpeed = randomBetween(0.08, 0.16); // px/ms
    this.curve = randomBetween(-0.015, 0.015);
    this.color = EARTH_COLOR;
  }
  update(dt) {
    super.update(dt);
    if (this.done) return;
    let last = this.segments[this.segments.length - 1];
    let t = last.t + dt * this.growSpeed;
    if (t * this.length >= this.length) {
      this.done = true;
      return;
    }
    let angle = this.angle + this.curve * t * this.length;
    let nx = this.x + Math.cos(angle) * t * this.length;
    let ny = this.y + Math.sin(angle) * t * this.length;
    this.segments.push({x: nx, y: ny, t});
  }
  draw(ctx) {
    ctx.save();
    ctx.strokeStyle = this.color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(this.x, this.y);
    for (let s of this.segments) ctx.lineTo(s.x, s.y);
    ctx.stroke();
    ctx.restore();
  }
  interact(type, data) {
    // e.g., ripple or rake: nudge segments
    if (type === 'rake') {
      for (let s of this.segments) {
        let dx = s.x - data.x, dy = s.y - data.y;
        let dist = Math.sqrt(dx*dx + dy*dy);
        if (dist < 40) {
          let force = (40 - dist) / 40 * 6;
          s.x += dx / dist * force;
          s.y += dy / dist * force;
        }
      }
    }
  }
  toJSON() {
    return {...super.toJSON(), segments: this.segments, length: this.length, angle: this.angle, growSpeed: this.growSpeed, curve: this.curve};
  }
  static fromJSON(obj) {
    let v = new Vine(obj.x, obj.y);
    v.segments = obj.segments;
    v.length = obj.length;
    v.angle = obj.angle;
    v.growSpeed = obj.growSpeed;
    v.curve = obj.curve;
    v.age = obj.age;
    v.done = true;
    return v;
  }
}
plantTypes.push(Vine);

// --- App State ---
let canvas, ctx, width, height;
let plants = [];
let fossils = [];
let lastCursor = {x: 0, y: 0};
let lastMoveTime = Date.now();
let idle = false;
let dragging = false;

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
  rakeAt(lastCursor.x, lastCursor.y);
}
function onPointerUp(e) {
  dragging = false;
}
function onPointerDrag(e) {
  if (dragging) {
    onPointerMove(e);
    rakeAt(lastCursor.x, lastCursor.y);
  }
}

function rakeAt(x, y) {
  for (let p of plants) p.interact('rake', {x, y});
}

// --- Growth ---
function tryGrow() {
  if (!idle) return;
  // Pick a random plant type
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
}
function drawFossils() {
  ctx.save();
  ctx.globalAlpha = FOSSIL_OPACITY;
  for (let f of fossils) f.draw(ctx);
  ctx.restore();
}
function drawPlants() {
  for (let p of plants) p.draw(ctx);
}
function updatePlants(dt) {
  for (let p of plants) p.update(dt);
}
function loop() {
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = CANVAS_BG;
  ctx.fillRect(0, 0, width, height);
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
  requestAnimationFrame(loop);
}

window.onload = setup;
