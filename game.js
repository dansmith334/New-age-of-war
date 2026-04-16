// Epoch Siege - original canvas base battler with zero external assets.
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const ui = {
  energyText: document.getElementById('energyText'),
  playerBaseText: document.getElementById('playerBaseText'),
  enemyBaseText: document.getElementById('enemyBaseText'),
  timeText: document.getElementById('timeText'),
  unitButtons: document.getElementById('unitButtons'),
  upgradeButtons: document.getElementById('upgradeButtons'),
  titleOverlay: document.getElementById('titleOverlay'),
  resultOverlay: document.getElementById('resultOverlay'),
  resultTitle: document.getElementById('resultTitle'),
  resultMsg: document.getElementById('resultMsg')
};

const CONFIG = {
  field: { width: 1280, height: 520, groundY: 430, lanePad: 52 },
  base: { width: 80, attackRange: 240, attackRate: 1.2, attackDamage: 16 },
  economy: { startEnergy: 70, maxEnergy: 130, genPerSec: 10 },
  colors: {
    player: '#67ddff', enemy: '#ff7f95', projectile: '#ffe87e', heal: '#8cffba', bgGround: '#74d06f'
  },
  units: {
    sprinter: { name: 'Sprinter', tier: 1, cost: 30, hp: 66, speed: 145, dmg: 10, atkRate: 1.2, range: 28, role: 'fast melee', shape: 'triangle' },
    bruiser: { name: 'Bulwark', tier: 1, cost: 55, hp: 180, speed: 60, dmg: 19, atkRate: 0.95, range: 30, role: 'tank melee', shape: 'square' },
    ranger: { name: 'Ranger', tier: 1, cost: 65, hp: 88, speed: 75, dmg: 16, atkRate: 1.0, range: 140, role: 'ranged', shape: 'diamond' },
    charger: { name: 'Charger', tier: 2, cost: 90, hp: 95, speed: 70, dmg: 24, atkRate: 1.15, range: 30, role: 'burst dash', shape: 'bolt', dashCooldown: 4.2 },
    lobber: { name: 'Lobber', tier: 2, cost: 120, hp: 100, speed: 52, dmg: 34, atkRate: 0.75, range: 220, role: 'arc shot', shape: 'circle', arc: true },
    support: { name: 'Beacon', tier: 2, cost: 85, hp: 80, speed: 62, dmg: 0, atkRate: 0.8, range: 115, role: 'heals allies', shape: 'plus', heal: 12 },
    titan: { name: 'Titan', tier: 3, cost: 190, hp: 350, speed: 46, dmg: 36, atkRate: 0.9, range: 36, role: 'legendary juggernaut', shape: 'hex' }
  },
  upgrades: {
    econBoost: { name: 'Power Grid', baseCost: 90, max: 4, type: 'econ' },
    battery: { name: 'Capacitor', baseCost: 80, max: 4, type: 'maxEnergy' },
    fortify: { name: 'Core Plating', baseCost: 110, max: 3, type: 'baseHp' },
    edge: { name: 'War Labs', baseCost: 95, max: 5, type: 'damage' },
    thrusters: { name: 'Servo Boost', baseCost: 100, max: 4, type: 'speed' },
    tier2: { name: 'Tier II Protocol', baseCost: 140, max: 1, type: 'unlock2' },
    tier3: { name: 'Titan Protocol', baseCost: 260, max: 1, type: 'unlock3' },
    turret: { name: 'Base Cannon', baseCost: 130, max: 3, type: 'turret' }
  }
};

const state = {
  running: false, time: 0, lastTs: 0,
  player: { baseHp: 850, baseMaxHp: 850, energy: 0, maxEnergy: CONFIG.economy.maxEnergy, genPerSec: CONFIG.economy.genPerSec, tier: 1, upgrades: {} },
  enemy: { baseHp: 850, baseMaxHp: 850, tier: 1, aiTimer: 0, aiCD: 2.5, aggression: 1 },
  units: [], projectiles: [], particles: []
};

function resetGame() {
  state.time = 0; state.running = true; state.units = []; state.projectiles = []; state.particles = [];
  state.player = { baseHp: 850, baseMaxHp: 850, energy: CONFIG.economy.startEnergy, maxEnergy: CONFIG.economy.maxEnergy, genPerSec: CONFIG.economy.genPerSec, tier: 1, upgrades: {} };
  state.enemy = { baseHp: 850, baseMaxHp: 850, tier: 1, aiTimer: 0, aiCD: 2.4, aggression: 1 };
  ui.resultOverlay.classList.add('hidden');
}

