// Sound system
const audioCtx = window.AudioContext ? new AudioContext() : null;
function beep(freq, dur, vol) {
  if (!audioCtx) return;
  const o = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  o.frequency.value = freq;
  o.type = "sine";
  g.gain.value = vol;
  o.connect(g); g.connect(audioCtx.destination);
  o.start();
  o.stop(audioCtx.currentTime + dur);
  g.gain.setValueAtTime(vol, audioCtx.currentTime);
  g.gain.linearRampToValueAtTime(0, audioCtx.currentTime + dur);
}
// Particle system and screenshake
let particles = [];
let shakeTime = 0, shakeMag = 0;
// The Last Pixel - Cellular Automata Engine
const SIZE = 100;
const EMPTY = 0, SAND = 1, LAVA = 2, GLASS = 3, PLAYER = 4;
const COLORS = ["#000", "#d2b48c", "#ff4500", "#87cefa", "#00ffff"];
let grid, playerX, playerY, time = 0, gameOver = false, stormTimer = 0;
let playerVX = 0, playerVY = 0, playerOnGround = false, coyoteTimer = 0, jumpQueued = false;
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const hud = document.getElementById("time");
const over = document.getElementById("gameOver");
const restartBtn = document.getElementById("restartBtn");
const keys = {};

function reset() {
  grid = Array.from({length: SIZE}, () => Array(SIZE).fill(EMPTY));
  playerX = SIZE >> 1;
  playerY = SIZE - 10;
  playerVX = 0;
  playerVY = 0;
  playerOnGround = false;
  coyoteTimer = 0;
  jumpQueued = false;
  grid[playerY][playerX] = PLAYER;
  time = 0;
  gameOver = false;
  stormTimer = 0;
  over.style.display = "none";
}

function spawnSand() {
  for (let i = 0; i < SIZE; i++)
    if (Math.random() < 0.02) grid[SIZE-1][i] = SAND;
}

function spawnLavaStorm() {
  for (let i = 0; i < SIZE; i++) grid[0][i] = LAVA;
  shakeTime = 30; // 0.5s at 60fps
  shakeMag = 3;
}

function updateGrid() {
  for (let y = SIZE-1; y >= 0; y--) {
    for (let x = 0; x < SIZE; x++) {
      let cell = grid[y][x];
      if (cell === SAND) {
        if (y+1 < SIZE && grid[y+1][x] === EMPTY) {
          grid[y+1][x] = SAND; grid[y][x] = EMPTY;
        } else if (y+1 < SIZE && x>0 && grid[y+1][x-1] === EMPTY) {
          grid[y+1][x-1] = SAND; grid[y][x] = EMPTY;
        } else if (y+1 < SIZE && x<SIZE-1 && grid[y+1][x+1] === EMPTY) {
          grid[y+1][x+1] = SAND; grid[y][x] = EMPTY;
        }
      } else if (cell === LAVA) {
        if (y+1 < SIZE && grid[y+1][x] === EMPTY) {
          grid[y+1][x] = LAVA; grid[y][x] = EMPTY;
        } else if (y+1 < SIZE && x>0 && grid[y+1][x-1] === EMPTY) {
          grid[y+1][x-1] = LAVA; grid[y][x] = EMPTY;
        } else if (y+1 < SIZE && x<SIZE-1 && grid[y+1][x+1] === EMPTY) {
          grid[y+1][x+1] = LAVA; grid[y][x] = EMPTY;
        }
        // Lava turns sand to glass
        for (let dx=-1; dx<=1; dx++) {
          for (let dy=-1; dy<=1; dy++) {
            let nx = x+dx, ny = y+dy;
            if (nx>=0 && nx<SIZE && ny>=0 && ny<SIZE && grid[ny][nx] === SAND) {
              grid[ny][nx] = GLASS;
              // Particle spray
              for (let p=0; p<5; p++) {
                particles.push({
                  x: nx+0.5, y: ny+0.5,
                  vx: (Math.random()-0.5)*2,
                  vy: (Math.random()-0.5)*2,
                  life: 20
                });
              }
            }
          }
        }
      }
    }
  }
                beep(880, 0.05, 0.15); // sizzle
}

