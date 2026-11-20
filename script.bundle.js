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


// =============================================================================
// 2. DATA ACCESS & STORAGE HELPERS
// =============================================================================

function getShopSettings() {
  const data = localStorage.getItem(STORAGE_KEYS.SHOP);
  return data ? JSON.parse(data) : DEFAULT_SHOP_SETTINGS;
}

function saveShopSettings(data) {
  if (data && data.preventDefault) data.preventDefault();
  const current = getShopSettings();
  const updated = {
    shopName: document.getElementById('setShopName').value.trim() || current.shopName || DEFAULT_SHOP_SETTINGS.shopName,
    ownerName: document.getElementById('setOwnerName').value.trim() || current.ownerName || DEFAULT_SHOP_SETTINGS.ownerName,
    phone: document.getElementById('setPhone').value.trim() || current.phone || '',
    category: document.getElementById('setCategory').value || current.category || 'Shops',
    openingTime: current.openingTime || '09:00',
    closingTime: current.closingTime || '20:00',
    dailyTargetHours: current.dailyTargetHours || 8
  };
  localStorage.setItem(STORAGE_KEYS.SHOP, JSON.stringify(updated));
  // ☁️ Supabase sync
  const storeId = getActiveStoreId();
  if (storeId) dbUpdateStore(storeId, updated).catch(console.warn);
  updateShopDisplayElements();
  showToast('Business details updated successfully!', 'success');
  return false;
}

function saveTimingSettings(e) {
  if (e && e.preventDefault) e.preventDefault();
  const current = getShopSettings();
  current.openingTime = document.getElementById('setOpeningTime').value || '09:00';
  current.closingTime = document.getElementById('setClosingTime').value || '20:00';
  current.dailyTargetHours = parseInt(document.getElementById('setDailyTarget').value, 10) || 8;
  const graceInput = document.getElementById('setGraceMinutes');
  const fineSelect = document.getElementById('setLateFineMode');
  if (graceInput) current.graceMinutes = parseInt(graceInput.value, 10) || 15;

  if (fineSelect) {
    if (fineSelect.value !== 'none' && getActivePlan() === 'free') {
      openFeaturePaywall('late_fine');
      fineSelect.value = 'none';
      current.lateFineMode = 'none';
      showToast('⚠️ Smart Late-Fine rules DUKANDAAR PRO feature hain!', 'warning');
      return false;
    }
    current.lateFineMode = fineSelect.value || 'none';
  }

  localStorage.setItem(STORAGE_KEYS.SHOP, JSON.stringify(current));
  // ☁️ Supabase sync
  const storeId = getActiveStoreId();
  if (storeId) dbUpdateStore(storeId, current).catch(console.warn);
  updateShopDisplayElements();
  renderAllViews();
  showToast('Shop shift timings & late rules saved!', 'success');
  return false;
}

function getEmployees() {
  const data = localStorage.getItem(STORAGE_KEYS.EMPLOYEES);
  return data ? JSON.parse(data) : DEFAULT_EMPLOYEES;
}

function saveEmployees(list) {
  localStorage.setItem(STORAGE_KEYS.EMPLOYEES, JSON.stringify(list));
  // ☁️ Supabase sync (fire & forget)
  const storeId = getActiveStoreId();
  if (storeId) dbSyncEmployees(storeId, list).catch(console.warn);
}

// =============================================================================
// 2A. REAL-TIME SHOP LIFECYCLE & DAILY DATE ROLLOVER
// =============================================================================

function getLocalDateString(dateObj = new Date()) {
  const y = dateObj.getFullYear();
  const m = String(dateObj.getMonth() + 1).padStart(2, '0');
  const d = String(dateObj.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Checks if current time is at or after shop closing time (e.g. 8:00 PM).
 * Between closing time and 12:00 AM midnight, the shop is CLOSED for the day.
 */
function isShopClosedNow() {
  const shop = getShopSettings();
  const [closeH, closeM] = (shop.closingTime || '20:00').split(':').map(Number);
  const now = new Date();
  const currentTotalMins = now.getHours() * 60 + now.getMinutes();
  const closeTotalMins = (closeH || 20) * 60 + (closeM || 0);
  return currentTotalMins >= closeTotalMins;
}

/**
 * Checks if calendar date has changed since last attendance was recorded.
 * If a new day has arrived (past 12:00 AM midnight):
 * 1. Archives previous day's attendance & breaks to history.
 * 2. Resets today's attendance to {} so EVERY employee is automatically Absent.
 * 3. Subah jab staff dukaan aayega aur scan karega, tabhi vo Present hoga.
 */
function checkAndRolloverDate() {
  const todayStr = getLocalDateString();
  const recordedDate = localStorage.getItem(STORAGE_KEYS.ATTENDANCE_DATE);

  if (!recordedDate) {
    localStorage.setItem(STORAGE_KEYS.ATTENDANCE_DATE, todayStr);
    return false;
  }

  if (recordedDate !== todayStr) {
    console.log(`🌅 Agla din shuru ho gaya: ${recordedDate} → ${todayStr}. Previous day archived, today reset to Absent.`);

    // 1. Archive previous day's attendance
    const currentAtt = localStorage.getItem(STORAGE_KEYS.ATTENDANCE);
    if (currentAtt) {
      try {
        const history = JSON.parse(localStorage.getItem(STORAGE_KEYS.ATTENDANCE_HISTORY) || '{}');
        history[recordedDate] = JSON.parse(currentAtt);
        localStorage.setItem(STORAGE_KEYS.ATTENDANCE_HISTORY, JSON.stringify(history));
      } catch (e) {
        console.warn('Attendance archive error:', e);
      }
    }

    // 2. Archive previous day's breaks
    const currentBreaks = localStorage.getItem(STORAGE_KEYS.BREAKS);
    if (currentBreaks) {
      try {
        const brkHistory = JSON.parse(localStorage.getItem(STORAGE_KEYS.BREAKS_HISTORY) || '{}');
        brkHistory[recordedDate] = JSON.parse(currentBreaks);
        localStorage.setItem(STORAGE_KEYS.BREAKS_HISTORY, JSON.stringify(brkHistory));
      } catch (e) {
        console.warn('Breaks archive error:', e);
      }
    }

    // 3. Reset attendance & breaks for the new day
    localStorage.setItem(STORAGE_KEYS.ATTENDANCE, JSON.stringify({}));
    localStorage.setItem(STORAGE_KEYS.BREAKS, JSON.stringify([]));
    localStorage.setItem(STORAGE_KEYS.ATTENDANCE_DATE, todayStr);

    return true; // Rollover occurred
  }

  return false;
}

/**
 * Resolves the real-time display status of an employee:
 * - If employee is left ➔ 'Chala Gaya'
 * - If no check-in today or marked Absent ➔ '🔴 Absent'
 * - If marked Half Day ➔ '🟡 Half Day'
 * - If marked Early Leave ➔ '🚪 Left Early'
 * - If checked in today AND current time >= closing time (8:00 PM - 12:00 AM) ➔ '🏠 Day Off'
 * - If checked in today AND during shop open hours AND currently on break ➔ '🟠 Bahar Hai'
 * - If checked in today AND during shop open hours ➔ '🟢 Present'
 */
function getEmployeeEffectiveStatus(empId) {
  checkAndRolloverDate();
  const employees = getEmployees();
  const emp = employees.find(e => e.id === empId);
  if (emp && emp.isLeft) {
    return {
      key: 'Left',
      label: 'Chala Gaya',
      badgeHtml: `<span class="status-badge left-staff">🚪 Chala Gaya</span>`,
      isLeft: true,
      isDayOff: false,
      isWorking: false
    };
  }

  const attendance = getAttendance();
  const att = attendance[empId];
  const isOut = isEmployeeCurrentlyOut(empId);
  const shopClosed = isShopClosedNow();

  // If no attendance record, or marked Absent, or no checkInTime
  if (!att || att.status === 'Absent' || !att.checkInTime) {
    return {
      key: 'Absent',
      label: 'Absent',
      badgeHtml: `<span class="status-badge absent">🔴 Absent</span>`,
      isAbsent: true,
      isDayOff: false,
      isWorking: false
    };
  }

  // If marked Half Day
  if (att.status === 'Half Day') {
    return {
      key: 'Half Day',
      label: 'Half Day',
      badgeHtml: `<span class="status-badge halfday">🟡 Half Day ${att.checkOutTime ? '(' + formatTime12h(att.checkOutTime) + ')' : ''}</span>`,
      isHalfDay: true,
      isDayOff: false,
      isWorking: false
    };
  }

  // If marked Early Leave
  if (att.status === 'Early Leave') {
    return {
      key: 'Early Leave',
      label: 'Left Early',
      badgeHtml: `<span class="status-badge early-leave">🚪 Left Early (${formatTime12h(att.checkOutTime)})</span>`,
      isEarlyLeave: true,
      isDayOff: false,
      isWorking: false
    };
  }

  // Employee was checked in today!
  // If shop closing time has passed (e.g. 8:00 PM to 12:00 AM midnight):
  if (shopClosed) {
    const shop = getShopSettings();
    const closeTimeStr = formatTime12h(shop.closingTime || '20:00');
    return {
      key: 'Day Off',
      label: 'Day Off (Shift Ended)',
      badgeHtml: `<span class="status-badge day-off" title="Dukaan ${closeTimeStr} baje band ho chuki hai. Today's shift ended.">🏠 Day Off</span>`,
      isDayOff: true,
      isWorking: false,
      wasPresentToday: true
    };
  }

  // During shop open hours:
  if (isOut) {
    return {
      key: 'Out',
      label: 'Bahar Hai',
      badgeHtml: `<span class="status-badge out-now"><span class="out-pulse-dot"></span> Bahar Hai</span>`,
      isOut: true,
      isDayOff: false,
      isWorking: true
    };
  }

  return {
    key: 'Present',
    label: 'Present',
    badgeHtml: `<span class="status-badge present">🟢 Present</span>`,
    isPresent: true,
    isDayOff: false,
    isWorking: true
  };
}

/**
 * Simulator function for Admin to test next-day rollover and 12 AM reset
 */
function simulateNextDayForTesting() {
  const current = localStorage.getItem(STORAGE_KEYS.ATTENDANCE_DATE) || getLocalDateString();
  const d = new Date(current);
  d.setDate(d.getDate() - 1);
  const yesterdayStr = getLocalDateString(d);
  localStorage.setItem(STORAGE_KEYS.ATTENDANCE_DATE, yesterdayStr);
  checkAndRolloverDate();
  renderAllViews();
  playSound('info');
  showToast('🌅 New Day Simulated! Agle din ke liye sabhi staff automatically Absent hain jab tak vo check-in na karein.', 'info');
}

function getAttendance() {
  checkAndRolloverDate();
  const data = localStorage.getItem(STORAGE_KEYS.ATTENDANCE);
  return data ? JSON.parse(data) : DEFAULT_ATTENDANCE;
}

function saveAttendance(att) {
  const todayStr = getLocalDateString();
  localStorage.setItem(STORAGE_KEYS.ATTENDANCE_DATE, todayStr);
  localStorage.setItem(STORAGE_KEYS.ATTENDANCE, JSON.stringify(att));
  // ☁️ Supabase sync (fire & forget)
  const storeId = getActiveStoreId();
  if (storeId) dbSyncAttendance(storeId, att).catch(console.warn);
}

function getBreaks() {
  const data = localStorage.getItem(STORAGE_KEYS.BREAKS);
  return data ? JSON.parse(data) : DEFAULT_BREAKS;
}

function saveBreaks(brks) {
  localStorage.setItem(STORAGE_KEYS.BREAKS, JSON.stringify(brks));
  // ☁️ Supabase sync (fire & forget)
  const storeId = getActiveStoreId();
  if (storeId) dbSyncBreaks(storeId, brks).catch(console.warn);
}

function getPayments() {
  const data = localStorage.getItem(STORAGE_KEYS.PAYMENTS);
  return data ? JSON.parse(data) : DEFAULT_PAYMENTS;
}

function savePayments(pays) {
  localStorage.setItem(STORAGE_KEYS.PAYMENTS, JSON.stringify(pays));
  // ☁️ Supabase sync (fire & forget)
  const storeId = getActiveStoreId();
  if (storeId) dbSyncPayments(storeId, pays).catch(console.warn);
}

// Reset Database helper
function resetPrototypeData() {
  if (confirm('Are you sure you want to clear all data and start fresh?')) {
    localStorage.clear();
    initApp();
    showToast('All data cleared successfully!', 'info');
  }
}

// =============================================================================
// 2B. HELPER: Is employee currently out on break (went out, not back yet)?
// =============================================================================
function isEmployeeCurrentlyOut(empId) {
  const breaks = getBreaks();
  return breaks.some(b => b.empId === empId && b.outTime && !b.backTime);
}

function getCurrentOutBreak(empId) {
  const breaks = getBreaks();
  return breaks.find(b => b.empId === empId && b.outTime && !b.backTime) || null;
}

// Mark employee as returned from break (sets backTime to now)
function markEmployeeReturned(empId) {
  const breaks = getBreaks();
  const now = new Date();
  const hh = now.getHours().toString().padStart(2, '0');
  const mm = now.getMinutes().toString().padStart(2, '0');
  const updated = breaks.map(b => {
    if (b.empId === empId && b.outTime && !b.backTime) {
      return { ...b, backTime: `${hh}:${mm}` };
    }
    return b;
  });
  saveBreaks(updated);
  renderAllViews();
  const employees = getEmployees();
  const emp = employees.find(e => e.id === empId);
  showToast(`${emp ? emp.name : empId} wapas aa gaye! ✓`, 'success');
  playSound('success');
}

// Toggle Mark Employee as Left (Chala Gaya)
function markEmployeeAsLeft(empId) {
  const employees = getEmployees();
  const emp = employees.find(e => e.id === empId);
  if (!emp) return;

  if (emp.isLeft) {
    // Restore employee
    if (!confirm(`${emp.name} ko wapas active karna chahte hain?`)) return;
    emp.isLeft = false;
    emp.leftDate = null;
    saveEmployees(employees);
    renderAllViews();
    showToast(`${emp.name} ko active staff mein wapas add kar diya!`, 'success');
  } else {
    // Mark as left
    if (!confirm(`Kya ${emp.name} ne job chhod di hai? Unhe "Chala Gaya" mark karein?`)) return;
    const today = new Date().toISOString().slice(0, 10);
    emp.isLeft = true;
    emp.leftDate = today;
    saveEmployees(employees);
    renderAllViews();
    showToast(`${emp.name} ko "Chala Gaya" mark kar diya gaya.`, 'warning');
  }
}

// =============================================================================
// 3. CORE BUSINESS LOGIC (Working Hours & Salary Calculations)
// =============================================================================

/**
 * Calculates working time for an employee today.
 * Rule: Check-in once, closing time (or current time if earlier) ends the day.
 * Break duration is deducted. No overtime.
 */
function calculateWorkingHours(empId) {
  const attendance = getAttendance();
  const shop = getShopSettings();
  const record = attendance[empId];
  const effStatus = getEmployeeEffectiveStatus(empId);

  if (!record || record.status === 'Absent' || !record.checkInTime) {
    return {
      minutes: 0,
      hours: 0,
      mins: 0,
      text: '0h 00m',
      progressPct: 0,
      status: effStatus.key,
      effectiveStatus: effStatus,
      checkInTime: null,
      checkOutTime: null,
      breaksDeducted: 0
    };
  }

  const [inH, inM] = record.checkInTime.split(':').map(Number);
  const [closeH, closeM] = (shop.closingTime || '20:00').split(':').map(Number);

  const inTotalMins = (inH || 0) * 60 + (inM || 0);
  const closeTotalMins = (closeH || 20) * 60 + (closeM || 0);

  const now = new Date();
  const currentTotalMins = now.getHours() * 60 + now.getMinutes();

  let endTotalMins = closeTotalMins;

  // If staff left early / checked out / marked half-day with departure time
  if (record.checkOutTime) {
    const [outH, outM] = record.checkOutTime.split(':').map(Number);
    endTotalMins = Math.min(closeTotalMins, (outH || 0) * 60 + (outM || 0));
  } else if (!isShopClosedNow()) {
    // During shop hours, live calculation up to current time (capped at closing time)
    endTotalMins = Math.min(closeTotalMins, currentTotalMins);
  } else {
    // If shop is closed for the day:
    if (inTotalMins >= closeTotalMins) {
      endTotalMins = Math.max(inTotalMins, currentTotalMins);
    }
  }

  let rawWorkedMins = Math.max(0, endTotalMins - inTotalMins);

  // If status is Half Day and no checkout time explicitly provided, default to half of target shift
  if (record.status === 'Half Day' && !record.checkOutTime) {
    const targetDailyMins = (shop.dailyTargetHours || 8) * 60;
    rawWorkedMins = Math.round(targetDailyMins / 2);
  }

  // Deduct breaks for this employee today
  const breaks = getBreaks().filter(b => b.empId === empId);
  let breakDeductionMins = 0;
  breaks.forEach(b => {
    if (b.outTime && b.backTime) {
      const [oH, oM] = b.outTime.split(':').map(Number);
      const [bH, bM] = b.backTime.split(':').map(Number);
      const diff = (bH * 60 + bM) - (oH * 60 + oM);
      if (diff > 0) breakDeductionMins += diff;
    }
  });

  const netWorkedMins = Math.max(0, rawWorkedMins - breakDeductionMins);
  const hours = Math.floor(netWorkedMins / 60);
  const mins = netWorkedMins % 60;
  const targetMins = (shop.dailyTargetHours || 8) * 60;
  const progressPct = Math.min(100, Math.round((netWorkedMins / targetMins) * 100));

  return {
    minutes: netWorkedMins,
    hours,
    mins,
    text: `${hours}h ${mins.toString().padStart(2, '0')}m`,
    progressPct,
    status: effStatus.key,
    effectiveStatus: effStatus,
    checkInTime: record.checkInTime,
    checkOutTime: record.checkOutTime || null,
    breaksDeducted: breakDeductionMins
  };
}

/**
 * Calculates salary balance for a staff member (Monthly Salary, Paid so far, Remaining Due)
 */
function calculateSalaryBalance(empId) {
  const employees = getEmployees();
  const emp = employees.find(e => e.id === empId);
  if (!emp) return { salary: 0, paid: 0, due: 0, progressPct: 0, payments: [] };

  const payments = getPayments().filter(p => p.empId === empId);
  const totalPaid = payments.reduce((sum, p) => sum + Number(p.amount), 0);
  const due = Math.max(0, emp.salary - totalPaid);
  const progressPct = emp.salary > 0 ? Math.min(100, Math.round((totalPaid / emp.salary) * 100)) : 0;

  return {
    salary: emp.salary,
    paid: totalPaid,
    due,
    progressPct,
    payments
  };
}

// =============================================================================
// 4. EMBEDDED SVG QR CODE GENERATOR (Pure Vanilla JS, Crisp Vector)
// =============================================================================

/**
 * Generates an authentic, crisp and 100% scannable QR Code representation.
 * Encodes the standard string "KARMIQ:<EMP_ID>"
 */
function generateEmployeeQR(empId, size = 130) {
  const text = `KARMIQ:${empId}`;

  // 1. Use Karmiq Pure-JS ISO/IEC 18004 Standard QR Engine
  if (window.KarmiqQrGenerator && typeof window.KarmiqQrGenerator.generateSvg === 'function') {
    return window.KarmiqQrGenerator.generateSvg(text, size);
  }

  // 2. QRCode.js fallback if available
  if (typeof QRCode !== 'undefined') {
    try {
      const container = document.createElement('div');
      new QRCode(container, {
        text: text,
        width: size,
        height: size,
        colorDark: '#0f172a',
        colorLight: '#ffffff'
      });
      const canvas = container.querySelector('canvas');
      if (canvas) {
        return `<img src="${canvas.toDataURL()}" width="${size}" height="${size}" alt="QR ${empId}" style="display:block; border-radius:8px; border:1px solid #cbd5e1; background:#fff; padding:6px; box-shadow:0 2px 6px rgba(0,0,0,0.06);" />`;
      }
    } catch (e) {}
  }

  return `<div style="width:${size}px; height:${size}px; background:#fff; border:1px solid #cbd5e1; border-radius:8px; display:flex; align-items:center; justify-content:center; font-weight:700; font-size:0.75rem;">${empId}</div>`;
}

// =============================================================================
// 5. AUDIO FEEDBACK (Synthesized via Web Audio API)
// =============================================================================

function playSound(type = 'success') {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);

    const now = ctx.currentTime;
    if (type === 'success') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, now); // D5
      osc.frequency.setValueAtTime(880, now + 0.1); // A5
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
      osc.start(now);
      osc.stop(now + 0.35);
    } else if (type === 'duplicate') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(220, now);
      osc.frequency.setValueAtTime(180, now + 0.12);
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
      osc.start(now);
      osc.stop(now + 0.28);
    }
  } catch (err) {
    console.log('Audio Context unavailable');
  }
}

// =============================================================================
// 6. VIEW & TAB NAVIGATION SYSTEM
// =============================================================================

function switchView(viewName) {
  const landing = document.getElementById('landingPage');
  const dashboard = document.getElementById('dashboardApp');

  if (viewName === 'dashboard') {
    landing.style.display = 'none';
    dashboard.style.display = 'flex';
    document.body.className = 'theme-dashboard';
    window.scrollTo({ top: 0, behavior: 'instant' });
    renderAllViews();
    localStorage.setItem(STORAGE_KEYS.CURRENT_VIEW, 'dashboard');
  } else {
    dashboard.style.display = 'none';
    landing.style.display = 'block';
    document.body.className = 'theme-landing';
    window.scrollTo({ top: 0, behavior: 'smooth' });
    localStorage.setItem(STORAGE_KEYS.CURRENT_VIEW, 'landing');
  }
}

function enterDashboard(targetTab = 'overview') {
  switchView('dashboard');
  if (targetTab) {
    switchTab(targetTab);
  }
}

function switchTab(tabId) {
  // Prevent manager from accessing financial tabs
  if (typeof getCurrentRole === 'function' && getCurrentRole() === 'manager') {
    if (tabId === 'salary' || tabId === 'reports' || tabId === 'aaj-ka-hisaab') {
      showToast('Restricted: Manager cannot access salary ledgers or financial reports.', 'warning');
      tabId = 'overview';
    }
  }

  // Update sidebar active classes
  document.querySelectorAll('.sidebar-nav .nav-item').forEach(item => {
    item.classList.toggle('active', item.getAttribute('data-tab') === tabId);
  });

  // Update mobile bottom nav active classes
  document.querySelectorAll('.mobile-bottom-nav .bottom-nav-item').forEach(item => {
    item.classList.toggle('active', item.getAttribute('data-tab') === tabId);
  });

  // Switch active pane
  document.querySelectorAll('.dash-tab-pane').forEach(pane => {
    pane.classList.toggle('active', pane.id === `pane-${tabId}`);
  });

  localStorage.setItem(STORAGE_KEYS.ACTIVE_TAB, tabId);
  toggleSidebar(false);

  // Stop camera when moving away from scanner tab to save battery/resources
  if (tabId !== 'scanner' && typeof stopLiveCameraScanner === 'function') {
    stopLiveCameraScanner();
  }

  // Render specific tab view content
  if (tabId === 'overview') renderOverview();
  else if (tabId === 'employees') renderEmployees();
  else if (tabId === 'scanner') setupScannerTab();
  else if (tabId === 'attendance') renderAttendancePane();
  else if (tabId === 'salary') renderSalaryPane();
  else if (tabId === 'reports') renderReports();
  else if (tabId === 'aaj-ka-hisaab') renderAajKaHisaabPane();
  else if (tabId === 'settings') populateSettingsForm();
}

function toggleSidebar(open) {
  const sidebar = document.getElementById('dashSidebar');
  if (sidebar) {
    sidebar.classList.toggle('open', open);
  }
}

// Mobile Hamburger Menu for Landing
const hamburgerBtn = document.getElementById('hamburgerBtn');
const mobileNav = document.getElementById('mobileNav');

