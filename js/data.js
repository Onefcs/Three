const SPRITE_DATA = {
  assasin: {
    frameWidth: 96, frameHeight: 96,
    files: { idle: 'IDLE.png', run: 'RUN.png', attack: 'ATTACK 1.png' },
    frames: { idle: 5, run: 8, attack: 6 }
  },
  mage: {
    frameWidth: 96, frameHeight: 64,
    files: { idle: 'IDLE.png', run: 'RUN.png', attack: 'ATTACK 3.png' },
    frames: { idle: 5, run: 8, attack: 7 }
  },
  warrior: {
    frameWidth: 96, frameHeight: 64,
    files: { idle: 'IDLE.png', run: 'RUN.png', attack: 'ATTACK1.png' },
    frames: { idle: 5, run: 7, attack: 5 }
  },
  archer: {
    frameWidth: 96, frameHeight: 80,
    files: { idle: 'IDLE.png', run: 'RUN.png', attack: 'ATTACK.png' },
    frames: { idle: 14, run: 8, attack: 11 }
  },
  zhnec: {
    frameWidth: 128, frameHeight: 108,
    files: {
      idle: 'IDLE (FLAMING SWORD).png',
      run: 'RUN (FLAMING SWORD).png',
      attack: 'ATTACK 2 (FLAMING SWORD).png'
    },
    frames: { idle: 6, run: 8, attack: 6 }
  }
};

