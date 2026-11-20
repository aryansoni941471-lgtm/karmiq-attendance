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
    if ((getActivePlan() || '').toLowerCase() !== 'pro') {
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