const clamp = (n,min,max)=>Math.max(min,Math.min(max,n));
const rand = (a,b)=>Math.random()*(b-a)+a;

function spawnUnit(key, team) {
  const base = CONFIG.units[key];
  if (!base) return;
  const buff = team === 'player' ? getBuffs() : { damage: 1 + state.enemy.aggression * 0.08, speed: 1 + state.enemy.aggression * 0.04 };
  const dir = team === 'player' ? 1 : -1;
  const x = team === 'player' ? CONFIG.field.lanePad + 70 : CONFIG.field.width - CONFIG.field.lanePad - 70;
  state.units.push({
    key, team, x, y: CONFIG.field.groundY - 24, dir,
    hp: base.hp * (team === 'enemy' ? 1 + state.enemy.aggression * 0.1 : 1), maxHp: base.hp * (team === 'enemy' ? 1 + state.enemy.aggression * 0.1 : 1),
    speed: base.speed * buff.speed, dmg: base.dmg * buff.damage, atkRate: base.atkRate,
    range: base.range, size: 22, cooldown: rand(0,0.4), dashCD: base.dashCooldown || 0
  });
}

function getBuffs() {
  const u = state.player.upgrades;
  return {
    damage: 1 + (u.edge || 0) * 0.12,
    speed: 1 + (u.thrusters || 0) * 0.08
  };
}

function tryBuyUnit(key) {
  const unit = CONFIG.units[key];
  if (!unit || unit.tier > state.player.tier || state.player.energy < unit.cost || !state.running) return;
  state.player.energy -= unit.cost;
  spawnUnit(key, 'player');
}

function upgradeCost(key) {
  const up = CONFIG.upgrades[key], lvl = state.player.upgrades[key] || 0;
  return Math.floor(up.baseCost * Math.pow(1.55, lvl));
}

function buyUpgrade(key) {
  const up = CONFIG.upgrades[key];
  const lvl = state.player.upgrades[key] || 0;
  if (!up || lvl >= up.max || !state.running) return;
  const cost = upgradeCost(key);
  if (state.player.energy < cost) return;
  state.player.energy -= cost;
  state.player.upgrades[key] = lvl + 1;

  switch (up.type) {
    case 'econ': state.player.genPerSec += 2.4; break;
    case 'maxEnergy': state.player.maxEnergy += 35; break;
    case 'baseHp': state.player.baseMaxHp += 210; state.player.baseHp += 210; break;
    case 'unlock2': state.player.tier = Math.max(state.player.tier, 2); break;
    case 'unlock3': state.player.tier = Math.max(state.player.tier, 3); break;
  }
}

function closestEnemy(unit) {
  let best = null, bestDist = Infinity;
  for (const other of state.units) {
    if (other.team === unit.team || other.hp <= 0) continue;
    const d = Math.abs(other.x - unit.x);
    if (d < bestDist) { bestDist = d; best = other; }
  }
  return [best, bestDist];
}

function createParticle(x,y,color,vx=0,vy=0,life=0.4,size=3) { state.particles.push({x,y,color,vx,vy,life,max:life,size}); }

function dealDamage(target, amount) {
  target.hp -= amount;
  for (let i=0;i<4;i++) createParticle(target.x || (target.team==='player'?48:CONFIG.field.width-48), (target.y||CONFIG.field.groundY-90)+rand(-9,9), '#ffd0d8', rand(-25,25), rand(-25,10), 0.3, 2);
}

function enemyAI(dt) {
  state.enemy.aiTimer -= dt;
  const t = state.time;
  state.enemy.aggression = 1 + t / 80;
  if (t > 45) state.enemy.tier = 2;
  if (t > 110) state.enemy.tier = 3;
  state.enemy.aiCD = clamp(2.5 - t * 0.006, 0.65, 2.5);
  if (state.enemy.aiTimer <= 0) {
    state.enemy.aiTimer = state.enemy.aiCD;
    const options = Object.entries(CONFIG.units).filter(([,u]) => u.tier <= state.enemy.tier);
    const weights = options.map(([k]) => ({
      key:k,
      w: ({sprinter:4, bruiser:3, ranger:2.6, charger:2.2, lobber:1.6, support:1.8, titan:0.9})[k] * (1 + t/150)
    }));
    let roll = Math.random() * weights.reduce((a,b)=>a+b.w,0);
    for (const item of weights) { roll -= item.w; if (roll<=0) { spawnUnit(item.key, 'enemy'); break; } }
  }
}

