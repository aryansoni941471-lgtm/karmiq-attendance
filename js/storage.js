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
    shopName: document.getElementById('setShopName')?.value?.trim() || current.shopName || DEFAULT_SHOP_SETTINGS.shopName,
    ownerName: document.getElementById('setOwnerName')?.value?.trim() || current.ownerName || DEFAULT_SHOP_SETTINGS.ownerName,
    phone: document.getElementById('setPhone')?.value?.trim() || current.phone || '',
    category: document.getElementById('setCategory')?.value || current.category || 'Shops',
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
  const opEl = document.getElementById('setOpeningTime');
  const clEl = document.getElementById('setClosingTime');
  const dtEl = document.getElementById('setDailyTarget');
  const graceInput = document.getElementById('setGraceMinutes');
  const fineSelect = document.getElementById('setLateFineMode');

  if (opEl) current.openingTime = opEl.value || '09:00';
  if (clEl) current.closingTime = clEl.value || '20:00';
  if (dtEl) current.dailyTargetHours = parseInt(dtEl.value, 10) || 8;
  if (graceInput) current.graceMinutes = parseInt(graceInput.value, 10) || 15;
  if (fineSelect) current.lateFineMode = fineSelect.value || 'none';

  localStorage.setItem(STORAGE_KEYS.SHOP, JSON.stringify(current));
  // ☁️ Supabase sync
  const storeId = getActiveStoreId();
  if (storeId) dbUpdateStore(storeId, current).catch(console.warn);
  updateShopDisplayElements();
  renderAllViews();
  showToast('Shop shift timings saved!', 'success');
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

// ===== DAY-BY-DAY ATTENDANCE & HISTORY OPERATIONS =====

function getAttendanceHistory() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.ATTENDANCE_HISTORY);
    if (raw && raw !== '{}') return JSON.parse(raw);
  } catch (e) {
    console.warn('Error reading attendance history:', e);
  }
  return seedMockAttendanceHistoryIfEmpty();
}

function saveAttendanceHistory(hist) {
  try {
    localStorage.setItem(STORAGE_KEYS.ATTENDANCE_HISTORY, JSON.stringify(hist || {}));
  } catch (e) {
    console.warn('Error saving attendance history:', e);
  }
}

function getAttendanceForDate(dateStr) {
  const todayStr = getLocalDateString();
  if (!dateStr || dateStr === todayStr) {
    return getAttendance();
  }
  const history = getAttendanceHistory();
  return history[dateStr] || {};
}

function saveAttendanceForDate(dateStr, att) {
  const todayStr = getLocalDateString();
  if (!dateStr || dateStr === todayStr) {
    saveAttendance(att);
    return;
  }
  const history = getAttendanceHistory();
  history[dateStr] = att;
  saveAttendanceHistory(history);
}

function manualMarkPresent(empId, dateStr, checkInTime, checkOutTime) {
  const targetDate = dateStr || window.currentAttendanceViewDate || getLocalDateString();
  const attMap = { ...getAttendanceForDate(targetDate) };
  const inTime = checkInTime || '09:15';
  const outTime = checkOutTime || (targetDate < getLocalDateString() ? '20:00' : null);

  attMap[empId] = {
    status: 'Present',
    checkInTime: inTime,
    checkOutTime: outTime,
    source: 'Manual Owner Entry'
  };

  saveAttendanceForDate(targetDate, attMap);
  renderAllViews();
  const emp = getEmployees().find(e => e.id === empId);
  playSound('success');
  showToast(`✓ ${emp ? emp.name : empId} ko ${targetDate} ke liye Present mark kiya gaya!`, 'success');
}

function manualMarkCheckOut(empId, dateStr, checkOutTime) {
  const targetDate = dateStr || window.currentAttendanceViewDate || getLocalDateString();
  const attMap = { ...getAttendanceForDate(targetDate) };
  if (!attMap[empId]) {
    attMap[empId] = { status: 'Present', checkInTime: '09:00' };
  }
  const now = new Date();
  const hh = now.getHours().toString().padStart(2, '0');
  const mm = now.getMinutes().toString().padStart(2, '0');
  const outTime = checkOutTime || `${hh}:${mm}`;

  attMap[empId].checkOutTime = outTime;
  saveAttendanceForDate(targetDate, attMap);
  renderAllViews();
  const emp = getEmployees().find(e => e.id === empId);
  playSound('success');
  showToast(`✓ ${emp ? emp.name : empId} ka Punch-Out (${outTime}) mark ho gaya!`, 'success');
}

function manualMarkAbsent(empId, dateStr) {
  const targetDate = dateStr || window.currentAttendanceViewDate || getLocalDateString();
  const attMap = { ...getAttendanceForDate(targetDate) };
  attMap[empId] = {
    status: 'Absent',
    checkInTime: null,
    checkOutTime: null,
    source: 'Manual Owner Override'
  };
  saveAttendanceForDate(targetDate, attMap);
  renderAllViews();
  const emp = getEmployees().find(e => e.id === empId);
  showToast(`🔴 ${emp ? emp.name : empId} ko ${targetDate} ke liye Absent mark kiya gaya.`, 'warning');
}

function seedMockAttendanceHistoryIfEmpty() {
  const employees = getEmployees();
  if (!employees || employees.length === 0) return {};

  const history = {};
  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth();
  const currentDay = today.getDate();

  for (let d = 1; d < currentDay; d++) {
    const dStr = String(d).padStart(2, '0');
    const mStr = String(currentMonth + 1).padStart(2, '0');
    const dateStr = `${currentYear}-${mStr}-${dStr}`;
    const dateObj = new Date(currentYear, currentMonth, d);
    const dayOfWeek = dateObj.getDay();

    if (dayOfWeek === 0) {
      continue;
    }

    const dayAtt = {};
    employees.forEach((emp, idx) => {
      const seed = (d * 7 + idx * 13) % 20;
      if (seed === 1) {
        dayAtt[emp.id] = { status: 'Absent', checkInTime: null, checkOutTime: null, note: 'Pre-informed Leave' };
      } else if (seed === 2) {
        dayAtt[emp.id] = { status: 'Half Day', checkInTime: '09:15', checkOutTime: '14:00', leaveReason: 'Doctor visit' };
      } else {
        const inMins = 10 + ((d + idx) % 20);
        const inStr = `09:${String(inMins).padStart(2, '0')}`;
        dayAtt[emp.id] = {
          status: 'Present',
          checkInTime: inStr,
          checkOutTime: '20:00',
          source: 'Live QR Camera',
          note: 'Full Shift'
        };
      }
    });

    history[dateStr] = dayAtt;
  }

  try {
    localStorage.setItem(STORAGE_KEYS.ATTENDANCE_HISTORY, JSON.stringify(history));
  } catch (e) {}

  return history;
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