const CHARACTERS = {
  mage: {
    id: 'mage', name: 'Маг', sprite: 'mage',
    type: 'ranged', weaponType: 'staff',
    color: '#4a90d9', icon: '🧙',
    desc: 'Дальний бой. Высокая атака, мало ХП и защиты.',
    baseStats: { hp: 800, atk: 150, def: 30, speed: 50, crit: 0.25, critDmg: 1.8, vamp: 0 },
    upgrades: { atk: 0, hp: 0, def: 0, speed: 0, crit: 0 },
    skills: [
      { name: 'Огненный шар', icon: '🔥', cd: 5, damage: 3.0, type: 'damage', desc: '300% ATK урона' },
      { name: 'Ледяная стрела', icon: '❄️', cd: 8, damage: 1.5, type: 'slow', desc: 'Замедляет врага' },
      { name: 'Молния', icon: '⚡', cd: 6, damage: 2.5, type: 'damage', desc: '250% ATK урона' },
      { name: 'Щит маны', icon: '🛡️', cd: 12, damage: 0, type: 'shield', desc: 'Поглощает 50% урона' },
      { name: 'Взрыв', icon: '💥', cd: 10, damage: 2.0, type: 'damage', desc: '200% ATK урона' }
    ]
  },
  warrior: {
    id: 'warrior', name: 'Воин', sprite: 'warrior',
    type: 'melee', weaponType: 'sword',
    color: '#e74c3c', icon: '⚔️',
    desc: 'Ближний бой. Много ХП и защиты, мало атаки.',
    baseStats: { hp: 2500, atk: 60, def: 150, speed: 20, crit: 0.05, critDmg: 1.3, vamp: 0 },
    upgrades: { atk: 0, hp: 0, def: 0, speed: 0, crit: 0 },
    skills: [
      { name: 'Удар щита', icon: '🛡️', cd: 6, damage: 0.8, type: 'stun', desc: 'Оглушает врага 2 сек' },
      { name: 'Боевой клич', icon: '📢', cd: 10, damage: 0, type: 'buff_def', desc: '+50% защиты 5 сек' },
      { name: 'Мощный удар', icon: '⚔️', cd: 5, damage: 2.0, type: 'damage', desc: '200% ATK урона' },
      { name: 'Вызов', icon: '🎯', cd: 8, damage: 0, type: 'buff_atk', desc: '+30% ATK 5 сек' },
      { name: 'Железная кожа', icon: '🦾', cd: 12, damage: 0, type: 'buff_def', desc: '+80% защиты 3 сек' }
    ]
  },
  archer: {
    id: 'archer', name: 'Лучник', sprite: 'archer',
    type: 'ranged', weaponType: 'bow',
    color: '#27ae60', icon: '🏹',
    desc: 'Дальний бой. Высокая атака, скорость и крит.',
    baseStats: { hp: 700, atk: 130, def: 25, speed: 90, crit: 0.4, critDmg: 2.2, vamp: 0 },
    upgrades: { atk: 0, hp: 0, def: 0, speed: 0, crit: 0 },
    skills: [
      { name: 'Залп стрел', icon: '🏹', cd: 7, damage: 0.8, type: 'multi', desc: '5 ударов по 80% ATK' },
      { name: 'Прицел', icon: '🎯', cd: 8, damage: 0, type: 'buff_crit', desc: '+100% крит шанс' },
      { name: 'Взрывная стрела', icon: '💥', cd: 10, damage: 3.5, type: 'damage', desc: '350% ATK урона' },
      { name: 'Дымовая завеса', icon: '💨', cd: 12, damage: 0, type: 'evade', desc: '80% уклонение 3 сек' },
      { name: 'Снайпер', icon: '⭐', cd: 15, damage: 5.0, type: 'damage', desc: '500% ATK, всегда крит' }
    ]
  },
  zhnec: {
    id: 'zhnec', name: 'Жнец', sprite: 'zhnec',
    type: 'melee', weaponType: 'scythe',
    color: '#9b59b6', icon: '💀',
    desc: 'Ближний бой. Высокая атака, вампиризм от ударов.',
    baseStats: { hp: 1200, atk: 120, def: 60, speed: 30, crit: 0.15, critDmg: 1.5, vamp: 0.25 },
    upgrades: { atk: 0, hp: 0, def: 0, speed: 0, crit: 0 },
    skills: [
      { name: 'Коса смерти', icon: '💀', cd: 5, damage: 2.5, type: 'damage', desc: '250% ATK урона' },
      { name: 'Жизнекрад', icon: '💚', cd: 8, damage: 0, type: 'heal', desc: 'Восстанавливает 30% HP' },
      { name: 'Тёмная аура', icon: '🌑', cd: 10, damage: 0, type: 'buff_vamp', desc: '+50% вампиризм 5 сек' },
      { name: 'Призрак смерти', icon: '👻', cd: 12, damage: 2.0, type: 'damage', desc: '200% ATK + уклонение' },
      { name: 'Жатва', icon: '⚔️', cd: 15, damage: 4.0, type: 'lifesteal', desc: '400% ATK + лечит 50%' }
    ]
  },
  assasin: {
    id: 'assasin', name: 'Ассасин', sprite: 'assasin',
    type: 'melee', weaponType: 'dagger',
    color: '#e67e22', icon: '🗡️',
    desc: 'Ближний бой. Высокий крит урон и шанс.',
    baseStats: { hp: 600, atk: 80, def: 20, speed: 95, crit: 0.5, critDmg: 3.2, vamp: 0 },
    upgrades: { atk: 0, hp: 0, def: 0, speed: 0, crit: 0 },
    skills: [
      { name: 'Тень', icon: '🌑', cd: 6, damage: 3.0, type: 'damage', desc: '300% ATK, телепорт' },
      { name: 'Яд', icon: '☠️', cd: 8, damage: 0.5, type: 'dot', desc: 'Яд 50% ATK/с на 5 сек' },
      { name: 'Двойной удар', icon: '⚡', cd: 5, damage: 2.0, type: 'multi', desc: '2 удара по 200% ATK' },
      { name: 'Дымовая бомба', icon: '💣', cd: 10, damage: 0, type: 'evade', desc: '100% уклонение 2 сек' },
      { name: 'Смерть', icon: '💀', cd: 15, damage: 6.0, type: 'damage', desc: '600% ATK, всегда крит' }
    ]
  }
};