function updateUnits(dt) {
  const turretLvl = state.player.upgrades.turret || 0;
  for (const u of state.units) {
    if (u.hp <= 0) continue;
    const spec = CONFIG.units[u.key];
    u.cooldown -= dt;
    if (u.dashCD) u.dashCD -= dt;
    const [target,dist] = closestEnemy(u);

    if (u.team === 'player' && u.key === 'support' && u.cooldown <= 0) {
      const ally = state.units.find(a => a.team==='player' && a!==u && a.hp>0 && Math.abs(a.x-u.x) < spec.range);
      if (ally) {
        ally.hp = Math.min(ally.maxHp, ally.hp + spec.heal);
        createParticle(ally.x, ally.y-18, CONFIG.colors.heal, 0, -20, 0.45, 3);
        u.cooldown = 1 / u.atkRate;
        continue;
      }
    }

    if (target && dist <= u.range + target.size) {
      if (u.cooldown <= 0) {
        if (spec.arc || spec.range > 60) {
          state.projectiles.push({
            x:u.x + u.dir*16, y:u.y-14, tx:target.x, ty:target.y-12, dmg:u.dmg,
            team:u.team, speed: spec.arc ? 190 : 270, life: 1.2, arc: !!spec.arc
          });
        } else {
          dealDamage(target, u.dmg);
        }
        if (u.key === 'charger' && u.dashCD <= 0) { u.x += u.dir * 34; u.dashCD = 4.2; }
        u.cooldown = 1 / u.atkRate;
      }
    } else {
      const frontBias = u.key === 'support' ? 0.4 : 1;
      u.x += u.dir * u.speed * dt * frontBias;
    }

    const enemyBaseX = u.team === 'player' ? CONFIG.field.width - CONFIG.field.lanePad - 35 : CONFIG.field.lanePad + 35;
    if (Math.abs(u.x - enemyBaseX) < 30 && u.cooldown <= 0) {
      if (u.team === 'player') state.enemy.baseHp -= u.dmg;
      else state.player.baseHp -= u.dmg;
      createParticle(enemyBaseX, CONFIG.field.groundY-95, '#fff08a', rand(-15,15), -20, 0.5, 4);
      u.cooldown = 1/u.atkRate;
    }
  }

  if (turretLvl > 0) {
    baseTurretFire('player', dt, turretLvl);
  }
  baseTurretFire('enemy', dt, Math.min(3, 1 + Math.floor(state.time / 65)));
  state.units = state.units.filter(u => u.hp > 0 && u.x > -40 && u.x < CONFIG.field.width + 40);
}

let baseTurretTimerP = 0, baseTurretTimerE = 0;
function baseTurretFire(team, dt, level) {
  const timerKey = team === 'player' ? 'p' : 'e';
  if (timerKey === 'p') baseTurretTimerP -= dt; else baseTurretTimerE -= dt;
  const cooldown = 1.35 / level;
  const originX = team === 'player' ? CONFIG.field.lanePad + 34 : CONFIG.field.width - CONFIG.field.lanePad - 34;
  const target = state.units.find(u => u.team !== team && Math.abs(u.x-originX) < CONFIG.base.attackRange + level*20);
  if (target && (timerKey==='p' ? baseTurretTimerP : baseTurretTimerE) <= 0) {
    state.projectiles.push({ x:originX, y:CONFIG.field.groundY-100, tx:target.x, ty:target.y-10, dmg:CONFIG.base.attackDamage*level, team, speed:320, life:1, arc:false });
    if (timerKey === 'p') baseTurretTimerP = cooldown; else baseTurretTimerE = cooldown;
  }
}

function updateProjectiles(dt) {
  for (const p of state.projectiles) {
    p.life -= dt;
    const dx = p.tx - p.x, dy = p.ty - p.y;
    const d = Math.hypot(dx,dy) || 1;
    p.x += dx / d * p.speed * dt;
    p.y += dy / d * p.speed * dt + (p.arc ? Math.sin((1 - p.life)*5) * -18 * dt : 0);
    const hit = state.units.find(u => u.team !== p.team && Math.hypot(u.x-p.x, (u.y-12)-p.y) < u.size*0.6);
    if (hit) {
      dealDamage(hit, p.dmg);
      p.life = -1;
      for(let i=0;i<6;i++) createParticle(p.x,p.y,CONFIG.colors.projectile,rand(-35,35),rand(-30,10),0.35,2);
    }
  }
  state.projectiles = state.projectiles.filter(p => p.life > 0);
}

