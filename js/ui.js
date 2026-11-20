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
    } else if (type === 'duplicate' || type === 'error') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(220, now);
      osc.frequency.setValueAtTime(140, now + 0.12);
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
      osc.start(now);
      osc.stop(now + 0.3);
    } else if (type === 'info') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, now);
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
      osc.start(now);
      osc.stop(now + 0.2);
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
    const remaining = document.querySelectorAll('.modal-overlay.open');
    if (!remaining || remaining.length === 0) {
      document.body.style.overflow = '';
    }
  }
}

// Close modals when clicking backdrop
document.addEventListener('click', (e) => {
  if (e.target.classList.contains('modal-overlay')) {
    e.target.classList.remove('open');
    const remaining = document.querySelectorAll('.modal-overlay.open');
    if (!remaining || remaining.length === 0) {
      document.body.style.overflow = '';
    }
  }
});

// Close modals when pressing Escape key
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    const openModals = document.querySelectorAll('.modal-overlay.open');
    if (openModals.length > 0) {
      openModals.forEach(m => m.classList.remove('open'));
      document.body.style.overflow = '';
    }
  }
});