const DUNGEONS = [
  {
    id: 'forest', name: 'Лес', minLevel: 1, icon: '🌲',
    theme: 'forest', goldMult: 1, xpMult: 1,
    monsters: ['goblin', 'wolf', 'treant', 'goblin_shaman']
  },
  {
    id: 'cave', name: 'Тёмная пещера', minLevel: 5, icon: '🦇',
    theme: 'cave', goldMult: 1.5, xpMult: 1.5,
    monsters: ['bat', 'skeleton', 'golem', 'shadow']
  },
  {
    id: 'icecave', name: 'Ледяная пещера', minLevel: 10, icon: '❄️',
    theme: 'ice', goldMult: 2.5, xpMult: 2.5,
    monsters: ['icewolf', 'yeti', 'ice_elemental', 'icedrake']
  },
  {
    id: 'volcano', name: 'Вулкан', minLevel: 20, icon: '🌋',
    theme: 'volcano', goldMult: 4, xpMult: 4,
    monsters: ['demon', 'lavagolem', 'fire_elemental', 'firedrake']
  },
  {
    id: 'ruins', name: 'Древние руины', minLevel: 35, icon: '🏛️',
    theme: 'ruins', goldMult: 7, xpMult: 7,
    monsters: ['guardian', 'wraith', 'ancient_golem', 'lich']
  }
];

const MONSTERS = {
  goblin:        { name: 'Гоблин',           hp: 180,  atk: 18,  def: 3,   gold: 10,  xp: 12,  color: '#7ab648', accent: '#4a8a28', size: 38 },
  wolf:          { name: 'Волк',             hp: 280,  atk: 32,  def: 8,   gold: 15,  xp: 18,  color: '#6c6f7d', accent: '#3c3f4d', size: 44 },
  treant:        { name: 'Трент',            hp: 550,  atk: 22,  def: 38,  gold: 28,  xp: 32,  color: '#5a3e28', accent: '#3a1e08', size: 60 },
  goblin_shaman: { name: 'Шаман гоблинов',   hp: 320,  atk: 40,  def: 5,   gold: 22,  xp: 25,  color: '#a0c040', accent: '#608020', size: 42 },
  bat:           { name: 'Летучая мышь',     hp: 220,  atk: 38,  def: 5,   gold: 18,  xp: 22,  color: '#4a4063', accent: '#2a2043', size: 34 },
  skeleton:      { name: 'Скелет',           hp: 380,  atk: 48,  def: 12,  gold: 24,  xp: 28,  color: '#c8b8a2', accent: '#a89882', size: 50 },
  golem:         { name: 'Голем',            hp: 850,  atk: 42,  def: 55,  gold: 48,  xp: 52,  color: '#8b7355', accent: '#5b4335', size: 68 },
  shadow:        { name: 'Тень',             hp: 300,  atk: 60,  def: 8,   gold: 30,  xp: 35,  color: '#2a1a4a', accent: '#4a2a8a', size: 46 },
  icewolf:       { name: 'Ледяной волк',     hp: 580,  atk: 75,  def: 22,  gold: 38,  xp: 48,  color: '#a8dadc', accent: '#78aabc', size: 54 },
  yeti:          { name: 'Йети',             hp: 1150, atk: 65,  def: 75,  gold: 65,  xp: 75,  color: '#e0f0f8', accent: '#a0c0d8', size: 74 },
  ice_elemental: { name: 'Ледяной элементаль',hp: 800,  atk: 90,  def: 40,  gold: 55,  xp: 65,  color: '#48cae4', accent: '#1890b4', size: 58 },
  icedrake:      { name: 'Ледяной дракон',   hp: 1900, atk: 115, def: 55,  gold: 115, xp: 125, color: '#48cae4', accent: '#084060', size: 88 },
  demon:         { name: 'Демон',            hp: 1400, atk: 145, def: 45,  gold: 75,  xp: 95,  color: '#e63946', accent: '#860a14', size: 64 },
  lavagolem:     { name: 'Лавовый голем',    hp: 2400, atk: 125, def: 115, gold: 95,  xp: 115, color: '#f4a261', accent: '#c47231', size: 84 },
  fire_elemental:{ name: 'Огненный элементаль',hp:1800, atk: 160, def: 35,  gold: 85,  xp: 100, color: '#ff6b35', accent: '#cc3a05', size: 62 },
  firedrake:     { name: 'Огненный дракон',  hp: 3800, atk: 195, def: 95,  gold: 190, xp: 210, color: '#e07a5f', accent: '#a03010', size: 98 },
  guardian:      { name: 'Страж',            hp: 2900, atk: 195, def: 145, gold: 145, xp: 175, color: '#e9c46a', accent: '#a9843a', size: 78 },
  wraith:        { name: 'Призрак',          hp: 1900, atk: 245, def: 45,  gold: 175, xp: 195, color: '#9b72cf', accent: '#6b42af', size: 58 },
  ancient_golem: { name: 'Древний голем',    hp: 4200, atk: 220, def: 200, gold: 220, xp: 260, color: '#b5838d', accent: '#855060', size: 92 },
  lich:          { name: 'Лич',              hp: 4800, atk: 290, def: 145, gold: 290, xp: 340, color: '#6a4c93', accent: '#3a1c63', size: 96 }
};

