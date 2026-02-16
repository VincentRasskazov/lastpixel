// The Last Pixel - Survival Falling Sand Game
const W = 120, H = 80, SCALE = 8;
const EMPTY = 0, SAND = 1, LAVA = 2, GLASS = 3, PLAYER = 4;
const COLORS = ["#000", "#d2b48c", "#ff4500", "#a8d1df", "#00ffff"];
const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
canvas.width = W * SCALE;
canvas.height = H * SCALE;
canvas.style.width = "100vw";
canvas.style.height = "100vh";
let grid, next, timer, running, player, survived, lavaTimer, worldTimer;
const hud = document.getElementById("hud");
const gameover = document.getElementById("gameover");
const restartBtn = document.getElementById("restart");

function reset() {
  grid = Array.from({length: H}, () => Array(W).fill(EMPTY));
  next = Array.from({length: H}, () => Array(W).fill(EMPTY));
  player = {x: W>>1, y: 2, vy: 0, onGround: false};
  for (let y=10; y<H-10; ++y) for (let x=0; x<W; ++x)
    if (Math.random()<0.12) grid[y][x]=SAND;
  grid[player.y][player.x]=PLAYER;
  timer=0; survived=0; running=true; lavaTimer=0; worldTimer=0;
  gameover.style.display="none";
}

function spawnLava() {
  for (let x=0; x<W; ++x)
    if (Math.random()<0.7) grid[0][x]=LAVA;
}

function clearSandKeepGlass() {
  for (let y=0; y<H; ++y) for (let x=0; x<W; ++x)
    if (grid[y][x]===SAND) grid[y][x]=EMPTY;
}

function update() {
  // Copy grid to next
  for (let y=0; y<H; ++y) for (let x=0; x<W; ++x) next[y][x]=grid[y][x];
  // Physics: Sand, Lava, Glass
  for (let y=H-2; y>=0; --y) for (let x=0; x<W; ++x) {
    let t=grid[y][x];
    if (t===SAND||t===LAVA) {
      let below=grid[y+1][x];
      if (below===EMPTY) {
        next[y][x]=EMPTY; next[y+1][x]=t;
      } else if (t===LAVA && below===SAND) {
        next[y][x]=EMPTY; next[y+1][x]=GLASS;
      } else {
        let dirs=[-1,1];
        for (let d of dirs) {
          let nx=x+d, ny=y+1;
          if (nx>=0&&nx<W&&grid[ny][nx]===EMPTY) {
            next[y][x]=EMPTY; next[ny][nx]=t; break;
          } else if (t===LAVA && nx>=0&&nx<W&&grid[ny][nx]===SAND) {
            next[y][x]=EMPTY; next[ny][nx]=GLASS; break;
          }
        }
      }
    }
  }
  // Player physics
  let {x, y, vy}=player;
  let below=next[y+1]?.[x];
  player.onGround = (below!==undefined && below!==EMPTY && below!==LAVA);
  if (!player.onGround) player.vy+=0.18;
  else player.vy=0;
  if (player.vy>1.5) player.vy=1.5;
  let ny = Math.min(H-1, Math.round(player.y+player.vy));
  // Check collision
  if (next[ny][x]===EMPTY||next[ny][x]===SAND||next[ny][x]===GLASS) {
    if (next[ny][x]===SAND) next[ny][x]=EMPTY;
    next[player.y][player.x]=EMPTY;
    player.y=ny;
  } else if (next[ny][x]===LAVA) {
    running=false;
    next[player.y][player.x]=EMPTY;
    player.y=ny;
  }
  next[player.y][player.x]=PLAYER;
  // Swap grids
  [grid,next]=[next,grid];
}

function draw() {
  ctx.clearRect(0,0,canvas.width,canvas.height);
  for (let y=0; y<H; ++y) for (let x=0; x<W; ++x) {
    let t=grid[y][x];
    if (t===EMPTY) continue;
    ctx.save();
    ctx.fillStyle=COLORS[t];
    if (t===LAVA) {
      ctx.shadowColor="#ff4500";
      ctx.shadowBlur=8;
    }
    ctx.fillRect(x*SCALE,y*SCALE,SCALE,SCALE);
    ctx.restore();
  }
}

function renderHUD() {
  hud.textContent = `Time Survived: ${survived.toFixed(1)}s`;
}

function loop(ts) {
  if (!running) {
    gameover.style.display="flex";
    return;
  }
  update();
  draw();
  renderHUD();
  timer+=1/60; lavaTimer+=1/60; worldTimer+=1/60;
  survived=timer;
  if (lavaTimer>=10) { spawnLava(); lavaTimer=0; }
  if (worldTimer>=30) { clearSandKeepGlass(); worldTimer=0; }
  if (player.y>=H-1) running=false;
  requestAnimationFrame(loop);
}

document.addEventListener("keydown",e=>{
  if (!running) return;
  let k=e.key.toLowerCase();
  if ((k==="arrowleft"||k==="a")&&player.x>0&&grid[player.y][player.x-1]===EMPTY) {
    grid[player.y][player.x]=EMPTY; player.x--; grid[player.y][player.x]=PLAYER;
  }
  if ((k==="arrowright"||k==="d")&&player.x<W-1&&grid[player.y][player.x+1]===EMPTY) {
    grid[player.y][player.x]=EMPTY; player.x++; grid[player.y][player.x]=PLAYER;
  }
  if ((k==="arrowup"||k==="w")&&player.onGround) {
    player.vy=-2.2;
  }
});

restartBtn.onclick=()=>{reset();requestAnimationFrame(loop);};

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