if (hamburgerBtn && mobileNav) {
  hamburgerBtn.addEventListener('click', () => {
    mobileNav.classList.toggle('open');
  });
}

function closeMobileNav() {
  if (mobileNav) mobileNav.classList.remove('open');
}

// =============================================================================
// 7. TOAST NOTIFICATIONS & MODAL CONTROLS
// =============================================================================

function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  
  let icon = 'ℹ️';
  if (type === 'success') icon = '✓';
  if (type === 'warning') icon = '⚠️';

  toast.innerHTML = `<span>${icon}</span> <span>${message}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100%)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.add('open');
    document.body.style.overflow = 'hidden';
  }
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.remove('open');
    document.body.style.overflow = '';
  }
}

// Close modals when clicking backdrop
document.addEventListener('click', (e) => {
  if (e.target.classList.contains('modal-overlay')) {
    e.target.classList.remove('open');
    document.body.style.overflow = '';
  }
});

// =============================================================================
// 8. PRICING TOGGLE & PLAN SELECTION
// =============================================================================

let isAnnualPricing = false;

function togglePricing() {
  isAnnualPricing = !isAnnualPricing;
  const toggleBtn = document.getElementById('pricingToggle');
  const monthlyLabel = document.getElementById('monthlyLabel');
  const annualLabel = document.getElementById('annualLabel');
  
  const proAmount = document.getElementById('proPriceAmount');
  const proPeriod = document.getElementById('proPricePeriod');
  const bizAmount = document.getElementById('bizPriceAmount');
  const bizPeriod = document.getElementById('bizPricePeriod');

  if (isAnnualPricing) {
    toggleBtn.classList.add('annual');
    annualLabel.classList.add('active');
    monthlyLabel.classList.remove('active');
    if (proAmount) proAmount.textContent = '999';
    if (proPeriod) proPeriod.textContent = '/ year';
    if (bizAmount) bizAmount.textContent = '1,999';
    if (bizPeriod) bizPeriod.textContent = '/ year';
  } else {
    toggleBtn.classList.remove('annual');
    monthlyLabel.classList.add('active');
    annualLabel.classList.remove('active');
    if (proAmount) proAmount.textContent = '99';
    if (proPeriod) proPeriod.textContent = '/ month';
    if (bizAmount) bizAmount.textContent = '199';
    if (bizPeriod) bizPeriod.textContent = '/ month';
  }
}

function selectPlan(planName) {
  openDemoAuth('signup', planName);
}

function openDemoAuth(mode = 'login', planName = 'Free') {
  if (mode === 'signup') {
    openSignUpModal();
    return;
  }
  const authTitle = document.getElementById('authModalTitle');
  const authSub = document.getElementById('authModalSub');
  if (authTitle) authTitle.textContent = 'Login to Karmiq';
  if (authSub) authSub.textContent = 'Select your role to access your store with role-based permissions';
  setAuthRoleTab('owner');
  openModal('demoAuthModal');
}

function setAuthRoleTab(role) {
  const tabs = document.querySelectorAll('.auth-role-tab-btn');
  tabs.forEach(btn => btn.classList.remove('active'));

  const activeBtn = document.getElementById(`authTab${role.charAt(0).toUpperCase() + role.slice(1)}`);
  if (activeBtn) activeBtn.classList.add('active');

  const panels = document.querySelectorAll('.auth-role-panel');
  panels.forEach(p => p.classList.remove('active'));

  const activePanel = document.getElementById(`${role}AuthForm`);
  if (activePanel) activePanel.classList.add('active');
}

function fillAuthCredentials(role) {
  const sec = getSecuritySettings();
  if (role === 'owner') {
    if (document.getElementById('authOwnerPhone')) document.getElementById('authOwnerPhone').value = sec.adminUser || 'admin';
    if (document.getElementById('authOwnerPin')) document.getElementById('authOwnerPin').value = sec.adminPass || sec.ownerPin || 'admin123';
  } else if (role === 'manager') {
    if (document.getElementById('authManagerId')) document.getElementById('authManagerId').value = sec.managerUser || 'manager';
    if (document.getElementById('authManagerPass')) document.getElementById('authManagerPass').value = sec.managerPass || 'mgr123';
  } else if (role === 'kiosk') {
    if (document.getElementById('authKioskCode')) document.getElementById('authKioskCode').value = sec.kioskCode || 'TERM-101';
  }
}

async function handleOwnerAuthLogin(e) {
  e.preventDefault();
  const userInput = (document.getElementById('authOwnerPhone').value || '').trim();
  const passInput = (document.getElementById('authOwnerPin').value || '').trim();

  // Show loading
  const btn = e.target?.querySelector('button[type="submit"]');
  if (btn) { btn.disabled = true; btn.textContent = 'Logging in...'; }

  // ===== TRY SUPABASE FIRST =====
  const { storeId, store, error: dbErr } = await dbLoginAdmin(userInput, passInput);

  if (btn) { btn.disabled = false; btn.textContent = 'Login as Admin'; }

  if (!dbErr || dbErr === 'no_stores') {
    if (storeId) {
      // ✅ Supabase login success
      setActiveStoreId(storeId);
      registerStore(storeId, store?.shop_name || 'My Store', store?.owner_name || '', store?.phone || '');
      const sec = getSecuritySettings();
      sec.currentRole = 'owner';
      saveSecuritySettings(sec);
      closeModal('demoAuthModal');
      playSound('success');
      showToast(`Welcome back! 👑 ${store?.owner_name || 'Store Owner'}`, 'success');
      enterDashboard('overview');
      dbSyncFromCloud(storeId).catch(console.warn);
      return;
    }
  } else if (dbErr !== 'invalid_credentials' && dbErr !== 'not_connected') {
    console.warn('Supabase login error:', dbErr);
  }

  if (dbErr === 'invalid_credentials') {
    playSound('error');
    showToast('Invalid credentials! Sahi username aur password daalo.', 'warning');
    return;
  }

  // ===== FALLBACK: Local registry search =====
  const registry = getStoreRegistry();
  if (registry.length > 0) {
    let matchedStoreId = null;
    for (const storeEntry of registry) {
      const origId = getActiveStoreId();
      setActiveStoreId(storeEntry.storeId);
      const storeSec = getSecuritySettings();
      setActiveStoreId(origId);
      const uMatch = userInput.toLowerCase() === (storeSec.adminUser || '').toLowerCase() ||
                     userInput === (storeEntry.phone || '');
      const pMatch = passInput === storeSec.adminPass || passInput === storeSec.ownerPin;
      if (uMatch && pMatch) { matchedStoreId = storeEntry.storeId; break; }
    }
    if (matchedStoreId) {
      setActiveStoreId(matchedStoreId);
      const sec = getSecuritySettings();
      sec.currentRole = 'owner';
      saveSecuritySettings(sec);
      closeModal('demoAuthModal');
      playSound('success');
      showToast(`Welcome back, ${getShopSettings().ownerName || 'Store Owner'}! 👑`, 'success');
      enterDashboard('overview');
      return;
    }
    playSound('error');
    showToast('Invalid credentials!', 'warning');
    return;
  }

  // ===== LAST FALLBACK: Default credentials =====
  const sec = getSecuritySettings();
  const ok = (userInput.toLowerCase() === (sec.adminUser || 'admin').toLowerCase() || userInput === 'admin') &&
              (passInput === sec.adminPass || passInput === sec.ownerPin || passInput === 'admin123' || passInput === '1234');
  if (!ok) { playSound('error'); showToast('Invalid Admin Credentials!', 'warning'); return; }
  sec.currentRole = 'owner';
  saveSecuritySettings(sec);
  closeModal('demoAuthModal');
  playSound('success');
  showToast('Welcome Store Owner!', 'success');
  enterDashboard('overview');
}

async function handleManagerAuthLogin(e) {
  e.preventDefault();
  const userInput = (document.getElementById('authManagerId').value || '').trim();
  const passInput = (document.getElementById('authManagerPass').value || '').trim();

  const btn = e.target?.querySelector('button[type="submit"]');
  if (btn) { btn.disabled = true; btn.textContent = 'Logging in...'; }

  // ===== TRY SUPABASE FIRST =====
  const { storeId, store, error: dbErr } = await dbLoginManager(userInput, passInput);

  if (btn) { btn.disabled = false; btn.textContent = 'Login as Manager'; }

  if (storeId) {
    setActiveStoreId(storeId);
    registerStore(storeId, store?.shop_name || 'My Store', store?.owner_name || '', store?.phone || '');
    const sec = getSecuritySettings();
    sec.currentRole = 'manager';
    saveSecuritySettings(sec);
    closeModal('demoAuthModal');
    playSound('success');
    showToast('Manager Logged In! 🧑‍💼 Attendance & Scanner active. Financial records protected.', 'info');
    enterDashboard('overview');
    dbSyncFromCloud(storeId).catch(console.warn);
    return;
  }

  if (dbErr === 'invalid_credentials') {
    playSound('error');
    showToast('Invalid Manager Credentials!', 'warning');
    return;
  }

  // ===== FALLBACK: Local registry =====
  const registry = getStoreRegistry();
  if (registry.length > 0) {
    let matchedId = null;
    for (const storeEntry of registry) {
      const origId = getActiveStoreId();
      setActiveStoreId(storeEntry.storeId);
      const storeSec = getSecuritySettings();
      setActiveStoreId(origId);
      const userMatches = userInput.toLowerCase() === (storeSec.managerUser || '').toLowerCase() ||
                          (storeSec.managerPhone && userInput === storeSec.managerPhone);
      if (userMatches && passInput === storeSec.managerPass) {
        matchedId = storeEntry.storeId; break;
      }
    }
    if (matchedId) {
      setActiveStoreId(matchedId);
      const sec = getSecuritySettings();
      sec.currentRole = 'manager';
      saveSecuritySettings(sec);
      closeModal('demoAuthModal');
      playSound('success');
      showToast('Manager Logged In!', 'info');
      enterDashboard('overview');
      return;
    }
    playSound('error');
    showToast('Invalid Manager Credentials!', 'warning');
    return;
  }

  // Last fallback
  const sec = getSecuritySettings();
  const userMatches = userInput.toLowerCase() === (sec.managerUser || 'manager').toLowerCase() ||
                      (sec.managerPhone && userInput === sec.managerPhone);
  if (!userMatches || passInput !== sec.managerPass) {
    playSound('error'); showToast('Invalid Manager Credentials!', 'warning'); return;
  }
  sec.currentRole = 'manager';
  saveSecuritySettings(sec);
  closeModal('demoAuthModal');
  playSound('success');
  showToast('Manager Logged In!', 'info');
  enterDashboard('overview');
}

async function handleKioskAuthLogin(e) {
  e.preventDefault();
  const code = (document.getElementById('authKioskCode').value || '').trim().toUpperCase();

  const btn = e.target?.querySelector('button[type="submit"]');
  if (btn) { btn.disabled = true; btn.textContent = 'Connecting...'; }

  // ===== TRY SUPABASE FIRST =====
  const { storeId, store, error: dbErr } = await dbLoginKiosk(code);

  if (btn) { btn.disabled = false; btn.textContent = 'Launch Counter Terminal'; }

  if (storeId) {
    setActiveStoreId(storeId);
    registerStore(storeId, store?.shop_name || 'My Store', store?.owner_name || '', store?.phone || '');
    const sec = getSecuritySettings();
    sec.currentRole = 'kiosk';
    saveSecuritySettings(sec);
    closeModal('demoAuthModal');
    enterDashboard('scanner');
    launchKioskTerminal();
    dbSyncFromCloud(storeId).catch(console.warn);
    return;
  }

  if (dbErr === 'invalid_credentials') {
    playSound('error');
    showToast('Invalid Terminal Code!', 'warning');
    return;
  }

  // ===== FALLBACK: Local registry =====
  const registry = getStoreRegistry();
  if (registry.length > 0) {
    let matchedId = null;
    for (const storeEntry of registry) {
      const origId = getActiveStoreId();
      setActiveStoreId(storeEntry.storeId);
      const storeSec = getSecuritySettings();
      setActiveStoreId(origId);
      const validCode = (storeSec.kioskCode || 'TERM-101').toUpperCase();
      if (code === validCode || code === storeSec.ownerPin) { matchedId = storeEntry.storeId; break; }
    }
    if (matchedId) {
      setActiveStoreId(matchedId);
      const sec = getSecuritySettings();
      sec.currentRole = 'kiosk';
      saveSecuritySettings(sec);
      closeModal('demoAuthModal');
      enterDashboard('scanner');
      launchKioskTerminal();
      return;
    }
    playSound('error');
    showToast('Invalid Terminal Code!', 'warning');
    return;
  }

  // Last fallback
  const sec = getSecuritySettings();
  const validCode = (sec.kioskCode || 'TERM-101').toUpperCase();
  if (code !== validCode && code !== (sec.ownerPin || '1234')) {
    playSound('error'); showToast(`Invalid Terminal Code!`, 'warning'); return;
  }
  sec.currentRole = 'kiosk';
  saveSecuritySettings(sec);
  closeModal('demoAuthModal');
  enterDashboard('scanner');
  launchKioskTerminal();
}

function logoutCurrentRole() {
  const currentRole = getCurrentRole();
  const sec = getSecuritySettings();
  sec.currentRole = 'owner';
  saveSecuritySettings(sec);

  switchView('landing');
  openDemoAuth('login');
  showToast(`Logged out from ${currentRole === 'manager' ? 'Manager' : currentRole === 'kiosk' ? 'Kiosk' : 'Owner'} account.`, 'info');
}

// =============================================================================
// SIGN UP FLOW (3-Step New Store Registration)
// =============================================================================

// Temp store for signup data across steps
let signupTempData = {};

function openSignUpModal() {
  // Reset all steps
  signupTempData = {};
  signupGoToStepUI(1);
  // Clear all form fields
  const fields = ['su_shopName', 'su_ownerName', 'su_phone', 'su_adminUser', 'su_adminPass', 'su_adminPin'];
  fields.forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  const credBox = document.getElementById('signupSuccessCreds');
  if (credBox) credBox.innerHTML = '';
  const loginLink = document.getElementById('signupLoginLink');
  if (loginLink) loginLink.style.display = '';
  openModal('signUpModal');
}

function signupGoToStepUI(step) {
  // Update step dots
  for (let i = 1; i <= 3; i++) {
    const dot = document.getElementById(`signupStepDot${i}`);
    if (!dot) continue;
    dot.classList.remove('active', 'completed');
    if (i < step) dot.classList.add('completed');
    else if (i === step) dot.classList.add('active');
  }
  // Update connector lines
  const lines = document.querySelectorAll('.signup-step-line');
  lines.forEach((line, idx) => {
    line.classList.toggle('done', idx + 1 < step);
  });
  // Show the correct panel
  for (let i = 1; i <= 3; i++) {
    const panel = document.getElementById(`signupPanel${i}`);
    if (panel) {
      panel.classList.remove('active');
      if (i === step) panel.classList.add('active');
    }
  }
  // Hide login link on success step
  const loginLink = document.getElementById('signupLoginLink');
  if (loginLink) loginLink.style.display = (step === 3) ? 'none' : '';
}

function signupGoToStep2(e) {
  if (e && e.preventDefault) e.preventDefault();
  const shopName = (document.getElementById('su_shopName')?.value || '').trim();
  const ownerName = (document.getElementById('su_ownerName')?.value || '').trim();
  const phone = (document.getElementById('su_phone')?.value || '').trim();
  const category = document.getElementById('su_category')?.value || 'Retail Shop';
  const employees = document.getElementById('su_employees')?.value || '1-5';

  if (!shopName || !ownerName || !phone) {
    showToast('Kripya sabhi mandatory (*) fields bharo.', 'warning');
    return;
  }
  if (phone.length < 10) {
    showToast('Valid 10-digit mobile number daalo.', 'warning');
    return;
  }

  // Save step 1 data
  signupTempData = { shopName, ownerName, phone, category, employees };
  signupGoToStepUI(2);
}

function signupGoToStep1() {
  signupGoToStepUI(1);
}

async function signupComplete(e) {
  if (e && e.preventDefault) e.preventDefault();
  const adminUser = (document.getElementById('su_adminUser')?.value || '').trim();
  const adminPass = (document.getElementById('su_adminPass')?.value || '').trim();
  const adminPin  = (document.getElementById('su_adminPin')?.value  || '').trim();

  if (!adminUser || !adminPass) {
    showToast('Admin username aur password required hai.', 'warning');
    return;
  }
  if (adminPass.length < 6) {
    showToast('Password kam se kam 6 characters ka hona chahiye.', 'warning');
    return;
  }
  if (!/^\d{4}$/.test(adminPin)) {
    showToast('Security PIN 4 numbers ka hona chahiye (e.g. 1234).', 'warning');
    return;
  }

  // Show loading state
  const btn = document.querySelector('#signupPanel2 .btn-primary');
  if (btn) { btn.disabled = true; btn.textContent = 'Registering...'; }

  // ===== SUPABASE: Register new store =====
  const { storeId: supaStoreId, error: supaErr, message: supaMsg } = await dbSignupStore({
    shopName:    signupTempData.shopName   || 'My Business',
    ownerName:   signupTempData.ownerName  || 'Store Owner',
    phone:       signupTempData.phone      || '',
    category:    signupTempData.category   || 'Retail Shop',
    adminUser,
    adminPass,
    adminPin,
    managerUser: 'manager',
    managerPass: 'mgr123',
    kioskCode:   'TERM-101'
  });

  if (btn) { btn.disabled = false; btn.textContent = 'Complete Registration'; }

  if (supaErr && supaErr !== 'not_connected') {
    showToast(supaMsg || `Registration failed: ${supaErr}`, 'warning');
    return;
  }

  // Use Supabase UUID as storeId (fallback to generated ID if offline)
  const newStoreId = supaStoreId || generateStoreId(signupTempData.phone || '');
  signupTempData.storeId = newStoreId;

  // Set as active store & save locally
  setActiveStoreId(newStoreId);

  const sec = getSecuritySettings();
  sec.adminUser = adminUser;
  sec.adminPass = adminPass;
  sec.ownerPin  = adminPin;
  saveSecuritySettings(sec);

  const shop = getShopSettings();
  shop.shopName  = signupTempData.shopName  || 'My Business';
  shop.ownerName = signupTempData.ownerName || 'Store Owner';
  shop.phone     = signupTempData.phone     || '';
  shop.category  = signupTempData.category  || 'Retail Shop';
  localStorage.setItem(STORAGE_KEYS.SHOP, JSON.stringify(shop));

  // Also register in local registry (for offline fallback)
  registerStore(newStoreId, shop.shopName, shop.ownerName, shop.phone);

  // Pre-fill success creds box
  const credBox = document.getElementById('signupSuccessCreds');
  if (credBox) {
    credBox.innerHTML = `
      <div style="font-weight:700; color:#1e40af; font-size:0.88rem; margin-bottom:0.5rem;">📋 Aapke Login Details (save kar lo):</div>
      <div class="cred-row"><span class="cred-label">🏪 Store Name</span><span class="cred-val">${shop.shopName}</span></div>
      <div class="cred-row"><span class="cred-label">👑 Admin Username</span><span class="cred-val">${adminUser}</span></div>
      <div class="cred-row"><span class="cred-label">🔑 Admin Password</span><span class="cred-val">${adminPass}</span></div>
      <div class="cred-row"><span class="cred-label">🔢 Security PIN</span><span class="cred-val">${adminPin}</span></div>
      <div class="cred-row" style="border-top:1px solid #dbeafe; margin-top:0.5rem; padding-top:0.5rem;">
        <span class="cred-label">☁️ Cloud Status</span>
        <span class="cred-val" style="color:${supaStoreId ? '#16a34a' : '#f59e0b'}">${supaStoreId ? '✅ Synced to Cloud' : '⚠️ Local Only (check internet)'}</span>
      </div>
    `;
  }

  signupGoToStepUI(3);
  playSound('success');
}

async function signupEnterDashboard() {
  const storeId = getActiveStoreId();
  const sec = getSecuritySettings();
  sec.currentRole = 'owner';
  saveSecuritySettings(sec);
  closeModal('signUpModal');
  showToast(`Welcome to Karmiq, ${signupTempData.ownerName || 'Store Owner'}! 🎉 Apna pehla staff member add karo.`, 'success');
  enterDashboard('overview');
  // Pull any existing cloud data
  if (storeId) dbSyncFromCloud(storeId).catch(console.warn);
}


function handleSaveAdminCreds(e) {
  if (e && e.preventDefault) e.preventDefault();
  const userEl = document.getElementById('setAdminUser');
  const passEl = document.getElementById('setAdminPass');
  const pinEl = document.getElementById('setAdminPin');
  if (!userEl || !passEl || !pinEl) return false;

  const newUser = userEl.value.trim();
  const newPass = passEl.value.trim();
  const newPin = pinEl.value.trim();

  if (!newUser || !newPass) {
    showToast('Admin Username & Password cannot be empty.', 'warning');
    return false;
  }
  if (!/^\d{4}$/.test(newPin)) {
    showToast('Admin Quick PIN must be exactly 4 numeric digits (e.g. 1234).', 'warning');
    return false;
  }

  const sec = getSecuritySettings();
  sec.adminUser = newUser;
  sec.adminPass = newPass;
  sec.ownerPin  = newPin;
  saveSecuritySettings(sec);

  // ☁️ Supabase sync
  const storeId = getActiveStoreId();
  if (storeId) dbUpdateAdminCreds(storeId, { username: newUser, password: newPass, pin: newPin }).catch(console.warn);

  showToast(`Admin credentials updated! Username: ${newUser} | Pass: ${newPass} | PIN: ${newPin}`, 'success');
  return false;
}

function handleSaveManagerCreds(e) {
  if (e && e.preventDefault) e.preventDefault();
  const nameEl = document.getElementById('setManagerName');
  const phoneEl = document.getElementById('setManagerPhone');
  const userEl = document.getElementById('setManagerUser');
  const passEl = document.getElementById('setManagerPass');
  if (!userEl || !passEl) return false;

  const newName = nameEl ? nameEl.value.trim() : '';
  const newPhone = phoneEl ? phoneEl.value.trim() : '';
  const newUser = userEl.value.trim();
  const newPass = passEl.value.trim();

  if (!newUser || !newPass) {
    showToast('Manager username and password cannot be empty.', 'warning');
    return false;
  }

  const sec = getSecuritySettings();
  sec.managerName = newName || 'Store Manager';
  sec.managerPhone = newPhone;
  sec.managerUser = newUser;
  sec.managerPass = newPass;
  sec.managerUpdatedAt = new Date().toISOString();
  sec.isManagerRegistered = true;
  saveSecuritySettings(sec);

  // ☁️ Supabase sync
  const storeId = getActiveStoreId();
  if (storeId) dbUpdateManagerCreds(storeId, { username: newUser, password: newPass }).catch(console.warn);

  showToast(`Manager details updated! Username: ${newUser} | Pass: ${newPass}`, 'success');
  toggleEditManagerForm(false);
  return false;
}

// Toggle between Manager Details Card and Edit Form in Settings
function toggleEditManagerForm(show) {
  const displayCard = document.getElementById('managerDetailsDisplayCard');
  const formWrap = document.getElementById('managerEditFormWrap');
  if (!displayCard || !formWrap) return;

  if (show === undefined) {
    show = formWrap.style.display === 'none';
  }

  if (show) {
    displayCard.style.display = 'none';
    formWrap.style.display = 'block';
    const sec = getSecuritySettings();
    if (document.getElementById('setManagerName')) document.getElementById('setManagerName').value = sec.managerName || 'Store Manager';
    if (document.getElementById('setManagerPhone')) document.getElementById('setManagerPhone').value = sec.managerPhone || '';
    if (document.getElementById('setManagerUser')) document.getElementById('setManagerUser').value = sec.managerUser || 'manager';
    if (document.getElementById('setManagerPass')) document.getElementById('setManagerPass').value = sec.managerPass || 'mgr123';
  } else {
    formWrap.style.display = 'none';
    displayCard.style.display = 'block';
  }
}

// Open Manager Details Modal from any view
function openManagerDetailsModal() {
  if (getActivePlan() !== 'business') {
    openFeaturePaywall('manager_role');
    return;
  }
  updateRoleDisplayElements();
  openModal('managerDetailsModal');
}

// Toggle masked password view
function toggleManagerPassVisibility(targetId) {
  const el = document.getElementById(targetId);
  const btn = document.getElementById(targetId + 'ToggleBtn');
  if (!el) return;
  const isMasked = el.getAttribute('data-masked') === 'true';
  const realPass = el.getAttribute('data-pass') || '';
  if (isMasked) {
    el.textContent = realPass;
    el.setAttribute('data-masked', 'false');
    if (btn) btn.innerHTML = '🙈';
  } else {
    el.textContent = '••••••';
    el.setAttribute('data-masked', 'true');
    if (btn) btn.innerHTML = '👁️';
  }
}

// Copy full formatted manager credentials
function copyManagerFullCreds() {
  const sec = getSecuritySettings();
  const shop = getShopSettings();
  const mgrName = sec.managerName || 'Store Manager';
  const mgrUser = sec.managerUser || 'manager';
  const mgrPass = sec.managerPass || 'mgr123';
  const pairCode = sec.managerCode || 'MGR-8842';
  const shopName = shop.shopName || 'Karmiq Store';
  const appUrl = window.location.href.split('#')[0];

  const text = `🏪 *${shopName} — Store Manager Login Details*\n\n` +
    `🧑‍💼 *Manager Name:* ${mgrName}\n` +
    `👤 *Username:* ${mgrUser}\n` +
    `🔑 *Password:* ${mgrPass}\n` +
    `📱 *Pair / Terminal Code:* ${pairCode}\n` +
    `🌐 *Login Link:* ${appUrl}\n\n` +
    `ℹ️ *Access Privileges:* Manager can mark staff attendance and scan QR codes. All salary books, loans, and financial reports are securely protected.`;

  copyTextToClipboard(text, 'Full Manager login credentials copied to clipboard!');
}

// Share credentials directly via WhatsApp
function shareManagerCredsWhatsApp() {
  const sec = getSecuritySettings();
  const shop = getShopSettings();
  const mgrName = sec.managerName || 'Store Manager';
  const mgrUser = sec.managerUser || 'manager';
  const mgrPass = sec.managerPass || 'mgr123';
  const pairCode = sec.managerCode || 'MGR-8842';
  const shopName = shop.shopName || 'Karmiq Store';
  const appUrl = window.location.href.split('#')[0];

  const text = `🏪 *${shopName} — Store Manager Login Details*\n\n` +
    `🧑‍💼 *Manager Name:* ${mgrName}\n` +
    `👤 *Username:* ${mgrUser}\n` +
    `🔑 *Password:* ${mgrPass}\n` +
    `📱 *Pair / Terminal Code:* ${pairCode}\n` +
    `🌐 *Login Link:* ${appUrl}\n\n` +
    `ℹ️ *Access:* Manager can mark attendance and scan QR codes. Salary ledgers and business financials are securely protected.`;

  const phone = (sec.managerPhone || '').replace(/\D/g, '');
  const waUrl = phone 
    ? `https://api.whatsapp.com/send?phone=91${phone.length === 10 ? phone : phone}&text=${encodeURIComponent(text)}`
    : `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;

  window.open(waUrl, '_blank');
}

// Generic clipboard helper
function copyTextToClipboard(text, successMsg = 'Copied to clipboard!') {
  if (!text) return;
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(() => {
      playSound('success');
      showToast(successMsg, 'success');
    }).catch(() => {
      prompt('Copy text:', text);
    });
  } else {
    prompt('Copy text:', text);
  }
}

function handleSaveKioskCode(e) {
  if (e && e.preventDefault) e.preventDefault();
  const codeEl = document.getElementById('setKioskCode');
  if (!codeEl) return false;

  const newCode = codeEl.value.trim().toUpperCase();
  if (!newCode) {
    showToast('Terminal authorization code cannot be empty.', 'warning');
    return false;
  }

  const sec = getSecuritySettings();
  sec.kioskCode = newCode;
  saveSecuritySettings(sec);

  // ☁️ Supabase sync
  const storeId = getActiveStoreId();
  if (storeId) dbUpdateAdminCreds(storeId, { kioskCode: newCode }).catch(console.warn);

  showToast(`Counter Terminal Code updated to: ${newCode}`, 'success');
  return false;
}

// FAQ Accordion Toggle
function toggleFaq(item) {
  item.classList.toggle('active');
}

// =============================================================================
// 9. DASHBOARD DATA RENDERING
// =============================================================================

function updateShopDisplayElements() {
  const shop = getShopSettings();
  
  const sideShopName = document.getElementById('sideShopName');
  const sideShopTiming = document.getElementById('sideShopTiming');
  const topShopName = document.getElementById('topShopName');
  const hisaabShopHeading = document.getElementById('hisaabShopHeading');
  const scannerShopName = document.getElementById('scannerShopName');
  const attShopTiming = document.getElementById('attShopTiming');
  const idCardShopName = document.getElementById('idCardShopName');

  const timingText = `${formatTime12h(shop.openingTime || '09:00')} – ${formatTime12h(shop.closingTime || '20:00')}`;

  if (sideShopName) sideShopName.textContent = shop.shopName || 'My Business';
  if (sideShopTiming) sideShopTiming.textContent = timingText;
  if (topShopName) topShopName.textContent = shop.shopName || 'My Business';
  if (hisaabShopHeading) hisaabShopHeading.textContent = shop.shopName || 'My Business';
  if (scannerShopName) scannerShopName.textContent = shop.shopName || 'My Business';
  if (attShopTiming) attShopTiming.textContent = timingText;
  if (idCardShopName) idCardShopName.textContent = shop.shopName || 'My Business';
}

function formatTime12h(timeStr) {
  if (!timeStr) return '';
  const [h, m] = timeStr.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12}:${(m || 0).toString().padStart(2, '0')} ${ampm}`;
}

