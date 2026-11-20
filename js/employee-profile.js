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
  if (typeof getActivePlan === 'function' && (getActivePlan() || '').toLowerCase() !== 'pro') {
    if (typeof openFeaturePaywall === 'function') {
      openFeaturePaywall('id_card');
      return;
    }
  }

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
  if (typeof getActivePlan === 'function' && (getActivePlan() || '').toLowerCase() !== 'pro') {
    if (typeof openFeaturePaywall === 'function') openFeaturePaywall('id_card');
    return;
  }
  window.print();
}
