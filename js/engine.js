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
  const atkAnim = { active: false, frame: 0, timer: 0, fps: 14, fired: false };
  // Projectiles (arrow / tornado)
  const projectiles = [];

  // Game state (set from outside)
  let gs = null;

  // Parallax themes — pixel-art style with live animations
  const THEMES = {
    forest: {
      ground: '#142808', groundTop: '#245010',
      drawLayer1: (ctx, w, h, off, t) => {
        const gy = h * GROUND_Y_RATIO;
        const g = ctx.createLinearGradient(0, 0, 0, gy);
        g.addColorStop(0, '#030608'); g.addColorStop(0.6, '#06100e'); g.addColorStop(1, '#0a1c10');
        ctx.fillStyle = g; ctx.fillRect(0, 0, w, gy);
        // Pixel stars — deterministic, twinkling
        for (let i = 0; i < 60; i++) {
          const sx = (i * 137 + 11) % w, sy = (i * 89 + 7) % (gy * 0.68);
          const tw = Math.sin(t * 2 + i * 0.9) * 0.5 + 0.5;
          ctx.fillStyle = `rgba(200,225,170,${0.15 + tw * 0.75})`;
          ctx.fillRect(Math.floor(sx), Math.floor(sy), i % 5 === 0 ? 2 : 1, 1);
        }
        // Crescent moon (pixel circle with shadow bite)
        const mx = Math.floor(w * 0.78), my = Math.floor(gy * 0.14), mr = 14;
        ctx.fillStyle = '#d4e87a';
        for (let r = -mr; r <= mr; r++) for (let c = -mr; c <= mr; c++)
          if (r*r+c*c <= mr*mr) ctx.fillRect(mx+c, my+r, 1, 1);
        ctx.fillStyle = '#04080e';
        for (let r = -mr; r <= mr; r++) for (let c = -mr+5; c <= mr+5; c++)
          if (r*r+c*c <= mr*mr) ctx.fillRect(mx+c, my+r, 1, 1);
      },
      drawLayer2: (ctx, w, h, off, t) => {
        const gy = h * GROUND_Y_RATIO;
        ctx.fillStyle = '#091a0c';
        for (let i = -1; i < 5; i++) {
          const x = ((i * 240 - off * 0.04) % (w + 270)) - 70;
          const mh = 72 + (i * 41 % 52);
          ctx.beginPath(); ctx.moveTo(x, gy); ctx.lineTo(x + 120, gy - mh); ctx.lineTo(x + 240, gy); ctx.fill();
        }
        ctx.fillStyle = '#112016';
        for (let i = -1; i < 7; i++) {
          const x = ((i * 165 - off * 0.08) % (w + 190)) - 50;
          const mh = 46 + (i * 37 % 30);
          ctx.beginPath(); ctx.moveTo(x, gy); ctx.lineTo(x + 82, gy - mh); ctx.lineTo(x + 165, gy); ctx.fill();
        }
      },
      drawLayer3: (ctx, w, h, off, t) => {
        const gy = h * GROUND_Y_RATIO;
        for (let i = -1; i < 8; i++) {
          const x = Math.floor(((i * 148 - off * 0.28) % (w + 172)) - 46);
          const th2 = 60 + (i * 31 % 32), trunkH = Math.floor(th2 * 0.38);
          ctx.fillStyle = '#2d1a08';
          ctx.fillRect(x + 22, Math.floor(gy - trunkH), 12, trunkH);
          ctx.fillStyle = '#3d2410';
          ctx.fillRect(x + 22, Math.floor(gy - trunkH), 3, trunkH);
          const layers = [{w:54,h:18,yo:0.14},{w:42,h:16,yo:0.32},{w:30,h:14,yo:0.50},{w:18,h:12,yo:0.65}];
          const cols = ['#0e2a0a','#163a10','#1e4a15','#266020'];
          layers.forEach((cl, idx) => {
            ctx.fillStyle = cols[idx];
            ctx.fillRect(x + 28 - Math.floor(cl.w/2), Math.floor(gy - th2 + cl.yo * th2), Math.floor(cl.w), cl.h);
            ctx.fillStyle = '#2a5818';
            ctx.fillRect(x + 28 - Math.floor(cl.w/2), Math.floor(gy - th2 + cl.yo * th2), Math.floor(cl.w), 2);
          });
        }
      },
      drawLayer4: (ctx, w, h, off, t) => {
        const gy = h * GROUND_Y_RATIO;
        for (let i = -1; i < 15; i++) {
          const x = Math.floor(((i * 78 - off * 0.72) % (w + 94)) - 28);
          const bh = 12 + (i * 19 % 10);
          ctx.fillStyle = '#091508'; ctx.fillRect(x, Math.floor(gy - bh), 28, bh);
          ctx.fillStyle = '#102010'; ctx.fillRect(x + 4, Math.floor(gy - bh - 5), 18, 7);
          ctx.fillStyle = '#1a3510';
          ctx.fillRect(x, Math.floor(gy - 4), 4, 4);
          ctx.fillRect(x + 10, Math.floor(gy - 5), 3, 5);
          ctx.fillRect(x + 20, Math.floor(gy - 3), 4, 3);
        }
        // Fireflies — animated 2×2 glowing pixels
        for (let i = 0; i < 10; i++) {
          const fx = ((i * 177 + off * 0.18) % w);
          const fy = gy * (0.32 + (i * 83 % 48) / 100) + Math.sin(t * 2.2 + i * 1.8) * 18;
          const glow = Math.sin(t * 3.5 + i * 2.3);
          if (glow > 0) {
            ctx.fillStyle = `rgba(150,255,70,${glow * 0.85})`;
            ctx.fillRect(Math.floor(fx), Math.floor(fy), 2, 2);
            ctx.fillStyle = `rgba(150,255,70,${glow * 0.18})`;
            ctx.fillRect(Math.floor(fx) - 3, Math.floor(fy) - 3, 8, 8);
          }
        }
      }
    },

    cave: {
      ground: '#100818', groundTop: '#1e1030',
      drawLayer1: (ctx, w, h, off, t) => {
        const gy = h * GROUND_Y_RATIO;
        ctx.fillStyle = '#02010a'; ctx.fillRect(0, 0, w, h);
        const lg = ctx.createLinearGradient(0, gy * 0.55, 0, gy);
        lg.addColorStop(0, 'rgba(55,0,95,0)'); lg.addColorStop(1, 'rgba(75,15,125,0.2)');
        ctx.fillStyle = lg; ctx.fillRect(0, gy * 0.55, w, gy * 0.45);
        // Floating spores
        for (let i = 0; i < 14; i++) {
          const fx = ((i * 173 + off * 0.05) % w);
          const fy = (gy * 0.15 + (i * 79 % (gy * 60)) / 100 + t * (8 + i % 5)) % gy;
          const alpha = Math.sin(t * 2 + i * 1.7) * 0.4 + 0.5;
          ctx.fillStyle = `rgba(190,90,255,${alpha * 0.55})`; ctx.fillRect(Math.floor(fx), Math.floor(fy), 2, 2);
        }
      },
      drawLayer2: (ctx, w, h, off, t) => {
        const gy = h * GROUND_Y_RATIO;
        // Ceiling stalactites — pixel tapered spikes
        for (let i = -1; i < 8; i++) {
          const x = Math.floor(((i * 118 - off * 0.05) % (w + 142)) - 44);
          const sl = 52 + (i * 43 % 55), sw = 15 + (i * 11 % 14);
          ctx.fillStyle = '#07021a';
          for (let row = 0; row < sl; row++) {
            const rw = Math.max(2, Math.floor(sw * (1 - row / sl)));
            ctx.fillRect(x + Math.floor((sw - rw) / 2), row, rw, 1);
          }
          ctx.fillStyle = '#100330';
          ctx.fillRect(x + 1, 0, 3, sl);
          const drip = (t * 38 + i * 28) % 75;
          if (drip < sl + 18) {
            ctx.fillStyle = '#4a0890aa';
            ctx.fillRect(x + Math.floor(sw / 2) - 1, Math.floor(sl + drip * 0.3), 2, 3);
          }
        }
        // Floor stalagmites
        for (let i = -1; i < 10; i++) {
          const x = Math.floor(((i * 93 - off * 0.08) % (w + 112)) - 34);
          const sl = 22 + (i * 37 % 32), sw = 10 + (i * 9 % 10);
          ctx.fillStyle = '#0e0420';
          for (let row = 0; row < sl; row++) {
            const rw = Math.max(2, Math.floor(sw * (1 - row / sl)));
            ctx.fillRect(x + Math.floor((sw - rw) / 2), Math.floor(gy - sl + row), rw, 1);
          }
        }
      },
      drawLayer3: (ctx, w, h, off, t) => {
        const gy = h * GROUND_Y_RATIO;
        const cols = ['#ff1877','#1870ff','#18e898','#9018ff','#ff8800'];
        for (let i = -1; i < 13; i++) {
          const x = Math.floor(((i * 80 - off * 0.26) % (w + 98)) - 28);
          const col = cols[i % 5], ch = 18 + (i * 17 % 20);
          const pulse = Math.sin(t * 2.5 + i * 1.2) * 0.25 + 0.75;
          for (let row = 0; row < ch; row++) {
            const rw = Math.max(1, Math.floor(7 * (1 - row / ch)));
            ctx.fillStyle = row < ch * 0.28 ? '#ffffff' : col;
            ctx.globalAlpha = pulse;
            ctx.fillRect(x + Math.floor((7 - rw) / 2), Math.floor(gy - ch + row), rw, 1);
          }
          const sh = Math.floor(ch * 0.6);
          for (let row = 0; row < sh; row++) {
            const rw = Math.max(1, Math.floor(4 * (1 - row / sh)));
            ctx.fillStyle = col; ctx.globalAlpha = pulse * 0.65;
            ctx.fillRect(x - 5 + Math.floor((4 - rw) / 2), Math.floor(gy - sh + row), rw, 1);
            ctx.fillRect(x + 9 + Math.floor((4 - rw) / 2), Math.floor(gy - sh + row), rw, 1);
          }
          ctx.globalAlpha = pulse * 0.13; ctx.fillStyle = col;
          ctx.fillRect(x - 8, Math.floor(gy - ch - 5), 30, ch + 8);
          ctx.globalAlpha = 1;
        }
      },
      drawLayer4: (ctx, w, h, off, t) => {
        const gy = h * GROUND_Y_RATIO;
        for (let i = -1; i < 20; i++) {
          const x = Math.floor(((i * 48 - off * 0.68) % (w + 62)) - 18);
          const rh = 8 + (i * 15 % 14), rw = 18 + (i * 11 % 14);
          ctx.fillStyle = '#05010e'; ctx.fillRect(x, Math.floor(gy - rh), rw, rh);
          ctx.fillStyle = '#0b021e'; ctx.fillRect(x + 2, Math.floor(gy - rh), 3, rh);
        }
      }
    },

    ice: {
      ground: '#a0c8e0', groundTop: '#c8e8f8',
      drawLayer1: (ctx, w, h, off, t) => {
        const gy = h * GROUND_Y_RATIO;
        const g = ctx.createLinearGradient(0, 0, 0, gy);
        g.addColorStop(0, '#010408'); g.addColorStop(0.5, '#020810'); g.addColorStop(1, '#040f1c');
        ctx.fillStyle = g; ctx.fillRect(0, 0, w, gy);
        // Stars
        for (let i = 0; i < 65; i++) {
          const sx = (i * 151 + 5) % w, sy = (i * 97 + 3) % (gy * 0.58);
          const tw = Math.sin(t * 1.8 + i * 0.7) * 0.5 + 0.5;
          ctx.fillStyle = `rgba(175,210,255,${0.18 + tw * 0.72})`;
          ctx.fillRect(Math.floor(sx), Math.floor(sy), i % 6 === 0 ? 2 : 1, 1);
        }
        // Aurora borealis — wavy colour bands
        const auroras = [{y:0.07,col:[0,210,110],bw:30},{y:0.13,col:[0,155,255],bw:24},{y:0.19,col:[135,0,255],bw:18}];
        auroras.forEach((au, ai) => {
          for (let xi = 0; xi < w; xi += 2) {
            const wave = Math.sin(xi * 0.012 + t * 0.6 + ai * 2.1) * 22 + Math.sin(xi * 0.007 - t * 0.4 + ai) * 12;
            const aY = gy * au.y + wave;
            const alpha = (Math.sin(xi * 0.018 + t * 0.5 + ai * 1.8) * 0.3 + 0.5) * 0.28;
            const [r, g2, b] = au.col;
            ctx.fillStyle = `rgba(${r},${g2},${b},${alpha})`;
            ctx.fillRect(xi, Math.floor(aY), 2, au.bw);
          }
        });
      },
      drawLayer2: (ctx, w, h, off, t) => {
        const gy = h * GROUND_Y_RATIO;
        ctx.fillStyle = '#0b1828';
        for (let i = -1; i < 4; i++) {
          const x = ((i * 285 - off * 0.04) % (w + 325)) - 90;
          const mh = 102 + (i * 47 % 55);
          ctx.beginPath(); ctx.moveTo(x, gy); ctx.lineTo(x + 142, gy - mh); ctx.lineTo(x + 285, gy); ctx.fill();
        }
        // Pixel snow caps
        for (let i = -1; i < 4; i++) {
          const x = ((i * 285 - off * 0.04) % (w + 325)) - 90;
          const mh = 102 + (i * 47 % 55);
          for (let row = 0; row < 24; row++) {
            const tw = Math.floor(((24 - row) / 24) * 38);
            ctx.fillStyle = row < 10 ? '#daeeff' : '#b4d4ee';
            ctx.fillRect(Math.floor(x + 142 - tw), Math.floor(gy - mh + row), tw * 2, 1);
          }
        }
      },
      drawLayer3: (ctx, w, h, off, t) => {
        const gy = h * GROUND_Y_RATIO;
        for (let i = -1; i < 10; i++) {
          const x = Math.floor(((i * 90 - off * 0.26) % (w + 108)) - 30);
          const ch = 50 + (i * 29 % 38), cw = 11 + (i * 7 % 8);
          const shimmer = Math.sin(t * 2.2 + i * 1.5) * 0.12 + 0.88;
          for (let row = 0; row < ch; row++) {
            const rw = Math.max(2, Math.floor(cw * (1 - row / ch)));
            ctx.fillStyle = row < ch * 0.15 ? '#eef8ff' : row < ch * 0.45 ? '#a4d4f0' : row < ch * 0.72 ? '#6aaad4' : '#4484b4';
            ctx.globalAlpha = shimmer;
            ctx.fillRect(x + Math.floor((cw - rw) / 2), Math.floor(gy - ch + row), rw, 1);
          }
          ctx.fillStyle = '#ffffff'; ctx.globalAlpha = shimmer * 0.55;
          ctx.fillRect(x + 2, Math.floor(gy - ch * 0.85), 2, Math.floor(ch * 0.5));
          // Small side shard
          const sh = Math.floor(ch * 0.5);
          ctx.fillStyle = '#8ec8e8'; ctx.globalAlpha = shimmer * 0.75;
          for (let row = 0; row < sh; row++) {
            const rw = Math.max(1, Math.floor(5 * (1 - row / sh)));
            ctx.fillRect(x + cw + 3 + Math.floor((5 - rw) / 2), Math.floor(gy - sh + row), rw, 1);
          }
          ctx.globalAlpha = 1;
        }
      },
      drawLayer4: (ctx, w, h, off, t) => {
        const gy = h * GROUND_Y_RATIO;
        // Snow drifts — pixel mounds
        for (let i = -1; i < 14; i++) {
          const x = Math.floor(((i * 70 - off * 0.62) % (w + 85)) - 22);
          const sh = 10 + (i * 13 % 10);
          for (let row = 0; row < sh; row++) {
            const sw2 = Math.floor(36 * Math.sqrt(Math.max(0, 1 - (row / sh) * (row / sh))));
            ctx.fillStyle = row === 0 ? '#e8f8ff' : '#c4e4f8';
            ctx.fillRect(x + Math.floor((36 - sw2 * 2) / 2), Math.floor(gy - sh + row), sw2 * 2, 1);
          }
        }
        // Falling snowflakes
        for (let i = 0; i < 26; i++) {
          const fx = ((i * 157 + off * 0.12) % w);
          const fy = ((i * 71 % (gy * 100)) / 100 + t * (18 + i % 12)) % gy;
          ctx.fillStyle = `rgba(210,238,255,${0.45 + (i % 4) * 0.12})`;
          ctx.fillRect(Math.floor(fx), Math.floor(fy), i % 3 === 0 ? 2 : 1, i % 3 === 0 ? 2 : 1);
        }
      }
    },

    volcano: {
      ground: '#1e0400', groundTop: '#480c00',
      drawLayer1: (ctx, w, h, off, t) => {
        const gy = h * GROUND_Y_RATIO;
        const g = ctx.createLinearGradient(0, 0, 0, gy);
        g.addColorStop(0, '#080000'); g.addColorStop(0.4, '#1c0300'); g.addColorStop(0.8, '#340600'); g.addColorStop(1, '#520c00');
        ctx.fillStyle = g; ctx.fillRect(0, 0, w, gy);
        // Rising ember pixels
        for (let i = 0; i < 42; i++) {
          const ex = ((i * 143 + off * 0.25) % w);
          const speed = 26 + (i % 20);
          const ey = (((i * 79 % (gy * 100)) / 100 - t * speed) % gy + gy) % gy;
          const alpha = (ey / gy) * 0.85;
          ctx.fillStyle = i % 3 === 0 ? `rgba(255,175,0,${alpha})` : i % 3 === 1 ? `rgba(255,75,0,${alpha})` : `rgba(255,35,0,${alpha * 0.55})`;
          ctx.fillRect(Math.floor(ex), Math.floor(ey), i % 5 === 0 ? 2 : 1, i % 5 === 0 ? 2 : 1);
        }
        // Ash wisps
        for (let i = 0; i < 3; i++) {
          const cx = w * (0.15 + i * 0.35) + Math.sin(t * 0.3 + i) * 14;
          for (let row = 0; row < 52; row++) {
            const cw2 = Math.floor(5 + row * 0.55 + Math.sin(row * 0.14 + t + i) * 4);
            ctx.fillStyle = `rgba(18,3,0,${0.26 - row * 0.004})`;
            ctx.fillRect(Math.floor(cx - cw2 / 2), row, cw2, 2);
          }
        }
      },
      drawLayer2: (ctx, w, h, off, t) => {
        const gy = h * GROUND_Y_RATIO;
        const vx = w * 0.62, vh = gy * 0.6;
        ctx.fillStyle = '#0b0100';
        ctx.beginPath();
        ctx.moveTo(vx - vh * 0.88, gy); ctx.lineTo(vx - 16, gy - vh); ctx.lineTo(vx + 16, gy - vh); ctx.lineTo(vx + vh * 0.88, gy);
        ctx.fill();
        // Crater glow — pulsing
        const pulse = Math.sin(t * 2.5) * 0.35 + 0.65;
        const cg = ctx.createRadialGradient(vx, gy - vh, 0, vx, gy - vh, 58);
        cg.addColorStop(0, `rgba(255,135,0,${pulse * 0.95})`);
        cg.addColorStop(0.35, `rgba(255,55,0,${pulse * 0.65})`);
        cg.addColorStop(0.75, `rgba(170,0,0,${pulse * 0.28})`);
        cg.addColorStop(1, 'rgba(90,0,0,0)');
        ctx.fillStyle = cg; ctx.fillRect(vx - 58, gy - vh - 28, 116, 65);
        // Lava blobs arcing out
        for (let i = 0; i < 5; i++) {
          const phase = (t * 1.8 + i * 1.26) % (Math.PI * 2);
          if (phase < Math.PI * 0.8) {
            const prog = phase / (Math.PI * 0.8);
            const angle = -Math.PI * 0.32 - (i - 2) * 0.24;
            const dist = prog * 52;
            const ex = vx + Math.cos(angle) * dist;
            const ey = gy - vh + Math.sin(angle) * dist - prog * prog * 28;
            ctx.fillStyle = `rgba(255,${95 + Math.floor(prog * 105)},0,${1 - prog * 0.45})`;
            ctx.fillRect(Math.floor(ex), Math.floor(ey), 3, 3);
          }
        }
      },
      drawLayer3: (ctx, w, h, off, t) => {
        const gy = h * GROUND_Y_RATIO;
        for (let i = -1; i < 8; i++) {
          const x = Math.floor(((i * 112 - off * 0.28) % (w + 136)) - 34);
          const pulse = Math.sin(t * 2.2 + i * 1.1) * 0.2 + 0.8;
          ctx.fillStyle = '#180200'; ctx.fillRect(x, Math.floor(gy - 17), 58, 17);
          ctx.fillStyle = `rgba(175,18,0,${pulse})`; ctx.fillRect(x + 3, Math.floor(gy - 15), 52, 13);
          ctx.fillStyle = `rgba(255,55,0,${pulse * 0.9})`; ctx.fillRect(x + 7, Math.floor(gy - 11), 44, 8);
          ctx.fillStyle = `rgba(255,128,0,${pulse * 0.82})`; ctx.fillRect(x + 12, Math.floor(gy - 8), 34, 4);
          ctx.fillStyle = `rgba(255,200,0,${pulse * 0.7})`; ctx.fillRect(x + 18, Math.floor(gy - 5), 22, 2);
          const hg = ctx.createLinearGradient(0, gy - 46, 0, gy - 17);
          hg.addColorStop(0, 'rgba(255,35,0,0)'); hg.addColorStop(1, `rgba(255,35,0,${pulse * 0.11})`);
          ctx.fillStyle = hg; ctx.fillRect(x, Math.floor(gy - 46), 58, 30);
        }
      },
      drawLayer4: (ctx, w, h, off, t) => {
        const gy = h * GROUND_Y_RATIO;
        for (let i = -1; i < 20; i++) {
          const x = Math.floor(((i * 46 - off * 0.66) % (w + 60)) - 15);
          const rh = 10 + (i * 17 % 18), rw = 18 + (i * 11 % 14);
          ctx.fillStyle = '#0c0100'; ctx.fillRect(x, Math.floor(gy - rh), rw, rh);
          ctx.fillStyle = '#1c0300'; ctx.fillRect(x, Math.floor(gy - rh), rw, 2);
          if (i % 3 === 1) {
            const cp = Math.sin(t * 3.5 + i * 2.3) * 0.35 + 0.65;
            ctx.fillStyle = `rgba(255,48,0,${cp * 0.52})`;
            ctx.fillRect(x + 5, Math.floor(gy - rh + 3), 2, rh - 6);
          }
        }
      }
    },

    ruins: {
      ground: '#160c20', groundTop: '#241535',
      drawLayer1: (ctx, w, h, off, t) => {
        const gy = h * GROUND_Y_RATIO;
        const g = ctx.createLinearGradient(0, 0, 0, gy);
        g.addColorStop(0, '#030108'); g.addColorStop(0.5, '#05020e'); g.addColorStop(1, '#0a0416');
        ctx.fillStyle = g; ctx.fillRect(0, 0, w, gy);
        // Stars with occasional cross-glint
        for (let i = 0; i < 65; i++) {
          const sx = (i * 157 + 9) % w, sy = (i * 103 + 5) % (gy * 0.6);
          const tw = Math.sin(t * 2.2 + i * 1.1) * 0.5 + 0.5;
          ctx.fillStyle = `rgba(205,185,255,${0.12 + tw * 0.78})`; ctx.fillRect(Math.floor(sx), Math.floor(sy), 1, 1);
          if (i % 8 === 0 && tw > 0.82) {
            ctx.fillStyle = `rgba(255,245,255,${(tw - 0.82) * 2.8})`;
            ctx.fillRect(Math.floor(sx) - 2, Math.floor(sy), 5, 1);
            ctx.fillRect(Math.floor(sx), Math.floor(sy) - 2, 1, 5);
          }
        }
        // Moon with purple glow
        const mx = Math.floor(w * 0.22), my = Math.floor(gy * 0.14), mr = 13;
        const mg = ctx.createRadialGradient(mx, my, mr - 1, mx, my, mr + 28);
        mg.addColorStop(0, 'rgba(175,135,255,0.28)'); mg.addColorStop(1, 'rgba(75,35,175,0)');
        ctx.fillStyle = mg; ctx.fillRect(mx - 34, my - 34, 68, 68);
        ctx.fillStyle = '#c4a4ff';
        for (let r = -mr; r <= mr; r++) for (let c = -mr; c <= mr; c++)
          if (r*r+c*c <= mr*mr) ctx.fillRect(mx + c, my + r, 1, 1);
        ctx.fillStyle = '#9c78d8';
        ctx.fillRect(mx - 4, my - 3, 4, 4); ctx.fillRect(mx + 3, my + 3, 3, 3);
        // Drifting clouds
        for (let i = 0; i < 4; i++) {
          const cx = ((i * 245 - off * 0.015 + t * 6) % (w + 285)) - 85;
          const cy = gy * (0.14 + i * 0.08);
          ctx.fillStyle = `rgba(10,4,22,${0.55 + i * 0.06})`;
          for (let j = 0; j < 5; j++) {
            ctx.beginPath(); ctx.arc(cx + j * 22, cy, 12 + (j % 3) * 5, 0, Math.PI * 2); ctx.fill();
          }
        }
      },
      drawLayer2: (ctx, w, h, off, t) => {
        const gy = h * GROUND_Y_RATIO;
        const tx = w * 0.62;
        // Ziggurat steps
        const steps = [{w:170,h:20},{w:136,h:19},{w:102,h:18},{w:70,h:18},{w:40,h:58}];
        let sy2 = gy;
        steps.forEach((s, idx) => {
          ctx.fillStyle = idx % 2 === 0 ? '#060412' : '#080516';
          ctx.fillRect(Math.floor(tx - s.w/2), Math.floor(sy2 - s.h), s.w, s.h);
          sy2 -= s.h;
        });
        // Torch glows
        const tp = Math.sin(t * 4.2) * 0.3 + 0.7;
        [-18, 18].forEach(ox => {
          const tg2 = ctx.createRadialGradient(tx + ox, sy2, 2, tx + ox, sy2, 24);
          tg2.addColorStop(0, `rgba(255,128,0,${tp * 0.92})`); tg2.addColorStop(1, 'rgba(255,55,0,0)');
          ctx.fillStyle = tg2; ctx.fillRect(Math.floor(tx + ox - 24), Math.floor(sy2 - 22), 48, 30);
          ctx.fillStyle = `rgba(255,200,0,${tp})`;
          ctx.fillRect(Math.floor(tx + ox) - 1, Math.floor(sy2) - 6, 2, 6);
        });
      },
      drawLayer3: (ctx, w, h, off, t) => {
        const gy = h * GROUND_Y_RATIO;
        for (let i = -1; i < 8; i++) {
          const x = Math.floor(((i * 106 - off * 0.28) % (w + 126)) - 32);
          const ph = 58 + (i * 33 % 38), bY = Math.floor(ph * (0.42 + (i * 7 % 5) * 0.08));
          ctx.fillStyle = '#14102a';
          ctx.fillRect(x + 5, Math.floor(gy - bY), 16, bY);
          ctx.fillStyle = '#1e1438'; ctx.fillRect(x + 5, Math.floor(gy - bY), 4, bY);
          ctx.fillStyle = '#1a1232';
          ctx.fillRect(x, Math.floor(gy - bY - 7), 26, 8);
          ctx.fillRect(x, Math.floor(gy - 8), 26, 8);
          if (bY < ph - 8) {
            ctx.fillStyle = '#100828';
            ctx.fillRect(x + (i % 2 === 0 ? 18 : -18), Math.floor(gy - 11), 24, 11);
          }
          ctx.fillStyle = '#0b1806';
          for (let v = 4; v < bY; v += 7) {
            ctx.fillRect(x + 5 + Math.floor(Math.sin(v * 0.4 + i) * 2), Math.floor(gy - bY + v), 3, 5);
          }
        }
      },
      drawLayer4: (ctx, w, h, off, t) => {
        const gy = h * GROUND_Y_RATIO;
        for (let i = -1; i < 22; i++) {
          const x = Math.floor(((i * 42 - off * 0.64) % (w + 55)) - 14);
          const sh = 7 + (i * 13 % 11), sw2 = 16 + (i * 9 % 12);
          ctx.fillStyle = '#0c0618'; ctx.fillRect(x, Math.floor(gy - sh), sw2, sh);
          ctx.fillStyle = '#0a1406'; ctx.fillRect(x + 2, Math.floor(gy - sh), sw2 - 4, 2);
        }
        // Floating magic dust particles
        for (let i = 0; i < 16; i++) {
          const fx = ((i * 169 + off * 0.08) % w);
          const fy = gy * 0.28 + (i * 71 % (gy * 55)) / 100 + Math.sin(t * 1.8 + i * 2.1) * 10;
          const alpha = Math.sin(t * 2.5 + i * 1.4) * 0.4 + 0.52;
          const hue = i % 3 === 0 ? '195,95,255' : i % 3 === 1 ? '95,145,255' : '255,95,195';
          ctx.fillStyle = `rgba(${hue},${alpha})`; ctx.fillRect(Math.floor(fx), Math.floor(fy), 2, 2);
        }
      }
    }
  };

  function drawGround(ctx, w, h, theme, off) {
    const th = THEMES[theme] || THEMES.forest;
    const gy = h * GROUND_Y_RATIO;
    ctx.fillStyle = th.ground; ctx.fillRect(0, gy, w, h - gy);
    ctx.fillStyle = th.groundTop; ctx.fillRect(0, gy, w, 4);
    // Per-theme ground edge detail
    if (theme === 'forest') {
      ctx.fillStyle = '#1e3a0a';
      for (let i = 0; i < w / 18 + 1; i++) {
        const x = Math.floor(((i * 18 - off * 0.8) % (w + 22)) - 4);
        ctx.fillRect(x, Math.floor(gy), 8, 2);
      }
    } else if (theme === 'ice') {
      ctx.fillStyle = '#daf2ff'; ctx.fillRect(0, gy, w, 3);
      ctx.fillStyle = '#b0d8f0';
      for (let i = 0; i < w / 65 + 1; i++) {
        const x = Math.floor(((i * 65 - off * 0.55) % (w + 75)) - 8);
        ctx.fillRect(x, Math.floor(gy + 3), 38, 1);
      }
    } else if (theme === 'volcano') {
      for (let i = 0; i < w / 28 + 1; i++) {
        const x = Math.floor(((i * 28 - off * 0.75) % (w + 34)) - 5);
        ctx.fillStyle = '#300600'; ctx.fillRect(x, Math.floor(gy), 14, 2);
      }
    } else if (theme === 'ruins') {
      for (let i = 0; i < w / 32 + 1; i++) {
        const x = Math.floor(((i * 32 - off * 0.62) % (w + 38)) - 6);
        ctx.fillStyle = '#1c1030'; ctx.fillRect(x, Math.floor(gy), 18, 3);
        ctx.fillStyle = '#0e1006'; ctx.fillRect(x + 2, Math.floor(gy), 14, 2);
      }
    }
  }

  function drawBackground(ctx, w, h, theme, off, t) {
    ctx.imageSmoothingEnabled = false;
    const th = THEMES[theme] || THEMES.forest;
    th.drawLayer1(ctx, w, h, off, t);
    th.drawLayer2(ctx, w, h, off, t);
    th.drawLayer3(ctx, w, h, off, t);
    drawGround(ctx, w, h, theme, off);
    th.drawLayer4(ctx, w, h, off, t);
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
    // Sprites have ~40% empty transparent space below the character feet
    const footFix = fh * 0.23 * scale;
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

  function drawIceBall(ctx, x, y, rot) {
    ctx.save(); ctx.translate(x, y);
    // Outer glow
    const outerGlow = ctx.createRadialGradient(0, 0, 4, 0, 0, 22);
    outerGlow.addColorStop(0, '#a8eeffcc');
    outerGlow.addColorStop(0.5, '#44aaff66');
    outerGlow.addColorStop(1, '#0066ff00');
    ctx.fillStyle = outerGlow;
    ctx.beginPath(); ctx.arc(0, 0, 22, 0, Math.PI * 2); ctx.fill();
    // Core sphere
    const core = ctx.createRadialGradient(-3, -3, 1, 0, 0, 11);
    core.addColorStop(0, '#eeffffff');
    core.addColorStop(0.4, '#88ddff');
    core.addColorStop(1, '#0055cc');
    ctx.fillStyle = core;
    ctx.beginPath(); ctx.arc(0, 0, 11, 0, Math.PI * 2); ctx.fill();
    // Ice crystal spikes (6 rotating spikes)
    ctx.strokeStyle = '#cceefffF';
    ctx.lineWidth = 2;
    for (let i = 0; i < 6; i++) {
      const a = rot + (i / 6) * Math.PI * 2;
      const r1 = 11, r2 = 20;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * r1, Math.sin(a) * r1);
      ctx.lineTo(Math.cos(a) * r2, Math.sin(a) * r2);
      ctx.stroke();
      // Side barbs
      const bA = a + 0.4, bR = r1 + 4;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * (r1 + 5), Math.sin(a) * (r1 + 5));
      ctx.lineTo(Math.cos(bA) * bR, Math.sin(bA) * bR);
      ctx.stroke();
    }
    // Specular highlight
    ctx.fillStyle = '#ffffffaa';
    ctx.beginPath(); ctx.arc(-3, -3, 4, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  function drawProjectiles(ctx) {
    for (const p of projectiles) {
      if (p.type === 'arrow') drawArrow(ctx, p.x, p.y, p.vx, p.vy);
      else drawIceBall(ctx, p.x, p.y, p.rotation);
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
      const py = groundY - (sd?.frameHeight || 64) * PLAYER_SCALE * 0.30;
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

    // Update scroll (also during kill pause so character doesn't run in place)
    if (gs.phase === 'running' || gs.phase === 'killed') {
      scrollOffset += 180 * dt;
    }

    drawBackground(ctx, w, h, theme, scrollOffset, runTime);

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

      const isRanged = CHARACTERS[gs.selectedChar]?.type === 'ranged';
      const combatTrigger = isRanged ? playerX + 320 : playerX + 60;
      if (gs.monster && gs.monsterX <= combatTrigger) {
        gs.phase = 'combat';
        gs.combatTimer = 0;
        gs.attackCooldown = 0.5;
        gs.monsterAttackCooldown = 1.5;
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
      const monY  = groundY;

      // Ranged: monster keeps walking toward player until melee range
      const isRangedCombat = CHARACTERS[gs.selectedChar]?.type === 'ranged';
      const meleeStop = playerX + 120;
      if (isRangedCombat && gs.monsterX > meleeStop) {
        gs.monsterX -= 55 * dt;
      }

      const monX  = gs.monsterX;

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

      const monMoving = isRangedCombat && gs.monsterX > meleeStop;
      drawMonster(ctx, gs.monster, monX, monY, 1, monMoving, runTime);
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

    // Player HP bar (always at regular scale position so it doesn't jump during attack)
    const stats2 = gs.computedStats;
    if (stats2) {
      const fh2 = sd?.frameHeight || 64;
      const sprH = fh2 * PLAYER_SCALE * (1 - 0.23);
      drawHPBar(ctx, playerX, groundY - sprH - 14,
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
