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