function updateParticles(dt) {
  for (const p of state.particles) {
    p.life -= dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += 40 * dt;
  }
  state.particles = state.particles.filter(p => p.life > 0);
}

function update(dt) {
  if (!state.running) return;
  state.time += dt;
  state.player.energy = Math.min(state.player.maxEnergy, state.player.energy + state.player.genPerSec * dt);
  enemyAI(dt);
  updateUnits(dt);
  updateProjectiles(dt);
  updateParticles(dt);

  if (state.player.baseHp <= 0 || state.enemy.baseHp <= 0) {
    state.running = false;
    showResult(state.enemy.baseHp <= 0);
  }
}

function drawUnit(u) {
  const c = u.team === 'player' ? CONFIG.colors.player : CONFIG.colors.enemy;
  ctx.save();
  ctx.translate(u.x, u.y);
  ctx.fillStyle = c;
  const s = u.size;
  switch (CONFIG.units[u.key].shape) {
    case 'triangle': ctx.beginPath(); ctx.moveTo(-s*0.7,s*0.7); ctx.lineTo(s*0.8,0); ctx.lineTo(-s*0.7,-s*0.7); ctx.fill(); break;
    case 'square': ctx.fillRect(-s*0.7,-s*0.7,s*1.4,s*1.4); break;
    case 'diamond': ctx.rotate(Math.PI/4); ctx.fillRect(-s*0.6,-s*0.6,s*1.2,s*1.2); break;
    case 'bolt': ctx.beginPath(); ctx.moveTo(-s*0.4,-s*0.8); ctx.lineTo(0,-s*0.1); ctx.lineTo(-s*0.1,-s*0.1); ctx.lineTo(s*0.5,s*0.8); ctx.lineTo(0,0.15*s); ctx.lineTo(s*0.1,0.15*s); ctx.fill(); break;
    case 'circle': ctx.beginPath(); ctx.arc(0,0,s*0.75,0,Math.PI*2); ctx.fill(); break;
    case 'plus': ctx.fillRect(-s*0.2,-s*0.75,s*0.4,s*1.5); ctx.fillRect(-s*0.75,-s*0.2,s*1.5,s*0.4); break;
    case 'hex':
      ctx.beginPath();
      for (let i=0;i<6;i++) { const a=i*Math.PI/3; const px=Math.cos(a)*s*0.9, py=Math.sin(a)*s*0.9; if(i===0)ctx.moveTo(px,py); else ctx.lineTo(px,py); }
      ctx.closePath(); ctx.fill(); break;
  }
  ctx.restore();
  drawBar(u.x - 20, u.y - 30, 40, 5, u.hp / u.maxHp, '#4f1020', '#8dffb2');
}

function drawBar(x,y,w,h,p,bg,fg) {
  ctx.fillStyle = bg; ctx.fillRect(x,y,w,h);
  ctx.fillStyle = fg; ctx.fillRect(x,y,w*clamp(p,0,1),h);
}

function render() {
  const { width, height, groundY, lanePad } = CONFIG.field;
  ctx.clearRect(0,0,width,height);
  const sky = ctx.createLinearGradient(0,0,0,groundY);
  sky.addColorStop(0,'#7ad8ff'); sky.addColorStop(1,'#e8fbff');
  ctx.fillStyle = sky; ctx.fillRect(0,0,width,groundY);
  ctx.fillStyle = CONFIG.colors.bgGround; ctx.fillRect(0,groundY,width,height-groundY);

  // bases
  drawBase(lanePad, 'player', state.player.baseHp, state.player.baseMaxHp);
  drawBase(width-lanePad, 'enemy', state.enemy.baseHp, state.enemy.baseMaxHp);

  // lane marks
  ctx.strokeStyle = '#ffffff36'; ctx.setLineDash([10,10]);
  ctx.beginPath(); ctx.moveTo(0,groundY-6); ctx.lineTo(width,groundY-6); ctx.stroke(); ctx.setLineDash([]);

  state.units.forEach(drawUnit);
  state.projectiles.forEach(p => {
    ctx.fillStyle = CONFIG.colors.projectile; ctx.beginPath(); ctx.arc(p.x,p.y,4,0,Math.PI*2); ctx.fill();
  });
  state.particles.forEach(p => {
    ctx.globalAlpha = p.life / p.max;
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x,p.y,p.size,p.size);
    ctx.globalAlpha = 1;
  });
}

