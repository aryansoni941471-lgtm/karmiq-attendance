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
  if ((getActivePlan() || '').toLowerCase() !== 'pro') {
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
  if ((getActivePlan() || '').toLowerCase() !== 'pro') {
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
  return (localStorage.getItem('karmiq_subscription_plan') || 'free').toLowerCase();
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
      modalPlan.innerHTML = `Dukandaar Pro (Unlimited Staff + QR IDs + Slips) ${subData.utr ? `<span style="font-size:0.75rem; color:#64748b; font-weight:normal;">(UTR: ${subData.utr})</span>` : ''}`;
    }
    if (btnPro) { btnPro.textContent = 'Current Plan (Active 💎)'; btnPro.disabled = true; btnPro.style.opacity = '0.7'; }
    if (btnFree) { btnFree.textContent = 'Downgrade to Free'; btnFree.disabled = false; btnFree.style.opacity = '1'; }
    if (btnBiz) { btnBiz.style.display = 'none'; }
  } else {
    // Free starter
    if (topText) topText.textContent = 'Free Plan (3 Staff)';
    if (topChip) { topChip.textContent = 'Upgrade ⚡'; topChip.style.background = '#b45309'; }
    if (sideBadge) { sideBadge.textContent = 'PRO'; sideBadge.style.background = '#fef08a'; sideBadge.style.color = '#854d0e'; }
    if (modalPlan) modalPlan.textContent = 'Free Plan (Max 3 Staff, No ID Cards)';
    if (btnFree) { btnFree.textContent = 'Current Plan'; btnFree.disabled = true; btnFree.style.opacity = '0.6'; }
    if (btnPro) { btnPro.textContent = '⚡ Upgrade to Pro (₹99/mo)'; btnPro.disabled = false; btnPro.style.opacity = '1'; }
    if (btnBiz) { btnBiz.style.display = 'none'; }
  }
}

function openSubscriptionModal() {
  updateSubscriptionUi();
  openModal('subscriptionModal');
}

/**
 * Open Manual UPI Payment Modal (Fixed to PRO ₹99)
 */
