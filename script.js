// The Last Pixel - Cellular Automata Engine
const SIZE = 100;
const EMPTY = 0, SAND = 1, LAVA = 2, GLASS = 3, PLAYER = 4;
const COLORS = ["#000", "#d2b48c", "#ff4500", "#87cefa", "#00ffff"];
let grid, playerX, playerY, time = 0, gameOver = false, stormTimer = 0;
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const hud = document.getElementById("time");
const over = document.getElementById("gameOver");
const restartBtn = document.getElementById("restartBtn");

function reset() {
  grid = Array.from({length: SIZE}, () => Array(SIZE).fill(EMPTY));
  playerX = SIZE >> 1;
  playerY = SIZE - 10;
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
            if (nx>=0 && nx<SIZE && ny>=0 && ny<SIZE && grid[ny][nx] === SAND)
              grid[ny][nx] = GLASS;
          }
        }
      }
    }
  }
}

function draw() {
  ctx.clearRect(0,0,SIZE,SIZE);
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      ctx.fillStyle = COLORS[grid[y][x]];
      ctx.fillRect(x, y, 1, 1);
    }
  }
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
  let nx = playerX+dx, ny = playerY+dy;
  if (nx>=0 && nx<SIZE && ny>=0 && ny<SIZE && grid[ny][nx] === EMPTY) {
    grid[playerY][playerX] = EMPTY;
    playerX = nx; playerY = ny;
    grid[playerY][playerX] = PLAYER;
  }
}

document.addEventListener("keydown", e => {
  if (gameOver) return;
  if (e.key === "w" || e.key === "ArrowUp") movePlayer(0,-1);
  if (e.key === "s" || e.key === "ArrowDown") movePlayer(0,1);
  if (e.key === "a" || e.key === "ArrowLeft") movePlayer(-1,0);
  if (e.key === "d" || e.key === "ArrowRight") movePlayer(1,0);
});

restartBtn.onclick = () => reset();

function loop(ts) {
  if (gameOver) return;
  updateGrid();
  draw();
  checkDeath();
  stormTimer++;
  if (stormTimer % 600 === 0) spawnLavaStorm();
  if (stormTimer % 60 === 0) { time++; hud.textContent = time; }
  requestAnimationFrame(loop);
}

reset();
requestAnimationFrame(loop);