function drawBase(x, team, hp, maxHp) {
  const isPlayer = team === 'player';
  const w = CONFIG.base.width;
  const y = CONFIG.field.groundY - 120;
  ctx.fillStyle = isPlayer ? '#2e4d93' : '#933251';
  ctx.fillRect(x - w/2, y, w, 120);
  ctx.fillStyle = isPlayer ? '#4b74da' : '#d5557a';
  ctx.fillRect(x - w/2 + 12, y + 20, w-24, 24);
  drawBar(x - 44, y - 12, 88, 7, hp / maxHp, '#40222a', '#81ffbe');
}

function formatTime(s) {
  const m = Math.floor(s / 60); const sec = Math.floor(s % 60).toString().padStart(2,'0');
  return `${m}:${sec}`;
}

function refreshUI() {
  ui.energyText.textContent = `${Math.floor(state.player.energy)} / ${state.player.maxEnergy}`;
  ui.playerBaseText.textContent = `${Math.max(0, Math.floor(state.player.baseHp))}`;
  ui.enemyBaseText.textContent = `${Math.max(0, Math.floor(state.enemy.baseHp))}`;
  ui.timeText.textContent = formatTime(state.time);

  for (const btn of ui.unitButtons.querySelectorAll('button')) {
    const key = btn.dataset.key; const u = CONFIG.units[key];
    const can = state.player.energy >= u.cost && u.tier <= state.player.tier && state.running;
    btn.disabled = !can;
    btn.classList.toggle('ready', can);
  }
  for (const btn of ui.upgradeButtons.querySelectorAll('button')) {
    const key = btn.dataset.key;
    const up = CONFIG.upgrades[key]; const lvl = state.player.upgrades[key] || 0; const cost = upgradeCost(key);
    const affordable = state.player.energy >= cost;
    const hidden = (key === 'tier3' && state.player.tier < 2);
    btn.style.display = hidden ? 'none' : '';
    btn.disabled = lvl >= up.max || !affordable || !state.running;
    btn.querySelector('.meta').textContent = lvl >= up.max ? 'MAX' : `Lv ${lvl}/${up.max} • ${cost}⚡`;
  }
}

function buildButtons() {
  ui.unitButtons.innerHTML = '';
  for (const [key,u] of Object.entries(CONFIG.units)) {
    const b = document.createElement('button');
    b.className = 'action-btn'; b.dataset.key = key;
    b.innerHTML = `<div class="row"><span class="name">${u.name}</span><span>${u.cost}⚡</span></div><div class="meta">Tier ${u.tier} • ${u.role}</div>`;
    b.addEventListener('click', ()=>tryBuyUnit(key));
    ui.unitButtons.appendChild(b);
  }

  ui.upgradeButtons.innerHTML = '';
  for (const [key,up] of Object.entries(CONFIG.upgrades)) {
    const b = document.createElement('button');
    b.className = 'action-btn'; b.dataset.key = key;
    b.innerHTML = `<div class="row"><span class="name">${up.name}</span><span>Upgrade</span></div><div class="meta">Lv 0/${up.max}</div>`;
    b.addEventListener('click', ()=>buyUpgrade(key));
    ui.upgradeButtons.appendChild(b);
  }
}

function showResult(win) {
  ui.resultOverlay.classList.remove('hidden');
  ui.resultTitle.textContent = win ? 'Victory!' : 'Defeat';
  ui.resultMsg.textContent = win ? 'Enemy core collapsed. Your faction dominates the frontier.' : 'Your core was destroyed. Rebuild and strike again.';
}

function frame(ts) {
  if (!state.lastTs) state.lastTs = ts;
  const dt = Math.min((ts - state.lastTs) / 1000, 0.033);
  state.lastTs = ts;
  update(dt);
  render();
  refreshUI();
  requestAnimationFrame(frame);
}

buildButtons();
resetGame();
render();
refreshUI();
ui.titleOverlay.classList.remove('hidden');

document.getElementById('startBtn').addEventListener('click', ()=>{ resetGame(); ui.titleOverlay.classList.add('hidden'); });
document.getElementById('restartBtn').addEventListener('click', ()=>resetGame());
requestAnimationFrame(frame);