function renderOverview() {
  const employees = getEmployees();
  const attendance = getAttendance();
  const payments = getPayments();

  const shopClosed = isShopClosedNow();
  let presentCount = 0;
  let dayOffCount = 0;
  let absentCount = 0;
  let halfDayCount = 0;
  let earlyLeaveCount = 0;
  let leftCount = 0;
  let outNowCount = 0;
  let totalWorkedMins = 0;

  employees.forEach(emp => {
    if (emp.isLeft) { leftCount++; return; }
    const eff = getEmployeeEffectiveStatus(emp.id);
    const wh = calculateWorkingHours(emp.id);
    totalWorkedMins += wh.minutes;

    if (eff.key === 'Day Off') {
      dayOffCount++;
    } else if (eff.key === 'Present') {
      presentCount++;
    } else if (eff.key === 'Absent') {
      absentCount++;
    } else if (eff.key === 'Half Day') {
      halfDayCount++;
    } else if (eff.key === 'Early Leave') {
      earlyLeaveCount++;
    }
    if (isEmployeeCurrentlyOut(emp.id)) outNowCount++;
  });

  // Calculate salary stats
  let totalSalary = 0;
  let totalPaid = 0;
  let paidTodaySum = 0;

  const todayStr = new Date().toISOString().slice(0, 10);
  payments.forEach(p => {
    if (p.date === todayStr) {
      paidTodaySum += Number(p.amount);
    }
  });

  employees.forEach(emp => {
    const sal = calculateSalaryBalance(emp.id);
    totalSalary += sal.salary;
    totalPaid += sal.paid;
  });

  const totalDue = Math.max(0, totalSalary - totalPaid);
  const activeStaff = employees.filter(e => !e.isLeft);

  // Update Overview Metric Cards
  const statTotalStaff = document.getElementById('statTotalStaff');
  const statPresent = document.getElementById('statPresent');
  const statPresentLbl = document.getElementById('statPresentLbl');
  const statAbsent = document.getElementById('statAbsent');
  const statHalfDay = document.getElementById('statHalfDay');
  const statOutNow = document.getElementById('statOutNow');
  const statTodayHours = document.getElementById('statTodayHours');
  const statPaidToday = document.getElementById('statPaidToday');
  const statSalaryDue = document.getElementById('statSalaryDue');
  const navEmpCount = document.getElementById('navEmpCount');

  if (statTotalStaff) statTotalStaff.textContent = `${activeStaff.length} Staff`;
  if (statPresent) {
    if (shopClosed) {
      statPresent.textContent = dayOffCount;
      if (statPresentLbl) statPresentLbl.textContent = 'Day Off (Closed)';
    } else {
      statPresent.textContent = presentCount;
      if (statPresentLbl) statPresentLbl.textContent = 'Present';
    }
  }
  if (statAbsent) statAbsent.textContent = absentCount;
  if (statHalfDay) statHalfDay.textContent = (halfDayCount + earlyLeaveCount);
  if (statOutNow) statOutNow.textContent = outNowCount;

  const totalHours = Math.floor(totalWorkedMins / 60);
  const totalMins = totalWorkedMins % 60;
  if (statTodayHours) statTodayHours.textContent = `${totalHours}h ${totalMins.toString().padStart(2, '0')}m`;
  
  const isManagerRole = (typeof getCurrentRole === 'function' && getCurrentRole() === 'manager');
  if (statPaidToday) {
    statPaidToday.innerHTML = isManagerRole ? '<span style="color:#b45309; font-size:1.1rem;">🔒 ₹••••</span>' : `₹${paidTodaySum.toLocaleString('en-IN')}`;
  }
  if (statSalaryDue) {
    statSalaryDue.innerHTML = isManagerRole ? '<span style="color:#b45309; font-size:1.1rem;">🔒 ₹••••</span>' : `₹${totalDue.toLocaleString('en-IN')}`;
  }
  if (navEmpCount) navEmpCount.textContent = activeStaff.length;

  // Render Compact Staff Status in Overview
  const staffListContainer = document.getElementById('overviewStaffList');
  if (staffListContainer) {
    if (employees.length === 0) {
      staffListContainer.innerHTML = `
        <div style="padding:2rem 1rem; text-align:center; color:var(--text-muted);">
          <div style="font-size:1.8rem; margin-bottom:0.5rem;">👥</div>
          <strong style="color:var(--text-white); font-size:0.95rem; display:block; margin-bottom:0.25rem;">No staff added yet</strong>
          <p style="font-size:0.8rem; margin-bottom:0.75rem;">Add your staff to track attendance and working hours.</p>
          <button class="btn btn-primary btn-xs" onclick="openAddEmployeeModal()">+ Add Staff</button>
        </div>
      `;
    } else {
      const topSix = employees.slice(0, 6);
      staffListContainer.innerHTML = topSix.map(emp => {
        const wh = calculateWorkingHours(emp.id);
        const initials = emp.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
        const isLeft = emp.isLeft;
        const isOut = !isLeft && isEmployeeCurrentlyOut(emp.id);

        let badgeHtml;
        if (isLeft) {
          badgeHtml = `<span class="status-badge left-staff">🚪 Chala Gaya</span>`;
        } else if (isOut) {
          badgeHtml = `<span class="status-badge out-now"><span class="out-pulse-dot"></span> Bahar Hai</span>`;
        } else if (wh.status === 'Day Off') {
          badgeHtml = `<span class="status-badge day-off" title="Dukaan band ho chuki hai. Today's shift ended.">🏠 Day Off</span>`;
        } else if (wh.status === 'Absent') {
          badgeHtml = `<span class="status-badge absent">🔴 Absent</span>`;
        } else if (wh.status === 'Half Day') {
          badgeHtml = `<span class="status-badge halfday">🟡 Half Day</span>`;
        } else if (wh.status === 'Early Leave') {
          badgeHtml = `<span class="status-badge early-leave">🚪 Left Early</span>`;
        } else {
          badgeHtml = `<span class="status-badge present">🟢 Present</span>`;
        }

        const rowStyle = isLeft ? 'opacity:0.55; filter:grayscale(0.4);' : '';

        return `
          <div class="staff-compact-item" onclick="openEmployeeDetailsModal('${emp.id}')" style="cursor:pointer; ${rowStyle}">
            <div class="staff-main-info">
              <div class="emp-avatar" style="${isLeft ? 'background:#e2e8f0; color:#94a3b8;' : ''}">${initials}</div>
              <div>
                <strong style="font-size:0.9rem; ${isLeft ? 'color:var(--text-muted); text-decoration:line-through;' : 'color:var(--text-dark);'}">${emp.name}</strong>
                <div style="font-size:0.75rem; color:var(--text-muted);">${emp.role} • ${emp.id}${isLeft ? ` • Left ${emp.leftDate || ''}` : ''}</div>
              </div>
            </div>
            <div class="staff-hours-tracker">
              ${badgeHtml}
              ${!isLeft ? `<div style="text-align:right;">
                <strong style="font-size:0.95rem; color:var(--primary-600); font-family:var(--font-heading);">${wh.text}</strong>
                <div class="staff-mini-bar">
                  <div class="staff-mini-fill" style="width: ${wh.progressPct}%;"></div>
                </div>
              </div>` : ''}
            </div>
          </div>
        `;
      }).join('');
    }
  }

  // Render Recent Advances in Overview
  const paymentsListContainer = document.getElementById('overviewPaymentsList');
  if (paymentsListContainer) {
    if (payments.length === 0) {
      paymentsListContainer.innerHTML = `
        <div style="padding:2rem 1rem; text-align:center; color:var(--text-muted);">
          <div style="font-size:1.8rem; margin-bottom:0.5rem;">💳</div>
          <strong style="color:var(--text-white); font-size:0.95rem; display:block; margin-bottom:0.25rem;">No payments recorded</strong>
          <p style="font-size:0.8rem; margin-bottom:0.75rem;">Record salary advances via Cash, UPI, or Bank transfer.</p>
          <button class="btn btn-secondary btn-xs" onclick="openPaymentModal()">+ Record Advance</button>
        </div>
      `;
    } else {
      const recent = payments.slice(-4).reverse();
      paymentsListContainer.innerHTML = recent.map(p => {
        const emp = employees.find(e => e.id === p.empId) || { name: 'Staff Member' };
        const modeClass = (p.mode || 'upi').toLowerCase();
        return `
          <div class="payment-record-item">
            <div class="pay-icon ${modeClass}">${p.mode}</div>
            <div class="pay-info">
              <div class="pay-date-mode">
                <strong style="font-size:0.85rem; color:var(--text-white);">${emp.name}</strong>
                <span class="pay-badge ${modeClass}">${p.mode}</span>
              </div>
              <span class="pay-note">${p.note || 'Salary advance'} • ${p.date}</span>
            </div>
            <div class="pay-amount">₹${Number(p.amount).toLocaleString('en-IN')}</div>
          </div>
        `;
      }).join('');
    }
  }
}

// =============================================================================
// 10. EMPLOYEES DIRECTORY & ADD EMPLOYEE MODAL
// =============================================================================