const ITEM_SLOTS = ['weapon', 'helmet', 'chest', 'gloves', 'boots', 'belt', 'ring1', 'ring2', 'necklace', 'trinket'];
const SLOT_LABELS = {
  weapon: 'Оружие', helmet: 'Шлем', chest: 'Нагрудник',
  gloves: 'Перчатки', boots: 'Сапоги', belt: 'Пояс',
  ring1: 'Кольцо 1', ring2: 'Кольцо 2', necklace: 'Ожерелье', trinket: 'Талисман'
};
const SLOT_ICONS = {
  weapon: '⚔️', helmet: '⛑️', chest: '🛡️', gloves: '🧤',
  boots: '👢', belt: '🎗️', ring1: '💍', ring2: '💍', necklace: '📿', trinket: '🧿'
};

const RARITY = {
  common:   { name: 'Обычный',     color: '#9e9e9e', bg: '#2a2a2a', mult: 1.0 },
  uncommon: { name: 'Необычный',   color: '#4caf50', bg: '#1a2e1a', mult: 1.8 },
  rare:     { name: 'Редкий',      color: '#2196f3', bg: '#0a1a2e', mult: 3.0 },
  epic:     { name: 'Эпический',   color: '#9c27b0', bg: '#1a0a2e', mult: 5.5 },
  legendary:{ name: 'Легендарный', color: '#ff9800', bg: '#2e1500', mult: 10.0 }
};
const RARITIES = ['common', 'uncommon', 'rare', 'epic', 'legendary'];

const WEAPON_TYPES = {
  staff:  { mage: true },
  sword:  { warrior: true },
  bow:    { archer: true },
  scythe: { zhnec: true },
  dagger: { assasin: true }
};

const WEAPON_NAMES = {
  staff:  ['Посох', 'Жезл', 'Скипетр', 'Архимагов посох', 'Посох Вечности'],
  sword:  ['Меч', 'Двуручник', 'Клинок', 'Рыцарский меч', 'Легендарный клинок'],
  bow:    ['Лук', 'Длинный лук', 'Боевой лук', 'Охотничий лук', 'Лук Судьбы'],
  scythe: ['Коса', 'Серп', 'Коса смерти', 'Тёмная коса', 'Коса Жнеца'],
  dagger: ['Кинжал', 'Нож', 'Стилет', 'Клинок теней', 'Кинжал Смерти']
};

const ITEM_NAMES = {
  helmet:   ['Шлем', 'Капюшон', 'Корона', 'Диадема', 'Шлем героя'],
  chest:    ['Кираса', 'Нагрудник', 'Броня', 'Латы', 'Доспех легенды'],
  gloves:   ['Перчатки', 'Рукавицы', 'Кольчужные перчатки', 'Латные перчатки', 'Перчатки силы'],
  boots:    ['Сапоги', 'Ботинки', 'Поножи', 'Сапоги скорости', 'Сапоги героя'],
  belt:     ['Пояс', 'Кушак', 'Кольчужный пояс', 'Пояс силы', 'Пояс легенды'],
  ring1:    ['Кольцо', 'Перстень', 'Кольцо силы', 'Боевой перстень', 'Кольцо легенды'],
  ring2:    ['Кольцо', 'Перстень', 'Кольцо удачи', 'Магический перстень', 'Кольцо мастера'],
  necklace: ['Ожерелье', 'Амулет', 'Кулон', 'Ожерелье силы', 'Амулет легенды'],
  trinket:  ['Талисман', 'Брошь', 'Медальон', 'Магический талисман', 'Артефакт']
};

