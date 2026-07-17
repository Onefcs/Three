const State = (() => {
  const SAVE_KEY = 'dungeon_warriors_v3';
  let state = null;

  function defaultState() {
    return {
      selectedChar: null,
      level: 1, xp: 0, gold: 500,
      currentHp: 0,
      upgrades: { atk: 0, hp: 0, def: 0, speed: 0, crit: 0 },
      inventory: [],
      equipped: {},
      skillCooldowns: [0, 0, 0, 0, 0],
      currentDungeon: null,
      phase: 'idle',
      monster: null, monsterX: 0,
      monsterHp: 0, monsterMaxHp: 0,
      combatTimer: 0, attackCooldown: 0, monsterAttackCooldown: 0,
      buffState: {},
      computedStats: null,
      onKill: null,
      onDefeat: null,
      playerLevel: 1
    };
  }

  function computeStats(s) {
    const char = CHARACTERS[s.selectedChar];
    if (!char) return null;
    const base = char.baseStats;
    const upg = s.upgrades;
    const ups = UPGRADES_DEF;

    let atk = base.atk + (upg.atk || 0) * ups.find(u=>u.id==='atk').perLevel;
    let maxHp = base.hp + (upg.hp || 0) * ups.find(u=>u.id==='hp').perLevel;
    let def = base.def + (upg.def || 0) * ups.find(u=>u.id==='def').perLevel;
    let speed = base.speed + (upg.speed || 0) * ups.find(u=>u.id==='speed').perLevel;
    let crit = base.crit + (upg.crit || 0) * ups.find(u=>u.id==='crit').perLevel;
    let critDmg = base.critDmg;
    let vamp = base.vamp;

    // Equipment bonuses
    Object.values(s.equipped || {}).forEach(item => {
      if (!item) return;
      const st = item.stats;
      if (st.atk) atk += st.atk;
      if (st.hp) maxHp += st.hp;
      if (st.def) def += st.def;
      if (st.speed) speed += st.speed;
      if (st.crit) crit += st.crit;
      if (st.critDmg) critDmg += st.critDmg;
      if (st.vamp) vamp += st.vamp;
    });

    return { atk: Math.floor(atk), maxHp: Math.floor(maxHp), def: Math.floor(def),
      speed: Math.floor(speed), crit: Math.min(0.95, crit), critDmg, vamp };
  }

  function save() {
    if (!state) return;
    const toSave = { ...state };
    toSave.onKill = null; toSave.onDefeat = null; toSave.onSpawnMonster = null;
    toSave.buffState = {};
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(toSave)); } catch(e){}
  }

  function load() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (raw) {
        state = { ...defaultState(), ...JSON.parse(raw) };
        state.computedStats = computeStats(state);
        if (!state.currentHp || state.currentHp <= 0) state.currentHp = state.computedStats?.maxHp || 100;
        return true;
      }
    } catch(e){}
    return false;
  }

  function get() { return state; }

  function selectChar(charId) {
    state.selectedChar = charId;
    state.computedStats = computeStats(state);
    state.currentHp = state.computedStats.maxHp;
    save();
    Engine.preloadCharSprites(charId);
    document.getElementById('char-select-screen').classList.remove('active');
    document.getElementById('main-screen').classList.add('active');
    UI.updateHeader();
    UI.renderDungeonSelect();
  }

  function spawnMonster(dungeon) {
    const monsterKey = dungeon.monsters[Math.floor(Math.random() * dungeon.monsters.length)];
    const monBase = MONSTERS[monsterKey];
    const lvlScale = Math.pow(1.06, state.level - 1);
    // HP scaled so monsters survive ~8-15 hits
    const hpMult = 6 + dungeon.goldMult * 1.5;
    state.monster = {
      ...monBase,
      hp:  Math.round(monBase.hp  * lvlScale * hpMult),
      atk: Math.round(monBase.atk * lvlScale * 1.2),
      def: Math.round(monBase.def * lvlScale)
    };
    state.monsterHp    = state.monster.hp;
    state.monsterMaxHp = state.monster.hp;
    state.attackCooldown = 0;
    state.monsterAttackCooldown = 0.6;
    state.buffState = {};
  }

  function startDungeon(dungeonId) {
    state.currentDungeon = dungeonId;
    const dungeon = DUNGEONS.find(d => d.id === dungeonId);
    state.monsterX = undefined;
    state.phase = 'running';
    state.skillCooldowns = [0, 0, 0, 0, 0];
    state.playerLevel = state.level;
    state.computedStats = computeStats(state);

    spawnMonster(dungeon);

    state.onKill = () => handleKill(dungeon);
    state.onSpawnMonster = () => { spawnMonster(dungeon); state.onKill = () => handleKill(dungeon); };
    state.onDefeat = () => handleDefeat();

    UI.showGameArea();
    UI.updateSkillsBar();
    Engine.start(state);
    save();
  }

  function handleKill(dungeon) {
    const gold = Math.round(state.monster.gold * dungeon.goldMult * (0.8 + Math.random() * 0.4));
    const xp   = Math.round(state.monster.xp   * dungeon.xpMult  * (0.8 + Math.random() * 0.4));
    state.gold += gold;
    state.xp   += xp;

    let leveled = false;
    while (state.xp >= getXpForLevel(state.level)) {
      state.xp -= getXpForLevel(state.level);
      state.level++;
      leveled = true;
    }
    if (leveled) {
      state.computedStats = computeStats(state);
      state.currentHp = Math.min(
        state.currentHp + state.computedStats.maxHp * 0.25,
        state.computedStats.maxHp
      );
      showToast(`🎉 Уровень ${state.level}!`, '#f1c40f');
    }

    // Loot drop
    if (Math.random() < 0.3) {
      const rarIdx = weightedRarityDrop(state.level);
      const rar  = RARITIES[rarIdx];
      const slots = ITEM_SLOTS.filter(s => s !== 'ring2' && s !== 'ring1');
      const slot  = Math.random() < 0.15 ? 'weapon' : slots[Math.floor(Math.random() * slots.length)];
      const item  = generateItem(slot, rar, state.selectedChar);
      state.inventory.push(item);
      showToast(`${item.icon} ${item.name}`, RARITY[rar].color);
    }

    showToast(`+${gold}💰  +${xp}⭐`, '#aaa');
    UI.updateHeader();
    save();
  }

  function handleDefeat() {
    state.currentHp = Math.ceil(state.computedStats.maxHp * 0.1);
    UI.showDefeat();
    save();
  }

  function weightedRarityDrop(level) {
    const weights = [60, 25, 10, 4, 1];
    // Scale rarity with level
    const bonus = Math.min(level * 0.3, 15);
    weights[0] -= bonus; weights[1] += bonus * 0.5; weights[2] += bonus * 0.3;
    weights[3] += bonus * 0.15; weights[4] += bonus * 0.05;
    const total = weights.reduce((a, b) => a + b, 0);
    let r = Math.random() * total;
    for (let i = 0; i < weights.length; i++) {
      r -= weights[i];
      if (r <= 0) return i;
    }
    return 0;
  }

  function continueGame() {
    UI.hideResult();
    if ((state.currentHp || 0) > 0) {
      // Revive with 10% HP and continue
      if (!state.currentHp || state.currentHp <= 0) {
        state.currentHp = Math.ceil(state.computedStats.maxHp * 0.1);
      }
      startDungeon(state.currentDungeon);
    } else {
      state.phase = 'idle';
      Engine.stop();
      UI.showDungeonSelect();
    }
  }

  function showToast(text, color = '#fff') {
    const el = document.createElement('div');
    el.className = 'game-toast';
    el.textContent = text;
    el.style.color = color;
    const gameArea = document.getElementById('game-area');
    if (!gameArea) return;
    gameArea.appendChild(el);
    setTimeout(() => el.remove(), 1800);
  }

  function buyUpgrade(id) {
    const lvl = state.upgrades[id] || 0;
    const cost = getUpgradeCost(id, lvl);
    if (state.gold < cost) return;
    state.gold -= cost;
    state.upgrades[id] = lvl + 1;
    state.computedStats = computeStats(state);
    state.currentHp = Math.min(state.currentHp, state.computedStats.maxHp);
    save();
    UI.updateHeader();
    UI.renderUpgrades();
  }

  function equipItem(idx) {
    const item = state.inventory[idx];
    if (!item) return;
    if (item.restriction && item.restriction !== state.selectedChar) {
      alert('Этот предмет нельзя надеть на вашего персонажа!'); return;
    }
    // Unequip current
    const slot = item.slot;
    if (state.equipped[slot]) {
      state.inventory.push(state.equipped[slot]);
    }
    state.equipped[slot] = item;
    state.inventory.splice(idx, 1);
    state.computedStats = computeStats(state);
    state.currentHp = Math.min(state.currentHp, state.computedStats.maxHp);
    save();
    UI.updateHeader();
    UI.renderInventory();
  }

  function unequipItem(slot) {
    const item = state.equipped[slot];
    if (!item) return;
    state.inventory.push(item);
    delete state.equipped[slot];
    state.computedStats = computeStats(state);
    save();
    UI.updateHeader();
    UI.renderInventory();
  }

  function sellItem(idx) {
    const item = state.inventory[idx];
    if (!item) return;
    const sellPrices = { common: 10, uncommon: 30, rare: 80, epic: 200, legendary: 600 };
    state.gold += sellPrices[item.rarity] || 10;
    state.inventory.splice(idx, 1);
    save();
    UI.updateHeader();
    UI.renderInventory();
  }

  function craftItem(fromRarity) {
    const rarIdx = RARITIES.indexOf(fromRarity);
    if (rarIdx >= RARITIES.length - 1) return;
    const items = state.inventory.filter(it => it.rarity === fromRarity);
    if (items.length < 3) return;
    // Remove 3 items
    let removed = 0;
    state.inventory = state.inventory.filter(it => {
      if (it.rarity === fromRarity && removed < 3) { removed++; return false; }
      return true;
    });
    const nextRar = RARITIES[rarIdx + 1];
    const slots = ITEM_SLOTS.filter(s => s !== 'ring2');
    const slot = Math.random() < 0.2 ? 'weapon' : slots[Math.floor(Math.random() * slots.length)];
    const item = generateItem(slot, nextRar, state.selectedChar);
    state.inventory.push(item);
    save();
    UI.renderInventory();
    alert(`✨ Создан: ${item.name} (${RARITY[nextRar].name})`);
  }

  function resetChar() {
    if (!confirm('Сменить персонажа? Прогресс сохранится.')) return;
    state.selectedChar = null;
    state.phase = 'idle';
    Engine.stop();
    save();
    document.getElementById('main-screen').classList.remove('active');
    document.getElementById('char-select-screen').classList.add('active');
    UI.renderCharSelect();
  }

  function init() {
    if (!load()) state = defaultState();

    if (state.selectedChar) {
      Engine.preloadCharSprites(state.selectedChar);
      document.getElementById('char-select-screen').classList.remove('active');
      document.getElementById('main-screen').classList.add('active');
      UI.updateHeader();
      UI.showDungeonSelect();
    } else {
      UI.renderCharSelect();
    }
    UI.renderInventory();
  }

  return { get, selectChar, startDungeon, continueGame, buyUpgrade,
    equipItem, unequipItem, sellItem, craftItem, resetChar, init };
})();

// Global onclick wrappers
function continueGame() { State.continueGame(); }

window.addEventListener('resize', () => {
  if (document.getElementById('game-area')?.style.display !== 'none') {
    Engine.resizeCanvas();
  }
});

document.addEventListener('DOMContentLoaded', () => State.init());