function renderEmployees() {
  const employees = getEmployees();
  const attendance = getAttendance();
  const tbody = document.getElementById('employeeTableBody');
  if (!tbody) return;

  const bannerContainer = document.getElementById('staffLimitBannerContainer');
  const plan = getActivePlan();
  if (bannerContainer) {
    if (plan === 'free' && employees.length >= 3) {
      bannerContainer.innerHTML = `
        <div class="free-limit-alert-bar" style="background:#fffbeb; border:1px solid #fde68a; border-radius:12px; padding:0.75rem 1rem; margin-bottom:1rem; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.5rem;">
          <div style="font-size:0.83rem; color:#92400e;">
            <strong>⚡ Free Starter Limit Reached (${employees.length}/3 Staff):</strong> Naye staff add karne aur WhatsApp slips bhejne ke liye Dukandaar PRO activate karein.
          </div>
          <button type="button" class="btn btn-primary btn-xs" onclick="openUpiPaymentModal('pro')" style="background:#16a34a; border-color:#15803d; font-weight:800; padding:0.35rem 0.75rem;">
            ⚡ Upgrade to PRO (₹99/mo) &rarr;
          </button>
        </div>
      `;
    } else {
      bannerContainer.innerHTML = '';
    }
  }

  if (employees.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" style="text-align:center; padding:3.5rem 1rem; color:var(--text-muted);">
          <div style="font-size:2.2rem; margin-bottom:0.5rem;">👥</div>
          <strong style="font-size:1.1rem; color:var(--text-white); display:block; margin-bottom:0.35rem;">No Staff Members Added Yet</strong>
          <p style="font-size:0.85rem; margin-bottom:1.25rem; max-width:400px; margin-left:auto; margin-right:auto;">Add your first staff member to generate instant printable QR ID cards and start tracking attendance.</p>
          <button class="btn btn-primary btn-sm" onclick="openAddEmployeeModal()">+ Add Your First Staff</button>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = employees.map(emp => {
    const att = attendance[emp.id] || { status: 'Absent' };
    const wh = calculateWorkingHours(emp.id);
    const sal = calculateSalaryBalance(emp.id);
    const initials = emp.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
    const isLeft = emp.isLeft;
    const isOut = !isLeft && isEmployeeCurrentlyOut(emp.id);
    const outBreak = isOut ? getCurrentOutBreak(emp.id) : null;

    const effStatus = getEmployeeEffectiveStatus(emp.id);
    let statusBadge = effStatus.badgeHtml;

    let rowClass = '';
    if (isLeft) rowClass = 'row-highlight-left';
    else if (isOut) rowClass = 'row-highlight-out';
    else if (effStatus.key === 'Day Off') rowClass = 'row-highlight-dayoff';

    let actionBtns = `
      <button class="btn btn-secondary btn-xs" onclick="openStaffIdCardModal('${emp.id}')" title="View & Print ID QR">QR ID</button>
      <button class="btn btn-primary btn-xs" onclick="openEmployeeDetailsModal('${emp.id}')">Details</button>
      <button class="btn btn-xs ${isLeft ? 'btn-primary' : 'btn-secondary'}" onclick="markEmployeeAsLeft('${emp.id}')" title="${isLeft ? 'Wapas active karein' : 'Chala Gaya mark karein'}" style="${isLeft ? '' : 'color:#b45309; border-color:#fbbf24;'}">${isLeft ? '↩ Restore' : '🚪 Left'}</button>
    `;
    if (isOut) {
      actionBtns = `
        <button class="btn-toggle-in btn" onclick="markEmployeeReturned('${emp.id}')" title="Wapas aa gaye mark karein">✓ Back</button>
        <button class="btn btn-primary btn-xs" onclick="openEmployeeDetailsModal('${emp.id}')">Details</button>
        <button class="btn btn-xs btn-secondary" onclick="markEmployeeAsLeft('${emp.id}')" style="color:#b45309; border-color:#fbbf24;">🚪 Left</button>
      `;
    }

    const nameStyle = isLeft ? 'text-decoration:line-through; color:var(--text-muted);' : 'color:var(--text-dark); font-weight:700;';
    const avatarStyle = isLeft ? 'background:#e2e8f0; color:#94a3b8;' : '';
    const subInfo = isLeft
      ? `${emp.role} • Chala Gaya: ${emp.leftDate || 'Haal hi mein'}`
      : (isOut ? `${emp.role} • Bahar: ${outBreak ? outBreak.outTime + ' se' : ''} (${outBreak ? outBreak.reason : ''})` : `${emp.role} • ${emp.phone || 'No phone'}`);

    return `
      <tr id="emp-row-${emp.id}" class="${rowClass}">
        <td>
          <div style="display:flex; align-items:center; gap:0.75rem;">
            <div class="emp-avatar" style="${avatarStyle}">${initials}</div>
            <div>
              <strong style="font-size:0.95rem; ${nameStyle}">${emp.name}</strong>
              <div style="font-size:0.75rem; color:${isLeft ? '#94a3b8' : isOut ? '#c2410c' : 'var(--text-muted)'};">${subInfo}</div>
            </div>
          </div>
        </td>
        <td><span style="font-family:monospace; font-weight:700; color:${isLeft ? '#94a3b8' : 'var(--primary-700)'};">${emp.id}</span></td>
        <td>${statusBadge}</td>
        <td>
          ${isLeft
            ? `<span style="color:#94a3b8; font-size:0.85rem;">—</span>`
            : `<strong style="color:var(--primary-600); font-family:var(--font-heading);">${wh.text}</strong>
               <div style="font-size:0.7rem; color:var(--text-muted);">Target: 8h</div>`
          }
        </td>
        <td><strong style="color:${isLeft ? '#94a3b8' : 'var(--text-dark)'};">${isLeft ? '—' : ((typeof getCurrentRole === 'function' && getCurrentRole() === 'manager') ? '<span style="color:#b45309;">🔒 ₹••••</span>' : '₹' + Number(emp.salary).toLocaleString('en-IN'))}</strong></td>
        <td><strong style="color:${isLeft ? '#94a3b8' : '#d97706'};">${isLeft ? '—' : ((typeof getCurrentRole === 'function' && getCurrentRole() === 'manager') ? '<span style="color:#b45309;">🔒 ₹••••</span>' : '₹' + sal.due.toLocaleString('en-IN'))}</strong></td>
        <td class="text-right">
          <div style="display:inline-flex; gap:0.4rem; flex-wrap:wrap; justify-content:flex-end;">
            ${actionBtns}
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

function filterEmployeeTable() {
  const query = (document.getElementById('employeeSearchInput').value || '').toLowerCase();
  const filter = document.getElementById('employeeStatusFilter').value;
  const employees = getEmployees();
  const attendance = getAttendance();

  employees.forEach(emp => {
    const row = document.getElementById(`emp-row-${emp.id}`);
    if (!row) return;

    const att = attendance[emp.id] || { status: 'Absent' };
    const eff = getEmployeeEffectiveStatus(emp.id);
    const isLeft = emp.isLeft;
    const isOut = isEmployeeCurrentlyOut(emp.id);

    const matchesSearch = emp.name.toLowerCase().includes(query) ||
                          (emp.role && emp.role.toLowerCase().includes(query)) ||
                          emp.id.toLowerCase().includes(query);

    let matchesStatus = false;
    if (filter === 'all') matchesStatus = true;
    else if (filter === 'Left') matchesStatus = isLeft;
    else if (filter === 'Out') matchesStatus = isOut;
    else if (filter === 'Day Off') matchesStatus = !isLeft && eff.key === 'Day Off';
    else matchesStatus = !isLeft && (eff.key === filter || att.status === filter);

    row.style.display = (matchesSearch && matchesStatus) ? '' : 'none';
  });
}

function openAddEmployeeModal() {
  const employees = getEmployees();
  if (getActivePlan() === 'free' && employees.length >= 3) {
    openFeaturePaywall('staff_limit');
    return;
  }

  const nextNum = employees.length + 1001;
  document.getElementById('empId').value = `EMP${nextNum}`;
  document.getElementById('empFullName').value = '';
  document.getElementById('empPhone').value = '';
  document.getElementById('empRole').value = '';
  document.getElementById('empSalary').value = '';
  
  const today = new Date().toISOString().slice(0, 10);
  const joinDateInput = document.getElementById('empJoinDate');
  if (joinDateInput) joinDateInput.value = today;

  openModal('addEmployeeModal');
}

function handleAddEmployee(e) {
  e.preventDefault();
  const employees = getEmployees();
  if (getActivePlan() === 'free' && employees.length >= 3) {
    openFeaturePaywall('staff_limit');
    showToast('⚠️ Free Starter limit (3 Staff) reach ho chuki hai! Unlimited staff ke liye PRO lijiye.', 'warning');
    return;
  }

  const name = document.getElementById('empFullName').value.trim();
  const phone = document.getElementById('empPhone').value.trim();
  const empId = document.getElementById('empId').value.trim().toUpperCase();
  const role = document.getElementById('empRole').value.trim() || 'Staff';
  const joinDate = document.getElementById('empJoinDate').value || new Date().toISOString().slice(0, 10);
  const salary = Number(document.getElementById('empSalary').value);

  if (!name || !empId || !salary) {
    showToast('Please fill all required fields (Name, ID, Salary)', 'warning');
    return;
  }

  if (employees.some(emp => emp.id === empId)) {
    showToast(`Employee ID ${empId} already exists. Use a unique ID.`, 'warning');
    return;
  }

  const newEmp = { id: empId, name, role, phone, joinDate, salary };
  employees.push(newEmp);
  saveEmployees(employees);

  closeModal('addEmployeeModal');
  window.lastCreatedEmpId = empId;

  // Show Success creation preview
  const previewDiv = document.getElementById('createdEmpPreview');
  if (previewDiv) {
    previewDiv.innerHTML = `
      <div style="display:flex; align-items:center; justify-content:center; gap:1.25rem;">
        <div>${generateEmployeeQR(empId, 100)}</div>
        <div style="text-align:left;">
          <h4 style="color:var(--text-white); font-size:1.1rem; margin-bottom:0.25rem;">${name}</h4>
          <div style="color:var(--primary-500); font-weight:700; font-size:0.85rem;">${empId} • ${role}</div>
          <div style="font-size:0.8rem; color:var(--text-muted); margin-top:0.35rem;">Monthly Salary: ₹${salary.toLocaleString('en-IN')}</div>
        </div>
      </div>
    `;
  }

  openModal('employeeCreatedModal');
  renderAllViews();
  showToast(`Staff member ${name} added successfully!`, 'success');
}

// =============================================================================
// 11. QR SCANNER TERMINAL & LIVE REAL-TIME CAMERA SCANNER
// =============================================================================

let liveHtml5QrScanner = null;
let isCameraScannerRunning = false;
let currentFacingMode = 'environment'; // Default to back camera for phone devices
let lastProcessedScanId = null;
let lastProcessedTime = 0;
let nativeMediaStream = null;

async function setupScannerTab() {
  const employees = getEmployees().filter(e => !e.isLeft);
  const select = document.getElementById('simEmployeeSelect');
  if (select) {
    if (employees.length === 0) {
      select.innerHTML = `<option value="">-- No active staff added --</option>`;
    } else {
      select.innerHTML = employees.map(emp => `
        <option value="${emp.id}">${emp.name} (${emp.id} - ${emp.role})</option>
      `).join('');
    }
  }

  renderScannerLog();
  // Automatically start live camera scanner when entering scanner tab
  startLiveCameraScanner();
}

async function startLiveCameraScanner() {
  if (isCameraScannerRunning) return;

  const statusText = document.getElementById('cameraStatusText');
  const statusDot = document.getElementById('cameraStatusDot');
  const btnToggleText = document.getElementById('btnToggleCameraText');
  const promptLabel = document.getElementById('cameraPromptLabel');
  const gridOverlay = document.getElementById('cameraGridOverlay');

  if (statusText) statusText.textContent = 'Connecting Camera...';
  if (statusDot) statusDot.className = 'pulse-amber';

  try {
    const videoEl = document.getElementById('cameraVideo');
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error('Camera API not supported in this browser/context');
    }

    nativeMediaStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: currentFacingMode },
      audio: false
    });
    videoEl.srcObject = nativeMediaStream;
    videoEl.style.display = 'block';
    await videoEl.play();

    isCameraScannerRunning = true;
    if (statusText) statusText.textContent = 'Camera Active • Scanning...';
    if (statusDot) statusDot.className = 'pulse-green';
    if (btnToggleText) btnToggleText.textContent = 'Stop Camera';
    if (promptLabel) promptLabel.textContent = 'POINT QR CODE AT CAMERA';
    if (gridOverlay) gridOverlay.style.opacity = '0.1';

    // Scan loop: every 200ms (lightweight, saves CPU/battery)
    const scanCanvas = document.createElement('canvas');
    const scanCtx = scanCanvas.getContext('2d', { willReadFrequently: true });
    const hasBarcodeDetector = 'BarcodeDetector' in window;
    let barcodeDetector = null;
    if (hasBarcodeDetector) {
      try { barcodeDetector = new window.BarcodeDetector({ formats: ['qr_code'] }); } catch(e) {}
    }

    const scanTick = async () => {
      if (!isCameraScannerRunning) return;
      try {
        if (videoEl.readyState >= 2 && videoEl.videoWidth > 0) {
          if (barcodeDetector) {
            // Native BarcodeDetector — fastest, no canvas needed
            const codes = await barcodeDetector.detect(videoEl);
            if (codes && codes.length > 0) handleCameraDecodedText(codes[0].rawValue);
          } else if (window.KarmiqQrGenerator && window.KarmiqQrGenerator.decodeFromVideo) {
            // Custom engine fallback
            const result = window.KarmiqQrGenerator.decodeFromVideo(videoEl, scanCanvas, scanCtx);
            if (result) handleCameraDecodedText(result);
          }
        }
      } catch (e) { /* ignore per-frame decode errors */ }
      if (isCameraScannerRunning) setTimeout(scanTick, 200);
    };
    setTimeout(scanTick, 500); // slight delay to let video settle
    return;

  } catch (err) {
    console.warn('Camera start failed:', err.message);
  }

  // Camera unavailable
  isCameraScannerRunning = false;
  if (statusText) statusText.textContent = 'Camera Unavailable';
  if (statusDot) statusDot.className = 'pulse-red';
  if (btnToggleText) btnToggleText.textContent = 'Start Camera Scanner';
  if (promptLabel) promptLabel.textContent = 'Camera blocked — use Upload QR or Manual Test below';
}

async function stopLiveCameraScanner() {
  if (liveHtml5QrScanner && isCameraScannerRunning) {
    try {
      await liveHtml5QrScanner.stop();
    } catch (e) {
      console.warn('Stop Html5Qrcode error:', e);
    }
  }

  if (nativeMediaStream) {
    nativeMediaStream.getTracks().forEach(track => track.stop());
    nativeMediaStream = null;
  }

  const videoEl = document.getElementById('cameraVideo');
  if (videoEl) {
    videoEl.srcObject = null;
    videoEl.style.display = 'none';
  }

  isCameraScannerRunning = false;
  const statusText = document.getElementById('cameraStatusText');
  const statusDot = document.getElementById('cameraStatusDot');
  const btnToggleText = document.getElementById('btnToggleCameraText');
  const promptLabel = document.getElementById('cameraPromptLabel');
  const gridOverlay = document.getElementById('cameraGridOverlay');

  if (statusText) statusText.textContent = 'Camera Paused';
  if (statusDot) statusDot.className = 'pulse-amber';
  if (btnToggleText) btnToggleText.textContent = 'Start Camera Scanner';
  if (promptLabel) promptLabel.textContent = 'CLICK START TO SCAN';
  if (gridOverlay) gridOverlay.style.opacity = '1';
}

function toggleLiveCamera() {
  if (isCameraScannerRunning) {
    stopLiveCameraScanner();
  } else {
    startLiveCameraScanner();
  }
}

async function switchLiveCamera() {
  currentFacingMode = (currentFacingMode === 'environment') ? 'user' : 'environment';
  if (isCameraScannerRunning) {
    await stopLiveCameraScanner();
    await startLiveCameraScanner();
  }
  showToast(`Switched camera mode: ${currentFacingMode === 'environment' ? 'Back / Rear Camera' : 'Front / Selfie Camera'}`, 'info');
}

// Upload QR Image Scanner Handler
async function handleQrImageUpload(event) {
  const file = event.target.files && event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async function(e) {
    const img = new Image();
    img.onload = async function() {
      // 1. Try native BarcodeDetector
      if ('BarcodeDetector' in window) {
        try {
          const detector = new window.BarcodeDetector({ formats: ['qr_code'] });
          const codes = await detector.detect(img);
          if (codes && codes.length > 0 && codes[0].rawValue) {
            handleCameraDecodedText(codes[0].rawValue);
            return;
          }
        } catch (err) {
          console.warn('BarcodeDetector image detect warning:', err);
        }
      }

      // 2. Fallback: Extract image data via canvas
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        ctx.drawImage(img, 0, 0);

        if (typeof jsQR !== 'undefined') {
          const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const code = jsQR(imgData.data, imgData.width, imgData.height);
          if (code && code.data) {
            handleCameraDecodedText(code.data);
            return;
          }
        }
      } catch (err) {
        console.warn('Canvas QR parse warning:', err);
      }

      showToast('Could not find a readable Karmiq QR code in this photo. Please try with clearer lighting or enter employee ID.', 'warning');
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
  event.target.value = '';
}

function parseEmployeeId(decodedString) {
  if (!decodedString) return '';
  const text = String(decodedString).trim();

  // Pattern 1: KARMIQ:EMP001
  if (text.startsWith('KARMIQ:')) {
    return text.replace('KARMIQ:', '').trim();
  }

  // Pattern 2: JSON payload
  try {
    const json = JSON.parse(text);
    if (json.id || json.empId || json.employeeId) {
      return (json.id || json.empId || json.employeeId).trim();
    }
  } catch (e) {}

  // Pattern 3: Direct match with existing employees
  const employees = getEmployees();
  const directMatch = employees.find(e => e.id.toLowerCase() === text.toLowerCase());
  if (directMatch) return directMatch.id;

  // Pattern 4: EMP\d+ regex
  const regexMatch = text.match(/EMP\d+/i);
  if (regexMatch) return regexMatch[0].toUpperCase();

  return text;
}

function handleCameraDecodedText(decodedText) {
  const empId = parseEmployeeId(decodedText);
  if (!empId) return;

  const now = Date.now();
  // Cooldown debounce: 3 seconds to avoid multi-beeping on the same card in front of camera
  if (empId === lastProcessedScanId && (now - lastProcessedTime < 3000)) {
    return;
  }

  lastProcessedScanId = empId;
  lastProcessedTime = now;
  processQrScan(empId);
}

function renderScannerLog() {
  const employees = getEmployees();
  const attendance = getAttendance();
  const logContainer = document.getElementById('scannerLiveLogs');
  const countBadge = document.getElementById('scannerPresentCount');

  let presentCount = 0;
  const logs = [];

  employees.forEach(emp => {
    const att = attendance[emp.id];
    if (att && att.status !== 'Absent' && att.checkInTime) {
      presentCount++;
      logs.push({
        emp,
        checkInTime: att.checkInTime,
        status: att.status,
        source: att.source || 'Live QR Scan'
      });
    }
  });

  if (countBadge) countBadge.textContent = `${presentCount} Present Today`;

  if (logContainer) {
    if (logs.length === 0) {
      logContainer.innerHTML = `<div style="padding:2rem; text-align:center; color:var(--text-muted); font-size:0.875rem;">No check-ins recorded yet today.<br><span style="font-size:0.78rem; opacity:0.8;">Scan an employee QR code to record attendance.</span></div>`;
    } else {
      logContainer.innerHTML = logs.reverse().map(item => `
        <div class="scanner-log-item">
          <div class="log-staff">
            <span style="font-size:1rem;">🟢</span>
            <div>
              <strong style="font-size:0.85rem; color:var(--text-white);">${item.emp.name}</strong>
              <div style="font-size:0.7rem; color:var(--text-muted);">${item.emp.id} • ${item.source}</div>
            </div>
          </div>
          <div class="log-time">${item.checkInTime}</div>
        </div>
      `).join('');
    }
  }
}

function triggerSimulatedScan() {
  const select = document.getElementById('simEmployeeSelect');
  if (!select || !select.value) {
    showToast('Please add a staff member first to test scanning.', 'warning');
    return;
  }
  const empId = select.value;
  processQrScan(empId);
}

function processQrScan(empId) {
  const employees = getEmployees();
  const attendance = getAttendance();
  const emp = employees.find(e => e.id.toUpperCase() === empId.toUpperCase());

  if (!emp) {
    showToast(`Unrecognized QR code (${empId}). Please scan a registered Karmiq staff QR.`, 'warning');
    return;
  }

  const existing = attendance[emp.id];
  const overlay = document.getElementById('scannerFeedbackOverlay');
  const card = document.getElementById('scannerFeedbackCard');
  const icon = document.getElementById('feedbackIcon');
  const title = document.getElementById('feedbackTitle');
  const details = document.getElementById('feedbackDetails');
  const hours = document.getElementById('feedbackHours');

  // Check duplicate prevention
  if (existing && existing.status === 'Present' && existing.checkInTime) {
    playSound('duplicate');
    if (card) card.className = 'feedback-card duplicate';
    if (icon) icon.textContent = '⚠️';
    if (title) title.textContent = 'Already Checked In';
    if (details) details.textContent = `${emp.name} is already checked in today at ${existing.checkInTime}.`;
    if (hours) hours.textContent = `Working hours tracking active for today.`;
    if (overlay) overlay.classList.add('show');
    showToast(`${emp.name} is already checked in today at ${existing.checkInTime}.`, 'warning');
    
    setTimeout(() => {
      if (overlay) overlay.classList.remove('show');
    }, 2800);
    return;
  }

  // Record Attendance
  const nowTime = new Date();
  const hoursStr = nowTime.getHours().toString().padStart(2, '0');
  const minsStr = nowTime.getMinutes().toString().padStart(2, '0');
  const checkInStamp = `${hoursStr}:${minsStr}`;

  attendance[emp.id] = {
    status: 'Present',
    checkInTime: checkInStamp,
    source: 'Live QR Camera'
  };
  saveAttendance(attendance);

  playSound('success');
  if (card) card.className = 'feedback-card';
  if (icon) icon.textContent = '✓';
  if (title) title.textContent = 'Attendance Marked Successfully';
  if (details) details.textContent = `${emp.name} • ${checkInStamp}`;
  if (hours) hours.textContent = `Working hours tracking active until shop closes`;
  if (overlay) overlay.classList.add('show');

  renderScannerLog();
  renderOverview();
  showToast(`✓ Attendance marked: ${emp.name} (${checkInStamp})`, 'success');

  setTimeout(() => {
    if (overlay) overlay.classList.remove('show');
  }, 2600);
}

// Live terminal clock updater
setInterval(() => {
  const clock = document.getElementById('terminalLiveClock');
  if (clock) {
    const d = new Date();
    clock.textContent = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
  }
}, 1000);

// =============================================================================
// 12. ATTENDANCE SHEET & BREAKS LOGIC
// =============================================================================

function renderAttendancePane() {
  const employees = getEmployees();
  const attendance = getAttendance();
  const container = document.getElementById('attendanceDetailedList');
  if (!container) return;

  if (employees.length === 0) {
    container.innerHTML = `
      <div style="text-align:center; padding:3.5rem 1rem; color:var(--text-muted);">
        <div style="font-size:2.2rem; margin-bottom:0.5rem;">⏱️</div>
        <strong style="font-size:1.1rem; color:var(--text-white); display:block; margin-bottom:0.35rem;">No Attendance Records</strong>
        <p style="font-size:0.85rem; margin-bottom:1.25rem;">Enroll staff members to start tracking attendance and work hours.</p>
        <button class="btn btn-primary btn-sm" onclick="openAddEmployeeModal()">+ Add Staff</button>
      </div>
    `;
    return;
  }

  container.innerHTML = employees.map(emp => {
    const att = attendance[emp.id] || { status: 'Absent', checkInTime: null };
    const wh = calculateWorkingHours(emp.id);
    const initials = emp.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
    const isLeft = emp.isLeft;
    const isOut = !isLeft && isEmployeeCurrentlyOut(emp.id);
    const outBreak = isOut ? getCurrentOutBreak(emp.id) : null;
    const isHalfDay = att.status === 'Half Day';
    const isEarlyLeave = att.status === 'Early Leave';

    const effStatus = getEmployeeEffectiveStatus(emp.id);
    let statusPill = effStatus.badgeHtml;

    let cardStyle = '';
    let cardBorderStyle = '';
    if (isLeft) {
      cardStyle = 'opacity: 0.6; filter: grayscale(0.3);';
      cardBorderStyle = 'border-left: 4px solid #cbd5e1;';
    } else if (isOut) {
      cardBorderStyle = 'border-left: 4px solid #f97316; background: #fffaf5;';
    } else if (effStatus.key === 'Day Off') {
      cardBorderStyle = 'border-left: 4px solid #64748b; background: #f8fafc;';
    } else if (isHalfDay) {
      cardBorderStyle = 'border-left: 4px solid #f59e0b; background: #fffdf5;';
    } else if (isEarlyLeave) {
      cardBorderStyle = 'border-left: 4px solid #3b82f6; background: #f8faff;';
    }

    const avatarStyle = isLeft ? 'background:#e2e8f0; color:#94a3b8;' : '';
    const nameStyle = isLeft ? 'color:var(--text-muted); text-decoration:line-through;' : 'color:var(--text-dark);';

    let actionBtn;
    if (isLeft) {
      actionBtn = `<button class="btn btn-primary btn-xs" onclick="markEmployeeAsLeft('${emp.id}')">↩ Restore</button>`;
    } else if (isOut) {
      actionBtn = `
        <button class="btn-toggle-in btn" onclick="markEmployeeReturned('${emp.id}')" style="margin-right:0.4rem;">✓ Wapas Aa Gaye</button>
        <button class="btn btn-secondary btn-xs" onclick="openBreakModal('${emp.id}', 'break')">+ Break Log</button>
      `;
    } else if (isHalfDay || isEarlyLeave) {
      actionBtn = `
        <button class="btn btn-secondary btn-xs" onclick="openBreakModal('${emp.id}', '${isHalfDay ? 'halfday' : 'leave'}')">✏ Timing Badlein</button>
        <button class="btn btn-secondary btn-xs" onclick="resetEmployeeToPresent('${emp.id}')" title="Wapas Full Present karein">↩ Reset to Present</button>
      `;
    } else {
      actionBtn = `
        <button class="btn btn-warning-soft btn-xs" onclick="openBreakModal('${emp.id}', 'halfday')" title="Staff beach me half day par gaya">🟡 Half Day</button>
        <button class="btn btn-secondary btn-xs" onclick="openBreakModal('${emp.id}', 'leave')" title="Staff beach me chhutti par gaya">🚪 Beach me Leave</button>
        <button class="btn btn-secondary btn-xs" onclick="openBreakModal('${emp.id}', 'break')" title="Bahar gaye / Break">+ Out/Break</button>
      `;
    }

    const outInfo = isOut && outBreak
      ? `<div style="font-size:0.75rem; color:#c2410c; font-weight:700; margin-top:0.25rem;">⏱ Bahar Gaye: ${outBreak.outTime} — ${outBreak.reason}</div>`
      : '';
    const leftInfo = isLeft
      ? `<div style="font-size:0.75rem; color:#94a3b8; margin-top:0.25rem;">Kaam Chhoda: ${emp.leftDate || 'Haal hi mein'}</div>`
      : '';
    const leaveNote = (isHalfDay || isEarlyLeave) && att.leaveReason
      ? `<div style="font-size:0.75rem; color:#b45309; font-weight:600; margin-top:0.25rem;">📝 Note: ${att.leaveReason}</div>`
      : '';

    const dayClosesOrClosed = (isHalfDay || isEarlyLeave) && att.checkOutTime
      ? `<span class="t-val text-amber">Left @ ${formatTime12h(att.checkOutTime)}</span>`
      : `<span class="t-val">${formatTime12h(getShopSettings().closingTime || '20:00')}</span>`;

    return `
      <div class="att-detail-card" style="${cardBorderStyle} ${cardStyle}">
        <div class="att-emp-block">
          <div class="emp-avatar" style="${avatarStyle}">${initials}</div>
          <div>
            <strong style="font-size:0.95rem; ${nameStyle}">${emp.name}</strong>
            <div style="font-size:0.75rem; color:var(--text-muted);">${emp.role} • ${emp.id}</div>
            ${outInfo}${leftInfo}${leaveNote}
          </div>
        </div>

        <div class="att-timing-block">
          <div class="timing-col">
            <span class="t-lbl">Today's Status</span>
            <div>${statusPill}</div>
          </div>
          <div class="timing-col">
            <span class="t-lbl">Check-In Time</span>
            <span class="t-val">${att.checkInTime ? formatTime12h(att.checkInTime) : '—'}</span>
          </div>
          <div class="timing-col">
            <span class="t-lbl">Break Deducted</span>
            <span class="t-val text-amber">${wh.breaksDeducted > 0 ? wh.breaksDeducted + ' mins' : 'None'}</span>
          </div>
          <div class="timing-col">
            <span class="t-lbl">${(isHalfDay || isEarlyLeave) ? 'Left At' : 'Day Closes At'}</span>
            ${dayClosesOrClosed}
          </div>
        </div>

        <div class="att-progress-block">
          ${isLeft
            ? `<span style="font-size:0.82rem; color:#94a3b8;">Inactive Record</span>`
            : `<div class="flex-between" style="font-size:0.8rem; margin-bottom:0.25rem;">
                <strong style="color:${isOut ? '#c2410c' : isHalfDay ? '#b45309' : 'var(--primary-600)'}; font-family:var(--font-heading); font-size:1.05rem;">${wh.text}</strong>
                <span style="color:var(--text-muted);">Target: 8h</span>
              </div>
              <div class="progress-bar-track">
                <div class="progress-bar-fill" style="width:${wh.progressPct}%; background: ${isOut ? 'linear-gradient(90deg, #f97316, #fb923c)' : isHalfDay ? 'linear-gradient(90deg, #f59e0b, #fbbf24)' : ''}"></div>
              </div>`
          }
        </div>

        <div style="display:flex; gap:0.4rem; flex-wrap:wrap; align-items:center;">
          ${actionBtn}
        </div>
      </div>
    `;
  }).join('');
}

// Live Current Time in HH:MM format (24-hour string)
function getCurrentTimeString() {
  const d = new Date();
  const hh = d.getHours().toString().padStart(2, '0');
  const mm = d.getMinutes().toString().padStart(2, '0');
  return `${hh}:${mm}`;
}

// Open modal with pre-filled live current time & selected mode
function openBreakModal(empId = '', defaultMode = 'halfday') {
  const employees = getEmployees().filter(e => !e.isLeft);
  const select = document.getElementById('breakEmpSelect');
  if (select) {
    if (employees.length === 0) {
      select.innerHTML = `<option value="">No active staff available</option>`;
    } else {
      select.innerHTML = employees.map(emp => `
        <option value="${emp.id}" ${emp.id === empId ? 'selected' : ''}>${emp.name} (${emp.id})</option>
      `).join('');
    }
  }

  // Auto-read current live time
  syncDepartureTimeToNow();
  setDepartureMode(defaultMode);
  onDepartureEmpChange();
  openModal('recordBreakModal');
}

// Set departure mode ('halfday', 'leave', 'break')
function setDepartureMode(mode) {
  const modeInput = document.getElementById('departureMode');
  if (modeInput) modeInput.value = mode;

  // Update tabs active state
  ['HalfDay', 'Leave', 'Break'].forEach(m => {
    const btn = document.getElementById(`tabMode${m}`);
    if (btn) btn.classList.remove('active');
  });

  const secDep = document.getElementById('sectionDepartureTime');
  const secBrk = document.getElementById('sectionBreakTimes');
  const sumBox = document.getElementById('departureSummaryBox');
  const submitText = document.getElementById('btnDepartureSubmitText');
  const timeLabel = document.getElementById('depTimeLabel');

  const nowStr = getCurrentTimeString();
  const nowFormatted = formatTime12h(nowStr);

  if (mode === 'halfday') {
    const btn = document.getElementById('tabModeHalfDay');
    if (btn) btn.classList.add('active');
    if (secDep) secDep.style.display = 'block';
    if (secBrk) secBrk.style.display = 'none';
    if (timeLabel) timeLabel.innerHTML = 'Half Day Departure Time (हाफ डे निकलने का समय) *';
    if (sumBox) {
      sumBox.className = 'departure-summary-box theme-halfday';
      sumBox.innerHTML = `🟡 <strong>Half Day:</strong> Staff status <b>"Half Day"</b> mark hoga aur shift iss departure time par close ho jayegi. Working hours departure time tak calculate honge.`;
    }
    if (submitText) submitText.textContent = `✓ Mark Half Day Now (${nowFormatted})`;
  } else if (mode === 'leave') {
    const btn = document.getElementById('tabModeLeave');
    if (btn) btn.classList.add('active');
    if (secDep) secDep.style.display = 'block';
    if (secBrk) secBrk.style.display = 'none';
    if (timeLabel) timeLabel.innerHTML = 'Early Leave / Departure Time (छुट्टी का समय) *';
    if (sumBox) {
      sumBox.className = 'departure-summary-box theme-leave';
      sumBox.innerHTML = `🚪 <strong>Beach me Leave:</strong> Staff ka departure time record ho jayega aur shift close ho jayegi. Aaj ka working hours iss waqt tak lock hoga.`;
    }
    if (submitText) submitText.textContent = `✓ Mark Early Leave (${nowFormatted})`;
  } else if (mode === 'break') {
    const btn = document.getElementById('tabModeBreak');
    if (btn) btn.classList.add('active');
    if (secDep) secDep.style.display = 'none';
    if (secBrk) secBrk.style.display = 'block';
    toggleBreakTimeInputs();
  }
}

// Sync departure time input fields to Current Live Clock
function syncDepartureTimeToNow() {
  const nowStr = getCurrentTimeString();
  const depTimeInput = document.getElementById('departureTimeInput');
  const breakOutTime = document.getElementById('breakOutTime');
  const breakBackTime = document.getElementById('breakBackTime');
  const liveClockDisplay = document.getElementById('depLiveClockDisplay');

  if (depTimeInput) depTimeInput.value = nowStr;
  if (breakOutTime) breakOutTime.value = nowStr;
  if (breakBackTime) {
    // Default return time +30 mins
    const [h, m] = nowStr.split(':').map(Number);
    const totalMins = h * 60 + m + 30;
    const bh = Math.floor((totalMins / 60) % 24).toString().padStart(2, '0');
    const bm = (totalMins % 60).toString().padStart(2, '0');
    breakBackTime.value = `${bh}:${bm}`;
  }

  if (liveClockDisplay) {
    liveClockDisplay.textContent = formatTime12h(nowStr);
  }
}

// Set a specific input to current time
function setFieldToCurrentTime(fieldId) {
  const field = document.getElementById(fieldId);
  if (field) {
    const nowStr = getCurrentTimeString();
    field.value = nowStr;
    showToast(`Time set to current: ${formatTime12h(nowStr)}`, 'info');
  }
}

// Toggle break inputs (Stepping out now vs Out & Returned)
function toggleBreakTimeInputs() {
  const typeNow = document.getElementById('breakTypeNow');
  const isNow = typeNow ? typeNow.checked : true;
  const backGroup = document.getElementById('breakBackTimeGroup');
  const quickChips = document.getElementById('quickDurationChips');
  const sumBox = document.getElementById('departureSummaryBox');
  const submitText = document.getElementById('btnDepartureSubmitText');

  if (isNow) {
    if (backGroup) backGroup.style.display = 'none';
    if (quickChips) quickChips.style.display = 'none';
    if (sumBox) {
      sumBox.className = 'departure-summary-box theme-break';
      sumBox.innerHTML = `⏱️ <strong>Abhi Bahar Ja Rahe Hain:</strong> Staff ka status "Bahar Hai" ho jayega. Wapas aane par 1-click <b>"Wapas Aa Gaye"</b> dabakar break band ho jayega.`;
    }
    if (submitText) submitText.textContent = `⏱️ Mark Bahar Gaye (Step Out Now)`;
  } else {
    if (backGroup) backGroup.style.display = 'block';
    if (quickChips) quickChips.style.display = 'flex';
    if (sumBox) {
      sumBox.className = 'departure-summary-box theme-break';
      sumBox.innerHTML = `⏱️ <strong>Completed Break:</strong> Bahar gaye aur wapas aane ka samay minus karke working hours calculate honge.`;
    }
    if (submitText) submitText.textContent = `Deduct Break & Update Working Hours`;
  }
}

// Quick add minutes to break return time
function addMinutesToBreak(mins) {
  const outInput = document.getElementById('breakOutTime');
  const backInput = document.getElementById('breakBackTime');
  if (!outInput || !backInput) return;
  const outTime = outInput.value || getCurrentTimeString();
  const [h, m] = outTime.split(':').map(Number);
  const total = h * 60 + m + mins;
  const bh = Math.floor((total / 60) % 24).toString().padStart(2, '0');
  const bm = (total % 60).toString().padStart(2, '0');
  backInput.value = `${bh}:${bm}`;
  showToast(`+${mins} min duration set (${bh}:${bm})`, 'info');
}

// On staff select change
function onDepartureEmpChange() {
  const select = document.getElementById('breakEmpSelect');
  if (!select || !select.value) return;
  const empId = select.value;
  const attendance = getAttendance();
  const att = attendance[empId];
  const hint = document.getElementById('departureCalcHint');
  if (hint) {
    if (att && att.checkInTime) {
      hint.textContent = `Check-in: ${formatTime12h(att.checkInTime)} — Iss departure time tak ka live working hours hisaab calculate hoga.`;
    } else {
      hint.textContent = `Staff abhi check-in nahi hai (auto 09:00 AM check-in assume kiya jayega).`;
    }
  }
}

// Main departure form submit handler
function handleDepartureSubmit(e) {
  e.preventDefault();
  const mode = document.getElementById('departureMode').value || 'halfday';
  const empId = document.getElementById('breakEmpSelect').value;
  const reason = (document.getElementById('breakReason').value || '').trim();

  if (!empId) {
    showToast('Please select a staff member', 'warning');
    return;
  }

  const employees = getEmployees();
  const emp = employees.find(e => e.id === empId);
  const empName = emp ? emp.name : empId;
  const attendance = getAttendance();
  const existingAtt = attendance[empId] || { status: 'Present', checkInTime: getShopSettings().openingTime || '09:00' };

  if (mode === 'halfday') {
    const depTime = document.getElementById('departureTimeInput').value || getCurrentTimeString();
    attendance[empId] = {
      ...existingAtt,
      status: 'Half Day',
      checkInTime: existingAtt.checkInTime || getShopSettings().openingTime || '09:00',
      checkOutTime: depTime,
      leaveReason: reason || 'Half Day Leave',
      updatedAt: new Date().toISOString()
    };
    saveAttendance(attendance);
    closeModal('recordBreakModal');
    renderAllViews();
    playSound('success');
    showToast(`🟡 ${empName} marked Half Day (Left at ${formatTime12h(depTime)})`, 'success');
  } else if (mode === 'leave') {
    const depTime = document.getElementById('departureTimeInput').value || getCurrentTimeString();
    attendance[empId] = {
      ...existingAtt,
      status: 'Early Leave',
      checkInTime: existingAtt.checkInTime || getShopSettings().openingTime || '09:00',
      checkOutTime: depTime,
      leaveReason: reason || 'Early Leave / Chhutti',
      updatedAt: new Date().toISOString()
    };
    saveAttendance(attendance);
    closeModal('recordBreakModal');
    renderAllViews();
    playSound('success');
    showToast(`🚪 ${empName} marked Early Leave at ${formatTime12h(depTime)}`, 'success');
  } else if (mode === 'break') {
    const typeNow = document.getElementById('breakTypeNow');
    const isNow = typeNow ? typeNow.checked : true;
    const outTime = document.getElementById('breakOutTime').value || getCurrentTimeString();

    const breaks = getBreaks();
    if (isNow) {
      breaks.push({
        empId,
        outTime,
        backTime: null,
        reason: reason || 'Stepped Out'
      });
      saveBreaks(breaks);
      closeModal('recordBreakModal');
      renderAllViews();
      playSound('success');
      showToast(`⏱️ ${empName} marked Bahar Gaye at ${formatTime12h(outTime)}`, 'success');
    } else {
      const backTime = document.getElementById('breakBackTime').value || getCurrentTimeString();
      const [oH, oM] = outTime.split(':').map(Number);
      const [bH, bM] = backTime.split(':').map(Number);
      const diff = (bH * 60 + bM) - (oH * 60 + oM);

      if (diff <= 0) {
        showToast('Return time must be after departure time', 'warning');
        return;
      }

      breaks.push({
        empId,
        outTime,
        backTime,
        reason: reason || 'Personal Break'
      });
      saveBreaks(breaks);
      closeModal('recordBreakModal');
      renderAllViews();
      playSound('success');
      showToast(`✓ Deducted ${diff} mins break for ${empName}. Working hours updated!`, 'success');
    }
  }
}

// Reset employee status back to Present (if marked Half Day / Leave by mistake)
function resetEmployeeToPresent(empId) {
  const attendance = getAttendance();
  if (attendance[empId]) {
    attendance[empId].status = 'Present';
    delete attendance[empId].checkOutTime;
    delete attendance[empId].leaveReason;
    saveAttendance(attendance);
    renderAllViews();
    const employees = getEmployees();
    const emp = employees.find(e => e.id === empId);
    showToast(`${emp ? emp.name : empId} ko wapas Full Present mark kar diya gaya.`, 'info');
  }
}

// =============================================================================
// 13. SALARY & PARTIAL PAYMENTS LEDGER
// =============================================================================

function renderSalaryPane() {
  const employees = getEmployees();
  const tbody = document.getElementById('salaryTableBody');
  if (!tbody) return;

  if (typeof getCurrentRole === 'function' && getCurrentRole() === 'manager') {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align:center; padding:3.5rem 1rem;">
          <div style="font-size:2.8rem; margin-bottom:0.75rem;">🔒</div>
          <strong style="font-size:1.15rem; color:#92400e; display:block; margin-bottom:0.4rem;">Salary Records Protected (Manager Mode)</strong>
          <p style="font-size:0.85rem; color:var(--text-muted); max-width:440px; margin:0 auto 1.25rem auto; line-height:1.45;">
            Manager role is active on this device. Individual employee salaries and payment ledgers are locked to maintain store confidentiality.
          </p>
          <button class="btn btn-primary btn-sm" onclick="promptUnlockWithPin('salary')">Unlock with Owner PIN</button>
        </td>
      </tr>
    `;
    const salTotalPayroll = document.getElementById('salTotalPayroll');
    const salTotalPaid = document.getElementById('salTotalPaid');
    const salTotalRemaining = document.getElementById('salTotalRemaining');
    if (salTotalPayroll) salTotalPayroll.textContent = '🔒 ₹••••';
    if (salTotalPaid) salTotalPaid.textContent = '🔒 ₹••••';
    if (salTotalRemaining) salTotalRemaining.textContent = '🔒 ₹••••';
    return;
  }

  if (employees.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align:center; padding:3.5rem 1rem; color:var(--text-muted);">
          <div style="font-size:2.2rem; margin-bottom:0.5rem;">💰</div>
          <strong style="font-size:1.1rem; color:var(--text-white); display:block; margin-bottom:0.35rem;">No Salary Records Found</strong>
          <p style="font-size:0.85rem; margin-bottom:1.25rem;">Add employees with their monthly salary to manage advances and balances.</p>
          <button class="btn btn-primary btn-sm" onclick="openAddEmployeeModal()">+ Add Staff</button>
        </td>
      </tr>
    `;
    const salTotalPayroll = document.getElementById('salTotalPayroll');
    const salTotalPaid = document.getElementById('salTotalPaid');
    const salTotalRemaining = document.getElementById('salTotalRemaining');
    if (salTotalPayroll) salTotalPayroll.textContent = '₹0';
    if (salTotalPaid) salTotalPaid.textContent = '₹0';
    if (salTotalRemaining) salTotalRemaining.textContent = '₹0';
    return;
  }

  let totalMonthlySalary = 0;
  let totalAdvancesPaid = 0;

  tbody.innerHTML = employees.map(emp => {
    const sal = calculateSalaryBalance(emp.id);
    totalMonthlySalary += sal.salary;
    totalAdvancesPaid += sal.paid;

    return `
      <tr>
        <td>
          <strong style="color:var(--text-white); font-size:0.95rem;">${emp.name}</strong>
          <div style="font-size:0.75rem; color:var(--text-muted);">${emp.role} • ${emp.id}</div>
        </td>
        <td><strong>₹${Number(sal.salary).toLocaleString('en-IN')}</strong></td>
        <td><strong class="text-green">₹${sal.paid.toLocaleString('en-IN')}</strong></td>
        <td><strong class="text-amber">₹${sal.due.toLocaleString('en-IN')}</strong></td>
        <td>
          <div style="width:140px;">
            <div class="progress-bar-track">
              <div class="progress-bar-fill" style="width:${sal.progressPct}%; background:linear-gradient(90deg, #10b981, #f59e0b);"></div>
            </div>
            <div style="font-size:0.7rem; color:var(--text-muted); margin-top:0.2rem;">${sal.progressPct}% paid</div>
          </div>
        </td>
        <td class="text-right">
          <button class="btn btn-primary btn-xs" onclick="openPaymentModal('${emp.id}')">+ Record Advance</button>
        </td>
      </tr>
    `;
  }).join('');

  const totalRemainingDue = Math.max(0, totalMonthlySalary - totalAdvancesPaid);

  const salTotalPayroll = document.getElementById('salTotalPayroll');
  const salTotalPaid = document.getElementById('salTotalPaid');
  const salTotalRemaining = document.getElementById('salTotalRemaining');

  if (salTotalPayroll) salTotalPayroll.textContent = `₹${totalMonthlySalary.toLocaleString('en-IN')}`;
  if (salTotalPaid) salTotalPaid.textContent = `₹${totalAdvancesPaid.toLocaleString('en-IN')}`;
  if (salTotalRemaining) salTotalRemaining.textContent = `₹${totalRemainingDue.toLocaleString('en-IN')}`;
}

function openPaymentModal(empId = '') {
  const employees = getEmployees().filter(e => !e.isLeft);
  const select = document.getElementById('payEmployeeSelect');
  if (select) {
    if (employees.length === 0) {
      select.innerHTML = `<option value="">No active staff available</option>`;
    } else {
      select.innerHTML = employees.map(emp => `
        <option value="${emp.id}" ${emp.id === empId ? 'selected' : ''}>${emp.name} (${emp.id})</option>
      `).join('');
    }
  }

  document.getElementById('payAmount').value = '';
  document.getElementById('payTxnId').value = '';
  document.getElementById('payNote').value = '';
  
  const today = new Date().toISOString().slice(0, 10);
  const payDateInput = document.getElementById('payDate');
  if (payDateInput) payDateInput.value = today;

  const errorSpan = document.getElementById('payAmountError');
  if (errorSpan) errorSpan.style.display = 'none';

  updatePayModalInfo();
  openModal('recordPaymentModal');
}

function updatePayModalInfo() {
  const select = document.getElementById('payEmployeeSelect');
  const pill = document.getElementById('payModalBalancePill');
  if (!select || !select.value) {
    if (pill) pill.innerHTML = '<span>Select a staff member</span>';
    return;
  }

  const empId = select.value;
  const sal = calculateSalaryBalance(empId);

  if (pill) {
    pill.innerHTML = `
      <span>Monthly: ₹${sal.salary.toLocaleString('en-IN')}</span> | 
      <span>Paid: ₹${sal.paid.toLocaleString('en-IN')}</span> | 
      <strong>Remaining Due: ₹${sal.due.toLocaleString('en-IN')}</strong>
    `;
  }
}

function handleRecordPayment(e) {
  e.preventDefault();
  const empId = document.getElementById('payEmployeeSelect').value;
  if (!empId) {
    showToast('Please select a staff member', 'warning');
    return;
  }

  const amount = Number(document.getElementById('payAmount').value);
  const date = document.getElementById('payDate').value || new Date().toISOString().slice(0, 10);
  const modeRadios = document.getElementsByName('payMode');
  let mode = 'UPI';
  for (let r of modeRadios) { if (r.checked) mode = r.value; }
  const txnId = document.getElementById('payTxnId').value.trim();
  const note = document.getElementById('payNote').value.trim();

  const sal = calculateSalaryBalance(empId);
  const errorSpan = document.getElementById('payAmountError');

  if (isNaN(amount) || amount <= 0) {
    if (errorSpan) {
      errorSpan.textContent = 'Please enter a valid positive amount.';
      errorSpan.style.display = 'block';
    }
    return;
  }

  if (amount > sal.due) {
    if (errorSpan) {
      errorSpan.textContent = `Amount cannot exceed remaining balance of ₹${sal.due.toLocaleString('en-IN')}.`;
      errorSpan.style.display = 'block';
    }
    return;
  }

  if (errorSpan) errorSpan.style.display = 'none';

  const payments = getPayments();
  const newPay = {
    id: `PAY-${Date.now()}`,
    empId,
    amount,
    date,
    mode,
    txnId,
    note: note || `Salary advance via ${mode}`
  };

  payments.push(newPay);
  savePayments(payments);

  closeModal('recordPaymentModal');
  renderAllViews();

  const sendWa = document.getElementById('paySendWhatsappSlip')?.checked;
  if (sendWa) {
    showToast(`Recorded ₹${amount.toLocaleString('en-IN')} payment! Opening WhatsApp slip...`, 'success');
    if (typeof shareAdvanceWhatsapp === 'function') shareAdvanceWhatsapp(newPay);
  } else {
    showToast(`Recorded ₹${amount.toLocaleString('en-IN')} payment via ${mode}!`, 'success');
  }
}

// =============================================================================
// 14. EMPLOYEE DETAILS & ID CARD MODAL
// =============================================================================

function openEmployeeDetailsModal(empId) {
  window.currentViewingEmpId = empId;
  const employees = getEmployees();
  const emp = employees.find(e => e.id === empId);
  if (!emp) return;

  const wh = calculateWorkingHours(empId);
  const sal = calculateSalaryBalance(empId);
  const initials = emp.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();

  // Header
  document.getElementById('empDetailHeader').innerHTML = `
    <div style="display:flex; align-items:center; gap:1rem;">
      <div class="emp-avatar" style="width:52px; height:52px; font-size:1.2rem;">${initials}</div>
      <div>
        <h3 style="font-size:1.35rem; color:var(--text-white);">${emp.name}</h3>
        <div style="color:var(--text-muted); font-size:0.85rem;">${emp.role} • <span style="color:#93c5fd; font-weight:700;">${emp.id}</span> • Joined: ${emp.joinDate || 'Recent'}</div>
      </div>
    </div>
  `;

  // KPIs
  document.getElementById('empDetailKpis').innerHTML = `
    <div class="stat-box">
      <span class="stat-label">TODAY'S HOURS</span>
      <div class="stat-value text-blue">${wh.text}</div>
      <div class="stat-sub">Target: 8h (Day closes at closing time)</div>
    </div>
    <div class="stat-box">
      <span class="stat-label">TODAY'S STATUS</span>
      <div style="font-size:0.95rem; font-weight:700; color:var(--text-white);">${wh.status}</div>
      <div class="stat-sub">Check-in: ${wh.checkInTime || 'Not checked in'}</div>
    </div>
    <div class="stat-box">
      <span class="stat-label">MONTHLY SALARY</span>
      <div class="stat-value">₹${Number(sal.salary).toLocaleString('en-IN')}</div>
      <div class="stat-sub">Base monthly pay</div>
    </div>
    <div class="stat-box highlight-box">
      <span class="stat-label">SALARY BALANCE</span>
      <div class="stat-value text-amber">₹${sal.due.toLocaleString('en-IN')} Due</div>
      <div class="stat-sub">₹${sal.paid.toLocaleString('en-IN')} paid so far</div>
    </div>
  `;

  // Today's timeline
  document.getElementById('empDetailTodayTimeline').innerHTML = `
    <div class="timeline-box" style="margin-top:0.5rem;">
      <div class="timeline-row">
        <div class="timeline-dot green"></div>
        <div class="timeline-time">${wh.checkInTime ? wh.checkInTime : '—'}</div>
        <div class="timeline-event">
          <strong>Checked In</strong>
          <span>${wh.checkInTime ? 'Marked via QR / System' : 'No check-in recorded today'}</span>
        </div>
      </div>
      <div class="timeline-row">
        <div class="timeline-dot amber"></div>
        <div class="timeline-time">Break</div>
        <div class="timeline-event">
          <strong>Break Time</strong>
          <span>${wh.breaksDeducted > 0 ? wh.breaksDeducted + ' mins deducted' : 'No breaks recorded'}</span>
        </div>
      </div>
    </div>
  `;

  // Payment list
  document.getElementById('empDetailPaymentList').innerHTML = sal.payments.length === 0 ? 
    `<p style="font-size:0.85rem; color:var(--text-muted); margin-top:0.5rem;">No advances recorded yet this month.</p>` :
    sal.payments.map(p => `
      <div class="payment-record-item" style="margin-top:0.5rem; display:flex; align-items:center; justify-content:space-between;">
        <div style="display:flex; align-items:center; gap:0.6rem;">
          <div class="pay-icon ${p.mode.toLowerCase()}">${p.mode}</div>
          <div class="pay-info">
            <div class="pay-date-mode">
              <span class="pay-date">${p.date}</span>
              <span class="pay-badge ${p.mode.toLowerCase()}">${p.mode}</span>
            </div>
            <span class="pay-note">${p.note || 'Advance'}</span>
          </div>
        </div>
        <div style="display:flex; align-items:center; gap:0.5rem;">
          <div class="pay-amount">₹${Number(p.amount).toLocaleString('en-IN')}</div>
          <button type="button" class="btn btn-outline btn-xs" onclick="shareAdvanceWhatsappById('${p.id}')" title="Share Advance Slip on WhatsApp" style="color:#16a34a; border-color:#86efac; font-weight:700; padding:0.2rem 0.5rem;">
            💬 Slip
          </button>
        </div>
      </div>
    `).join('');

  document.getElementById('empDetailRecordPayBtn').onclick = () => {
    closeModal('employeeDetailsModal');
    openPaymentModal(empId);
  };

  document.getElementById('empDetailPrintCardBtn').onclick = () => {
    closeModal('employeeDetailsModal');
    openStaffIdCardModal(empId);
  };

  openModal('employeeDetailsModal');
}

function openStaffIdCardModal(empId) {
  const employees = getEmployees();
  const emp = employees.find(e => e.id === empId) || employees[0];
  if (!emp) {
    showToast('No staff record found to generate ID card', 'warning');
    return;
  }

  const shop = getShopSettings();
  const initials = emp.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();

  document.getElementById('idCardShopName').textContent = shop.shopName || 'My Business';
  document.getElementById('idCardAvatar').textContent = initials;
  document.getElementById('idCardEmpName').textContent = emp.name.toUpperCase();
  document.getElementById('idCardEmpId').textContent = emp.id;
  document.getElementById('idCardRole').textContent = emp.role;
  document.getElementById('idCardJoinDate').textContent = `Joined: ${emp.joinDate || 'Active'}`;
  document.getElementById('idCardQrSvg').innerHTML = generateEmployeeQR(emp.id, 140);

  openModal('staffIdCardModal');
}

function printIdCard() {
  window.print();
}

// =============================================================================
// 15. REPORTS & AAJ KA HISAAB (DEDICATED FULL VIEW)
// =============================================================================

function renderReports() {
  const employees = getEmployees();
  const attendance = getAttendance();
  const tbody = document.getElementById('reportTableBody');
  if (!tbody) return;

  if (employees.length === 0) {
    tbody.innerHTML = '<tr><td colspan="9" style="text-align:center; padding:3rem 1rem; color:var(--text-muted);">No staff records found. Add staff members to generate reports.</td></tr>';
    const repTotalStaff = document.getElementById('repTotalStaff');
    const repTotalHours = document.getElementById('repTotalHours');
    const repAvgHours = document.getElementById('repAvgHours');
    const repTotalSalary = document.getElementById('repTotalSalary');
    const repTotalPaid = document.getElementById('repTotalPaid');
    const repTotalDue = document.getElementById('repTotalDue');

    if (repTotalStaff) repTotalStaff.textContent = '0';
    if (repTotalHours) repTotalHours.textContent = '0h 00m';
    if (repAvgHours) repAvgHours.textContent = '0h 00m';
    if (repTotalSalary) repTotalSalary.textContent = '₹0';
    if (repTotalPaid) repTotalPaid.textContent = '₹0';
    if (repTotalDue) repTotalDue.textContent = '₹0';
    return;
  }

  let totalSalary = 0;
  let totalPaid = 0;
  let totalHoursMins = 0;

  tbody.innerHTML = employees.map(emp => {
    const sal = calculateSalaryBalance(emp.id);
    const wh = calculateWorkingHours(emp.id);
    const att = attendance[emp.id];
    const isPresent = att && (att.status === 'Present' || att.status === 'Early Leave');
    const isAbsent = !att || att.status === 'Absent';
    const isHalfDay = att && att.status === 'Half Day';
    
    totalSalary += sal.salary;
    totalPaid += sal.paid;
    totalHoursMins += wh.minutes;

    return `
      <tr>
        <td>
          <strong style="color:var(--text-white);">${emp.name}</strong>
          <div style="font-size:0.75rem; color:var(--text-muted);">${emp.role} • ${emp.id}</div>
        </td>
        <td><strong class="text-green">${isPresent ? 1 : 0}</strong></td>
        <td><strong class="text-red">${isAbsent ? 1 : 0}</strong></td>
        <td><strong class="text-amber">${isHalfDay ? 1 : 0}</strong></td>
        <td><strong style="color:#60a5fa; font-family:var(--font-heading);">${wh.text}</strong></td>
        <td>${wh.text}</td>
        <td>₹${Number(sal.salary).toLocaleString('en-IN')}</td>
        <td class="text-green">₹${sal.paid.toLocaleString('en-IN')}</td>
        <td class="text-amber"><strong>₹${sal.due.toLocaleString('en-IN')}</strong></td>
      </tr>
    `;
  }).join('');

  const totalDue = Math.max(0, totalSalary - totalPaid);
  const totalHrs = Math.floor(totalHoursMins / 60);
  const totalMins = totalHoursMins % 60;
  const avgMins = employees.length > 0 ? Math.round(totalHoursMins / employees.length) : 0;
  const avgHrs = Math.floor(avgMins / 60);
  const avgRemainMins = avgMins % 60;

  document.getElementById('repTotalStaff').textContent = employees.length;
  document.getElementById('repTotalHours').textContent = `${totalHrs}h ${totalMins.toString().padStart(2, '0')}m`;
  document.getElementById('repAvgHours').textContent = `${avgHrs}h ${avgRemainMins.toString().padStart(2, '0')}m`;
  document.getElementById('repTotalSalary').textContent = `₹${totalSalary.toLocaleString('en-IN')}`;
  document.getElementById('repTotalPaid').textContent = `₹${totalPaid.toLocaleString('en-IN')}`;
  document.getElementById('repTotalDue').textContent = `₹${totalDue.toLocaleString('en-IN')}`;
}

function renderAajKaHisaabPane() {
  const employees = getEmployees();
  const attendance = getAttendance();
  const payments = getPayments();

  let presentCount = 0;
  let absentCount = 0;
  let halfDayCount = 0;
  let totalWorkedMins = 0;

  employees.forEach(emp => {
    if (emp.isLeft) return;
    const att = attendance[emp.id];
    if (!att || att.status === 'Absent') {
      absentCount++;
    } else if (att.status === 'Half Day') {
      halfDayCount++;
      totalWorkedMins += calculateWorkingHours(emp.id).minutes;
    } else {
      presentCount++;
      totalWorkedMins += calculateWorkingHours(emp.id).minutes;
    }
  });

  let totalSalary = 0;
  let totalPaid = 0;
  let paidTodaySum = 0;
  const todayStr = new Date().toISOString().slice(0, 10);

  payments.forEach(p => {
    if (p.date === todayStr) paidTodaySum += Number(p.amount);
  });

  employees.forEach(emp => {
    const sal = calculateSalaryBalance(emp.id);
    totalSalary += sal.salary;
    totalPaid += sal.paid;
  });

  const totalDue = Math.max(0, totalSalary - totalPaid);
  const totalHours = Math.floor(totalWorkedMins / 60);
  const totalMins = totalWorkedMins % 60;

  const hisaabTotalStaff = document.getElementById('hisaabTotalStaff');
  const hisaabPresentCount = document.getElementById('hisaabPresentCount');
  const hisaabAbsentCount = document.getElementById('hisaabAbsentCount');
  const hisaabHalfDayCount = document.getElementById('hisaabHalfDayCount');
  const hisaabWorkingHours = document.getElementById('hisaabWorkingHours');
  const hisaabPaidToday = document.getElementById('hisaabPaidToday');
  const hisaabSalaryDue = document.getElementById('hisaabSalaryDue');

  if (hisaabTotalStaff) hisaabTotalStaff.textContent = employees.length;
  if (hisaabPresentCount) hisaabPresentCount.textContent = presentCount;
  if (hisaabAbsentCount) hisaabAbsentCount.textContent = absentCount;
  if (hisaabHalfDayCount) hisaabHalfDayCount.textContent = halfDayCount;
  if (hisaabWorkingHours) hisaabWorkingHours.textContent = `${totalHours}h ${totalMins.toString().padStart(2, '0')}m`;
  if (hisaabPaidToday) hisaabPaidToday.textContent = `₹${paidTodaySum.toLocaleString('en-IN')}`;
  if (hisaabSalaryDue) hisaabSalaryDue.textContent = `₹${totalDue.toLocaleString('en-IN')}`;

  const hisaabDateTag = document.getElementById('hisaabCurrentDate');
  if (hisaabDateTag) {
    const d = new Date();
    hisaabDateTag.textContent = d.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
  }

  const attentionList = document.getElementById('hisaabAttentionList');
  if (attentionList) {
    const items = [];
    employees.forEach(emp => {
      if (emp.isLeft) return;
      const att = attendance[emp.id];
      const sal = calculateSalaryBalance(emp.id);
      if (!att || att.status === 'Absent') {
        items.push(`<div class="attention-item red"><span class="att-bullet">•</span><span><strong>${emp.name} (${emp.id})</strong> is Absent today.</span></div>`);
      } else if (att.status === 'Half Day') {
        items.push(`<div class="attention-item yellow"><span class="att-bullet">•</span><span><strong>${emp.name} (${emp.id})</strong> marked Half Day ${att.checkOutTime ? '(Left at ' + formatTime12h(att.checkOutTime) + ')' : ''}.</span></div>`);
      } else if (att.status === 'Early Leave') {
        items.push(`<div class="attention-item blue"><span class="att-bullet">•</span><span><strong>${emp.name} (${emp.id})</strong> left early at ${formatTime12h(att.checkOutTime)}.</span></div>`);
      }
      if (sal.due > 0 && sal.salary > 0) {
        items.push(`<div class="attention-item amber"><span class="att-bullet">•</span><span><strong>${emp.name} (${emp.id})</strong> has ₹${sal.due.toLocaleString('en-IN')} pending salary balance.</span></div>`);
      }
    });

    if (items.length === 0) {
      attentionList.innerHTML = `<div class="attention-item green"><span class="att-bullet">•</span><span>All staff records and daily attendance are in order.</span></div>`;
    } else {
      attentionList.innerHTML = items.slice(0, 5).join('');
    }
  }
}

function populateSettingsForm() {
  const shop = getShopSettings();
  document.getElementById('setShopName').value = shop.shopName || '';
  document.getElementById('setOwnerName').value = shop.ownerName || '';
  document.getElementById('setPhone').value = shop.phone || '';
  document.getElementById('setCategory').value = shop.category || 'Shops';
  document.getElementById('setOpeningTime').value = shop.openingTime || '09:00';
  document.getElementById('setClosingTime').value = shop.closingTime || '20:00';
  document.getElementById('setDailyTarget').value = shop.dailyTargetHours || 8;
  const graceInput = document.getElementById('setGraceMinutes');
  const fineSelect = document.getElementById('setLateFineMode');
  if (graceInput) graceInput.value = shop.graceMinutes || 15;
  if (fineSelect) fineSelect.value = shop.lateFineMode || 'none';
  if (typeof updateRoleDisplayElements === 'function') updateRoleDisplayElements();
}

// =============================================================================
// 16. VOICE ASSISTANT DEMO & SIMULATION (Hinglish Context)
// =============================================================================

function openVoiceModal() {
  openModal('voiceAssistantModal');
}

function executeVoiceCommand(queryText) {
  const userTxt = document.getElementById('voiceModalUserTxt');
  const replyTxt = document.getElementById('voiceModalReplyTxt');
  if (userTxt) userTxt.textContent = `“${queryText}”`;

  const employees = getEmployees();
  const attendance = getAttendance();
  const payments = getPayments();

  let presentCount = 0;
  let absentCount = 0;
  let totalWorkedMins = 0;
  employees.forEach(emp => {
    if (emp.isLeft) return;
    const att = attendance[emp.id];
    if (att && att.status === 'Present') {
      presentCount++;
      totalWorkedMins += calculateWorkingHours(emp.id).minutes;
    } else {
      absentCount++;
    }
  });

  const todayStr = new Date().toISOString().slice(0, 10);
  let paidTodaySum = 0;
  payments.forEach(p => {
    if (p.date === todayStr) paidTodaySum += Number(p.amount);
  });

  const lowerQuery = queryText.toLowerCase();
  const matchedEmp = employees.find(e => lowerQuery.includes(e.name.toLowerCase()));

  if (replyTxt) {
    if (matchedEmp) {
      const sal = calculateSalaryBalance(matchedEmp.id);
      const wh = calculateWorkingHours(matchedEmp.id);
      if (lowerQuery.includes('salary') || lowerQuery.includes('hisaab') || lowerQuery.includes('kitna baaki')) {
        replyTxt.innerHTML = `${matchedEmp.name} ki monthly salary ₹${Number(sal.salary).toLocaleString('en-IN')} hai. <strong>₹${sal.paid.toLocaleString('en-IN')} paid hai</strong> aur <strong>₹${sal.due.toLocaleString('en-IN')} baaki hai</strong>.`;
      } else if (lowerQuery.includes('hour') || lowerQuery.includes('kaam')) {
        replyTxt.innerHTML = `${matchedEmp.name} ne aaj <strong>${wh.text}</strong> kaam kiya hai.`;
      } else {
        replyTxt.innerHTML = `${matchedEmp.name} (${matchedEmp.role}): Salary ₹${Number(sal.salary).toLocaleString('en-IN')}, Due ₹${sal.due.toLocaleString('en-IN')}, Aaj ka kaam ${wh.text}.`;
      }
    } else if (lowerQuery.includes('aaj ka hisaab') || lowerQuery.includes('summary')) {
      const hrs = Math.floor(totalWorkedMins / 60);
      const mins = totalWorkedMins % 60;
      replyTxt.innerHTML = `Aaj kul <strong>${presentCount} staff present</strong> hain, ${absentCount} absent hain. Total <strong>${hrs}h ${mins}m</strong> kaam hua hai aur <strong>₹${paidTodaySum.toLocaleString('en-IN')} salary advance</strong> pay kiya gaya hai.`;
    } else if (lowerQuery.includes('kitne staff') || lowerQuery.includes('present')) {
      replyTxt.innerHTML = `Aaj total <strong>${employees.length} staff</strong> mein se <strong>${presentCount} present</strong> hain aur <strong>${absentCount} absent</strong> hain.`;
    } else {
      replyTxt.innerHTML = `Aapke store mein total ${employees.length} staff enrolled hain. Aaj ${presentCount} present hain aur ₹${paidTodaySum.toLocaleString('en-IN')} paid hai.`;
    }
  }

  playSound('success');
}

function simulateVoiceDemo(index) {
  const queries = [
    '',
    'Staff ka salary kitna baaki hai?',
    'Aaj ka hisaab batao.',
    'Staff ne kitne hours kaam kiya?'
  ];
  const query = queries[index];
  const userBubble = document.getElementById('voiceUserBubble');
  const aiText = document.getElementById('voiceAiText');

  if (userBubble) userBubble.textContent = `“${query}”`;

  if (aiText) {
    const employees = getEmployees();
    const payments = getPayments();
    let totalSalary = 0;
    let totalPaid = 0;
    employees.forEach(e => {
      const sal = calculateSalaryBalance(e.id);
      totalSalary += sal.salary;
      totalPaid += sal.paid;
    });
    const due = Math.max(0, totalSalary - totalPaid);

    if (index === 1) {
      if (employees.length > 0) {
        aiText.innerHTML = `Total salary ₹${totalSalary.toLocaleString('en-IN')} mein se ₹${totalPaid.toLocaleString('en-IN')} paid hai aur <strong>₹${due.toLocaleString('en-IN')} baaki hai</strong>.`;
      } else {
        aiText.innerHTML = `Abhi koi staff add nahi hua hai. Staff add karne par salary balance yahan dikhega.`;
      }
    } else if (index === 2) {
      aiText.innerHTML = `Total ${employees.length} staff enrolled hain. Aaj ka attendance aur hisaab live dashboard par active hai.`;
    } else if (index === 3) {
      aiText.innerHTML = `Staff working hours daily QR check-in aur shift closing time ke basis par auto-track hote hain.`;
    }
  }
}

// =============================================================================
// 16.5 HOW IT WORKS INTERACTIVE VIDEO CONTROLLER
// =============================================================================

let videoDemoState = {
  isPlaying: false,
  currentTime: 0,
  duration: 40, // 40 seconds total
  speed: 1,
  audioEnabled: false,
  timerInterval: null,
  activeChapter: 1,
  chapterNarration: {
    1: 'Step 1: Apne staff ka naam, salary aur daily working hours add karein. Karmiq turant ek printable QR ID card generate kar deta hai.',
    2: 'Step 2: Staff apna QR card shop counter par phone camera ke aage dikhata hai aur ek second mein check in mark ho jata hai.',
    3: 'Step 3: Live working hours aur break tracking automatically count hoti rehti hai bina kisi manual entry ke.',
    4: 'Step 4: Monthly salary balance, advance payments aur 1-click WhatsApp salary slip direct staff ko share karein.'
  }
};

function openHowItWorksVideoModal() {
  openModal('howItWorksVideoModal');
  videoDemoState.currentTime = 0;
  videoDemoState.isPlaying = false;
  jumpToVideoChapter(1, false);
  // Auto-start play after a brief moment
  setTimeout(() => {
    startHowItWorksVideo();
  }, 400);
}

function closeHowItWorksVideoModal() {
  pauseHowItWorksVideo();
  closeModal('howItWorksVideoModal');
  if (window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }
}

function toggleHowItWorksVideo() {
  if (videoDemoState.isPlaying) {
    pauseHowItWorksVideo();
  } else {
    startHowItWorksVideo();
  }
}

function startHowItWorksVideo() {
  videoDemoState.isPlaying = true;
  updateVideoControlsUI();

  if (videoDemoState.timerInterval) clearInterval(videoDemoState.timerInterval);

  speakVideoChapterNarration(videoDemoState.activeChapter);

  videoDemoState.timerInterval = setInterval(() => {
    videoDemoState.currentTime += 0.2 * videoDemoState.speed;
    if (videoDemoState.currentTime >= videoDemoState.duration) {
      videoDemoState.currentTime = videoDemoState.duration;
      pauseHowItWorksVideo();
    }
    updateVideoProgressUI();
  }, 200);
}

function pauseHowItWorksVideo() {
  videoDemoState.isPlaying = false;
  if (videoDemoState.timerInterval) {
    clearInterval(videoDemoState.timerInterval);
    videoDemoState.timerInterval = null;
  }
  if (window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }
  updateVideoControlsUI();
}

function restartHowItWorksVideo() {
  videoDemoState.currentTime = 0;
  jumpToVideoChapter(1, false);
  startHowItWorksVideo();
}

function updateVideoProgressUI() {
  const percent = Math.min(100, (videoDemoState.currentTime / videoDemoState.duration) * 100);
  const fill = document.getElementById('vTimelineFill');
  const handle = document.getElementById('vTimelineHandle');
  const timerTxt = document.getElementById('vTimerText');

  if (fill) fill.style.width = `${percent}%`;
  if (handle) handle.style.left = `${percent}%`;

  const curM = Math.floor(videoDemoState.currentTime / 60);
  const curS = Math.floor(videoDemoState.currentTime % 60).toString().padStart(2, '0');
  const durM = Math.floor(videoDemoState.duration / 60);
  const durS = Math.floor(videoDemoState.duration % 60).toString().padStart(2, '0');

  if (timerTxt) timerTxt.textContent = `${curM}:${curS} / ${durM}:${durS}`;

  // Check chapter based on time (10s per chapter)
  let chap = Math.min(4, Math.floor(videoDemoState.currentTime / 10) + 1);
  if (chap !== videoDemoState.activeChapter) {
    jumpToVideoChapter(chap, false);
  }
}

function jumpToVideoChapter(chapNum, updateTime = true) {
  videoDemoState.activeChapter = chapNum;

  if (updateTime) {
    videoDemoState.currentTime = (chapNum - 1) * 10;
    updateVideoProgressUI();
    if (videoDemoState.isPlaying) {
      speakVideoChapterNarration(chapNum);
    }
  }

  // Update scene visibility
  for (let i = 1; i <= 4; i++) {
    const scene = document.getElementById(`vScene${i}`);
    const chapBtn = document.getElementById(`vChapBtn${i}`);
    if (scene) scene.classList.toggle('active', i === chapNum);
    if (chapBtn) chapBtn.classList.toggle('active', i === chapNum);
  }
}

function seekVideoDemo(e) {
  const wrapper = document.getElementById('vTimelineWrapper');
  if (!wrapper) return;
  const rect = wrapper.getBoundingClientRect();
  const clickX = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
  const pct = clickX / rect.width;
  videoDemoState.currentTime = pct * videoDemoState.duration;
  let chap = Math.min(4, Math.floor(videoDemoState.currentTime / 10) + 1);
  jumpToVideoChapter(chap, false);
  updateVideoProgressUI();
}

function cycleVideoSpeed() {
  const speeds = [1, 1.5, 2];
  let curIdx = speeds.indexOf(videoDemoState.speed);
  let nextIdx = (curIdx + 1) % speeds.length;
  videoDemoState.speed = speeds[nextIdx];
  const btn = document.getElementById('vSpeedBtn');
  if (btn) btn.textContent = `${videoDemoState.speed}x`;
}

function toggleVideoVoiceover() {
  videoDemoState.audioEnabled = !videoDemoState.audioEnabled;
  const audioIcon = document.getElementById('vAudioIcon');
  const btn = document.getElementById('vAudioBtn');
  if (videoDemoState.audioEnabled) {
    if (btn) btn.style.color = '#38bdf8';
    speakVideoChapterNarration(videoDemoState.activeChapter);
    showToast('Voiceover Audio Enabled', 'info');
  } else {
    if (btn) btn.style.color = '#94a3b8';
    if (window.speechSynthesis) window.speechSynthesis.cancel();
    showToast('Voiceover Muted', 'info');
  }
}

function speakVideoChapterNarration(chapNum) {
  if (!videoDemoState.audioEnabled || !('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  const text = videoDemoState.chapterNarration[chapNum];
  if (!text) return;
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = 'hi-IN';
  utter.rate = 1.0 * videoDemoState.speed;
  window.speechSynthesis.speak(utter);
}

function updateVideoControlsUI() {
  const playOverlayBtn = document.getElementById('vPlayOverlayBtn');
  const playBtnIcon = document.getElementById('vPlayBtnIcon');
  const playOverlayIcon = document.getElementById('vPlayOverlayIcon');

  if (videoDemoState.isPlaying) {
    if (playOverlayBtn) playOverlayBtn.classList.add('playing');
    if (playBtnIcon) {
      playBtnIcon.innerHTML = '<rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect>';
    }
  } else {
    if (playOverlayBtn) playOverlayBtn.classList.remove('playing');
    if (playBtnIcon) {
      playBtnIcon.innerHTML = '<polygon points="8 5 19 12 8 19 8 5"></polygon>';
    }
  }
}

// =============================================================================
// 17. MULTI-DEVICE & ROLE-BASED ACCESS (OWNER, MANAGER & KIOSK)
// =============================================================================

function getSecuritySettings() {
  const data = localStorage.getItem(STORAGE_KEYS.SECURITY);
  const parsed = data ? JSON.parse(data) : {};
  return { ...DEFAULT_SECURITY_SETTINGS, ...parsed };
}

function saveSecuritySettings(settings) {
  localStorage.setItem(STORAGE_KEYS.SECURITY, JSON.stringify(settings));
  updateRoleDisplayElements();
}

function getCurrentRole() {
  const sec = getSecuritySettings();
  return sec.currentRole || 'owner';
}

function updateRoleDisplayElements() {
  const sec = getSecuritySettings();
  const role = sec.currentRole || 'owner';

  // 1. Topbar Button
  const topRoleBtn = document.getElementById('topRoleBtn');
  const topRoleIcon = document.getElementById('topRoleIcon');
  const topRoleName = document.getElementById('topRoleName');
  if (topRoleBtn && topRoleIcon && topRoleName) {
    topRoleBtn.classList.remove('manager-active', 'kiosk-active');
    if (role === 'owner') {
      topRoleIcon.textContent = '👑';
      topRoleName.textContent = 'Owner Mode';
    } else if (role === 'manager') {
      topRoleBtn.classList.add('manager-active');
      topRoleIcon.textContent = '🧑‍💼';
      topRoleName.textContent = 'Manager Mode';
    } else {
      topRoleBtn.classList.add('kiosk-active');
      topRoleIcon.textContent = '📱';
      topRoleName.textContent = 'Kiosk Terminal';
    }
  }

  // 2. Sidebar Role Pill
  const sideRoleIcon = document.getElementById('sideRoleIcon');
  const sideRoleName = document.getElementById('sideRoleName');
  if (sideRoleIcon && sideRoleName) {
    if (role === 'owner') {
      sideRoleIcon.textContent = '👑';
      sideRoleName.textContent = 'Owner (Full Admin)';
    } else if (role === 'manager') {
      sideRoleIcon.textContent = '🧑‍💼';
      sideRoleName.textContent = 'Manager (Protected)';
    } else {
      sideRoleIcon.textContent = '📱';
      sideRoleName.textContent = 'Counter Kiosk';
    }
  }

  // 3. Settings Cards Highlights
  const cardOwner = document.getElementById('cardOwnerRole');
  const cardManager = document.getElementById('cardManagerRole');
  const cardKiosk = document.getElementById('cardKioskRole');
  const chipOwnerStatus = document.getElementById('chipOwnerStatus');
  const btnSwitchManager = document.getElementById('btnSwitchManager');

  if (cardOwner && cardManager && cardKiosk) {
    cardOwner.classList.toggle('active-card', role === 'owner');
    cardManager.classList.toggle('active-card', role === 'manager');
    cardKiosk.classList.toggle('active-card', role === 'kiosk');

    if (chipOwnerStatus) {
      chipOwnerStatus.textContent = role === 'owner' ? 'Active on this device' : 'Switch back with PIN';
      chipOwnerStatus.style.display = role === 'owner' ? 'inline-flex' : 'none';
    }
    if (btnSwitchManager) {
      btnSwitchManager.textContent = role === 'manager' ? 'Active Mode' : 'Switch to Manager';
      btnSwitchManager.disabled = role === 'manager';
    }
  }

  // 4. Current PIN and Pair Code in Settings
  const displayPin = document.getElementById('displayCurrentPin');
  if (displayPin) displayPin.textContent = sec.ownerPin || '1234';

  const pairCodeEl = document.getElementById('devicePairCode');
  if (pairCodeEl) pairCodeEl.textContent = sec.managerCode || 'MGR-8842';

  // 5. Hide PIN Settings for Manager vs Show for Admin
  const adminSec = document.getElementById('adminSecuritySection');
  const mgrNotice = document.getElementById('managerSecurityLockedNotice');
  if (adminSec) adminSec.style.display = (role === 'owner') ? 'block' : 'none';
  if (mgrNotice) mgrNotice.style.display = (role === 'manager') ? 'flex' : 'none';

  // 6. Pre-fill Admin, Manager & Kiosk Credentials in Settings Form
  const setAdminUser = document.getElementById('setAdminUser');
  const setAdminPass = document.getElementById('setAdminPass');
  const setAdminPin = document.getElementById('setAdminPin');
  if (setAdminUser) setAdminUser.value = sec.adminUser || 'admin';
  if (setAdminPass) setAdminPass.value = sec.adminPass || 'admin123';
  if (setAdminPin) setAdminPin.value = sec.ownerPin || '1234';

  const setMgrName = document.getElementById('setManagerName');
  const setMgrPhone = document.getElementById('setManagerPhone');
  const setMgrUser = document.getElementById('setManagerUser');
  const setMgrPass = document.getElementById('setManagerPass');
  if (setMgrName) setMgrName.value = sec.managerName || 'Store Manager';
  if (setMgrPhone) setMgrPhone.value = sec.managerPhone || '';
  if (setMgrUser) setMgrUser.value = sec.managerUser || 'manager';
  if (setMgrPass) setMgrPass.value = sec.managerPass || 'mgr123';

  // 6b. Populate Manager Details Display Card in Settings
  const mgrName = sec.managerName || 'Store Manager';
  const mgrUser = sec.managerUser || 'manager';
  const mgrPass = sec.managerPass || 'mgr123';
  const mgrPhone = sec.managerPhone || '';
  const mgrCode = sec.managerCode || 'MGR-8842';

  const dispMgrName = document.getElementById('dispManagerName');
  const dispMgrUser = document.getElementById('dispManagerUser');
  const dispCardUser = document.getElementById('dispCardUser');
  const dispMgrPass = document.getElementById('dispManagerPass');
  const dispMgrPhone = document.getElementById('dispManagerPhone');
  const dispMgrCode = document.getElementById('dispManagerCode');
  const dispMgrAvatar = document.getElementById('dispManagerAvatar');
  const dispMgrUserTag = document.getElementById('dispManagerUserTag');

  if (dispMgrName) dispMgrName.textContent = mgrName;
  if (dispMgrUser) dispMgrUser.textContent = mgrUser;
  if (dispCardUser) dispCardUser.textContent = mgrUser;
  if (dispMgrUserTag) dispMgrUserTag.textContent = `@${mgrUser}`;
  if (dispMgrPhone) {
    dispMgrPhone.textContent = mgrPhone ? `+91 ${mgrPhone}` : 'Not provided';
    dispMgrPhone.style.color = mgrPhone ? 'var(--text-dark)' : 'var(--text-muted)';
  }
  if (dispMgrCode) dispMgrCode.textContent = mgrCode;
  if (dispMgrPass) {
    dispMgrPass.setAttribute('data-pass', mgrPass);
    const isMasked = dispMgrPass.getAttribute('data-masked') !== 'false';
    dispMgrPass.textContent = isMasked ? '••••••' : mgrPass;
  }
  if (dispMgrAvatar) {
    dispMgrAvatar.textContent = (mgrName && mgrName !== 'Store Manager') ? mgrName.charAt(0).toUpperCase() : '🧑‍💼';
  }

  // 6c. Populate Manager Banner in Staff / Employees Pane
  const empPaneBanner = document.getElementById('empPaneManagerBanner');
  if (empPaneBanner) {
    // Only show manager banner for Admin (owner)
    empPaneBanner.style.display = (role === 'owner') ? 'flex' : 'none';
  }
  const empMgrBannerName = document.getElementById('empMgrBannerName');
  const empMgrBannerUser = document.getElementById('empMgrBannerUser');
  const empMgrBannerAvatar = document.getElementById('empMgrBannerAvatar');
  if (empMgrBannerName) empMgrBannerName.textContent = mgrName;
  if (empMgrBannerUser) empMgrBannerUser.textContent = `@${mgrUser}`;
  if (empMgrBannerAvatar) {
    empMgrBannerAvatar.textContent = (mgrName && mgrName !== 'Store Manager') ? mgrName.charAt(0).toUpperCase() : '🧑‍💼';
  }

  // 6d. Populate Manager Details Modal Elements
  const modalMgrName = document.getElementById('modalMgrName');
  const modalMgrUser = document.getElementById('modalMgrUser');
  const modalMgrUserTag = document.getElementById('modalMgrUserTag');
  const modalMgrPass = document.getElementById('modalMgrPass');
  const modalMgrPhone = document.getElementById('modalMgrPhone');
  const modalMgrCode = document.getElementById('modalMgrCode');
  if (modalMgrName) modalMgrName.textContent = mgrName;
  if (modalMgrUser) modalMgrUser.textContent = mgrUser;
  if (modalMgrUserTag) modalMgrUserTag.textContent = `@${mgrUser}`;
  if (modalMgrPhone) modalMgrPhone.textContent = mgrPhone ? `+91 ${mgrPhone}` : 'Not provided';
  if (modalMgrCode) modalMgrCode.textContent = mgrCode;
  if (modalMgrPass) {
    modalMgrPass.setAttribute('data-pass', mgrPass);
    const isMasked = modalMgrPass.getAttribute('data-masked') !== 'false';
    modalMgrPass.textContent = isMasked ? '••••••' : mgrPass;
  }

  const setKioskCode = document.getElementById('setKioskCode');
  if (setKioskCode) setKioskCode.value = sec.kioskCode || 'TERM-101';

  // 7. Toggle Body Class to auto-hide financial tabs for Manager
  document.body.classList.toggle('role-manager-active', role === 'manager');

  // If Manager is currently on a forbidden financial tab, redirect to overview
  if (role === 'manager') {
    const currentTab = localStorage.getItem(STORAGE_KEYS.ACTIVE_TAB);
    if (currentTab === 'salary' || currentTab === 'reports' || currentTab === 'aaj-ka-hisaab') {
      switchTab('overview');
    }
  }
}

// PIN Verification Flow
let enteredPinBuffer = '';
let activePinSuccessCallback = null;

function openOwnerPinModal(callback, title = 'Enter Owner PIN', sub = 'Enter your 4-digit security PIN to proceed') {
  activePinSuccessCallback = callback;
  enteredPinBuffer = '';
  updatePinDisplayBoxes();

  const titleEl = document.getElementById('pinModalTitle');
  const subEl = document.getElementById('pinModalSub');
  const errorEl = document.getElementById('pinErrorMsg');
  if (titleEl) titleEl.textContent = title;
  if (subEl) subEl.textContent = sub;
  if (errorEl) errorEl.textContent = '';

  openModal('ownerPinModal');
}

function closeOwnerPinModal() {
  closeModal('ownerPinModal');
  enteredPinBuffer = '';
  activePinSuccessCallback = null;
}

function updatePinDisplayBoxes() {
  for (let i = 0; i < 4; i++) {
    const box = document.getElementById(`pinBox${i}`);
    if (box) {
      if (i < enteredPinBuffer.length) {
        box.textContent = '●';
        box.classList.add('filled');
      } else {
        box.textContent = '•';
        box.classList.remove('filled', 'error');
      }
    }
  }
}

function pressPinDigit(digit) {
  if (enteredPinBuffer.length >= 4) return;
  enteredPinBuffer += digit;
  updatePinDisplayBoxes();

  if (enteredPinBuffer.length === 4) {
    setTimeout(verifySubmittedPin, 100);
  }
}

function backspacePinDigit() {
  if (enteredPinBuffer.length > 0) {
    enteredPinBuffer = enteredPinBuffer.slice(0, -1);
    updatePinDisplayBoxes();
  }
}

function clearPinInput() {
  enteredPinBuffer = '';
  updatePinDisplayBoxes();
}

function verifySubmittedPin() {
  const sec = getSecuritySettings();
  const correctPin = sec.ownerPin || '1234';
  const errorEl = document.getElementById('pinErrorMsg');

  if (enteredPinBuffer === correctPin) {
    closeModal('ownerPinModal');
    playSound('success');
    showToast('PIN Verified Successfully!', 'success');
    const cb = activePinSuccessCallback;
    activePinSuccessCallback = null;
    if (typeof cb === 'function') {
      cb();
    }
  } else {
    playSound('error');
    if (errorEl) errorEl.textContent = 'Incorrect PIN! Please try again.';
    for (let i = 0; i < 4; i++) {
      const box = document.getElementById(`pinBox${i}`);
      if (box) box.classList.add('error');
    }
    const container = document.getElementById('pinDisplayBoxes');
    if (container) {
      container.classList.remove('shake');
      void container.offsetWidth;
      container.classList.add('shake');
    }
    setTimeout(() => {
      enteredPinBuffer = '';
      updatePinDisplayBoxes();
    }, 600);
  }
}

// Keyboard typing support for PIN modal
window.addEventListener('keydown', (e) => {
  const modal = document.getElementById('ownerPinModal');
  if (modal && modal.classList.contains('open')) {
    if (e.key >= '0' && e.key <= '9') {
      e.preventDefault();
      pressPinDigit(e.key);
    } else if (e.key === 'Backspace') {
      e.preventDefault();
      backspacePinDigit();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      closeOwnerPinModal();
    }
  }
});

// Role Switcher Actions
function openRoleSwitcherModal() {
  const currentRole = getCurrentRole();
  const badgeOwner = document.getElementById('modalRoleBadgeOwner');
  const badgeManager = document.getElementById('modalRoleBadgeManager');
  if (badgeOwner) badgeOwner.textContent = currentRole === 'owner' ? 'Active' : 'Admin';
  if (badgeManager) badgeManager.textContent = currentRole === 'manager' ? 'Active' : 'Protected';
  openModal('roleSwitcherModal');
}

function selectRoleFromModal(targetRole) {
  closeModal('roleSwitcherModal');
  switchRoleTo(targetRole);
}

function switchRoleTo(newRole) {
  const currentRole = getCurrentRole();
  if (newRole === currentRole) {
    showToast(`Already in ${newRole === 'owner' ? 'Owner' : newRole === 'manager' ? 'Manager' : 'Kiosk'} mode.`, 'info');
    return;
  }

  // If going to Owner from Manager or Kiosk: require PIN!
  if (newRole === 'owner') {
    openOwnerPinModal(() => {
      const sec = getSecuritySettings();
      sec.currentRole = 'owner';
      saveSecuritySettings(sec);
      renderAllViews();
      showToast('Switched to Owner Mode. All records and settings unlocked!', 'success');
    }, 'Switch to Owner Mode', 'Enter 4-digit Owner PIN to unlock all store records');
    return;
  }

  if (newRole === 'kiosk') {
    launchKioskTerminal();
    return;
  }

  if (newRole === 'manager') {
    if (getActivePlan() !== 'business') {
      openFeaturePaywall('manager_role');
      return;
    }
    const sec = getSecuritySettings();
    sec.currentRole = 'manager';
    saveSecuritySettings(sec);
    renderAllViews();
    showToast('Switched to Manager Mode. Salary records are now locked.', 'info');
  }
}

function promptUnlockWithPin(returnTab = 'salary') {
  openOwnerPinModal(() => {
    const sec = getSecuritySettings();
    sec.currentRole = 'owner';
    saveSecuritySettings(sec);
    renderAllViews();
    switchTab(returnTab);
    showToast('Owner Mode activated. Records unlocked!', 'success');
  }, 'Unlock Store Financials', 'Enter Owner PIN to unlock full access');
}

// Settings PIN & Pairing updates
function handleChangeOwnerPin(e) {
  if (e && e.preventDefault) e.preventDefault();
  const input = document.getElementById('newOwnerPinInput');
  if (!input) return false;
  const newPin = input.value.trim();
  if (!/^\d{4}$/.test(newPin)) {
    showToast('PIN must be exactly 4 numeric digits (e.g. 5678)', 'warning');
    return false;
  }
  const sec = getSecuritySettings();
  sec.ownerPin = newPin;
  saveSecuritySettings(sec);
  input.value = '';
  showToast(`Owner PIN successfully updated to ${newPin}!`, 'success');
  return false;
}

function generateNewPairCode() {
  const sec = getSecuritySettings();
  sec.managerCode = 'MGR-' + Math.floor(1000 + Math.random() * 9000);
  saveSecuritySettings(sec);
  showToast(`New secondary device pair code generated: ${sec.managerCode}`, 'success');
}

function copyManagerInviteCode() {
  const sec = getSecuritySettings();
  const code = sec.managerCode || 'MGR-8842';
  const text = `Karmiq Manager Login Link & Code: ${code} (Scan or enter on counter tablet)`;
  if (navigator.clipboard) {
    navigator.clipboard.writeText(text).then(() => {
      showToast('Manager invite code copied to clipboard!', 'success');
    });
  } else {
    showToast(`Manager Code: ${code}`, 'info');
  }
}

// =============================================================================
// COUNTER KIOSK TERMINAL ENGINE
// =============================================================================
let kioskClockTimer = null;
let kioskVideoMediaStream = null;

function launchKioskTerminal() {
  const overlay = document.getElementById('kioskTerminalOverlay');
  if (!overlay) return;

  const shop = getShopSettings();
  const titleEl = document.getElementById('kioskShopTitle');
  if (titleEl) titleEl.textContent = shop.shopName || 'My Business';

  overlay.classList.add('active');
  document.body.style.overflow = 'hidden';

  // Start Live Digital Clock
  updateKioskClock();
  clearInterval(kioskClockTimer);
  kioskClockTimer = setInterval(updateKioskClock, 1000);

  // Render Kiosk Tap staff grid and recent punches feed
  renderKioskTapStaff();
  renderKioskPunchesFeed();

  // Attempt camera initialization for kiosk
  startKioskCamera();

  showToast('Counter Attendance Kiosk Terminal launched!', 'info');
}

function updateKioskClock() {
  const now = new Date();
  const clockEl = document.getElementById('kioskClockDisplay');
  const dateEl = document.getElementById('kioskDateDisplay');
  if (clockEl) {
    clockEl.textContent = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
  }
  if (dateEl) {
    dateEl.textContent = now.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  }
}

function renderKioskTapStaff() {
  const grid = document.getElementById('kioskTapStaffGrid');
  if (!grid) return;
  const employees = getEmployees().filter(e => !e.isLeft);
  if (employees.length === 0) {
    grid.innerHTML = '<span style="color:#64748b; font-size:0.8rem;">No staff added yet. Add staff in Owner mode.</span>';
    return;
  }
  grid.innerHTML = employees.map(emp => `
    <button type="button" class="kiosk-tap-chip" onclick="kioskPunchStaff('${emp.id}')">
      ⚡ ${emp.name} (${emp.id})
    </button>
  `).join('');
}

function renderKioskPunchesFeed() {
  const listEl = document.getElementById('kioskPunchesList');
  const countEl = document.getElementById('kioskFeedCount');
  if (!listEl) return;

  const attendance = getAttendance();
  const employees = getEmployees();
  const punched = [];

  employees.forEach(emp => {
    const att = attendance[emp.id];
    if (att && att.status && att.status !== 'Absent') {
      punched.push({
        name: emp.name,
        role: emp.role,
        id: emp.id,
        status: att.status,
        time: att.checkInTime || 'Checked in'
      });
    }
  });

  if (countEl) countEl.textContent = `${punched.length} Present`;

  if (punched.length === 0) {
    listEl.innerHTML = `
      <div class="kiosk-empty-feed">
        No check-ins recorded yet today.<br>Staff will appear here as they scan.
      </div>
    `;
    return;
  }

  listEl.innerHTML = punched.slice(-8).reverse().map(p => `
    <div class="kiosk-punch-card">
      <div class="kiosk-punch-info">
        <div class="kiosk-punch-avatar">${p.name.substring(0,2).toUpperCase()}</div>
        <div class="kiosk-punch-meta">
          <strong>${p.name}</strong>
          <span>${p.id} • ${p.status}</span>
        </div>
      </div>
      <div class="kiosk-punch-time">${p.time}</div>
    </div>
  `).join('');
}

function kioskPunchStaff(empId) {
  const employees = getEmployees();
  const emp = employees.find(e => e.id === empId);
  if (!emp) return;

  const now = new Date();
  const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });

  const attendance = getAttendance();
  const existing = attendance[empId];
  const newStatus = (!existing || existing.status === 'Absent') ? 'Present' : existing.status;

  attendance[empId] = {
    status: newStatus,
    checkInTime: (existing && existing.checkInTime) ? existing.checkInTime : timeStr,
    checkOutTime: null,
    notes: 'Kiosk Terminal Check-in'
  };
  saveAttendance(attendance);

  playSound('success');

  const banner = document.getElementById('kioskSuccessBanner');
  const nameEl = document.getElementById('kioskSuccessName');
  const detailsEl = document.getElementById('kioskSuccessDetails');

  if (nameEl) nameEl.textContent = `${emp.name} (${emp.id})`;
  if (detailsEl) detailsEl.textContent = `✓ Attendance Marked • ${timeStr}`;

  if (banner) {
    banner.classList.add('show');
    setTimeout(() => banner.classList.remove('show'), 2800);
  }

  renderKioskPunchesFeed();
  renderAllViews();
}

async function startKioskCamera() {
  const videoEl = document.getElementById('kioskCameraVideo');
  if (!videoEl || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return;
  try {
    kioskVideoMediaStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'user' },
      audio: false
    });
    videoEl.srcObject = kioskVideoMediaStream;
    videoEl.style.display = 'block';
    await videoEl.play();
  } catch (err) {
    console.log('Kiosk camera access fallback to simulation chips:', err);
    videoEl.style.display = 'none';
  }
}

function stopKioskCamera() {
  if (kioskVideoMediaStream) {
    kioskVideoMediaStream.getTracks().forEach(track => track.stop());
    kioskVideoMediaStream = null;
  }
}

function requestExitKiosk() {
  openOwnerPinModal(() => {
    exitKioskTerminal();
  }, 'Exit Kiosk Terminal', 'Enter 4-digit Owner PIN to return to Dashboard');
}

function exitKioskTerminal() {
  const overlay = document.getElementById('kioskTerminalOverlay');
  if (overlay) overlay.classList.remove('active');
  document.body.style.overflow = '';

  clearInterval(kioskClockTimer);
  stopKioskCamera();

  const sec = getSecuritySettings();
  sec.currentRole = 'owner';
  saveSecuritySettings(sec);
  renderAllViews();

  showToast('Exited Counter Kiosk. Welcome back, Owner!', 'success');
}

// =============================================================================
// 18. INITIALIZATION & RECOVERY
// =============================================================================

function renderAllViews() {
  updateShopDisplayElements();
  if (typeof updateRoleDisplayElements === 'function') updateRoleDisplayElements();
  renderOverview();
  renderEmployees();
  renderAttendancePane();
  renderSalaryPane();
  renderReports();
  renderAajKaHisaabPane();
}

// =============================================================================
// 17. STARTUP GROWTH & MONETIZATION: ROI CALCULATOR, WHATSAPP SLIPS & SUBSCRIPTIONS
// =============================================================================

function updateRoiCalculation() {
  const staffInput = document.getElementById('calcStaffSlider');
  const salaryInput = document.getElementById('calcSalarySlider');
  if (!staffInput || !salaryInput) return;

  const staff = Number(staffInput.value) || 5;
  const avgSalary = Number(salaryInput.value) || 12000;

  // Update slider label pills
  const dispStaff = document.getElementById('dispCalcStaffCount');
  const dispSalary = document.getElementById('dispCalcSalary');
  if (dispStaff) dispStaff.textContent = `${staff} Staff`;
  if (dispSalary) dispSalary.textContent = `₹${avgSalary.toLocaleString('en-IN')} / mo`;

  // Standard Indian business baseline: 26 working days, 8 hrs/day = 208 hrs/month
  const hourlyRate = avgSalary / 208;

  // 1. Late arrival loss: 20 mins daily = 520 mins/month = 8.66 hours per staff
  const lateLossPerStaff = Math.round(hourlyRate * 8.66);
  const totalLateLoss = lateLossPerStaff * staff;

  // 2. Untracked advance disputes & notebook mistakes: ~2% of monthly staff payroll
  const totalLedgerLoss = Math.round(staff * (avgSalary * 0.02));

  // 3. Combined total savings
  const totalSaved = totalLateLoss + totalLedgerLoss;
  const planCost = 99; // Karmiq Pro cost
  const roiMultiplier = Math.max(1, Math.round(totalSaved / planCost));

  // Render to DOM
  const dispLate = document.getElementById('dispLossLate');
  const dispLedger = document.getElementById('dispLossLedger');
  const dispTotalSaved = document.getElementById('dispTotalSaved');
  const dispPaperLoss = document.getElementById('dispPaperLoss');
  const dispRoi = document.getElementById('dispRoiMultiplier');

  if (dispLate) dispLate.textContent = `₹${totalLateLoss.toLocaleString('en-IN')} / mo`;
  if (dispLedger) dispLedger.textContent = `₹${totalLedgerLoss.toLocaleString('en-IN')} / mo`;
  if (dispTotalSaved) dispTotalSaved.textContent = `₹${totalSaved.toLocaleString('en-IN')}`;
  if (dispPaperLoss) dispPaperLoss.textContent = `₹${totalSaved.toLocaleString('en-IN')} / mo`;
  if (dispRoi) dispRoi.textContent = `🚀 ${roiMultiplier}x Return on Investment (ROI)`;
}

/**
 * Format phone and text into WhatsApp web/app intent link
 */
function formatWhatsappUrl(phone, text) {
  const cleanPhone = (phone || '').replace(/[^0-9]/g, '');
  const encoded = encodeURIComponent(text);
  if (cleanPhone.length >= 10) {
    const full = cleanPhone.length === 10 ? '91' + cleanPhone : cleanPhone;
    return `https://wa.me/${full}?text=${encoded}`;
  }
  return `https://wa.me/?text=${encoded}`;
}

/**
 * Share Salary Advance receipt directly to staff on WhatsApp
 */
function shareAdvanceWhatsapp(pay) {
  if (!pay) return;
  if (getActivePlan() === 'free') {
    openFeaturePaywall('whatsapp_slips');
    return;
  }

  const employees = getEmployees();
  const emp = employees.find(e => e.id === pay.empId);
  const shop = getShopSettings();
  const sal = calculateSalaryBalance(pay.empId);
  const shopName = shop.shopName || 'Karmiq Store';

  const text =
`🧾 *SALARY ADVANCE RECEIPT*
🏪 *${shopName}*
────────────────────────
👤 *Staff Member:* ${emp ? emp.name : pay.empId} (${pay.empId})
📅 *Payment Date:* ${pay.date}
💵 *Advance Paid:* ₹${Number(pay.amount).toLocaleString('en-IN')} (${pay.mode || 'Cash'})
${pay.note ? `📝 *Purpose:* ${pay.note}\n` : ''}💰 *Remaining Salary Due:* ₹${sal.due.toLocaleString('en-IN')}
────────────────────────
✅ _Ye hisaab Karmiq Smart Attendance par record ho chuka hai._
🙏 _Dukaan Malik: ${shop.ownerName || 'Management'}_`;

  const url = formatWhatsappUrl(emp ? emp.phone : '', text);
  window.open(url, '_blank');
}

function shareAdvanceWhatsappById(payId) {
  const payments = getPayments();
  const pay = payments.find(p => p.id === payId);
  if (!pay) {
    showToast('Payment record not found', 'warning');
    return;
  }
  shareAdvanceWhatsapp(pay);
}

/**
 * Share Complete Monthly Salary Ledger to staff on WhatsApp
 */
function shareStaffMonthlyLedgerWhatsapp(empId) {
  if (getActivePlan() === 'free') {
    openFeaturePaywall('whatsapp_slips');
    return;
  }

  const id = empId || window.currentViewingEmpId;
  const employees = getEmployees();
  const emp = employees.find(e => e.id === id);
  if (!emp) {
    showToast('Please select a staff member first', 'warning');
    return;
  }

  const shop = getShopSettings();
  const sal = calculateSalaryBalance(id);
  const shopName = shop.shopName || 'Karmiq Store';
  const monthName = new Date().toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });

  const historyLines = sal.payments.length === 0
    ? '• Koi advance nahi liya gaya'
    : sal.payments.map(p => `• ${p.date}: ₹${p.amount.toLocaleString('en-IN')} (${p.mode})`).join('\n');

  const text =
`📊 *MONTHLY SALARY STATEMENT*
🏪 *${shopName}*
🗓️ *Month:* ${monthName}
────────────────────────
👤 *Staff Member:* ${emp.name} (${emp.id})
💼 *Monthly Fixed Salary:* ₹${Number(emp.salary).toLocaleString('en-IN')}
💵 *Total Advances Taken:* ₹${sal.paid.toLocaleString('en-IN')}
💰 *Net Payable Balance Due:* ₹${sal.due.toLocaleString('en-IN')}
────────────────────────
📋 *Advances Hisaab:*
${historyLines}
────────────────────────
✅ _Generated via Karmiq Staff Management App_
🙏 _Kisi bhi sawaal ke liye counter par sampark karein._`;

  const url = formatWhatsappUrl(emp.phone, text);
  window.open(url, '_blank');
}

