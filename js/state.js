/**
 * KARMIQ — Kaam ka smart hisaab
 * Master JavaScript Logic & Application State
 * Vanilla JS + localStorage persistence + SVG QR generator + Web Audio API
 */

// =============================================================================
// 1. INITIAL STATE & CLEAN DATABASE
// =============================================================================

// Auto-clear legacy demo cache so app starts 100% fresh and clean
if (localStorage.getItem('karmiq_fresh_init_v4') !== 'true') {
  // Only clear non-global keys (preserve store registry across init)
  const registry = localStorage.getItem('karmiq_store_registry');
  const activeStore = localStorage.getItem('karmiq_active_store_id');
  localStorage.clear();
  localStorage.setItem('karmiq_fresh_init_v4', 'true');
  if (registry) localStorage.setItem('karmiq_store_registry', registry);
  if (activeStore) localStorage.setItem('karmiq_active_store_id', activeStore);
}

// =============================================================================
// MULTI-TENANT: Global keys (never namespaced — shared across all stores)
// =============================================================================
const GLOBAL_KEYS = {
  ACTIVE_STORE: 'karmiq_active_store_id',  // Which store is currently active
  STORE_REGISTRY: 'karmiq_store_registry'  // List of all registered stores
};

// Get the currently active store ID
function getActiveStoreId() {
  return localStorage.getItem(GLOBAL_KEYS.ACTIVE_STORE) || null;
}

// Set the active store ID
function setActiveStoreId(storeId) {
  if (storeId) {
    localStorage.setItem(GLOBAL_KEYS.ACTIVE_STORE, storeId);
  } else {
    localStorage.removeItem(GLOBAL_KEYS.ACTIVE_STORE);
  }
}

// Get the store registry (list of all stores)
function getStoreRegistry() {
  const data = localStorage.getItem(GLOBAL_KEYS.STORE_REGISTRY);
  return data ? JSON.parse(data) : [];
}

// Save the store registry
function saveStoreRegistry(registry) {
  localStorage.setItem(GLOBAL_KEYS.STORE_REGISTRY, JSON.stringify(registry));
}

// Register a new store in the registry
function registerStore(storeId, shopName, ownerName, phone) {
  const registry = getStoreRegistry();
  // Check if already exists
  const existing = registry.find(s => s.storeId === storeId);
  if (!existing) {
    registry.push({ storeId, shopName, ownerName, phone, createdAt: new Date().toISOString() });
    saveStoreRegistry(registry);
  }
}

// Generate a unique store ID
function generateStoreId(phone) {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).substring(2, 6);
  const phonePart = (phone || '').replace(/\D/g, '').slice(-4) || 'xxxx';
  return `${phonePart}${ts}${rand}`.toUpperCase();
}

// Dynamic STORAGE_KEYS — namespaced per active store
// If no storeId is active, falls back to old key names (backward compatibility)
function getStorageKeys() {
  const storeId = getActiveStoreId();
  const pfx = storeId ? `karmiq_store_${storeId}_` : 'karmiq_';
  return {
    SHOP: pfx + 'shop_settings',
    EMPLOYEES: pfx + 'employees',
    ATTENDANCE: pfx + 'attendance_today',
    BREAKS: pfx + 'breaks_today',
    PAYMENTS: pfx + 'payments_log',
    CURRENT_VIEW: pfx + 'current_view',
    ACTIVE_TAB: pfx + 'active_tab',
    SECURITY: pfx + 'security_settings',
    ATTENDANCE_DATE: pfx + 'attendance_date',
    ATTENDANCE_HISTORY: pfx + 'attendance_history',
    BREAKS_HISTORY: pfx + 'breaks_history'
  };
}

// STORAGE_KEYS now is a dynamic getter (backward compatible)
const STORAGE_KEYS = new Proxy({}, {
  get(_, key) {
    return getStorageKeys()[key];
  }
});

const DEFAULT_SECURITY_SETTINGS = {
  adminUser: 'admin',
  adminPass: 'admin123',
  ownerPin: '1234',
  currentRole: 'owner', // 'owner' | 'manager' | 'kiosk'
  managerCode: 'MGR-8842',
  managerName: 'Store Manager',
  managerPhone: '',
  managerUser: 'manager',
  managerPass: 'mgr123',
  managerUpdatedAt: '',
  isManagerRegistered: true,
  kioskCode: 'TERM-101'
};

const DEFAULT_SHOP_SETTINGS = {
  shopName: 'My Business',
  ownerName: 'Store Owner',
  phone: '',
  category: 'Shops',
  openingTime: '09:00',
  closingTime: '20:00', // 8:00 PM
  dailyTargetHours: 8
};

const DEFAULT_EMPLOYEES = [];
const DEFAULT_ATTENDANCE = {};
const DEFAULT_BREAKS = [];
const DEFAULT_PAYMENTS = [];
