const INITIAL_COINS = 120;
const CLAIMED_STORAGE_KEY = 'astra_claimed_coin_events';

function getSessionUsername() {
  try {
    const parsed = JSON.parse(localStorage.getItem('astra_edu_session') || 'null');
    return parsed?.username?.trim().toLowerCase() || 'commander';
  } catch {
    return 'commander';
  }
}

function getCoinsKey() {
  return `astra_coins_${getSessionUsername()}`;
}

function getInventoryKey() {
  return `astra_inventory_${getSessionUsername()}`;
}

function getUpgradesKey() {
  return `astra_upgrades_${getSessionUsername()}`;
}

function getClaimedSet() {
  try {
    const raw = JSON.parse(sessionStorage.getItem(CLAIMED_STORAGE_KEY) || '[]');
    return new Set(Array.isArray(raw) ? raw : []);
  } catch {
    return new Set();
  }
}

function saveClaimedSet(set) {
  try {
    sessionStorage.setItem(CLAIMED_STORAGE_KEY, JSON.stringify(Array.from(set).slice(-120)));
  } catch {
    // Ignore storage quota issues
  }
}

export function getCoins() {
  try {
    const raw = localStorage.getItem(getCoinsKey());
    if (raw === null) {
      localStorage.setItem(getCoinsKey(), String(INITIAL_COINS));
      return INITIAL_COINS;
    }
    const num = Number(raw);
    return Number.isFinite(num) && num >= 0 ? Math.floor(num) : INITIAL_COINS;
  } catch {
    return INITIAL_COINS;
  }
}

export function setCoins(nextAmount) {
  const safe = Math.max(0, Math.floor(Number(nextAmount) || 0));
  try {
    localStorage.setItem(getCoinsKey(), String(safe));
    window.dispatchEvent(new Event('astra_coins_change'));
  } catch {
    // Ignore storage errors
  }
  return safe;
}

export function addCoins(amount, eventId = null) {
  const value = Math.max(0, Math.floor(Number(amount) || 0));
  const current = getCoins();
  if (value <= 0) return { ok: false, balance: current, added: 0 };

  if (eventId) {
    const claimed = getClaimedSet();
    if (claimed.has(eventId)) {
      return { ok: false, balance: current, added: 0 };
    }
    claimed.add(eventId);
    saveClaimedSet(claimed);
  }

  const balance = setCoins(current + value);
  return { ok: true, balance, added: value };
}

export function spendCoins(amount) {
  const cost = Math.max(0, Math.floor(Number(amount) || 0));
  const current = getCoins();
  if (current < cost) {
    return { ok: false, balance: current };
  }
  const balance = setCoins(current - cost);
  return { ok: true, balance };
}

/* ==================== Inventory & Upgrades Persistence ==================== */

const DEFAULT_INVENTORY = {
  tools: ['scoop'], // Geological Trenching Scoop (Shovel) equipped by default
  equippedTool: 'scoop',
  modules: {}, // e.g. { solar: 1, o2: 0 }
  samples: [], // [{ id, name, category: 'soil'|'rock', mineral, planet, mediaKey, value, collectedDay }]
  totalReturnedSamples: 0,
};

export function getInventory() {
  try {
    const raw = JSON.parse(localStorage.getItem(getInventoryKey()) || 'null');
    if (!raw || typeof raw !== 'object') {
      localStorage.setItem(getInventoryKey(), JSON.stringify(DEFAULT_INVENTORY));
      return { ...DEFAULT_INVENTORY, modules: {}, samples: [] };
    }
    return {
      tools: Array.isArray(raw.tools) && raw.tools.includes('scoop') ? raw.tools : ['scoop', ...(raw.tools || [])],
      equippedTool: raw.equippedTool || 'scoop',
      modules: raw.modules && typeof raw.modules === 'object' ? raw.modules : {},
      samples: Array.isArray(raw.samples) ? raw.samples : [],
      totalReturnedSamples: Number(raw.totalReturnedSamples) || 0,
      starterKitSeeded: Boolean(raw.starterKitSeeded),
    };
  } catch {
    return { ...DEFAULT_INVENTORY, modules: {}, samples: [] };
  }
}

function saveInventory(inv) {
  try {
    localStorage.setItem(getInventoryKey(), JSON.stringify(inv));
    window.dispatchEvent(new Event('astra_inventory_change'));
  } catch {
    // Ignore storage errors
  }
  return inv;
}

/** One-time free starter modules. Saved to storage so later inventory refreshes keep them. */
export function seedStarterKit() {
  const inv = getInventory();
  if (inv.starterKitSeeded) return inv;
  inv.modules.flag_station = (inv.modules.flag_station || 0) + 1;
  inv.modules.alsep = (inv.modules.alsep || 0) + 1;
  inv.starterKitSeeded = true;
  return saveInventory(inv);
}

export function setEquippedTool(toolId) {
  const inv = getInventory();
  if (!inv.tools.includes(toolId)) return inv;
  inv.equippedTool = toolId;
  return saveInventory(inv);
}

export function unlockInventoryTool(toolId) {
  const inv = getInventory();
  if (!inv.tools.includes(toolId)) {
    inv.tools.push(toolId);
  }
  inv.equippedTool = toolId;
  return saveInventory(inv);
}

export function addInventoryModule(moduleType, count = 1) {
  const inv = getInventory();
  inv.modules[moduleType] = Math.max(0, (inv.modules[moduleType] || 0) + count);
  return saveInventory(inv);
}

export function consumeInventoryModule(moduleType) {
  const inv = getInventory();
  const current = inv.modules[moduleType] || 0;
  if (current <= 0) return { ok: false, inventory: inv };
  inv.modules[moduleType] = current - 1;
  return { ok: true, inventory: saveInventory(inv) };
}

export function addSampleToInventory(sample) {
  const inv = getInventory();
  inv.samples.push({
    uid: `smp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    ...sample,
  });
  return saveInventory(inv);
}

export function clearInventorySamples() {
  const inv = getInventory();
  const count = inv.samples.length;
  const totalValue = inv.samples.reduce((sum, s) => sum + (Number(s.value) || 25), 0);
  inv.totalReturnedSamples = (inv.totalReturnedSamples || 0) + count;
  inv.samples = [];
  saveInventory(inv);
  return { count, totalValue, totalReturnedSamples: inv.totalReturnedSamples };
}

export function getUpgrades() {
  try {
    const raw = JSON.parse(localStorage.getItem(getUpgradesKey()) || 'null');
    return raw && typeof raw === 'object' ? raw : {};
  } catch {
    return {};
  }
}

export function setUpgradeTier(upgradeKey, tier) {
  const current = getUpgrades();
  current[upgradeKey] = tier;
  try {
    localStorage.setItem(getUpgradesKey(), JSON.stringify(current));
    window.dispatchEvent(new Event('astra_upgrades_change'));
  } catch {
    // Ignore storage errors
  }
  return current;
}