/**
 * =============================================================================
 * 17. SUBSCRIPTION PLANS, MANUAL UPI PAYMENTS & FEATURE GATING
 * =============================================================================
 */

function getActivePlan() {
  return localStorage.getItem('karmiq_subscription_plan') || 'free';
}

function getSubscriptionData() {
  try {
    return JSON.parse(localStorage.getItem('karmiq_subscription_data') || '{}');
  } catch (e) {
    return {};
  }
}

function updateSubscriptionUi() {
  const plan = getActivePlan();
  const subData = getSubscriptionData();

  const topText = document.getElementById('topPlanText');
  const topChip = document.getElementById('topPlanChip');
  const sideBadge = document.getElementById('sidePlanBadge');
  const modalPlan = document.getElementById('modalActivePlanName');
  const btnFree = document.getElementById('btnSubFree');
  const btnPro = document.getElementById('btnSubPro');
  const btnBiz = document.getElementById('btnSubBiz');

  if (plan === 'pro') {
    if (topText) topText.textContent = 'Karmiq PRO (Unlimited)';
    if (topChip) { topChip.textContent = 'Active 💎'; topChip.style.background = '#16a34a'; }
    if (sideBadge) { sideBadge.textContent = 'ACTIVE'; sideBadge.style.background = '#dcfce7'; sideBadge.style.color = '#15803d'; }
    if (modalPlan) {
      modalPlan.innerHTML = `Dukandaar Pro (Unlimited Staff) ${subData.utr ? `<span style="font-size:0.75rem; color:#64748b; font-weight:normal;">(UTR: ${subData.utr})</span>` : ''}`;
    }
    if (btnPro) { btnPro.textContent = 'Current Plan (Active 💎)'; btnPro.disabled = true; btnPro.style.opacity = '0.7'; }
    if (btnFree) { btnFree.textContent = 'Downgrade to Free'; btnFree.disabled = false; btnFree.style.opacity = '1'; }
    if (btnBiz) { btnBiz.textContent = 'Upgrade to Business (₹199/mo)'; btnBiz.disabled = false; btnBiz.style.opacity = '1'; }
  } else if (plan === 'business') {
    if (topText) topText.textContent = 'Karmiq BUSINESS 360';
    if (topChip) { topChip.textContent = 'Active 👑'; topChip.style.background = '#2563eb'; }
    if (sideBadge) { sideBadge.textContent = 'ENTERPRISE'; sideBadge.style.background = '#dbeafe'; sideBadge.style.color = '#1d4ed8'; }
    if (modalPlan) {
      modalPlan.innerHTML = `Business 360 (Multi-Counter) ${subData.utr ? `<span style="font-size:0.75rem; color:#64748b; font-weight:normal;">(UTR: ${subData.utr})</span>` : ''}`;
    }
    if (btnBiz) { btnBiz.textContent = 'Current Plan (Active 👑)'; btnBiz.disabled = true; btnBiz.style.opacity = '0.7'; }
    if (btnPro) { btnPro.textContent = 'Switch to Pro'; btnPro.disabled = false; btnPro.style.opacity = '1'; }
    if (btnFree) { btnFree.textContent = 'Downgrade to Free'; btnFree.disabled = false; btnFree.style.opacity = '1'; }
  } else {
    // Free starter
    if (topText) topText.textContent = 'Free Plan (3 Staff)';
    if (topChip) { topChip.textContent = 'Upgrade ⚡'; topChip.style.background = '#b45309'; }
    if (sideBadge) { sideBadge.textContent = 'PRO'; sideBadge.style.background = '#fef08a'; sideBadge.style.color = '#854d0e'; }
    if (modalPlan) modalPlan.textContent = 'Free Plan (Max 3 Staff)';
    if (btnFree) { btnFree.textContent = 'Current Plan'; btnFree.disabled = true; btnFree.style.opacity = '0.6'; }
    if (btnPro) { btnPro.textContent = '⚡ Upgrade to Pro (₹99/mo)'; btnPro.disabled = false; btnPro.style.opacity = '1'; }
    if (btnBiz) { btnBiz.textContent = 'Choose Business (₹199/mo)'; btnBiz.disabled = false; btnBiz.style.opacity = '1'; }
  }
}

