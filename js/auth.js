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
  const plan = (planName || '').toLowerCase();
  if (plan === 'pro' || plan === 'business') {
    if (typeof openUpiPaymentModal === 'function') {
      openUpiPaymentModal(plan);
      return;
    }
  }
  openSignUpModal();
}

function openDemoAuth(mode = 'login', planName = 'Free') {
  if (mode === 'signup') {
    const plan = (planName || '').toLowerCase();
    if (plan === 'pro' || plan === 'business') {
      if (typeof openUpiPaymentModal === 'function') {
        openUpiPaymentModal(plan);
        return;
      }
    }
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
    const plan = (store?.subscription_plan || getActivePlan() || '').toLowerCase();
    if (plan !== 'pro') {
      playSound('error');
      showToast('⚠️ Store Manager login sirf Karmiq PRO (₹99/mo) pack mein available hai. Free plan mein Manager role locked hai.', 'warning');
      return;
    }
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
      if ((getActivePlan() || '').toLowerCase() !== 'pro') {
        playSound('error');
        showToast('⚠️ Store Manager login sirf Karmiq PRO (₹99/mo) pack mein available hai. Free plan mein Manager role locked hai.', 'warning');
        return;
      }
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
  if ((getActivePlan() || '').toLowerCase() !== 'pro') {
    playSound('error');
    showToast('⚠️ Store Manager login sirf Karmiq PRO (₹99/mo) pack mein available hai. Free plan mein Manager role locked hai.', 'warning');
    return;
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
// SIGNUP WORKFLOW WITH EMPLOYEE-BASED SUBSCRIPTION
// =============================================================================

// Temp store for signup data across steps
let signupTempData = {};

function openSignUpModal() {
  // Reset all steps
  signupTempData = {
    selectedPlan: 'pro',
    subUtr: '',
    isTrial: false
  };
  // Clear all form fields
  const fields = ['su_shopName', 'su_ownerName', 'su_phone', 'su_adminUser', 'su_adminPass', 'su_adminPin', 'su_subUtr'];
  fields.forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  const trialCb = document.getElementById('su_trialCheckbox');
  if (trialCb) trialCb.checked = false;

  const credBox = document.getElementById('signupSuccessCreds');
  if (credBox) credBox.innerHTML = '';
  const loginLink = document.getElementById('signupLoginLink');
  if (loginLink) loginLink.style.display = '';

  onSignupEmployeesChange();
  signupGoToStepUI(1);
  openModal('signUpModal');
}

function signupGoToStepUI(step) {
  // Update step dots (1 to 4)
  for (let i = 1; i <= 4; i++) {
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
  // Show the correct panel (1 to 4)
  for (let i = 1; i <= 4; i++) {
    const panel = document.getElementById(`signupPanel${i}`);
    if (panel) {
      panel.classList.remove('active');
      if (i === step) panel.classList.add('active');
    }
  }
  // Hide login link on success step
  const loginLink = document.getElementById('signupLoginLink');
  if (loginLink) loginLink.style.display = (step === 4) ? 'none' : '';
}

/**
 * Live recommendation banner based on selected employees in Step 1
 */
function onSignupEmployeesChange() {
  const empVal = document.getElementById('su_employees')?.value || '4-15';
  const titleEl = document.getElementById('su_recPlanTitle');
  const descEl = document.getElementById('su_recPlanDesc');

  if (empVal === '1-3') {
    if (titleEl) titleEl.textContent = 'Recommended: Free Starter Plan (₹0/lifetime)';
    if (descEl) descEl.textContent = '1–3 staff members ke liye basic attendance aur salary hisaab (Bina ID Cards & Slips).';
  } else {
    if (titleEl) titleEl.textContent = 'Recommended: Dukandaar PRO Plan (₹99/mo) 🚀';
    if (descEl) descEl.textContent = 'Unlimited staff, Printable QR ID Cards, 1-Click WhatsApp Slips aur CA Reports included!';
  }
}

/**
 * Step 1 -> Step 2 (Subscription Selection based on Employees)
 */
function signupGoToStep2(e) {
  if (e && e.preventDefault) e.preventDefault();
  const shopName = (document.getElementById('su_shopName')?.value || '').trim();
  const ownerName = (document.getElementById('su_ownerName')?.value || '').trim();
  const phone = (document.getElementById('su_phone')?.value || '').trim();
  const category = document.getElementById('su_category')?.value || 'Retail Shop';
  const employees = document.getElementById('su_employees')?.value || '4-15';

  if (!shopName || !ownerName || !phone) {
    showToast('Kripya sabhi mandatory (*) fields bharo.', 'warning');
    return;
  }
  if (phone.length < 10) {
    showToast('Valid 10-digit mobile number daalo.', 'warning');
    return;
  }

  // Save step 1 data
  signupTempData.shopName = shopName;
  signupTempData.ownerName = ownerName;
  signupTempData.phone = phone;
  signupTempData.category = category;
  signupTempData.employees = employees;

  // Auto-select plan based on selected employees (Only 2 Plans: Free vs PRO)
  const defaultPlan = (employees === '1-3') ? 'free' : 'pro';

  // Update step 2 sub-header text
  const subHeader = document.getElementById('su_step2SubHeader');
  if (subHeader) {
    const staffLabel = employees === '1-3' ? '1–3 Employees' : (employees === '4-15' ? '4–15 Employees' : `${employees} Employees`);
    subHeader.innerHTML = `Aapne <strong>${staffLabel}</strong> chune hain. Us hisab se aapka plan select kiya gaya hai:`;
  }

  // Set recommendation badges on cards
  ['free', 'pro', 'business'].forEach(p => {
    const badge = document.getElementById(`suPlanBadge_${p}`);
    if (badge) badge.style.display = (p === defaultPlan) ? 'block' : 'none';
  });

  signupSelectPlan(defaultPlan);
  signupGoToStepUI(2);
}

function signupGoToStep1() {
  signupGoToStepUI(1);
}

/**
 * Change selected plan inside Step 2
 */
function signupSelectPlan(planKey) {
  signupTempData.selectedPlan = planKey;

  // Highlight card (2 Plans only)
  ['free', 'pro'].forEach(p => {
    const card = document.getElementById(`suPlanCard_${p}`);
    if (card) {
      if (p === planKey) card.classList.add('active');
      else card.classList.remove('active');
    }
  });

  // Mismatch alert: if user selected Free but has >3 staff
  const mismatchAlert = document.getElementById('su_planMismatchAlert');
  if (mismatchAlert) {
    const isStaffOver3 = signupTempData.employees && signupTempData.employees !== '1-3';
    mismatchAlert.style.display = (planKey === 'free' && isStaffOver3) ? 'block' : 'none';
  }

  const freeBox = document.getElementById('su_freePlanDetails');
  const paidBox = document.getElementById('su_paidPlanDetails');
  const amountText = document.getElementById('su_payAmountText');

  if (planKey === 'free') {
    if (freeBox) freeBox.style.display = 'block';
    if (paidBox) paidBox.style.display = 'none';
  } else {
    if (freeBox) freeBox.style.display = 'none';
    if (paidBox) paidBox.style.display = 'block';

    const amount = 99;
    if (amountText) {
      amountText.textContent = `₹${amount} / month`;
    }

    // Render UPI QR Code
    const upiId = 'karmiq@upi';
    const upiUri = `upi://pay?pa=${encodeURIComponent(upiId)}&pn=Karmiq%20India&am=${amount}&cu=INR&tn=${encodeURIComponent('Karmiq Pro Subscription')}`;
    const qrContainer = document.getElementById('su_signupQrContainer');
    if (qrContainer) {
      if (window.KarmiqQrGenerator && typeof window.KarmiqQrGenerator.generateSvg === 'function') {
        qrContainer.innerHTML = window.KarmiqQrGenerator.generateSvg(upiUri, 107);
      } else {
        qrContainer.innerHTML = `<div style="padding:1.5rem 0.5rem; font-size:0.75rem; color:#475569;">Pay ₹${amount} to UPI: <strong>${upiId}</strong></div>`;
      }
    }

    const deepLink = document.getElementById('su_upiDeepLinkBtn');
    if (deepLink) {
      deepLink.href = upiUri;
      deepLink.style.display = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ? 'inline-block' : 'none';
    }
  }
}

function onSignupTrialToggle(cb) {
  signupTempData.isTrial = Boolean(cb && cb.checked);
  const utrInput = document.getElementById('su_subUtr');
  if (utrInput) {
    if (signupTempData.isTrial) {
      utrInput.placeholder = 'Optional during free trial';
    } else {
      utrInput.placeholder = 'e.g. 423819827162';
    }
  }
}

/**
 * Step 2 -> Step 3 (Admin Setup)
 */
function signupGoToStep3() {
  const plan = signupTempData.selectedPlan || 'pro';

  if (plan !== 'free') {
    const utr = (document.getElementById('su_subUtr')?.value || '').trim();
    const isTrial = document.getElementById('su_trialCheckbox')?.checked;

    if (!isTrial && !utr) {
      showToast('⚠️ Kripya UPI payment karke 12-digit UTR enter karein, ya Free Trial checkbox par tick karein.', 'warning');
      return;
    }
    signupTempData.subUtr = utr;
    signupTempData.isTrial = isTrial;
  } else {
    signupTempData.subUtr = '';
    signupTempData.isTrial = false;
  }

  // Update Step 3 plan badge
  const badge = document.getElementById('su_step3PlanBadge');
  if (badge) {
    if (plan === 'free') {
      badge.textContent = '🟢 Free Starter (₹0)';
      badge.style.background = '#dcfce7';
      badge.style.color = '#15803d';
    } else if (plan === 'business') {
      badge.textContent = '👑 Business 360 (₹199/mo)';
      badge.style.background = '#dbeafe';
      badge.style.color = '#1d4ed8';
    } else {
      badge.textContent = '⚡ Dukandaar PRO (₹99/mo)';
      badge.style.background = '#fef08a';
      badge.style.color = '#854d0e';
    }
  }

  signupGoToStepUI(3);
}

function signupGoToStep2Back() {
  signupGoToStepUI(2);
}

/**
 * Step 3 -> Step 4 (Registration & Plan Activation)
 */
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
  const btn = document.querySelector('#signupPanel3 .btn-primary');
  if (btn) { btn.disabled = true; btn.textContent = 'Registering Store...'; }

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

  if (btn) { btn.disabled = false; btn.textContent = '🚀 Store Register Karo!'; }

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

  // ===== ACTIVATE SELECTED SUBSCRIPTION PLAN =====
  const selectedPlan = signupTempData.selectedPlan || 'free';
  const utr = signupTempData.subUtr || (signupTempData.isTrial ? 'TRIAL-7DAYS' : '');
  const amount = selectedPlan === 'free' ? 0 : (selectedPlan === 'business' ? 199 : 99);
  const planDisplayName = selectedPlan === 'free' ? 'Free Starter (Max 3 Staff)' : (selectedPlan === 'business' ? 'Business 360 (Multi-Counter)' : 'Dukandaar PRO (Unlimited)');

  const subData = {
    plan: selectedPlan,
    amount,
    utr,
    payer: signupTempData.phone || '',
    staffRange: signupTempData.employees || '',
    isTrial: Boolean(signupTempData.isTrial),
    billingCycle: 'monthly',
    activatedAt: new Date().toISOString(),
    validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    status: 'active'
  };

  localStorage.setItem('karmiq_subscription_plan', selectedPlan);
  localStorage.setItem('karmiq_subscription_data', JSON.stringify(subData));

  // Sync with store settings in Supabase if supported
  if (newStoreId && typeof dbUpdateStore === 'function') {
    dbUpdateStore(newStoreId, { subscriptionPlan: selectedPlan, subscriptionUtr: utr }).catch(console.warn);
  }

  // Pre-fill success creds box
  const credBox = document.getElementById('signupSuccessCreds');
  if (credBox) {
    credBox.innerHTML = `
      <div style="font-weight:700; color:#1e40af; font-size:0.88rem; margin-bottom:0.5rem;">📋 Aapke Login &amp; Subscription Details:</div>
      <div class="cred-row"><span class="cred-label">🏪 Store Name</span><span class="cred-val">${shop.shopName}</span></div>
      <div class="cred-row"><span class="cred-label">👥 Staff Range</span><span class="cred-val">${signupTempData.employees || '1-5'} Employees</span></div>
      <div class="cred-row"><span class="cred-label">💎 Subscription Plan</span><span class="cred-val" style="color:#16a34a; font-weight:800;">${planDisplayName}</span></div>
      ${utr ? `<div class="cred-row"><span class="cred-label">🧾 Payment Ref / UTR</span><span class="cred-val" style="font-family:monospace;">${utr}</span></div>` : ''}
      <div class="cred-row"><span class="cred-label">👑 Admin Username</span><span class="cred-val">${adminUser}</span></div>
      <div class="cred-row"><span class="cred-label">🔑 Admin Password</span><span class="cred-val">${adminPass}</span></div>
      <div class="cred-row"><span class="cred-label">🔢 Security PIN</span><span class="cred-val">${adminPin}</span></div>
      <div class="cred-row" style="border-top:1px solid #dbeafe; margin-top:0.5rem; padding-top:0.5rem;">
        <span class="cred-label">☁️ Cloud Status</span>
        <span class="cred-val" style="color:${supaStoreId ? '#16a34a' : '#f59e0b'}">${supaStoreId ? '✅ Synced to Cloud' : '⚠️ Local Storage (Ready)'}</span>
      </div>
    `;
  }

  signupGoToStepUI(4);
  playSound('success');
}

async function signupEnterDashboard() {
  const storeId = getActiveStoreId();
  const sec = getSecuritySettings();
  sec.currentRole = 'owner';
  saveSecuritySettings(sec);
  closeModal('signUpModal');

  // Update subscription UI immediately
  if (typeof updateSubscriptionUi === 'function') {
    updateSubscriptionUi();
  }

  showToast(`Welcome to Karmiq, ${signupTempData.ownerName || 'Store Owner'}! 🎉 Apna pehla staff member add karo.`, 'success');
  enterDashboard('overview');
  // Pull any existing cloud data
  if (storeId && typeof dbSyncFromCloud === 'function') {
    dbSyncFromCloud(storeId).catch(console.warn);
  }
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

  showToast(`Admin credentials updated successfully for ${newUser}!`, 'success');
  return false;
}

function handleSaveManagerCreds(e) {
  if (e && e.preventDefault) e.preventDefault();
  if ((getActivePlan() || '').toLowerCase() !== 'pro') {
    openFeaturePaywall('manager_role');
    return false;
  }
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

  showToast(`Manager details updated successfully for ${newUser}!`, 'success');
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

  if (show && (getActivePlan() || '').toLowerCase() !== 'pro') {
    openFeaturePaywall('manager_role');
    return;
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
  if ((getActivePlan() || '').toLowerCase() !== 'pro') {
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
  if ((getActivePlan() || '').toLowerCase() !== 'pro') {
    openFeaturePaywall('manager_role');
    return;
  }
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
  if ((getActivePlan() || '').toLowerCase() !== 'pro') {
    openFeaturePaywall('manager_role');
    return;
  }
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
