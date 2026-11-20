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

  // Shop's operational working hours (from earliest arrival to latest departure)
  const shopHours = typeof calculateShopTodayWorkingHours === 'function'
    ? calculateShopTodayWorkingHours()
    : { hours: 0, mins: 0, text: '0h 00m' };
  if (statTodayHours) statTodayHours.textContent = shopHours.text;
  
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