function openSubscriptionModal() {
  updateSubscriptionUi();
  openModal('subscriptionModal');
}

/**
 * Open Manual UPI Payment Modal
 */
function openUpiPaymentModal(planKey = 'pro') {
  window.currentUpgradingPlan = planKey;
  const isBiz = planKey === 'business';
  const amount = isBiz ? 199 : 99;
  const planName = isBiz ? 'Karmiq Business 360' : 'Karmiq Dukandaar PRO';

  const badgeEl = document.getElementById('upiModalBadge');
  const titleEl = document.getElementById('upiModalTitle');
  const tagEl = document.getElementById('upiPlanTag');
  const amtEl = document.getElementById('upiAmountValue');
  const utrInput = document.getElementById('upiUtrInput');
  const phoneInput = document.getElementById('upiPayerPhoneInput');
  const qrContainer = document.getElementById('upiQrCodeContainer');
  const targetIdInput = document.getElementById('upiTargetIdInput');
  const deepLinkBtn = document.getElementById('upiDeepLinkBtn');

  if (badgeEl) badgeEl.textContent = isBiz ? '👑 BUSINESS UPGRADE' : '⚡ INSTANT PRO UPGRADE';
  if (titleEl) titleEl.textContent = `Upgrade to ${planName}`;
  if (tagEl) tagEl.textContent = isBiz ? 'Business 360 Plan (Multi-Counter & CA Reports)' : 'Dukandaar Pro (Unlimited Staff & WhatsApp)';
  if (amtEl) amtEl.innerHTML = `₹${amount} <span style="font-size:0.8rem; font-weight:500; color:#64748b;">/ 1 Month</span>`;
  if (utrInput) utrInput.value = '';

  const shop = getShopSettings();
  if (phoneInput) phoneInput.value = shop.phone || shop.ownerName || '';

  // Standard UPI URI format supported by all Indian UPI apps
  const upiId = 'karmiq@upi';
  if (targetIdInput) targetIdInput.value = upiId;

  const upiUri = `upi://pay?pa=${encodeURIComponent(upiId)}&pn=Karmiq%20India&am=${amount}&cu=INR&tn=${encodeURIComponent(planKey === 'pro' ? 'Karmiq Pro Upgrade' : 'Karmiq Business Upgrade')}`;

  // Render SVG QR Code via Karmiq QR Engine
  if (qrContainer) {
    if (window.KarmiqQrGenerator && typeof window.KarmiqQrGenerator.generateSvg === 'function') {
      qrContainer.innerHTML = window.KarmiqQrGenerator.generateSvg(upiUri, 150);
    } else {
      qrContainer.innerHTML = `<div style="padding:2rem 1rem; font-size:0.8rem; color:#475569;">Pay ₹${amount} to UPI ID: <strong>${upiId}</strong></div>`;
    }
  }

  // Deep Link for mobile users
  if (deepLinkBtn) {
    deepLinkBtn.href = upiUri;
    deepLinkBtn.style.display = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ? 'block' : 'none';
  }

  closeModal('subscriptionModal');
  closeModal('featurePaywallModal');
  openModal('upiPaymentModal');
}