const BASE_ITEM_STATS = {
  weapon:   { atk: 25 },
  helmet:   { hp: 60, def: 8 },
  chest:    { hp: 120, def: 18 },
  gloves:   { atk: 8, speed: 4 },
  boots:    { speed: 12, def: 5 },
  belt:     { hp: 80, def: 6 },
  ring1:    { atk: 12, crit: 0.02 },
  ring2:    { hp: 40, crit: 0.015 },
  necklace: { hp: 35, atk: 14 },
  trinket:  { crit: 0.03, critDmg: 0.12 }
};

const UPGRADES_DEF = [
  { id: 'atk',   name: 'Атака',    icon: '⚔️',  stat: 'atk',   baseCost: 50,  perLevel: 10 },
  { id: 'hp',    name: 'Здоровье', icon: '❤️',  stat: 'hp',    baseCost: 50,  perLevel: 50 },
  { id: 'def',   name: 'Защита',   icon: '🛡️', stat: 'def',   baseCost: 50,  perLevel: 8  },
  { id: 'speed', name: 'Скорость', icon: '💨',  stat: 'speed', baseCost: 80,  perLevel: 3  },
  { id: 'crit',  name: 'Крит',     icon: '💥',  stat: 'crit',  baseCost: 100, perLevel: 0.01 }
];

function generateItem(slot, rarity, charId) {
  const mult = RARITY[rarity].mult;
  const isWeapon = slot === 'weapon';
  const base = BASE_ITEM_STATS[slot] || { atk: 5 };
  const stats = {};
  for (const [k, v] of Object.entries(base)) {
    stats[k] = parseFloat((v * mult * (0.85 + Math.random() * 0.3)).toFixed(3));
  }

  let name, restriction = null;
  if (isWeapon && charId) {
    const char = CHARACTERS[charId];
    const wt = char.weaponType;
    const rarIdx = RARITIES.indexOf(rarity);
    name = WEAPON_NAMES[wt][rarIdx] || WEAPON_NAMES[wt][0];
    stats.atk = parseFloat((25 * mult * (0.85 + Math.random() * 0.3)).toFixed(1));
    restriction = charId;
  } else if (isWeapon) {
    const charKey = Object.keys(CHARACTERS)[Math.floor(Math.random() * 5)];
    const char = CHARACTERS[charKey];
    const wt = char.weaponType;
    const rarIdx = RARITIES.indexOf(rarity);
    name = WEAPON_NAMES[wt][rarIdx] || WEAPON_NAMES[wt][0];
    stats.atk = parseFloat((25 * mult * (0.85 + Math.random() * 0.3)).toFixed(1));
    restriction = charKey;
  } else {
    const rarIdx = RARITIES.indexOf(rarity);
    const names = ITEM_NAMES[slot] || ['Предмет'];
    name = names[rarIdx] || names[0];
  }

  return {
    id: Date.now() + '_' + Math.random().toString(36).slice(2),
    slot, rarity, name, stats, restriction,
    icon: isWeapon ? (restriction ? CHARACTERS[restriction]?.icon || '⚔️' : '⚔️') : SLOT_ICONS[slot]
  };
}

function getXpForLevel(lvl) {
  return Math.floor(100 * Math.pow(lvl, 1.5));
}

function getUpgradeCost(upgradeId, level) {
  const upg = UPGRADES_DEF.find(u => u.id === upgradeId);
  return Math.floor(upg.baseCost * Math.pow(level + 1, 1.7));
}
