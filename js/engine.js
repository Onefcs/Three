// Game Engine: canvas rendering, sprite animation, parallax, combat

const Engine = (() => {
  let canvas, ctx;
  let animId = null;
  let lastTime = 0;
  let scrollOffset = 0;
  let runTime = 0;
  const PLAYER_SCALE = 1.73;
  const GROUND_Y_RATIO = 0.72;
  const PLAYER_X_RATIO = 0.22;

  // Sprite image cache
  const imgCache = {};
  function loadImg(src) {
    if (imgCache[src]) return imgCache[src];
    const img = new Image();
    img.src = src;
    imgCache[src] = img;
    return img;
  }

  // Preload all character sprites
  function preloadCharSprites(charId) {
    const sd = SPRITE_DATA[charId];
    if (!sd) return;
    for (const anim of ['idle', 'run', 'attack']) {
      loadImg(`Character/${charId}/${sd.files[anim]}`);
    }
  }

  // Animation state
  const anim = {
    player: { anim: 'run', frame: 0, timer: 0, fps: 10 }
  };
  // Separate one-shot attack animation
  const atkAnim = { active: false, frame: 0, timer: 0, fps: 7, fired: false };
  // Projectiles (arrow / tornado)
  const projectiles = [];

  // Game state (set from outside)
  let gs = null;

  // Parallax themes
  const THEMES = {
    forest: {
      skyGrad: ['#1a2a14', '#2d5020', '#4a8040'],
      ground: '#2a5a1a',
      groundTop: '#3a8a2a',
      drawLayer1: (ctx, w, h) => {
        const g = ctx.createLinearGradient(0, 0, 0, h * GROUND_Y_RATIO);
        g.addColorStop(0, '#0a1a08'); g.addColorStop(0.6, '#1a3a10'); g.addColorStop(1, '#2a5a18');
        ctx.fillStyle = g; ctx.fillRect(0, 0, w, h * GROUND_Y_RATIO);
      },
      drawLayer2: (ctx, w, h, off) => {
        ctx.fillStyle = '#1a3a10';
        for (let i = -1; i < 5; i++) {
          const x = ((i * 220 - off * 0.08) % (w + 250)) - 50;
          const ph = 90 + (i % 3) * 35;
          ctx.beginPath(); ctx.moveTo(x, h * GROUND_Y_RATIO);
          ctx.lineTo(x + 110, h * GROUND_Y_RATIO - ph);
          ctx.lineTo(x + 220, h * GROUND_Y_RATIO); ctx.fill();
        }
      },
      drawLayer3: (ctx, w, h, off) => {
        for (let i = -1; i < 7; i++) {
          const x = ((i * 150 - off * 0.3) % (w + 180)) - 60;
          const th = 55 + (i % 4) * 18;
          ctx.fillStyle = '#4a2a14';
          ctx.fillRect(x + 28, h * GROUND_Y_RATIO - th, 14, th);
          ctx.fillStyle = '#1b4020';
          ctx.beginPath(); ctx.arc(x + 35, h * GROUND_Y_RATIO - th - 30, 38, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = '#255030';
          ctx.beginPath(); ctx.arc(x + 35, h * GROUND_Y_RATIO - th - 48, 26, 0, Math.PI * 2); ctx.fill();
        }
      },
      drawLayer4: (ctx, w, h, off) => {
        ctx.fillStyle = '#0d2010';
        for (let i = -1; i < 14; i++) {
          const x = ((i * 80 - off * 0.7) % (w + 100)) - 30;
          ctx.beginPath(); ctx.arc(x + 20, h * GROUND_Y_RATIO, 20, Math.PI, 0); ctx.fill();
          ctx.beginPath(); ctx.arc(x + 42, h * GROUND_Y_RATIO, 15, Math.PI, 0); ctx.fill();
        }
      }
    },
    cave: {
      ground: '#2a1a3a', groundTop: '#3a2a5a',
      drawLayer1: (ctx, w, h) => {
        const g = ctx.createLinearGradient(0, 0, 0, h);
        g.addColorStop(0, '#05020a'); g.addColorStop(1, '#150830');
        ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
      },
      drawLayer2: (ctx, w, h, off) => {
        ctx.fillStyle = '#0f0520';
        for (let i = -1; i < 8; i++) {
          const x = ((i * 130 - off * 0.05) % (w + 150)) - 40;
          const sh = 40 + (i % 4) * 25;
          ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + 40, sh); ctx.lineTo(x + 80, 0); ctx.fill();
          ctx.fillStyle = '#150830'; ctx.fillRect(x, 0, 80, sh * 0.3);
        }
      },
      drawLayer3: (ctx, w, h, off) => {
        ctx.fillStyle = '#200a40';
        for (let i = -1; i < 10; i++) {
          const x = ((i * 100 - off * 0.25) % (w + 120)) - 30;
          const sh = 55 + (i % 3) * 30;
          ctx.beginPath(); ctx.moveTo(x + 10, 0); ctx.lineTo(x + 30, sh); ctx.lineTo(x + 50, 0); ctx.fill();
        }
        // gems
        const gemColors = ['#ff4080', '#4080ff', '#40ff80'];
        for (let i = -1; i < 12; i++) {
          const x = ((i * 85 - off * 0.3) % (w + 100)) - 20;
          const y = 20 + (i % 5) * 18;
          ctx.fillStyle = gemColors[i % 3] + '88';
          ctx.beginPath(); ctx.arc(x + 15, y, 5, 0, Math.PI * 2); ctx.fill();
        }
      },
      drawLayer4: (ctx, w, h, off) => {
        ctx.fillStyle = '#100520';
        for (let i = -1; i < 16; i++) {
          const x = ((i * 60 - off * 0.6) % (w + 80)) - 20;
          ctx.beginPath();
          ctx.moveTo(x + 5, h * GROUND_Y_RATIO);
          ctx.lineTo(x + 15, h * GROUND_Y_RATIO - 22);
          ctx.lineTo(x + 25, h * GROUND_Y_RATIO); ctx.fill();
        }
      }
    },
    ice: {
      ground: '#c8e8f8', groundTop: '#e8f8ff',
      drawLayer1: (ctx, w, h) => {
        const g = ctx.createLinearGradient(0, 0, 0, h);
        g.addColorStop(0, '#0a1830'); g.addColorStop(0.5, '#1a3860'); g.addColorStop(1, '#2a5880');
        ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
      },
      drawLayer2: (ctx, w, h, off) => {
        ctx.fillStyle = '#1a3860aa';
        for (let i = -1; i < 5; i++) {
          const x = ((i * 200 - off * 0.07) % (w + 230)) - 60;
          const ph = 100 + (i % 3) * 40;
          ctx.beginPath(); ctx.moveTo(x, h * GROUND_Y_RATIO);
          ctx.lineTo(x + 100, h * GROUND_Y_RATIO - ph);
          ctx.lineTo(x + 200, h * GROUND_Y_RATIO); ctx.fill();
          ctx.fillStyle = '#e8f8ffcc';
          ctx.fillRect(x + 85, h * GROUND_Y_RATIO - ph - 5, 30, 12);
        }
      },
      drawLayer3: (ctx, w, h, off) => {
        ctx.strokeStyle = '#88c8e8'; ctx.lineWidth = 2;
        for (let i = -1; i < 10; i++) {
          const x = ((i * 90 - off * 0.25) % (w + 110)) - 20;
          const hy = 50 + (i % 4) * 25;
          ctx.beginPath(); ctx.moveTo(x + 20, h * GROUND_Y_RATIO);
          ctx.lineTo(x + 20, h * GROUND_Y_RATIO - hy);
          ctx.lineTo(x, h * GROUND_Y_RATIO - hy + 15);
          ctx.moveTo(x + 20, h * GROUND_Y_RATIO - hy);
          ctx.lineTo(x + 40, h * GROUND_Y_RATIO - hy + 15); ctx.stroke();
        }
      },
      drawLayer4: (ctx, w, h, off) => {
        ctx.fillStyle = '#88d8f8aa';
        for (let i = -1; i < 18; i++) {
          const x = ((i * 55 - off * 0.6) % (w + 70)) - 15;
          ctx.beginPath(); ctx.moveTo(x + 12, h * GROUND_Y_RATIO);
          ctx.lineTo(x + 18, h * GROUND_Y_RATIO - 18);
          ctx.lineTo(x + 24, h * GROUND_Y_RATIO); ctx.fill();
        }
      }
    },
    volcano: {
      ground: '#3a0a00', groundTop: '#6a1a00',
      drawLayer1: (ctx, w, h) => {
        const g = ctx.createLinearGradient(0, 0, 0, h);
        g.addColorStop(0, '#1a0000'); g.addColorStop(0.6, '#3a0800'); g.addColorStop(1, '#6a1000');
        ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
        // lava glow at bottom
        const lg = ctx.createLinearGradient(0, h * 0.6, 0, h);
        lg.addColorStop(0, 'transparent'); lg.addColorStop(1, '#ff400088');
        ctx.fillStyle = lg; ctx.fillRect(0, h * 0.6, w, h * 0.4);
      },
      drawLayer2: (ctx, w, h, off) => {
        ctx.fillStyle = '#2a0800';
        for (let i = -1; i < 4; i++) {
          const x = ((i * 280 - off * 0.06) % (w + 320)) - 80;
          ctx.beginPath(); ctx.moveTo(x, h * GROUND_Y_RATIO);
          ctx.lineTo(x + 140, h * GROUND_Y_RATIO - 150);
          ctx.lineTo(x + 280, h * GROUND_Y_RATIO); ctx.fill();
          // lava spout
          ctx.fillStyle = '#ff6020';
          ctx.beginPath(); ctx.arc(x + 140, h * GROUND_Y_RATIO - 155, 8, 0, Math.PI * 2); ctx.fill();
        }
      },
      drawLayer3: (ctx, w, h, off) => {
        // lava pools
        for (let i = -1; i < 10; i++) {
          const x = ((i * 110 - off * 0.28) % (w + 130)) - 30;
          ctx.fillStyle = '#8a2000';
          ctx.beginPath(); ctx.ellipse(x + 35, h * GROUND_Y_RATIO - 8, 35, 12, 0, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = '#ff6020aa';
          ctx.beginPath(); ctx.ellipse(x + 35, h * GROUND_Y_RATIO - 8, 20, 7, 0, 0, Math.PI * 2); ctx.fill();
        }
      },
      drawLayer4: (ctx, w, h, off) => {
        ctx.fillStyle = '#1a0500';
        for (let i = -1; i < 20; i++) {
          const x = ((i * 45 - off * 0.65) % (w + 60)) - 15;
          const rh = 12 + (i % 4) * 8;
          ctx.fillRect(x, h * GROUND_Y_RATIO - rh, 20, rh);
        }
      }
    },
    ruins: {
      ground: '#2a1a30', groundTop: '#4a2a50',
      drawLayer1: (ctx, w, h) => {
        const g = ctx.createLinearGradient(0, 0, 0, h);
        g.addColorStop(0, '#0a0515'); g.addColorStop(0.5, '#15082a'); g.addColorStop(1, '#200a35');
        ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
        // stars
        ctx.fillStyle = '#ffffff';
        for (let i = 0; i < 40; i++) {
          const sx = (i * 137.5) % w, sy = (i * 97.3) % (h * 0.5);
          ctx.beginPath(); ctx.arc(sx, sy, 1, 0, Math.PI * 2); ctx.fill();
        }
      },
      drawLayer2: (ctx, w, h, off) => {
        ctx.fillStyle = '#180830';
        for (let i = -1; i < 4; i++) {
          const x = ((i * 260 - off * 0.06) % (w + 300)) - 70;
          const bh = 120 + (i % 3) * 40;
          ctx.fillRect(x, h * GROUND_Y_RATIO - bh, 80, bh);
          ctx.fillRect(x + 90, h * GROUND_Y_RATIO - bh * 0.7, 60, bh * 0.7);
          // arch
          ctx.beginPath(); ctx.arc(x + 40, h * GROUND_Y_RATIO - bh + 40, 25, Math.PI, 0); ctx.fill();
        }
      },
      drawLayer3: (ctx, w, h, off) => {
        ctx.fillStyle = '#2a1040';
        for (let i = -1; i < 10; i++) {
          const x = ((i * 95 - off * 0.28) % (w + 110)) - 25;
          const ph = 60 + (i % 3) * 30;
          ctx.fillRect(x + 10, h * GROUND_Y_RATIO - ph, 18, ph);
          ctx.fillRect(x + 5, h * GROUND_Y_RATIO - ph - 8, 28, 10);
        }
      },
      drawLayer4: (ctx, w, h, off) => {
        ctx.fillStyle = '#180828';
        for (let i = -1; i < 22; i++) {
          const x = ((i * 42 - off * 0.62) % (w + 55)) - 12;
          ctx.beginPath(); ctx.arc(x + 12, h * GROUND_Y_RATIO, 12 + (i % 3) * 5, Math.PI, 0); ctx.fill();
        }
      }
    }
  };

  function drawGround(ctx, w, h, theme) {
    const th = THEMES[theme] || THEMES.forest;
    const gy = h * GROUND_Y_RATIO;
    ctx.fillStyle = th.ground;
    ctx.fillRect(0, gy, w, h - gy);
    ctx.fillStyle = th.groundTop;
    ctx.fillRect(0, gy, w, 6);
  }

  function drawBackground(ctx, w, h, theme, off) {
    const th = THEMES[theme] || THEMES.forest;
    th.drawLayer1(ctx, w, h, off);
    th.drawLayer2(ctx, w, h, off);
    th.drawLayer3(ctx, w, h, off);
    drawGround(ctx, w, h, theme);
    th.drawLayer4(ctx, w, h, off);
  }

  // Draw monster procedurally with run animation
  function drawMonster(ctx, mData, x, y, scale = 1, running = false, t = 0) {
    const s = mData.size * scale;
    // Running bob: body moves up/down, legs alternate
    const speed = 8;
    const bob   = running ? Math.sin(t * speed) * s * 0.05 : 0;
    const legA  = running ? Math.sin(t * speed) * 0.5 : 0;       // leg swing angle
    const armA  = running ? Math.sin(t * speed + Math.PI) * 0.4 : 0;

    ctx.save();
    // Monsters always face left (toward player), so flip horizontally
    ctx.translate(x, 0);
    ctx.scale(-1, 1);
    ctx.translate(-x, 0);

    const cy = y + bob; // vertical bob

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath(); ctx.ellipse(x, y + 4, s * 0.5, s * 0.12, 0, 0, Math.PI * 2); ctx.fill();

    // Body
    ctx.fillStyle = mData.color;
    ctx.beginPath(); ctx.ellipse(x, cy - s * 0.45, s * 0.32, s * 0.42, 0, 0, Math.PI * 2); ctx.fill();

    // Head (slight tilt when running)
    ctx.fillStyle = mData.accent;
    ctx.beginPath(); ctx.arc(x, cy - s * 0.88, s * 0.24, 0, Math.PI * 2); ctx.fill();

    // Eyes
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(x - s * 0.08, cy - s * 0.9, s * 0.065, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(x + s * 0.08, cy - s * 0.9, s * 0.065, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ff2020';
    ctx.beginPath(); ctx.arc(x - s * 0.08, cy - s * 0.9, s * 0.035, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(x + s * 0.08, cy - s * 0.9, s * 0.035, 0, Math.PI * 2); ctx.fill();

    // Arms (swing when running)
    ctx.strokeStyle = mData.color; ctx.lineWidth = s * 0.09; ctx.lineCap = 'round';
    const armSwing = s * 0.25 * (running ? Math.sin(t * speed + Math.PI) : 1);
    ctx.beginPath();
    ctx.moveTo(x - s * 0.3, cy - s * 0.55);
    ctx.lineTo(x - s * 0.52, cy - s * 0.55 + armSwing); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x + s * 0.3, cy - s * 0.55);
    ctx.lineTo(x + s * 0.52, cy - s * 0.55 - armSwing); ctx.stroke();

    // Legs (alternate when running)
    const legFwd = s * 0.22 * Math.sin(t * speed);
    ctx.beginPath();
    ctx.moveTo(x - s * 0.13, cy - s * 0.08);
    ctx.lineTo(x - s * 0.13 - legFwd, y + s * 0.02); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x + s * 0.13, cy - s * 0.08);
    ctx.lineTo(x + s * 0.13 + legFwd, y + s * 0.02); ctx.stroke();

    ctx.restore();
  }

  // Draw player sprite
  function drawPlayer(ctx, charId, animName, frame, x, y, scale) {
    const sd = SPRITE_DATA[charId];
    if (!sd) return;
    const file = sd.files[animName] || sd.files.idle;
    const img = loadImg(`Character/${charId}/${file}`);
    if (!img.complete) return;
    const fw = sd.frameWidth, fh = sd.frameHeight;
    const totalFrames = sd.frames[animName] || sd.frames.idle;
    const f = Math.floor(frame) % totalFrames;
    const dw = fw * scale, dh = fh * scale;
    // Sprites have ~8% empty padding at bottom — shift down to plant feet on ground
    const footFix = fh * 0.08 * scale;
    ctx.drawImage(img, f * fw, 0, fw, fh, x - dw / 2, y - dh + footFix, dw, dh);
  }

  // HP bar above entity
  function drawHPBar(ctx, x, y, curHp, maxHp, w = 70) {
    const pct = Math.max(0, curHp / maxHp);
    const bx = x - w / 2, by = y - 12;
    ctx.fillStyle = '#333'; ctx.fillRect(bx, by, w, 7);
    const col = pct > 0.5 ? '#2ecc71' : pct > 0.25 ? '#f39c12' : '#e74c3c';
    ctx.fillStyle = col; ctx.fillRect(bx, by, w * pct, 7);
    ctx.strokeStyle = '#666'; ctx.lineWidth = 1; ctx.strokeRect(bx, by, w, 7);
  }

  // Damage numbers
  const dmgNumbers = [];
  function spawnDmgNumber(x, y, value, isCrit) {
    dmgNumbers.push({ x, y: y - 20, value, isCrit, life: 1.0 });
  }
  function updateDmgNumbers(dt) {
    for (let i = dmgNumbers.length - 1; i >= 0; i--) {
      dmgNumbers[i].y -= 40 * dt;
      dmgNumbers[i].life -= dt * 1.2;
      if (dmgNumbers[i].life <= 0) dmgNumbers.splice(i, 1);
    }
  }
  function drawDmgNumbers(ctx) {
    for (const dn of dmgNumbers) {
      ctx.globalAlpha = dn.life;
      ctx.font = dn.isCrit ? `bold ${dn.isCrit ? 20 : 14}px Arial` : '14px Arial';
      ctx.fillStyle = dn.isCrit ? '#ffcc00' : '#ff6060';
      ctx.strokeStyle = '#000'; ctx.lineWidth = 3;
      ctx.strokeText(dn.value, dn.x - 12, dn.y);
      ctx.fillText(dn.value, dn.x - 12, dn.y);
      ctx.globalAlpha = 1;
    }
  }

  // Combat effects
  const effects = [];
  function spawnEffect(type, x, y) {
    effects.push({ type, x, y, life: 1.0 });
  }
  function updateEffects(dt) {
    for (let i = effects.length - 1; i >= 0; i--) {
      effects[i].life -= dt * 2;
      if (effects[i].life <= 0) effects.splice(i, 1);
    }
  }
  function drawEffects(ctx) {
    for (const ef of effects) {
      ctx.globalAlpha = ef.life;
      if (ef.type === 'hit') {
        ctx.fillStyle = '#ff8800';
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI * 2;
          const r = 18 * (1 - ef.life);
          ctx.beginPath(); ctx.arc(ef.x + Math.cos(a)*r, ef.y + Math.sin(a)*r, 4, 0, Math.PI*2); ctx.fill();
        }
      } else if (ef.type === 'heal') {
        ctx.fillStyle = '#00ff88';
        ctx.font = 'bold 22px Arial';
        ctx.fillText('♥', ef.x - 8, ef.y - 20 * (1 - ef.life));
      }
      ctx.globalAlpha = 1;
    }
  }

  // ── PROJECTILES ──────────────────────────────────────────────
  function spawnProjectile(charId, x, y, tx, ty, dmg, isCrit, onHit) {
    const isArcher = charId === 'archer';
    const dx = tx - x, dy = ty - y;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
    const speed = isArcher ? 600 : 320;
    projectiles.push({ type: isArcher ? 'arrow' : 'tornado',
      x, y, tx, ty, vx: dx / dist * speed, vy: dy / dist * speed,
      dmg, isCrit, onHit, rotation: 0 });
  }

  function updateProjectiles(dt) {
    for (let i = projectiles.length - 1; i >= 0; i--) {
      const p = projectiles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rotation += dt * 10;
      // Arrived when we overshoot the dot-product toward target
      const dx = p.tx - p.x, dy = p.ty - p.y;
      if (dx * p.vx + dy * p.vy <= 0) {
        p.onHit && p.onHit(p.dmg, p.isCrit);
        projectiles.splice(i, 1);
      }
    }
  }

  function drawArrow(ctx, x, y, vx, vy) {
    const angle = Math.atan2(vy, vx);
    ctx.save();
    ctx.translate(x, y); ctx.rotate(angle);
    // shaft
    ctx.strokeStyle = '#8b5e3c'; ctx.lineWidth = 3; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-16, 0); ctx.lineTo(8, 0); ctx.stroke();
    // head
    ctx.fillStyle = '#d0d0d0';
    ctx.beginPath(); ctx.moveTo(8, 0); ctx.lineTo(1, -4); ctx.lineTo(1, 4); ctx.closePath(); ctx.fill();
    // feathers
    ctx.fillStyle = '#ffffff99';
    ctx.beginPath(); ctx.moveTo(-16, 0); ctx.lineTo(-8, -6); ctx.lineTo(-5, 0); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(-16, 0); ctx.lineTo(-8,  6); ctx.lineTo(-5, 0); ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  function drawTornado(ctx, x, y, rot) {
    ctx.save(); ctx.translate(x, y);
    const rings = [
      { r: 18, w: 9,  col: '#4488ffcc' },
      { r: 12, w: 7,  col: '#88bbffcc' },
      { r:  6, w: 5,  col: '#ccddffee' }
    ];
    for (let i = 0; i < rings.length; i++) {
      const rg = rings[i];
      ctx.save(); ctx.rotate(rot + i * 1.3); ctx.scale(1, 0.4);
      ctx.beginPath(); ctx.arc(0, 0, rg.r, 0, Math.PI * 2);
      ctx.strokeStyle = rg.col; ctx.lineWidth = rg.w; ctx.stroke();
      ctx.restore();
    }
    // core
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 9);
    g.addColorStop(0, '#ffffffee'); g.addColorStop(1, '#4488ff00');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(0, 0, 9, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  function drawProjectiles(ctx) {
    for (const p of projectiles) {
      if (p.type === 'arrow') drawArrow(ctx, p.x, p.y, p.vx, p.vy);
      else drawTornado(ctx, p.x, p.y, p.rotation);
    }
  }

  // Deal hit: called on penultimate attack frame
  function doAttackHit(gs, stats, charId, playerX, groundY) {
    if (!gs.monster || gs.phase !== 'combat') return;
    const char = CHARACTERS[charId];
    const sd   = SPRITE_DATA[charId];
    const monX = gs.monsterX;

    const isCrit = Math.random() < (stats.crit + (gs.buffState?.crit_bonus || 0));
    let dmg = stats.atk * (isCrit ? stats.critDmg : 1);
    dmg = Math.max(1, dmg - gs.monster.def * 0.5);
    if (gs.buffState?.evade) dmg = 0;
    dmg = Math.round(dmg * (0.85 + Math.random() * 0.3));

    const applyDmg = (damage, crit) => {
      if (!gs.monster) return;
      gs.monsterHp = Math.max(0, gs.monsterHp - damage);
      spawnDmgNumber(monX + (Math.random() - 0.5) * 30,
        groundY - gs.monster.size * 0.8, damage, crit);
      spawnEffect('hit', monX, groundY - gs.monster.size * 0.5);
      const vamp = stats.vamp + (gs.buffState?.vamp_bonus || 0);
      if (vamp > 0) {
        const heal = Math.round(damage * vamp);
        gs.currentHp = Math.min(stats.maxHp, (gs.currentHp || stats.maxHp) + heal);
        spawnEffect('heal', playerX, groundY - 80);
      }
    };

    if (char && char.type === 'ranged') {
      const py = groundY - (sd?.frameHeight || 64) * PLAYER_SCALE * 0.6;
      const my = groundY - gs.monster.size * 0.55;
      spawnProjectile(charId, playerX + 20, py, monX, my, dmg, isCrit, applyDmg);
    } else {
      applyDmg(dmg, isCrit);
    }
  }

  // Main loop
  function loop(ts) {
    animId = requestAnimationFrame(loop);
    const dt = Math.min((ts - lastTime) / 1000, 0.05);
    lastTime = ts;
    if (!gs || !canvas) return;

    const w = canvas.width, h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    const dungeon = DUNGEONS.find(d => d.id === gs.currentDungeon);
    const theme = dungeon ? dungeon.theme : 'forest';

    runTime += dt;

    // Update scroll
    if (gs.phase === 'running') {
      scrollOffset += 180 * dt;
    }

    drawBackground(ctx, w, h, theme, scrollOffset);

    const groundY = h * GROUND_Y_RATIO;
    const playerX = w * PLAYER_X_RATIO;
    const charId  = gs.selectedChar;
    const sd      = SPRITE_DATA[charId];

    // ── IDLE/RUN ANIMATION (loops) ──────────────────────────────
    if (!atkAnim.active) {
      anim.player.timer += dt;
      if (anim.player.timer >= 1 / anim.player.fps) {
        anim.player.timer = 0;
        const tot = sd ? (sd.frames[anim.player.anim] || 4) : 4;
        anim.player.frame = (anim.player.frame + 1) % tot;
      }
    }

    // ── ATTACK ANIMATION (one-shot, fires on penultimate frame) ─
    if (atkAnim.active) {
      atkAnim.timer += dt;
      if (atkAnim.timer >= 1 / atkAnim.fps) {
        atkAnim.timer -= 1 / atkAnim.fps;
        atkAnim.frame++;
        const tot = sd ? (sd.frames.attack || 6) : 6;
        if (atkAnim.frame >= tot - 1 && !atkAnim.fired) {
          atkAnim.fired = true;
          const stats = gs.computedStats;
          if (stats) doAttackHit(gs, stats, charId, playerX, groundY);
        }
        if (atkAnim.frame >= tot) {
          atkAnim.active = false;
          atkAnim.frame  = 0;
        }
      }
    }

    // ── PHASE LOGIC ──────────────────────────────────────────────
    if (gs.phase === 'running') {
      anim.player.anim = 'run';
      if (gs.monsterX === undefined) gs.monsterX = w * 1.1;

      gs.monsterX -= 130 * dt;

      if (gs.monster && gs.monsterX <= playerX + 160) {
        gs.phase = 'combat';
        gs.monsterX = w * 0.64;
        gs.combatTimer = 0;
        gs.attackCooldown = 0.5;
        gs.monsterAttackCooldown = 1.2;
        gs.monsterHp    = gs.monster.hp;
        gs.monsterMaxHp = gs.monster.hp;
        gs.buffState    = {};
        atkAnim.active  = false;
        atkAnim.frame   = 0;
        projectiles.length = 0;
      }

      if (gs.monster) {
        drawMonster(ctx, gs.monster, gs.monsterX, groundY, 1, true, runTime);
        drawHPBar(ctx, gs.monsterX, groundY - gs.monster.size - 10,
          gs.monsterHp || gs.monster.hp, gs.monster.hp);
      }

    } else if (gs.phase === 'combat') {
      anim.player.anim = atkAnim.active ? 'attack' : 'idle';
      gs.combatTimer = (gs.combatTimer || 0) + dt;

      const stats = gs.computedStats;
      const monX  = gs.monsterX;
      const monY  = groundY;

      // Player attack cooldown → start attack animation
      const atkInterval = Math.max(0.5, 2.8 - (stats.speed / 100) * 2.0);
      gs.attackCooldown = (gs.attackCooldown || 0) - dt;
      if (gs.attackCooldown <= 0 && !atkAnim.active && !(gs.buffState?.stun)) {
        gs.attackCooldown = atkInterval;
        atkAnim.active = true;
        atkAnim.frame  = 0;
        atkAnim.timer  = 0;
        atkAnim.fired  = false;
      }

      // Monster auto-attack
      gs.monsterAttackCooldown = (gs.monsterAttackCooldown || 0) - dt;
      if (gs.monsterAttackCooldown <= 0) {
        gs.monsterAttackCooldown = 1.6;
        if (!gs.buffState?.evade) {
          const monDmg = Math.max(1, gs.monster.atk - stats.def * 0.35 * (1 + (gs.buffState?.def_bonus || 0)));
          const dmg = Math.round(monDmg * (0.85 + Math.random() * 0.3));
          gs.currentHp = Math.max(0, (gs.currentHp || stats.maxHp) - dmg * (gs.buffState?.shield ? 0.5 : 1));
          spawnDmgNumber(playerX + (Math.random() - 0.5) * 30, groundY - 80, dmg, false);
          spawnEffect('hit', playerX, groundY - 60);
        }
      }

      // Buff timers
      for (const k of Object.keys(gs.buffState || {})) {
        if (typeof gs.buffState[k] === 'number') {
          gs.buffState[k] -= dt;
          if (gs.buffState[k] <= 0) delete gs.buffState[k];
        }
      }

      drawMonster(ctx, gs.monster, monX, monY, 1, false, runTime);
      drawHPBar(ctx, monX, monY - gs.monster.size - 10, gs.monsterHp, gs.monsterMaxHp);
      ctx.fillStyle = '#fff'; ctx.font = 'bold 12px Arial'; ctx.textAlign = 'center';
      ctx.fillText(gs.monster.name, monX, monY - gs.monster.size - 22);
      ctx.textAlign = 'left';

      if (gs.monsterHp <= 0 && gs.phase === 'combat') {
        gs.phase = 'killed';
        gs.killTimer = 0.6;
        atkAnim.active = false;
        projectiles.length = 0;
        gs.onKill && gs.onKill();
      } else if ((gs.currentHp || 1) <= 0 && gs.phase === 'combat') {
        gs.phase = 'defeat';
        gs.onDefeat && gs.onDefeat();
      }

    } else if (gs.phase === 'killed') {
      anim.player.anim = 'run';
      gs.killTimer = (gs.killTimer || 0) - dt;
      if (gs.killTimer <= 0) {
        gs.phase = 'running';
        gs.monsterX = undefined;
        gs.monster  = null;
        gs.onSpawnMonster && gs.onSpawnMonster();
      }
    } else {
      anim.player.anim = 'idle';
    }

    // ── DRAW PLAYER ──────────────────────────────────────────────
    const drawAnim  = atkAnim.active ? 'attack' : anim.player.anim;
    const drawFrame = atkAnim.active ? atkAnim.frame : anim.player.frame;
    drawPlayer(ctx, charId, drawAnim, drawFrame, playerX, groundY, PLAYER_SCALE);

    // Player HP bar
    const stats2 = gs.computedStats;
    if (stats2) {
      const sprH = (sd?.frameHeight || 64) * PLAYER_SCALE;
      drawHPBar(ctx, playerX, groundY - sprH + (sd?.frameHeight || 64) * 0.08 * PLAYER_SCALE - 14,
        gs.currentHp || stats2.maxHp, stats2.maxHp, 80);
    }

    updateProjectiles(dt);
    drawProjectiles(ctx);
    updateDmgNumbers(dt);
    drawDmgNumbers(ctx);
    updateEffects(dt);
    drawEffects(ctx);
  }

  function start(gameState) {
    gs = gameState;
    atkAnim.active = false; atkAnim.frame = 0; atkAnim.fired = false;
    projectiles.length = 0;
    if (!canvas) {
      canvas = document.getElementById('game-canvas');
      ctx = canvas.getContext('2d');
    }
    resizeCanvas();
    if (!animId) {
      lastTime = performance.now();
      animId = requestAnimationFrame(loop);
    }
  }

  function stop() {
    if (animId) { cancelAnimationFrame(animId); animId = null; }
  }

  function resizeCanvas() {
    if (!canvas) return;
    const parent = canvas.parentElement;
    canvas.width = parent.clientWidth;
    canvas.height = parent.clientHeight;
  }

  function useSkill(skillIdx) {
    if (!gs || gs.phase !== 'combat') return;
    const char = CHARACTERS[gs.selectedChar];
    if (!char) return;
    const skill = char.skills[skillIdx];
    if (!skill) return;
    const now = performance.now() / 1000;
    if ((gs.skillCooldowns[skillIdx] || 0) > now) return;
    gs.skillCooldowns[skillIdx] = now + skill.cd;

    const stats = gs.computedStats;
    const monX = gs.monsterX;
    const canvas2 = document.getElementById('game-canvas');
    const groundY = canvas2 ? canvas2.height * GROUND_Y_RATIO : 300;
    const playerX = canvas2 ? canvas2.width * PLAYER_X_RATIO : 100;

    if (!gs.buffState) gs.buffState = {};

    switch (skill.type) {
      case 'damage': {
        const isCrit = skill.name === 'Снайпер' || skill.name === 'Смерть';
        let dmg = Math.round(stats.atk * skill.damage * (isCrit ? stats.critDmg : 1) * (0.9 + Math.random() * 0.2));
        dmg = Math.max(1, dmg - gs.monster.def * 0.3);
        gs.monsterHp -= dmg;
        spawnDmgNumber(monX, groundY - gs.monster.size, dmg, isCrit);
        spawnEffect('hit', monX, groundY - gs.monster.size * 0.5);
        break;
      }
      case 'multi': {
        const hits = skill.name.includes('Залп') ? 5 : 2;
        for (let i = 0; i < hits; i++) {
          setTimeout(() => {
            const isCrit = Math.random() < stats.crit;
            let dmg = Math.round(stats.atk * skill.damage * (isCrit ? stats.critDmg : 1) * (0.85 + Math.random() * 0.3));
            dmg = Math.max(1, dmg - gs.monster.def * 0.3);
            if (gs.monsterHp > 0) {
              gs.monsterHp -= dmg;
              spawnDmgNumber(monX + (Math.random()-0.5)*40, groundY - gs.monster.size * 0.7, dmg, isCrit);
            }
          }, i * 150);
        }
        break;
      }
      case 'heal': {
        const healAmt = Math.round(stats.maxHp * 0.3);
        gs.currentHp = Math.min(stats.maxHp, gs.currentHp + healAmt);
        spawnEffect('heal', playerX, groundY - 100);
        spawnDmgNumber(playerX, groundY - 80, '+' + healAmt, false);
        break;
      }
      case 'lifesteal': {
        let dmg = Math.round(stats.atk * skill.damage * (0.9 + Math.random() * 0.2));
        dmg = Math.max(1, dmg - gs.monster.def * 0.3);
        gs.monsterHp -= dmg;
        const healAmt = Math.round(dmg * 0.5);
        gs.currentHp = Math.min(stats.maxHp, gs.currentHp + healAmt);
        spawnDmgNumber(monX, groundY - gs.monster.size, dmg, true);
        spawnEffect('heal', playerX, groundY - 100);
        break;
      }
      case 'shield':     gs.buffState.shield = 5; break;
      case 'buff_def':   gs.buffState.def_bonus = skill.name.includes('Желез') ? 0.8 : 0.5; gs.buffState.def_bonus_t = skill.cd * 0.5; break;
      case 'buff_atk':   gs.buffState.atk_bonus = 0.3; gs.buffState.atk_bonus_t = 5; break;
      case 'buff_crit':  gs.buffState.crit_bonus = 1.0; gs.buffState.crit_bonus_t = 3; break;
      case 'buff_vamp':  gs.buffState.vamp_bonus = 0.5; gs.buffState.vamp_bonus_t = 5; break;
      case 'evade':      gs.buffState.evade = skill.name.includes('100') ? 2 : 3; break;
      case 'slow':       gs.buffState.slow = 3; break;
      case 'stun':       gs.buffState.stun = 2; break;
      case 'dot': {
        gs.buffState.dot = 5;
        gs.buffState.dotDmg = stats.atk * skill.damage;
        break;
      }
    }

    // Refresh skills UI
    window.UI && UI.updateSkillsBar();
  }

  return { start, stop, resizeCanvas, preloadCharSprites, useSkill, getSkillCooldownRatio(idx) {
    if (!gs) return 0;
    const now = performance.now() / 1000;
    const char = CHARACTERS[gs.selectedChar];
    if (!char) return 0;
    const skill = char.skills[idx];
    if (!skill) return 0;
    const remaining = (gs.skillCooldowns[idx] || 0) - now;
    if (remaining <= 0) return 0;
    return remaining / skill.cd;
  }};
})();