function openUpiPaymentModal(planKey = 'pro') {
  window.currentUpgradingPlan = 'pro';
  const isAnnual = typeof isAnnualPricing !== 'undefined' && Boolean(isAnnualPricing);
  const amount = isAnnual ? 999 : 99;
  const periodText = isAnnual ? '/ year (Annual)' : '/ month';
  const planName = 'Karmiq Dukandaar PRO';

  const badgeEl = document.getElementById('upiModalBadge');
  const titleEl = document.getElementById('upiModalTitle');
  const tagEl = document.getElementById('upiPlanTag');
  const amtEl = document.getElementById('upiAmountValue');
  const utrInput = document.getElementById('upiUtrInput');
  const phoneInput = document.getElementById('upiPayerPhoneInput');
  const qrContainer = document.getElementById('upiQrCodeContainer');
  const targetIdInput = document.getElementById('upiTargetIdInput');
  const deepLinkBtn = document.getElementById('upiDeepLinkBtn');

  if (badgeEl) badgeEl.textContent = '⚡ INSTANT PRO UPGRADE';
  if (titleEl) titleEl.textContent = `Upgrade to ${planName}`;
  if (tagEl) tagEl.textContent = 'Dukandaar Pro (Unlimited Staff + QR IDs + WhatsApp Slips + CA Reports)';
  if (amtEl) amtEl.innerHTML = `₹${amount.toLocaleString('en-IN')} <span style="font-size:0.8rem; font-weight:500; color:#64748b;">${periodText}</span>`;
  if (utrInput) utrInput.value = '';

  const shop = getShopSettings();
  if (phoneInput) phoneInput.value = shop.phone || '';

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
  const isAnnual = typeof isAnnualPricing !== 'undefined' && Boolean(isAnnualPricing);
  let amount = 99;
  if (planKey === 'business') {
    amount = isAnnual ? 1999 : 199;
  } else {
    amount = isAnnual ? 999 : 99;
  }
  const validityDays = isAnnual ? 365 : 30;

  const subData = {
    plan: planKey,
    amount,
    utr,
    payer,
    billingCycle: isAnnual ? 'annual' : 'monthly',
    activatedAt: new Date().toISOString(),
    validUntil: new Date(Date.now() + validityDays * 24 * 60 * 60 * 1000).toISOString(),
    status: 'active'
  };

  localStorage.setItem('karmiq_subscription_plan', planKey);
  localStorage.setItem('karmiq_subscription_data', JSON.stringify(subData));

  // If user entered phone/name, personalize shop info if currently blank
  if (payer) {
    const shop = getShopSettings();
    if (!shop.phone || shop.ownerName === 'Store Owner') {
      if (/^\d{10}$/.test(payer.replace(/\D/g, ''))) {
        shop.phone = payer.trim();
      } else {
        shop.ownerName = payer.trim();
      }
      localStorage.setItem(STORAGE_KEYS.SHOP, JSON.stringify(shop));
    }
  }

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

  // If on landing page, enter dashboard to view unlocked features
  const curView = localStorage.getItem(STORAGE_KEYS.CURRENT_VIEW);
  if (curView !== 'dashboard') {
    enterDashboard('overview');
  }
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
  } else if (featureKey === 'id_card') {
    if (iconEl) iconEl.textContent = '🪪';
    if (badgeEl) { badgeEl.textContent = '⚡ DUKANDAAR PRO'; badgeEl.style.background = '#fef3c7'; badgeEl.style.color = '#b45309'; }
    if (titleEl) titleEl.textContent = 'Printable Staff QR Identity Card';
    if (descEl) descEl.textContent = 'Instant printable QR ID cards aur unlimited staff Dukandaar PRO (₹99/mo) plan mein shamil hain.';
    if (benefitsBox) {
      benefitsBox.innerHTML = `
        <ul class="paywall-benefits-list">
          <li><span class="check">✓</span> <strong>Instant Printable QR Identity Cards</strong></li>
          <li><span class="check">✓</span> <strong>Unlimited Staff Members</strong> (> 3 Staff)</li>
          <li><span class="check">✓</span> <strong>1-Click WhatsApp Salary & Advance Slips</strong></li>
          <li><span class="check">✓</span> <strong>CA / Accountant Reports Export</strong></li>
        </ul>
      `;
    }
    if (priceEl) priceEl.innerHTML = `₹99 <span style="font-size:0.75rem; font-weight:600; color:#64748b;">/ month</span>`;
    if (actionBtn) {
      actionBtn.textContent = '⚡ Pay ₹99 via UPI & Unlock ID Cards →';
      window.currentPaywallAction = () => openUpiPaymentModal('pro');
    }
  } else if (featureKey === 'ca_report') {
    if (iconEl) iconEl.textContent = '📑';
    if (badgeEl) { badgeEl.textContent = '⚡ DUKANDAAR PRO'; badgeEl.style.background = '#fef3c7'; badgeEl.style.color = '#b45309'; }
    if (titleEl) titleEl.textContent = 'CA-Ready Salary Ledger & Reports';
    if (descEl) descEl.textContent = 'Income Tax aur Accountant ke liye 1-Click financial ledger download Dukandaar PRO plan mein available hai.';
    if (benefitsBox) {
      benefitsBox.innerHTML = `
        <ul class="paywall-benefits-list">
          <li><span class="check">✓</span> <strong>1-Click CA-Ready Financial Ledger CSV</strong></li>
          <li><span class="check">✓</span> <strong>Complete Monthly Salary & Advance Breakdown</strong></li>
          <li><span class="check">✓</span> <strong>Printable Staff QR ID Cards Included</strong></li>
          <li><span class="check">✓</span> <strong>Unlimited Staff & WhatsApp Slips</strong></li>
        </ul>
      `;
    }
    if (priceEl) priceEl.innerHTML = `₹99 <span style="font-size:0.75rem; font-weight:600; color:#64748b;">/ month</span>`;
    if (actionBtn) {
      actionBtn.textContent = '⚡ Pay ₹99 via UPI & Unlock CA Reports →';
      window.currentPaywallAction = () => openUpiPaymentModal('pro');
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
  } else if (featureKey === 'manager_role') {
    if (iconEl) iconEl.textContent = '🧑‍💼';
    if (badgeEl) { badgeEl.textContent = '⚡ DUKANDAAR PRO'; badgeEl.style.background = '#fef3c7'; badgeEl.style.color = '#b45309'; }
    if (titleEl) titleEl.textContent = 'Store Manager & Device Login Mode';
    if (descEl) descEl.textContent = 'Store Manager account, alag device pairing aur salary-protected view Dukandaar PRO (₹99/mo) pack mein included hai. Free plan mein Manager role allowed nahi hai.';
    if (benefitsBox) {
      benefitsBox.innerHTML = `
        <ul class="paywall-benefits-list">
          <li><span class="check">✓</span> <strong>Store Manager Account & Separate Login</strong></li>
          <li><span class="check">✓</span> <strong>Salaries & Advances Locked with 4-Digit Owner PIN</strong></li>
          <li><span class="check">✓</span> <strong>Manager Mobile/Tablet Attendance & QR Scanner</strong></li>
          <li><span class="check">✓</span> <strong>Unlimited Staff & WhatsApp Slips Included</strong></li>
        </ul>
      `;
    }
    if (priceEl) priceEl.innerHTML = `₹99 <span style="font-size:0.75rem; font-weight:600; color:#64748b;">/ month</span>`;
    if (actionBtn) {
      actionBtn.textContent = '⚡ Pay ₹99 via UPI & Unlock Store Manager Role →';
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
 * 1-Click CA-Ready Audit Report Export (PRO Feature Only)
 */
function exportCaReport() {
  const plan = (getActivePlan() || '').toLowerCase();
  if (plan !== 'pro') {
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
  csvContent += `EMP ID,Staff Name,Role,Present Days,Absent Days,Half Days,Total Hours Logged,Monthly Salary (INR),Advances Paid (INR),Balance Due (INR)\n`;

  employees.forEach(emp => {
    const sal = calculateSalaryBalance(emp.id);
    const stats = typeof getStaffMonthlyAttendanceStats === 'function' 
      ? getStaffMonthlyAttendanceStats(emp.id) 
      : { presentDays: 0, absentDays: 0, halfDays: 0, totalHoursText: '0h' };
    const row = [
      emp.id,
      `"${emp.name}"`,
      `"${emp.role || 'Staff'}"`,
      stats.presentDays,
      stats.absentDays,
      stats.halfDays,
      `"${stats.totalHoursText}"`,
      emp.salary || 0,
      sal.paid || 0,
      sal.due || 0
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
 * Print Report Handler (PRO Feature Only)
 */
function handlePrintReport() {
  const plan = (getActivePlan() || '').toLowerCase();
  if (plan !== 'pro') {
    openFeaturePaywall('ca_report');
    return;
  }
  window.print();
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