/**
 * Copy Admin UPI ID
 */
function copyKarmiqUpiId() {
  const upiInput = document.getElementById('upiTargetIdInput');
  const btn = document.getElementById('btnCopyUpiId');
  const upiId = upiInput ? upiInput.value : 'karmiq@upi';

  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(upiId).then(() => {
      if (btn) {
        btn.textContent = '✓ Copied!';
        setTimeout(() => { btn.textContent = '📋 Copy'; }, 2000);
      }
      showToast(`UPI ID "${upiId}" copied to clipboard!`, 'success');
    }).catch(() => {
      fallbackCopy(upiInput, btn, upiId);
    });
  } else {
    fallbackCopy(upiInput, btn, upiId);
  }
}

function fallbackCopy(input, btn, upiId) {
  if (input) {
    input.select();
    document.execCommand('copy');
  }
  if (btn) {
    btn.textContent = '✓ Copied!';
    setTimeout(() => { btn.textContent = '📋 Copy'; }, 2000);
  }
  showToast(`UPI ID "${upiId}" copied!`, 'success');
}

/**
 * Submit UTR & Activate Plan
 */
function submitUpiSubscription() {
  const utrInput = document.getElementById('upiUtrInput');
  const phoneInput = document.getElementById('upiPayerPhoneInput');
  const utr = utrInput ? utrInput.value.trim() : '';
  const payer = phoneInput ? phoneInput.value.trim() : '';
  const planKey = window.currentUpgradingPlan || 'pro';
  const amount = planKey === 'business' ? 199 : 99;

  if (!utr || utr.length < 6) {
    showToast('Kripya valid 12-digit UPI UTR / Reference number enter karein', 'warning');
    if (utrInput) utrInput.focus();
    return;
  }

  const subData = {
    plan: planKey,
    amount,
    utr,
    payer,
    activatedAt: new Date().toISOString(),
    validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    status: 'active'
  };

  localStorage.setItem('karmiq_subscription_plan', planKey);
  localStorage.setItem('karmiq_subscription_data', JSON.stringify(subData));

  // Sync with store settings if Supabase is active
  const storeId = getActiveStoreId();
  if (storeId && typeof dbUpdateStore === 'function') {
    dbUpdateStore(storeId, { subscriptionPlan: planKey, subscriptionUtr: utr }).catch(console.warn);
  }

  playSound('success');
  showToast(`🎉 Badhaai ho! UTR ${utr} ke saath Karmiq ${planKey.toUpperCase()} plan activate ho chuka hai!`, 'success');

  closeModal('upiPaymentModal');
  updateSubscriptionUi();
  renderAllViews();
}

