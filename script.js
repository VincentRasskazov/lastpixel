// The Last Pixel - Falling Sand Simulation
const W = 120, H = 80, SCALE = 8;
const EMPTY = 0, SAND = 1, LAVA = 2, PLAYER = 3;
const COLORS = ["#000", "#d2b48c", "#ff4500", "#00ffff"];
const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
canvas.width = W * SCALE;
canvas.height = H * SCALE;
canvas.style.width = "100vw";
canvas.style.height = "100vh";
const hud = document.getElementById("hud");
const gameover = document.getElementById("gameover");
const restartBtn = document.getElementById("restart");

let grid, player, running, timer, lavaTimer;

function reset() {
  grid = Array.from({length: H}, () => Array(W).fill(EMPTY));
  // Fill sand
  for (let y = 10; y < H - 10; ++y) {
    for (let x = 0; x < W; ++x) {
      if (Math.random() < 0.12) grid[y][x] = SAND;
    }
  }
  // Place player
  player = {x: W >> 1, y: 2, vy: 0, onGround: false};
  grid[player.y][player.x] = PLAYER;
  running = true;
  timer = 0;
  lavaTimer = 0;
  gameover.style.display = "none";
}

function spawnLava() {
  for (let x = 0; x < W; ++x) {
    if (Math.random() < 0.7) grid[0][x] = LAVA;
  }
}

function updateSandAndLava() {
  // Move sand and lava
  for (let y = H - 2; y >= 0; --y) {
    for (let x = 0; x < W; ++x) {
      let t = grid[y][x];
      if (t === SAND || t === LAVA) {
        let below = grid[y + 1][x];
        if (below === EMPTY) {
          grid[y][x] = EMPTY;
          grid[y + 1][x] = t;
        } else {
          let dirs = [-1, 1];
          for (let d of dirs) {
            let nx = x + d;
            if (nx >= 0 && nx < W && grid[y + 1][nx] === EMPTY) {
              grid[y][x] = EMPTY;
              grid[y + 1][nx] = t;
              break;
            }
          }
        }
      }
    }
  }
}

function updatePlayer() {
  // Gravity
  let below = grid[player.y + 1]?.[player.x];
  player.onGround = (below !== undefined && below !== EMPTY && below !== LAVA);
  if (!player.onGround) player.vy += 0.18;
  else player.vy = 0;
  if (player.vy > 1.5) player.vy = 1.5;
  let ny = Math.min(H - 1, Math.round(player.y + player.vy));
  // Collision
  let nextCell = grid[ny][player.x];
  if (nextCell === EMPTY || nextCell === SAND) {
    if (nextCell === SAND) grid[ny][player.x] = EMPTY;
    grid[player.y][player.x] = EMPTY;
    player.y = ny;
  } else if (nextCell === LAVA) {
    running = false;
    grid[player.y][player.x] = EMPTY;
    player.y = ny;
  }
  grid[player.y][player.x] = PLAYER;
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  for (let y = 0; y < H; ++y) {
    for (let x = 0; x < W; ++x) {
      let t = grid[y][x];
      if (t === EMPTY) continue;
      ctx.save();
      ctx.fillStyle = COLORS[t];
      if (t === LAVA) {
        ctx.shadowColor = "#ff4500";
        ctx.shadowBlur = 8;
      }
      ctx.fillRect(x * SCALE, y * SCALE, SCALE, SCALE);
      ctx.restore();
    }
  }
}

function renderHUD() {
  hud.textContent = `Time Survived: ${timer.toFixed(1)}s`;
}

function loop() {
  if (!running) {
    gameover.style.display = "flex";
    return;
  }
  updateSandAndLava();
  updatePlayer();
  draw();
  renderHUD();
  timer += 1 / 60;
  lavaTimer += 1 / 60;
  if (lavaTimer >= 10) {
    spawnLava();
    lavaTimer = 0;
  }
  requestAnimationFrame(loop);
}

document.addEventListener("keydown", e => {
  if (!running) return;
  let k = e.key.toLowerCase();
  if ((k === "arrowleft" || k === "a") && player.x > 0 && grid[player.y][player.x - 1] === EMPTY) {
    grid[player.y][player.x] = EMPTY;
    player.x--;
    grid[player.y][player.x] = PLAYER;
  }
  if ((k === "arrowright" || k === "d") && player.x < W - 1 && grid[player.y][player.x + 1] === EMPTY) {
    grid[player.y][player.x] = EMPTY;
    player.x++;
    grid[player.y][player.x] = PLAYER;
  }
  if ((k === "arrowup" || k === "w") && player.onGround) {
    player.vy = -2.2;
  }
});

