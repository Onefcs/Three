const UI = (() => {
  let currentTab = 'game';
  let currentInvTab = 'equip';

  function switchTab(tab, btn) {
    currentTab = tab;
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(el => el.classList.remove('active'));
    const el = document.getElementById('tab-' + tab);
    if (el) el.classList.add('active');
    if (btn) btn.classList.add('active');

    if (tab === 'upgrades') renderUpgrades();
    if (tab === 'inventory') renderInventory();
    if (tab === 'profile') renderProfile();
    if (tab === 'friends') renderFriends();
    if (tab === 'game') {
      Engine.resizeCanvas();
      setTimeout(() => Engine.resizeCanvas(), 100);
    }
  }

  function showInvTab(t) {
    currentInvTab = t;
    document.querySelectorAll('.inv-section').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.inv-tab-btn').forEach(el => el.classList.remove('active'));
    const sec = document.getElementById('inv-' + t);
    if (sec) sec.classList.add('active');
    document.querySelectorAll('.inv-tab-btn').forEach(btn => {
      if (btn.getAttribute('onclick')?.includes(t)) btn.classList.add('active');
    });
    if (t === 'equip') renderEquip();
    if (t === 'items') renderItems();
    if (t === 'craft') renderCraft();
  }

  function updateHeader() {
    const s = State.get();
    const char = CHARACTERS[s.selectedChar];
    if (!char) return;
    document.getElementById('h-char-name').textContent = char.name + ' ' + (s.level > 1 ? `(Ур.${s.level})` : '');
    const cs = s.computedStats;
    const hpPct = Math.max(0, Math.min(1, s.currentHp / cs.maxHp));
    document.getElementById('h-hp-fill').style.width = (hpPct * 100) + '%';
    document.getElementById('h-hp-text').textContent = `${Math.ceil(s.currentHp)}/${cs.maxHp}`;
    const xpNeeded = getXpForLevel(s.level);
    const xpPct = Math.min(1, s.xp / xpNeeded);
    document.getElementById('h-xp-fill').style.width = (xpPct * 100) + '%';
    document.getElementById('h-level-text').textContent = `${s.xp}/${xpNeeded}`;
    document.getElementById('h-gold').textContent = Math.floor(s.gold);
    document.getElementById('h-level').textContent = 'Ур.' + s.level;
    const power = Math.floor(cs.atk * 3 + cs.maxHp * 0.1 + cs.def * 2 + cs.speed + cs.crit * 200);
    document.getElementById('h-power').textContent = power;
  }

  function renderDungeonSelect() {
    const s = State.get();
    const el = document.getElementById('dungeon-list');
    if (!el) return;
    el.innerHTML = '';
    DUNGEONS.forEach(d => {
      const locked = s.level < d.minLevel;
      const div = document.createElement('div');
      div.className = 'dungeon-card' + (locked ? ' locked' : '');
      div.innerHTML = `
        <div class="dungeon-icon">${d.icon}</div>
        <div class="dungeon-info">
          <div class="dungeon-name">${d.name}</div>
          <div class="dungeon-req">Мин. уровень: ${d.minLevel} ${locked ? '🔒' : ''}</div>
          <div class="dungeon-mult">💰×${d.goldMult} ⭐×${d.xpMult}</div>
        </div>
        ${!locked ? '<button class="btn-enter" onclick="State.startDungeon(\''+d.id+'\')">Войти</button>' : ''}
      `;
      el.appendChild(div);
    });
  }

  function renderUpgrades() {
    const s = State.get();
    const cs = s.computedStats;
    const el = document.getElementById('upgrades-list');
    if (!el) return;
    el.innerHTML = '';
    UPGRADES_DEF.forEach(upg => {
      const lvl = s.upgrades[upg.id] || 0;
      const cost = getUpgradeCost(upg.id, lvl);
      const canAfford = s.gold >= cost;
      const statVal = cs[upg.stat];
      const statStr = upg.stat === 'crit' ? (statVal * 100).toFixed(1) + '%' : Math.floor(statVal);
      const div = document.createElement('div');
      div.className = 'upgrade-card';
      div.innerHTML = `
        <div class="upg-icon">${upg.icon}</div>
        <div class="upg-info">
          <div class="upg-name">${upg.name}</div>
          <div class="upg-stat">Текущее: <b>${statStr}</b></div>
          <div class="upg-level">Улучшений: ${lvl}</div>
        </div>
        <div class="upg-action">
          <div class="upg-cost">💰 ${cost}</div>
          <button class="btn-upgrade ${canAfford ? '' : 'disabled'}"
            onclick="State.buyUpgrade('${upg.id}')" ${canAfford ? '' : 'disabled'}>
            Улучшить
          </button>
        </div>
      `;
      el.appendChild(div);
    });
  }

  function renderEquip() {
    const s = State.get();
    const el = document.getElementById('inv-equip');
    if (!el) return;
    el.innerHTML = '<h3>Экипировка (до 10 предметов)</h3><div class="equip-grid" id="equip-grid"></div>';
    const grid = document.getElementById('equip-grid');
    ITEM_SLOTS.forEach(slot => {
      const item = s.equipped[slot];
      const div = document.createElement('div');
      div.className = 'equip-slot' + (item ? ' filled rarity-' + item.rarity : '');
      if (item) {
        const r = RARITY[item.rarity];
        div.style.borderColor = r.color;
        const statStr = Object.entries(item.stats).map(([k, v]) => {
          const labels = { atk: 'ATK', hp: 'HP', def: 'DEF', speed: 'SPD', crit: 'Крит', critDmg: 'КритУрон', vamp: 'Вамп' };
          const fmt = k === 'crit' || k === 'critDmg' || k === 'vamp'
            ? (v * 100).toFixed(1) + '%' : '+' + Math.floor(v);
          return `${labels[k] || k}: ${fmt}`;
        }).join(', ');
        div.innerHTML = `
          <div class="slot-label">${SLOT_LABELS[slot]}</div>
          <div class="slot-icon" style="color:${r.color}">${item.icon}</div>
          <div class="slot-name" style="color:${r.color}">${item.name}</div>
          <div class="slot-stats">${statStr}</div>
          <button class="btn-unequip" onclick="State.unequipItem('${slot}')">Снять</button>
        `;
      } else {
        div.innerHTML = `
          <div class="slot-label">${SLOT_LABELS[slot]}</div>
          <div class="slot-icon empty">${SLOT_ICONS[slot]}</div>
          <div class="slot-empty">Пусто</div>
        `;
      }
      grid.appendChild(div);
    });
  }

  function renderItems() {
    const s = State.get();
    const el = document.getElementById('inv-items');
    if (!el) return;
    if (!s.inventory.length) {
      el.innerHTML = '<div class="empty-state"><span>🎒</span><p>Инвентарь пуст. Убивайте монстров!</p></div>';
      return;
    }
    el.innerHTML = '<h3>Предметы (' + s.inventory.length + ')</h3><div class="item-grid" id="item-grid"></div>';
    const grid = document.getElementById('item-grid');
    s.inventory.forEach((item, idx) => {
      const r = RARITY[item.rarity];
      const canEquip = !item.restriction || item.restriction === s.selectedChar;
      const div = document.createElement('div');
      div.className = 'item-card';
      div.style.borderColor = r.color;
      div.style.background = r.bg;
      const statStr = Object.entries(item.stats).map(([k, v]) => {
        const labels = { atk: 'ATK', hp: 'HP', def: 'DEF', speed: 'SPD', crit: 'Крит', critDmg: 'КД', vamp: 'Вамп' };
        const fmt = k === 'crit' || k === 'critDmg' || k === 'vamp'
          ? (v * 100).toFixed(1) + '%' : '+' + Math.floor(v);
        return `${labels[k] || k}:${fmt}`;
      }).join(' ');
      div.innerHTML = `
        <div class="item-icon" style="color:${r.color}">${item.icon}</div>
        <div class="item-name" style="color:${r.color}">${item.name}</div>
        <div class="item-rarity" style="color:${r.color}">${r.name}</div>
        <div class="item-stats">${statStr}</div>
        ${item.restriction ? `<div class="item-restrict">Только: ${CHARACTERS[item.restriction]?.name || ''}</div>` : ''}
        <div class="item-actions">
          ${canEquip ? `<button class="btn-equip" onclick="State.equipItem(${idx})">Надеть</button>` : ''}
          <button class="btn-sell" onclick="State.sellItem(${idx})">Продать</button>
        </div>
      `;
      grid.appendChild(div);
    });
  }

  function renderCraft() {
    const s = State.get();
    const el = document.getElementById('inv-craft');
    if (!el) return;
    el.innerHTML = `
      <h3>Крафт</h3>
      <p class="craft-desc">Объедините 3 предмета одной редкости → 1 предмет следующей редкости</p>
      <div class="craft-rarities" id="craft-rarities"></div>
    `;
    const cr = document.getElementById('craft-rarities');
    RARITIES.slice(0, -1).forEach(rar => {
      const nextRar = RARITIES[RARITIES.indexOf(rar) + 1];
      const count = s.inventory.filter(it => it.rarity === rar).length;
      const r = RARITY[rar], rn = RARITY[nextRar];
      const canCraft = count >= 3;
      const div = document.createElement('div');
      div.className = 'craft-card';
      div.innerHTML = `
        <div class="craft-recipe">
          <span style="color:${r.color}">3× ${r.name}</span>
          <span class="craft-arrow">→</span>
          <span style="color:${rn.color}">1× ${rn.name}</span>
        </div>
        <div class="craft-count">У вас: <b style="color:${count>=3?'#4caf50':'#e57373'}">${count}/3</b></div>
        <button class="btn-craft ${canCraft ? '' : 'disabled'}"
          onclick="State.craftItem('${rar}')" ${canCraft ? '' : 'disabled'}>
          Создать
        </button>
      `;
      cr.appendChild(div);
    });
  }

  function renderInventory() {
    if (currentInvTab === 'equip') renderEquip();
    else if (currentInvTab === 'items') renderItems();
    else if (currentInvTab === 'craft') renderCraft();
  }

  function renderProfile() {
    const s = State.get();
    const char = CHARACTERS[s.selectedChar];
    const cs = s.computedStats;
    if (!char) return;
    const el = document.getElementById('profile-content');
    if (!el) return;
    el.innerHTML = `
      <div class="profile-header">
        <div class="profile-avatar" style="background:${char.color}22;border-color:${char.color}">
          <span class="profile-icon">${char.icon}</span>
        </div>
        <div class="profile-info">
          <h2>${char.name}</h2>
          <div class="profile-level">Уровень ${s.level}</div>
          <div class="profile-type">${char.desc}</div>
        </div>
      </div>
      <div class="stats-grid">
        <div class="stat-box"><span>❤️ HP</span><b>${Math.floor(cs.maxHp)}</b></div>
        <div class="stat-box"><span>⚔️ ATK</span><b>${Math.floor(cs.atk)}</b></div>
        <div class="stat-box"><span>🛡️ DEF</span><b>${Math.floor(cs.def)}</b></div>
        <div class="stat-box"><span>💨 SPD</span><b>${Math.floor(cs.speed)}</b></div>
        <div class="stat-box"><span>💥 Крит</span><b>${(cs.crit * 100).toFixed(1)}%</b></div>
        <div class="stat-box"><span>🎯 КритУрон</span><b>${(cs.critDmg * 100).toFixed(0)}%</b></div>
        ${cs.vamp > 0 ? `<div class="stat-box"><span>🩸 Вамп</span><b>${(cs.vamp * 100).toFixed(0)}%</b></div>` : ''}
        <div class="stat-box"><span>💰 Золото</span><b>${Math.floor(s.gold)}</b></div>
      </div>
      <div class="skills-profile">
        <h3>Навыки</h3>
        ${char.skills.map((sk, i) => `
          <div class="skill-row">
            <span class="skill-prof-icon">${sk.icon}</span>
            <div><b>${sk.name}</b><div class="skill-desc">${sk.desc}</div></div>
            <span class="skill-cd">⏱ ${sk.cd}с</span>
          </div>
        `).join('')}
      </div>
      <div class="change-char">
        <button class="btn-danger" onclick="State.resetChar()">Сменить персонажа</button>
      </div>
    `;
  }

  function renderFriends() {
    const el = document.getElementById('tab-friends');
    if (!el) return;
    el.innerHTML = `
      <div class="friends-screen">
        <h2>Друзья</h2>
        <div class="empty-state">
          <span style="font-size:64px">👥</span>
          <p>Пока нет друзей</p>
          <p style="color:#888;font-size:13px">Пригласи друзей и получи бонусы!</p>
          <button class="btn-primary">Пригласить друзей</button>
        </div>
      </div>
    `;
  }

  function renderCharSelect() {
    const el = document.getElementById('char-list');
    if (!el) return;
    let selectedId = Object.keys(CHARACTERS)[0];
    const render = (charId) => {
      selectedId = charId;
      document.querySelectorAll('.char-card').forEach(c => c.classList.remove('active'));
      const card = document.querySelector(`[data-char="${charId}"]`);
      if (card) card.classList.add('active');
      const char = CHARACTERS[charId];
      const cs = char.baseStats;
      document.getElementById('char-preview').innerHTML = `
        <div class="preview-icon" style="background:${char.color}22;border-color:${char.color}">${char.icon}</div>
        <h2 style="color:${char.color}">${char.name}</h2>
        <p>${char.desc}</p>
      `;
      document.getElementById('char-stats').innerHTML = `
        <div class="stats-mini">
          <div>❤️ HP: <b>${cs.hp}</b></div>
          <div>⚔️ ATK: <b>${cs.atk}</b></div>
          <div>🛡️ DEF: <b>${cs.def}</b></div>
          <div>💨 SPD: <b>${cs.speed}</b></div>
          <div>💥 Крит: <b>${(cs.crit*100).toFixed(0)}%</b></div>
          ${cs.vamp > 0 ? `<div>🩸 Вамп: <b>${(cs.vamp*100).toFixed(0)}%</b></div>` : ''}
        </div>
        <div class="char-type-badge">${char.type === 'ranged' ? '🏹 Дальний бой' : '⚔️ Ближний бой'}</div>
      `;
      document.getElementById('btn-select').onclick = () => State.selectChar(charId);
    };

    Object.values(CHARACTERS).forEach(char => {
      const div = document.createElement('div');
      div.className = 'char-card';
      div.setAttribute('data-char', char.id);
      div.innerHTML = `<span class="char-card-icon">${char.icon}</span><span class="char-card-name">${char.name}</span>`;
      div.onclick = () => render(char.id);
      el.appendChild(div);
    });
    render(selectedId);
  }

  function updateSkillsBar() {
    const s = State.get();
    const char = CHARACTERS[s.selectedChar];
    if (!char) return;
    const bar = document.getElementById('skills-bar');
    if (!bar) return;
    const now = performance.now() / 1000;
    bar.innerHTML = '';
    char.skills.forEach((sk, i) => {
      const cdEnd = s.skillCooldowns[i] || 0;
      const remaining = Math.max(0, cdEnd - now);
      const pct = remaining / sk.cd;
      const btn = document.createElement('div');
      btn.className = 'skill-btn' + (remaining > 0 ? ' on-cd' : '');
      btn.innerHTML = `
        <div class="skill-icon">${sk.icon}</div>
        <div class="skill-name-short">${sk.name.split(' ')[0]}</div>
        ${remaining > 0 ? `<div class="skill-cd-overlay" style="height:${pct*100}%"></div><div class="skill-cd-text">${remaining.toFixed(1)}</div>` : ''}
      `;
      btn.onclick = () => { Engine.useSkill(i); updateSkillsBar(); };
      bar.appendChild(btn);
    });
  }

  function showVictory(gold, xp, items) {
    const el = document.getElementById('battle-result');
    if (!el) return;
    document.getElementById('result-title').textContent = '⚔️ Победа!';
    document.getElementById('result-title').style.color = '#f1c40f';
    let html = `<div class="result-rewards">`;
    html += `<div class="reward-item">💰 +${gold} золота</div>`;
    html += `<div class="reward-item">⭐ +${xp} опыта</div>`;
    items.forEach(it => {
      const r = RARITY[it.rarity];
      html += `<div class="reward-item" style="color:${r.color}">${it.icon} ${it.name} (${r.name})</div>`;
    });
    html += '</div>';
    document.getElementById('result-rewards').innerHTML = html;
    el.style.display = 'flex';
  }

  function showDefeat() {
    const el = document.getElementById('battle-result');
    if (!el) return;
    document.getElementById('result-title').textContent = '💀 Поражение';
    document.getElementById('result-title').style.color = '#e74c3c';
    document.getElementById('result-rewards').innerHTML = '<p>Возвращайтесь сильнее!</p>';
    el.style.display = 'flex';
  }

  function hideResult() {
    const el = document.getElementById('battle-result');
    if (el) el.style.display = 'none';
  }

  function showGameArea() {
    document.getElementById('dungeon-select').style.display = 'none';
    document.getElementById('game-area').style.display = 'flex';
    setTimeout(() => Engine.resizeCanvas(), 50);
  }

  function showDungeonSelect() {
    document.getElementById('dungeon-select').style.display = 'block';
    document.getElementById('game-area').style.display = 'none';
    renderDungeonSelect();
  }

  // Tick skills cooldown display
  setInterval(() => {
    const s = State.get();
    if (s.selectedChar && document.getElementById('tab-game')?.classList.contains('active')) {
      updateSkillsBar();
    }
  }, 100);

  return { switchTab, showInvTab, updateHeader, renderDungeonSelect, renderUpgrades,
    renderInventory, renderEquip, renderItems, renderCraft, renderProfile, renderFriends,
    renderCharSelect, updateSkillsBar, showVictory, showDefeat, hideResult,
    showGameArea, showDungeonSelect };
})();

// Global wrappers for onclick
function switchTab(tab, btn) { UI.switchTab(tab, btn); }
function showInvTab(t) { UI.showInvTab(t); }