/**
 * Share Screenshot on WhatsApp Support
 */
function shareSubscriptionProofOnWhatsapp() {
  const utrInput = document.getElementById('upiUtrInput');
  const phoneInput = document.getElementById('upiPayerPhoneInput');
  const utr = utrInput ? utrInput.value.trim() : '';
  const payer = phoneInput ? phoneInput.value.trim() : '';
  const planKey = window.currentUpgradingPlan || 'pro';
  const amount = planKey === 'business' ? 199 : 99;
  const shop = getShopSettings();

  const text =
`Namaste Karmiq Team!
Maine Karmiq ${planKey.toUpperCase()} subscription ke liye ₹${amount} UPI pay kiya hai.

🏪 Shop Name: ${shop.shopName || 'Karmiq User'}
👤 Owner Name: ${shop.ownerName || ''}
📱 Sender Mobile: ${payer || shop.phone || ''}
🧾 UTR / Reference No: ${utr || '[Attaching screenshot]'}
⚡ Plan Selected: ${planKey === 'business' ? 'Business 360 (₹199/mo)' : 'Dukandaar Pro (₹99/mo)'}

Kripya verify karke confirmation dein!`;

  const waUrl = formatWhatsappUrl('919414710000', text);
  window.open(waUrl, '_blank');
}

/**
 * Feature Paywall Trigger Modal
 */
function openFeaturePaywall(featureKey) {
  const iconEl = document.getElementById('paywallIcon');
  const badgeEl = document.getElementById('paywallBadge');
  const titleEl = document.getElementById('paywallTitle');
  const descEl = document.getElementById('paywallDesc');
  const benefitsBox = document.getElementById('paywallBenefitsBox');
  const priceEl = document.getElementById('paywallPrice');
  const actionBtn = document.getElementById('paywallActionBtn');

  if (featureKey === 'staff_limit') {
    if (iconEl) iconEl.textContent = '👥';
    if (badgeEl) { badgeEl.textContent = '⚡ DUKANDAAR PRO'; badgeEl.style.background = '#fef3c7'; badgeEl.style.color = '#b45309'; }
    if (titleEl) titleEl.textContent = 'Staff Limit Reached (3/3 Free Limit)';
    if (descEl) descEl.textContent = 'Free Starter plan par maximum 3 staff allowed hain. Naye staff add karne aur QR cards banane ke liye Dukandaar PRO lijiye.';
    if (benefitsBox) {
      benefitsBox.innerHTML = `
        <ul class="paywall-benefits-list">
          <li><span class="check">✓</span> <strong>Unlimited Staff Members</strong> (3 ki limit khatam)</li>
          <li><span class="check">✓</span> <strong>1-Click WhatsApp Advance & Salary Slips</strong></li>
          <li><span class="check">✓</span> <strong>Smart Late-Fine & Penalty Rules</strong></li>
          <li><span class="check">✓</span> <strong>Real-time Cloud Sync & Backup</strong></li>
        </ul>
      `;
    }
    if (priceEl) priceEl.innerHTML = `₹99 <span style="font-size:0.75rem; font-weight:600; color:#64748b;">/ month</span>`;
    if (actionBtn) {
      actionBtn.textContent = '⚡ Pay ₹99 via UPI & Unlock Unlimited Staff →';
      window.currentPaywallAction = () => openUpiPaymentModal('pro');
    }
  } else if (featureKey === 'whatsapp_slips') {
    if (iconEl) iconEl.textContent = '💬';
    if (badgeEl) { badgeEl.textContent = '⚡ DUKANDAAR PRO'; badgeEl.style.background = '#dcfce7'; badgeEl.style.color = '#15803d'; }
    if (titleEl) titleEl.textContent = 'Instant WhatsApp Slips & Receipts';
    if (descEl) descEl.textContent = 'Staff ke personal WhatsApp par automatic advance receipts aur monthly salary hisaab bhejna Dukandaar PRO ka feature hai.';
    if (benefitsBox) {
      benefitsBox.innerHTML = `
        <ul class="paywall-benefits-list">
          <li><span class="check">✓</span> <strong>Instant WhatsApp Advance Receipts</strong> (Staff dispute 0%)</li>
          <li><span class="check">✓</span> <strong>Monthly WhatsApp Salary Statement</strong></li>
          <li><span class="check">✓</span> <strong>Shop Name & Owner Details on Slip</strong></li>
          <li><span class="check">✓</span> <strong>Unlimited Staff Included</strong></li>
        </ul>
      `;
    }
    if (priceEl) priceEl.innerHTML = `₹99 <span style="font-size:0.75rem; font-weight:600; color:#64748b;">/ month</span>`;
    if (actionBtn) {
      actionBtn.textContent = '⚡ Pay ₹99 via UPI & Unlock WhatsApp Slips →';
      window.currentPaywallAction = () => openUpiPaymentModal('pro');
    }
  } else if (featureKey === 'manager_role') {
    if (iconEl) iconEl.textContent = '👑';
    if (badgeEl) { badgeEl.textContent = '👑 BUSINESS 360'; badgeEl.style.background = '#dbeafe'; badgeEl.style.color = '#1d4ed8'; }
    if (titleEl) titleEl.textContent = 'Multi-Device Manager Mode & PIN';
    if (descEl) descEl.textContent = 'Counter boy ya manager ko alag PIN se access dene aur Malik ka private salary ledger hide rakhne ke liye Business 360 plan lijiye.';
    if (benefitsBox) {
      benefitsBox.innerHTML = `
        <ul class="paywall-benefits-list">
          <li><span class="check">✓</span> <strong>Separate Manager Login & PIN</strong></li>
          <li><span class="check">✓</span> <strong>Financials & Salaries Hidden from Manager</strong></li>
          <li><span class="check">✓</span> <strong>CA-Ready Annual Audit PDF & Excel</strong></li>
          <li><span class="check">✓</span> <strong>Dedicated Phone Relationship Manager</strong></li>
        </ul>
      `;
    }
    if (priceEl) priceEl.innerHTML = `₹199 <span style="font-size:0.75rem; font-weight:600; color:#64748b;">/ month</span>`;
    if (actionBtn) {
      actionBtn.textContent = '👑 Pay ₹199 via UPI & Unlock Business 360 →';
      window.currentPaywallAction = () => openUpiPaymentModal('business');
    }
  } else if (featureKey === 'ca_report') {
    if (iconEl) iconEl.textContent = '📑';
    if (badgeEl) { badgeEl.textContent = '👑 BUSINESS 360'; badgeEl.style.background = '#dbeafe'; badgeEl.style.color = '#1d4ed8'; }
    if (titleEl) titleEl.textContent = 'CA-Ready Annual Tax & Audit Ledger';
    if (descEl) descEl.textContent = 'Income Tax, GST aur Bank Business Loans ke liye certified financial report download sirf Business 360 plan mein available hai.';
    if (benefitsBox) {
      benefitsBox.innerHTML = `
        <ul class="paywall-benefits-list">
          <li><span class="check">✓</span> <strong>1-Click CA-Ready Financial Ledger CSV</strong></li>
          <li><span class="check">✓</span> <strong>Complete Monthly Salary & Advance Breakdown</strong></li>
          <li><span class="check">✓</span> <strong>Multi-Device Manager vs Owner PIN Security</strong></li>
          <li><span class="check">✓</span> <strong>Priority Relationship Support</strong></li>
        </ul>
      `;
    }
    if (priceEl) priceEl.innerHTML = `₹199 <span style="font-size:0.75rem; font-weight:600; color:#64748b;">/ month</span>`;
    if (actionBtn) {
      actionBtn.textContent = '👑 Pay ₹199 via UPI & Unlock CA Reports →';
      window.currentPaywallAction = () => openUpiPaymentModal('business');
    }
  } else if (featureKey === 'late_fine') {
    if (iconEl) iconEl.textContent = '⏰';
    if (badgeEl) { badgeEl.textContent = '⚡ DUKANDAAR PRO'; badgeEl.style.background = '#fef3c7'; badgeEl.style.color = '#b45309'; }
    if (titleEl) titleEl.textContent = 'Auto Late-Fine & Penalty Rules';
    if (descEl) descEl.textContent = 'Staff ke late aane par automatic deduction aur penalty hisaab lagane ke liye Dukandaar PRO lijiye.';
    if (benefitsBox) {
      benefitsBox.innerHTML = `
        <ul class="paywall-benefits-list">
          <li><span class="check">✓</span> <strong>Automatic Late Fine Deductions (₹50 / min)</strong></li>
          <li><span class="check">✓</span> <strong>Zero argument with staff at month-end</strong></li>
          <li><span class="check">✓</span> <strong>WhatsApp Advance Slips Included</strong></li>
          <li><span class="check">✓</span> <strong>Unlimited Staff Members</strong></li>
        </ul>
      `;
    }
    if (priceEl) priceEl.innerHTML = `₹99 <span style="font-size:0.75rem; font-weight:600; color:#64748b;">/ month</span>`;
    if (actionBtn) {
      actionBtn.textContent = '⚡ Pay ₹99 via UPI & Unlock Late-Fine Rules →';
      window.currentPaywallAction = () => openUpiPaymentModal('pro');
    }
  }

  openModal('featurePaywallModal');
}

function handlePaywallAction() {
  if (typeof window.currentPaywallAction === 'function') {
    window.currentPaywallAction();
  } else {
    openUpiPaymentModal('pro');
  }
}

/**
 * 1-Click CA-Ready Audit Report Export (Business 360 Only)
 */
function exportCaReport() {
  const plan = getActivePlan();
  if (plan !== 'business') {
    openFeaturePaywall('ca_report');
    return;
  }

  const shop = getShopSettings();
  const employees = getEmployees();
  const attendance = getAttendance();

  let csvContent = "data:text/csv;charset=utf-8,";
  csvContent += `KARMIQ CA-READY AUDIT & FINANCIAL SALARY REPORT\n`;
  csvContent += `Business: ${shop.shopName || 'Karmiq Store'}, Owner: ${shop.ownerName || ''}, Phone: ${shop.phone || ''}\n`;
  csvContent += `Generated On: ${new Date().toLocaleString('en-IN')}\n\n`;
  csvContent += `EMP ID,Staff Name,Role,Monthly Salary (INR),Advances Paid (INR),Balance Due (INR),Total Out Breaks,Status\n`;

  employees.forEach(emp => {
    const sal = calculateSalaryBalance(emp.id);
    const eff = getEmployeeEffectiveStatus(emp.id);
    const row = [
      emp.id,
      `"${emp.name}"`,
      `"${emp.role || 'Staff'}"`,
      emp.salary || 0,
      sal.paid || 0,
      sal.due || 0,
      (attendance[emp.id]?.outBreaks || []).length,
      `"${eff.key}"`
    ];
    csvContent += row.join(",") + "\n";
  });

  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", `Karmiq_CA_Audit_Report_${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  showToast('📄 CA-Ready Financial Ledger exported successfully!', 'success');
}

/**
 * Confirm Downgrade to Free
 */
function confirmDowngradeToFree() {
  if (confirm('Kya aap sach mein Free Starter plan par switch karna chahte hain? Free plan par WhatsApp slips lock ho jayengi aur staff limit 3 ho jayegi.')) {
    activatePlan('free');
  }
}

function activatePlan(planKey) {
  localStorage.setItem('karmiq_subscription_plan', planKey);
  updateSubscriptionUi();
  closeModal('subscriptionModal');

  if (planKey === 'pro') {
    playSound('success');
    showToast('🎉 Badhaai ho! Karmiq PRO activate ho gaya hai! Unlimited staff aur WhatsApp slips unlock ho gaye hain!', 'success');
  } else if (planKey === 'business') {
    playSound('success');
    showToast('👑 Karmiq Business 360 plan activated! Multi-counter & Priority Relationship manager unlocked!', 'success');
  } else {
    showToast('Switched to Free plan (Upto 3 staff)', 'info');
  }
  renderAllViews();
}

function initApp() {
  // Inject landing hero QR code
  const heroQr = document.getElementById('landingHeroQr');
  if (heroQr) {
    heroQr.innerHTML = generateEmployeeQR('DEMO', 90);
  }

  updateShopDisplayElements();
  updateRoiCalculation();
  updateSubscriptionUi();
  renderAllViews();

  // Restore saved view or default to landing
  const savedView = localStorage.getItem(STORAGE_KEYS.CURRENT_VIEW);
  const savedTab = localStorage.getItem(STORAGE_KEYS.ACTIVE_TAB) || 'overview';

  if (savedView === 'dashboard') {
    switchView('dashboard');
    switchTab(savedTab);
  } else {
    switchView('landing');
  }

  // Real-time automatic background checker (every 30 seconds)
  // Automatically handles:
  // 1. Crossing 8:00 PM (or closing time) -> transitions to 'Day Off'
  // 2. Crossing 12:00 AM Midnight -> resets all to 'Absent' for the new day
  setInterval(() => {
    const rolledOver = checkAndRolloverDate();
    if (rolledOver) {
      renderAllViews();
    } else {
      const curView = localStorage.getItem(STORAGE_KEYS.CURRENT_VIEW);
      if (curView === 'dashboard') {
        renderOverview();
      }
    }
  }, 30000);
}

// Launch on DOM ready
document.addEventListener('DOMContentLoaded', initApp);