function draw() {
  // Screenshake
  if (shakeTime > 0) {
    ctx.save();
    ctx.translate((Math.random()-0.5)*shakeMag, (Math.random()-0.5)*shakeMag);
    shakeTime--;
    if (shakeTime === 0) ctx.restore();
  }
  ctx.clearRect(0,0,SIZE,SIZE);
  // Draw base with jitter
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      let jitter = 0;
      if (grid[y][x] === SAND || grid[y][x] === LAVA) {
        jitter = (Math.random()-0.5);
      }
      ctx.fillStyle = COLORS[grid[y][x]];
      ctx.fillRect(x+jitter, y, 1, 1);
    }
  }
  // Glow pass
  ctx.globalCompositeOperation = "lighter";
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      if (grid[y][x] === LAVA) {
        ctx.fillStyle = "rgba(255,80,0,0.5)";
        ctx.fillRect(x-1, y-1, 3, 3);
      } else if (grid[y][x] === GLASS) {
        ctx.fillStyle = "rgba(135,206,250,0.3)";
        ctx.fillRect(x-1, y-1, 3, 3);
      }
    }
  }
  ctx.globalCompositeOperation = "source-over";
  // Draw particles
  for (let i=particles.length-1; i>=0; i--) {
    let p = particles[i];
    ctx.fillStyle = `rgba(255,255,255,${p.life/20})`;
    ctx.fillRect(p.x, p.y, 1, 1);
    p.x += p.vx;
    p.y += p.vy;
    p.life--;
    if (p.life <= 0) particles.splice(i,1);
  }
  if (shakeTime > 0) ctx.restore();
}

function checkDeath() {
  for (let dx=-1; dx<=1; dx++) {
    for (let dy=-1; dy<=1; dy++) {
      let nx = playerX+dx, ny = playerY+dy;
      if (nx>=0 && nx<SIZE && ny>=0 && ny<SIZE && grid[ny][nx] === LAVA) {
        gameOver = true;
        over.style.display = "flex";
        return;
      }
    }
  }
}

function movePlayer(dx, dy) {
  // Deprecated: replaced by velocity-based movement
}

document.addEventListener("keydown", e => {
  if (gameOver) return;
  keys[e.key] = true;
  if ((e.key === "w" || e.key === "ArrowUp") && playerOnGround) {
    jumpQueued = true;
  }
});
document.addEventListener("keyup", e => {
  keys[e.key] = false;
});

restartBtn.onclick = () => reset();

function loop(ts) {
  if (gameOver) return;
  updateGrid();
  // Player movement
  let ax = 0, ay = 0.2; // gravity
  if (keys["a"] || keys["ArrowLeft"]) ax -= 0.5;
  if (keys["d"] || keys["ArrowRight"]) ax += 0.5;
  playerVX += ax;
  playerVY += ay;
  // Friction
  playerVX *= playerOnGround ? 0.7 : 0.98;
  playerVY *= 0.98;
  // Coyote time
  if (playerOnGround) coyoteTimer = 8;
  else if (coyoteTimer > 0) coyoteTimer--;
  // Jump
  if (jumpQueued && coyoteTimer > 0) {
    playerVY = -4.5;
    jumpQueued = false;
    coyoteTimer = 0;
  }
  // Move
  let nx = Math.round(playerX + playerVX);
  let ny = Math.round(playerY + playerVY);
  // Clamp and prevent out-of-bounds
  nx = Math.max(0, Math.min(SIZE-1, nx));
  ny = Math.max(0, Math.min(SIZE-1, ny));
  if (nx <= 0 || nx >= SIZE-1) playerVX = 0;
  if (ny <= 0 || ny >= SIZE-1) playerVY = 0;
  // Collision
  if (ny+1 < SIZE && grid[ny+1][nx] !== EMPTY) {
    playerOnGround = true;
    playerVY = 0;
    ny = ny;
  } else {
    playerOnGround = false;
  }
  if (grid[ny][nx] === EMPTY || grid[ny][nx] === PLAYER) {
    grid[playerY][playerX] = EMPTY;
    playerX = nx;
    playerY = ny;
    grid[playerY][playerX] = PLAYER;
  } else {
    // Hit wall: stop
    playerVX = 0;
    playerVY = 0;
  }
  draw();
  checkDeath();
  stormTimer++;
  if (stormTimer % 600 === 0) spawnLavaStorm();
  if (stormTimer % 60 === 0) { time++; hud.textContent = time; }
  requestAnimationFrame(loop);
    if (stormTimer % 540 === 0) beep(300, 0.2, 0.15); // warning tone 1s before storm
}

reset();
requestAnimationFrame(loop);
