// game.js

const homeScreen = document.getElementById('homeScreen');
const startBtn   = document.getElementById('startBtn');

const timerEl = document.createElement('div');
timerEl.id = 'timer';
timerEl.textContent = '00:00';
document.body.appendChild(timerEl);

// ——— Timer state
let startTime = null;
function formatTime(seconds) {
  const m = Math.floor(seconds/60).toString().padStart(2,'0');
  const s = Math.floor(seconds%60).toString().padStart(2,'0');
  return `${m}:${s}`;
}

const THUD_DELAY = 1.85;

let gameStarted = false;

function beginGame() {
  if (gameStarted) return; // prevent multiple starts
  gameStarted = true;
  startTime = performance.now();
  homeScreen.style.display = 'none';  
  startGame();
  
    // schedule the “thud” when player first hits the ground
  setTimeout(() => {
    thudSound.currentTime = 0;
    thudSound.play();
  }, THUD_DELAY * 1000);
}

// 2) Wire up both click and keydown
startBtn.addEventListener('click', beginGame);

window.addEventListener('keydown', function onFirstKey(e) {
  beginGame();  
});

// ——— Canvas & Resize ———
const canvas = document.getElementById('gameCanvas');
const ctx    = canvas.getContext('2d');
function resizeCanvas() {
  canvas.width  = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// ——— Assets ———
const playerImage   = new Image();
playerImage.src     = 'assets/images/gorilla.png';

const bgImage        = new Image();
bgImage.src          = 'assets/images/background.png';

const platformImage  = new Image();
platformImage.src    = 'assets/images/platform.jpg';   // your provided PNG

const groundImage   = new Image();
groundImage.src     = 'assets/images/ground.png';

const flagImage = new Image();
flagImage.src   = 'assets/images/banana.png';

const jumpSound      = new Audio('assets/sounds/huu.mp3');
const winSound = new Audio('assets/sounds/won.mp3');
const screamSound = new Audio('assets/sounds/scream.mp3');
const thudSound      = new Audio('assets/sounds/thud.mp3');


// ——— Constants ———
const GRAVITY          = 2000;
const MAX_CHARGE       = 1;
const AUTO_CHARGE_LIMIT= MAX_CHARGE / 2;
const JUMP_MULTIPLIER  = 900;
const MOVE_ACCEL       = 2500;
const MAX_MOVE_SPEED   = 375;
const FRICTION_GROUND  = 0.0;

const TILE_W           = 120;
const TILE_H           = 20;
const V_SPACING        = 150;

const BAR_X      = 20;
const BAR_Y      = 20;
const BAR_WIDTH  = 200;
const BAR_HEIGHT = 16;
const BAR_SEGS   = 10;          // number of segments

// ——— Game State ———
let player = {
  x: canvas.width/2 + 500,
  // y: canvas.height - TILE_H - 60,
  y: canvas.height - 3500,
  width: 50, height: 50,
  vx: 0, vy: 0,
  onGround: true,
  charging: false,
  chargeTime: 0
};

let maxHeight = player.y;

// ——— Input ———
const keys = { left:false, right:false, space:false };
window.addEventListener('keydown', e => {
  if (e.code==='KeyA'||e.code==='ArrowLeft')  keys.left  = true;
  if (e.code==='KeyD'||e.code==='ArrowRight') keys.right = true;
  if (e.code==='Space')                      keys.space = true;
});
window.addEventListener('keyup', e => {
  if (e.code==='KeyA'||e.code==='ArrowLeft')  keys.left  = false;
  if (e.code==='KeyD'||e.code==='ArrowRight') keys.right = false;
  if (e.code==='Space') {
    if (player.charging) doJump();
    keys.space = false;
  }
});

// ——— Mobile touch controls binding ———
function bindControl(btnId, keyName) {
  const btn = document.getElementById(btnId);
  if (!btn) return;

  // Press start
  ['touchstart', 'mousedown'].forEach(evt =>
    btn.addEventListener(evt, e => {
      e.preventDefault();
      keys[keyName] = true;
    }, { passive: false })
  );

  // Press end
  ['touchend', 'mouseup'].forEach(evt =>
    btn.addEventListener(evt, e => {
      e.preventDefault();
      // trigger jump off-charge just like Space keyup
      if (keyName === 'space' && player.charging) doJump();
      keys[keyName] = false;
    }, { passive: false })
  );
}

bindControl('btn-left',  'left');
bindControl('btn-right', 'right');
bindControl('btn-jump',  'space');

// ——— Platform Generator ———
const platforms = [
  { x: 0,   y: canvas.height - 20, width: canvas.width, height: 530 }, // Ground
  { x: 100, y: canvas.height - 150, width: 180, height: 20 },
  { x: 320, y: canvas.height - 300, width: 150, height: 20 },
  { x: 520, y: canvas.height - 450, width: 100, height: 20 },
  { x: 250, y: canvas.height - 600, width: 160, height: 20 },
  { x: 80,  y: canvas.height - 750, width: 100, height: 20 },
  { x: 400, y: canvas.height - 900, width: 130, height: 20 },
  { x: 220, y: canvas.height - 1050, width: 180, height: 20 },
  { x: 500, y: canvas.height - 1200, width: 150, height: 20 },

  { x: 350, y: canvas.height -1350, width: 140, height: 20 },
  { x: 120, y: canvas.height -1500, width: 160, height: 20 },
  { x: 450, y: canvas.height -1650, width: 120, height: 20 },
  { x: 200, y: canvas.height -1800, width: 170, height: 20 },
  { x:  60, y: canvas.height -1950, width: 110, height: 20 },
  { x: 380, y: canvas.height -2100, width: 130, height: 20 },
  { x: 240, y: canvas.height -2250, width: 150, height: 20 },
  { x: 500, y: canvas.height -2400, width: 100, height: 20 },
  { x: 150, y: canvas.height -2550, width: 180, height: 20 },
  { x: 420, y: canvas.height -2700, width: 140, height: 20 },
  { x: 280, y: canvas.height -2850, width: 120, height: 20 },
  { x:  90, y: canvas.height -3000, width: 160, height: 20 },
  { x:  500, y: canvas.height -3075, width: 90, height: 20 },

  // 20: summit / goal
  { x: canvas.width/2 - 95, y: canvas.height -3150, width: 60, height: 20, isGoal: true }
];

const flag = {
  x: canvas.width/2 - 95,
  // x: canvas.width/2 - 16,          // center horizontally
  y: canvas.height - 3150 - 60,    // summitY − sprite height
  width: 60,
  height: 60,
  reached: false
};

function startGame() {
  // play your scream effect
  screamSound.currentTime = 0;
  screamSound.play();

  // reset the timestamp so the first frame delta is clean
  lastTime = null;

  // kick off the loop
  requestAnimationFrame(gameLoop);
}


// ——— Jump Helper ———
function doJump() {
  const t = Math.min(player.chargeTime, AUTO_CHARGE_LIMIT);
  player.vy        = -(t/AUTO_CHARGE_LIMIT)*MAX_CHARGE*JUMP_MULTIPLIER;
  player.onGround  = false;
  player.charging  = false;
  jumpSound.currentTime = 0;
  jumpSound.play();
}

// ——— Game Loop ———
let lastTime = null;
function gameLoop(ts) {
  if (!lastTime) lastTime = ts;
  const dt = (ts - lastTime)/1000;
  lastTime = ts;

  if (startTime !== null) {
    const elapsed = (ts - startTime)/1000;
    timerEl.textContent = formatTime(elapsed);
  }

  update(dt);

  // if we just hit the flag, don't clear or re‑render world (overlay already drawn)
  if (flag.reached) {
    return;
  }

  render();
  
  requestAnimationFrame(gameLoop);
}
// requestAnimationFrame(gameLoop);
// startGame();

function update(dt) {
  // 1) Horizontal accel & friction
  if (keys.left) {
    player.vx -= MOVE_ACCEL * dt;
  } else if (keys.right) {
    player.vx += MOVE_ACCEL * dt;
  } else if (player.onGround) {
    player.vx *= Math.pow(FRICTION_GROUND, dt);
  }
  player.vx = Math.max(-MAX_MOVE_SPEED, Math.min(MAX_MOVE_SPEED, player.vx));
  if (player.onGround && Math.abs(player.vx) < 5) player.vx = 0;
  player.x += player.vx * dt;
  player.x = Math.max(0, Math.min(canvas.width - player.width, player.x));

  // 2) Jump charging
  if (keys.space && player.onGround && !player.charging) {
    player.charging  = true;
    player.chargeTime = 0;
  }
  if (player.charging) {
    player.chargeTime = Math.min(player.chargeTime + dt, AUTO_CHARGE_LIMIT);
    if (player.chargeTime >= AUTO_CHARGE_LIMIT) doJump();
    player.vy = 0;
  } else {
    // 3) Gravity & vertical position
    player.vy += GRAVITY * dt;
    player.y  += player.vy * dt;

    // 4) Flag collision check (win condition)
    if (!flag.reached &&
        player.x <  flag.x + flag.width &&
        player.x + player.width > flag.x &&
        player.y <  flag.y + flag.height &&
        player.y + player.height > flag.y
    ) {
      flag.reached = true;
      winSound.currentTime = 0;
      winSound.play();
      showWinScreen();
      return;  // stop further physics/logic
    }

    // 5) Platform collisions (regular landings only)
    player.onGround = false;
    platforms.forEach(p => {
      const prevY   = player.y - player.vy * dt;
      const falling = player.vy > 0;
      const crossed = prevY + player.height <= p.y
                    && player.y + player.height >= p.y;
      const withinX = player.x + player.width > p.x
                    && player.x < p.x + p.width;
      if (falling && crossed && withinX) {
        player.y       = p.y - player.height;
        player.vy      = 0;
        player.onGround = true;

        // play land sound
        // landSound.currentTime = 0;
        // landSound.play();
      }
    });

    // 6) Respawn if fallen off-screen
    // maxHeight = Math.min(maxHeight, player.y);
    // if (player.y - maxHeight > canvas.height) {
    //   const base = platforms[0];
    //   player.x = base.x + base.width/2 - player.width/2;
    //   player.y = base.y - player.height;
    //   player.vy = 0;
    //   maxHeight = player.y;
    // }
  }
}

// ——— Update ———
// function update(dt) {

//   // horizontal accel & friction
//   if (keys.left)  player.vx -= MOVE_ACCEL*dt;
//   else if (keys.right) player.vx += MOVE_ACCEL*dt;
//   else if (player.onGround) player.vx *= Math.pow(FRICTION_GROUND, dt);

//   player.vx = Math.max(-MAX_MOVE_SPEED, Math.min(MAX_MOVE_SPEED, player.vx));
//   if (player.onGround && Math.abs(player.vx) < 5) player.vx = 0;
//   player.x += player.vx*dt;
//   player.x = Math.max(0, Math.min(canvas.width-player.width, player.x));

//   // charging
//   if (keys.space && player.onGround && !player.charging) {
//     player.charging = true;
//     player.chargeTime = 0;
//   }
//   if (player.charging) {
//     player.chargeTime = Math.min(player.chargeTime + dt, AUTO_CHARGE_LIMIT);
//     if (player.chargeTime >= AUTO_CHARGE_LIMIT) doJump();
//     player.vy = 0;
//   } else {
//     // gravity
//     player.vy += GRAVITY*dt;
//     player.y  += player.vy*dt;

//     // collisions
//     player.onGround = false;
//     platforms.forEach(p => {
//       const prevY   = player.y - player.vy*dt;
//       const falling = player.vy > 0;
//       const crossed = prevY+player.height <= p.y &&
//                       player.y+player.height >= p.y;
//       const withinX = player.x+player.width > p.x &&
//                       player.x < p.x+p.width;
//       if (falling && crossed && withinX) {
//         player.y = p.y-player.height;
//         player.vy = 0;
//         player.onGround = true;
//         if (p.isGoal && !window.gameWon) {
//           window.gameWon = true;
//           winSound.currentTime = 0;
//           winSound.play();
//           showWinScreen();
//           return;
//         }
//       }
//     });

    // respawn if fallen too far
    // maxHeight = Math.min(maxHeight, player.y);
    // if (player.y-maxHeight > canvas.height) {
    //   const base = platforms[0];
    //   player.x = base.x + base.width/2 - player.width/2;
    //   player.y = base.y-player.height;
    //   player.vy = 0;
    //   maxHeight = player.y;
    // }
//   }
// }

// ——— Render ———
function render() {
  // // // background parallax
  // // const offsetY = player.y - (canvas.height/2 - player.height/2);
  // // if (bgImage.complete) {
  // //   const scale    = canvas.width/bgImage.width;
  // //   const sh       = bgImage.height*scale;
  // //   const yScroll  = -offsetY*0.5 % sh;
  // //   ctx.drawImage(bgImage, 0, yScroll,     canvas.width, sh);
  // //   ctx.drawImage(bgImage, 0, yScroll - sh, canvas.width, sh);
  // // } else {
  // //   ctx.fillStyle = '#000';
  // //   ctx.fillRect(0, 0, canvas.width, canvas.height);
  // // }

  // // === Tiled parallax background ===
  // // 0) Compute camera offset so the player stays centered
  // const offsetY = player.y - (canvas.height/2 - player.height/2);

  // // 1) Draw tiled, parallax background
  // // if (bgImage.complete && bgImage.naturalWidth) {
  // //   const parallax = 0.5;
  // //   const scale    = canvas.width  / bgImage.width;
  // //   const tileH    = bgImage.height * scale;

  // //   // scroll position, wrapped within one tile
  // //   let yScroll = (-offsetY * parallax) % tileH;
  // //   if (yScroll > 0) yScroll -= tileH;

  // //   // draw enough vertical tiles to cover the view
  // //   for (let y = yScroll; y < canvas.height; y += tileH) {
  // //     ctx.drawImage(bgImage, 0, y, canvas.width, tileH);
  // //   }
  // // } else {
  // //   ctx.fillStyle = '#000';
  // //   ctx.fillRect(0, 0, canvas.width, canvas.height);
  // // }

  // if (bgImage.complete && bgImage.naturalWidth) {
  //   const scale = canvas.width / bgImage.width;
  //   const bgHeight = bgImage.height * scale;

  //   // Compute background Y so it's pinned to the ground/platform at canvas bottom
  //   const bgY = canvas.height - bgHeight - offsetY;
  //   ctx.drawImage(bgImage, 0, bgY, canvas.width, bgHeight);
  // } else {
  //   ctx.fillStyle = '#000';
  //   ctx.fillRect(0, 0, canvas.width, canvas.height);
  // }

  // // camera transform
  // ctx.save();
  // ctx.translate(0, -offsetY);

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // 1) compute camera Y offset in world‐space
  const offsetY = player.y - (canvas.height/2 - player.height/2);

  // 2) draw the correct slice of the tall background so it always fills the screen
  if (bgImage.complete && bgImage.naturalWidth) {
    // scale factor between image‐pixels and canvas‐pixels
    const scale = canvas.width / bgImage.width;

    // how many source‐pixels tall we need to fill the canvas
    const srcH = canvas.height / scale;

    // which source‐Y to start from (so that bottom of image = ground, then we scroll up)
    let srcY = offsetY / scale;

    // clamp so we never read outside the image
    srcY = Math.max(0, Math.min(bgImage.height - srcH, srcY));

    // drawImage( image,
    //            srcX, srcY, srcW, srcH,
    //            dstX, dstY, dstW, dstH )
    ctx.drawImage(
      bgImage,
      0,      srcY,
      bgImage.width, srcH,
      0,      0,
      canvas.width,   canvas.height
    );
  } else {
    // fallback fill
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  // 3) now translate and draw the rest of your world…
  ctx.save();
  ctx.translate(0, -offsetY);
  

  if (flagImage.complete) {
    ctx.drawImage(flagImage, flag.x, flag.y, flag.width, flag.height);
  }

  // draw platforms
  platforms.forEach(p => {
    // if (p.isGoal) {
    //   // flag
    //   ctx.save();
    //   ctx.strokeStyle = '#fff';
    //   ctx.lineWidth   = 4;
    //   ctx.beginPath();
    //   ctx.moveTo(p.x+p.width/2, p.y);
    //   ctx.lineTo(p.x+p.width/2, p.y-40);
    //   ctx.stroke();
    //   ctx.fillStyle = '#e91e63';
    //   ctx.fillRect(p.x+p.width/2, p.y-40, 30, 20);
    //   ctx.restore();
    // } else

    if (p.y === canvas.height - TILE_H && groundImage.complete) {
    ctx.drawImage(groundImage, p.x, p.y, p.width, p.height);

    }else if (platformImage.complete) {
      ctx.drawImage(platformImage, p.x, p.y, p.width, p.height);
    } else {
      ctx.fillStyle = '#555';
      ctx.fillRect(p.x, p.y, p.width, p.height);
    }
  });

  // draw player with tilt
  const cx = player.x + player.width/2;
  const cy = player.y + player.height/2;
  let angle = 0;
  if (player.vy < -50) angle = -0.15;
  else if (player.vy > 50) angle = 0.2;
  ctx.translate(cx, cy);
  ctx.rotate(angle);
  if (playerImage.complete) {
    ctx.drawImage(playerImage, -player.width/2, -player.height/2, player.width, player.height);
  } else {
    ctx.fillStyle = '#4af';
    ctx.fillRect(-player.width/2, -player.height/2, player.width, player.height);
  }
  ctx.restore();

    // 1) Draw bar background (thick border)
  ctx.fillStyle   = '#000';
  ctx.fillRect(BAR_X - 2, BAR_Y - 2, BAR_WIDTH + 4, BAR_HEIGHT + 4);
  ctx.fillStyle   = '#222';
  ctx.fillRect(BAR_X,    BAR_Y,     BAR_WIDTH,     BAR_HEIGHT);

  // 2) Draw segments
  const pct = player.chargeTime / AUTO_CHARGE_LIMIT;
  for (let i = 0; i < BAR_SEGS; i++) {
    const segW   = (BAR_WIDTH / BAR_SEGS) - 2;
    const segX   = BAR_X + i * (segW + 2) + 1;
    const fillPct = pct * BAR_SEGS;
    ctx.fillStyle = i < fillPct ? '#0f0' : '#040';  // bright green vs dark
    ctx.fillRect(segX, BAR_Y + 1, segW, BAR_HEIGHT - 2);
  }

  // 3) Draw border in neon green
  ctx.strokeStyle = '#0f0';
  ctx.lineWidth   = 2;
  ctx.strokeRect(BAR_X - 2, BAR_Y - 2, BAR_WIDTH + 4, BAR_HEIGHT + 4);

  // // UI: charge bar (screen space)
  // const barW = 200, barH = 16;
  // const pct  = player.chargeTime / AUTO_CHARGE_LIMIT;
  // ctx.fillStyle   = '#222';
  // ctx.fillRect(20, 20, barW, barH);
  // ctx.fillStyle   = '#32baff';
  // ctx.fillRect(20, 20, barW * pct, barH);
  // ctx.strokeStyle = '#fff';
  // ctx.lineWidth   = 2;
  // ctx.strokeRect(20, 20, barW, barH);
}

// startGame();

function showWinScreen() {
  // overlay
  ctx.save();
  ctx.resetTransform();
  ctx.fillStyle = 'rgba(0,0,0,0.7)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#ffffff';
  ctx.font      = '48px "Press Start 2P"';
  ctx.textAlign = 'center';
  ctx.fillText('🦍 You Won! 🍌', canvas.width/2, canvas.height/2 - 40);
  ctx.restore();

  // // create a button in DOM
  // const btn = document.createElement('button');
  // btn.textContent = 'Play Again';
  // Object.assign(btn.style, {
  //   position: 'absolute',
  //   left: '50%',
  //   top: '60%',
  //   transform: 'translateX(-50%)',
  //   padding: '0.8rem 1.5rem',
  //   fontSize: '1.2rem',
  //   zIndex: 99,
  //   cursor: 'pointer'
  // });

  if (startTime !== null) {
    // freeze display at the final time
    const finalSec = (performance.now() - startTime) / 1000;
    timerEl.textContent = formatTime(finalSec);
  }
  startTime = null;
  
  const btn = document.createElement('button');
  btn.classList.add('replay');
  btn.textContent = 'Play Again!';
  Object.assign(btn.style, {
    position:   'absolute',
    left:       '50%',
    top:        '50%',
    transform:  'translateX(-50%)',
    padding:    '14px 26px',
    fontSize:   '24px',
    fontFamily: '"Press Start 2P", monospace',
    color:      '#fff',
    //background: 'rgba(255,255,255,0.5)', // 50% white
    border:     '4px solid #fff',
    borderRadius:'6px',
    textShadow: '0 0 6px #000',
    cursor:     'pointer',
    zIndex:     999
  });
  document.body.appendChild(btn);
  btn.addEventListener('click', () => {
    screamSound.currentTime = 0;
    screamSound.play();



    // reset state
    document.body.removeChild(btn);
    // window.gameWon = false;
    flag.reached = false; 
    lastTime = null;
    // player.x = canvas.width/2 - player.width/2;
    // player.y = canvas.height -20 - player.height;
    player.x = canvas.width/2 + 500;
    player.y = canvas.height - 3500;
    player.vx = player.vy = 0;
    player.onGround = true;
    player.charging = false;
    maxHeight = player.y;

    // ── RESTART the timer ──
    startTime = performance.now();
    timerEl.textContent = '00:00';

    setTimeout(() => {
    thudSound.currentTime = 0;
    thudSound.play();
  }, THUD_DELAY * 1000);

    requestAnimationFrame(gameLoop);

  });
}