restartBtn.onclick = () => {
  reset();
  requestAnimationFrame(loop);
};

reset();
requestAnimationFrame(loop);
// Procedural Zen Garden
// Modular, extensible, and GitHub Pages ready


// Clean Minimal Zen Garden
const BG = '#1a1a1a', STROKE = '#e0d7c6';
const IDLE = 3200, SPLIT = 30, WOBBLE = 7, FPS = 60;
let canvas, ctx, width, height, lastMove = Date.now(), idle = false;
let rakes = [], plants = [];

class Plant {
  constructor(x, y) {
    this.x = x; this.y = y; this.pts = [{x, y, t: 0, a: -Math.PI/2}];
    this.grown = 0; this.done = false;
  }
  update(dt) {
    if (this.done) return;
    this.grown += dt * 0.09;
    let last = this.pts[this.pts.length-1];
    if (last.t > 120) { this.done = true; return; }
    let t = last.t + 2;
    let x = last.x + Math.cos(last.a) * 2;
    let y = last.y + Math.sin(last.a) * 2;
    let a = last.a + Math.sin(Date.now()/700 + t/18) * WOBBLE * Math.PI/180;
    if (t % SPLIT < 2 && t > 0) {
      // Split into Y
      let left = a - Math.PI/6 - Math.random()*Math.PI/12;
      let right = a + Math.PI/6 + Math.random()*Math.PI/12;
      this.pts.push({x, y, t, a: left});
      this.pts.push({x, y, t, a: right});
    } else {
      this.pts.push({x, y, t, a});
    }
  }
  draw(ctx) {
    ctx.save();
    ctx.strokeStyle = STROKE;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(this.x, this.y);
    for (let i=1; i<this.pts.length && i<this.grown; ++i) {
      ctx.lineTo(this.pts[i].x, this.pts[i].y);
    }
    ctx.stroke();
    ctx.restore();
  }
}

function addPlant(x, y) { plants.push(new Plant(x, y)); }

function onPointerDown(e) {
  let p = getPos(e);
  rakes.push({pts: [p], t: Date.now()});
  lastMove = Date.now();
}
function onPointerMove(e) {
  if (rakes.length) {
    let p = getPos(e);
    let rake = rakes[rakes.length-1];
    rake.pts.push(p);
    lastMove = Date.now();
  }
}
function onPointerUp(e) {
  // nothing
}
function getPos(e) {
  let rect = canvas.getBoundingClientRect();
  let x = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left;
  let y = (e.touches ? e.touches[0].clientY : e.clientY) - rect.top;
  return {x, y};
}

function drawRakes(ctx) {
  let now = Date.now();
  rakes = rakes.filter(r => now - r.t < 2000);
  ctx.save();
  ctx.strokeStyle = STROKE;
  ctx.globalAlpha = 0.18;
  ctx.lineWidth = 7;
  ctx.lineCap = 'round';
  for (let r of rakes) {
    if (r.pts.length < 2) continue;
    ctx.beginPath();
    ctx.moveTo(r.pts[0].x, r.pts[0].y);
    for (let i=1; i<r.pts.length-1; ++i) {
      let xc = (r.pts[i].x + r.pts[i+1].x)/2;
      let yc = (r.pts[i].y + r.pts[i+1].y)/2;
      ctx.quadraticCurveTo(r.pts[i].x, r.pts[i].y, xc, yc);
    }
    ctx.stroke();
  }
  ctx.restore();
}

function loop() {
  ctx.clearRect(0,0,width,height);
  ctx.fillStyle = BG;
  ctx.fillRect(0,0,width,height);
  drawRakes(ctx);
  for (let p of plants) { p.update(1); p.draw(ctx); }
  if (Date.now() - lastMove > IDLE && plants.length < 1) addPlant(width/2, height-40);
  requestAnimationFrame(loop);
}

window.onload = () => {
  canvas = document.getElementById('zen-canvas');
  ctx = canvas.getContext('2d');
  width = window.innerWidth; height = window.innerHeight;
  canvas.width = width; canvas.height = height;
  canvas.addEventListener('mousedown', onPointerDown);
  canvas.addEventListener('mousemove', onPointerMove);
  canvas.addEventListener('mouseup', onPointerUp);
  canvas.addEventListener('touchstart', onPointerDown, {passive:false});
  canvas.addEventListener('touchmove', onPointerMove, {passive:false});
  window.addEventListener('resize', ()=>{width=window.innerWidth;height=window.innerHeight;canvas.width=width;canvas.height=height;});
  loop();
};
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
