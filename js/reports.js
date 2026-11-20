// =============================================================================
// 15. REPORTS & AAJ KA HISAAB (DEDICATED FULL VIEW)
// =============================================================================

function renderReports() {
  const employees = getEmployees();
  const tbody = document.getElementById('reportTableBody');
  if (!tbody) return;

  const today = new Date();
  const reportYear = window.currentReportYear !== undefined ? window.currentReportYear : today.getFullYear();
  const reportMonth = window.currentReportMonth !== undefined ? window.currentReportMonth : today.getMonth();

  // Sync Month Display
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const monthTextEl = document.getElementById('reportSelectedMonthText');
  if (monthTextEl) {
    monthTextEl.textContent = `${monthNames[reportMonth]} ${reportYear}`;
  }

  if (employees.length === 0) {
    tbody.innerHTML = '<tr><td colspan="10" style="text-align:center; padding:3rem 1rem; color:var(--text-muted);">No staff records found. Add staff members to generate reports.</td></tr>';
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
    const stats = typeof getStaffMonthlyAttendanceStats === 'function' 
      ? getStaffMonthlyAttendanceStats(emp.id, reportYear, reportMonth)
      : { presentDays: 0, absentDays: 0, halfDays: 0, totalHoursText: '0h 00m', avgHoursText: '0h 00m', totalWorkedMins: 0 };

    totalSalary += sal.salary;
    totalPaid += sal.paid;
    totalHoursMins += stats.totalWorkedMins;

    return `
      <tr>
        <td>
          <strong style="color:var(--text-white);">${emp.name}</strong>
          <div style="font-size:0.75rem; color:var(--text-muted);">${emp.role} • ${emp.id}</div>
        </td>
        <td><strong class="text-green" style="font-size:0.95rem;">${stats.presentDays} Din</strong></td>
        <td><strong class="text-red" style="font-size:0.95rem;">${stats.absentDays} Din</strong></td>
        <td><strong class="text-amber" style="font-size:0.95rem;">${stats.halfDays} Din</strong></td>
        <td><strong style="color:#2563eb; font-family:var(--font-heading); font-size:0.95rem;">${stats.totalHoursText}</strong></td>
        <td>${stats.avgHoursText}</td>
        <td>₹${Number(sal.salary).toLocaleString('en-IN')}</td>
        <td class="text-green">₹${sal.paid.toLocaleString('en-IN')}</td>
        <td class="text-amber"><strong>₹${sal.due.toLocaleString('en-IN')}</strong></td>
        <td>
          <button type="button" class="btn btn-outline btn-xs" onclick="openStaffMonthlyAttendanceModal('${emp.id}')"
            style="color:#1d4ed8; border-color:#93c5fd; font-weight:700; background:#eff6ff; padding:0.25rem 0.55rem; white-space:nowrap;">
            📅 Rozana Sheet &rarr;
          </button>
        </td>
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

// Change Report Month Filter (e.g. Previous or Next Month)
function changeReportMonth(delta) {
  const today = new Date();
  let year = window.currentReportYear !== undefined ? window.currentReportYear : today.getFullYear();
  let month = window.currentReportMonth !== undefined ? window.currentReportMonth : today.getMonth();

  month += delta;
  if (month < 0) {
    month = 11;
    year -= 1;
  } else if (month > 11) {
    month = 0;
    year += 1;
  }

  window.currentReportYear = year;
  window.currentReportMonth = month;
  renderReports();
}

// Open Dedicated Day-by-Day Monthly Register Sheet Modal
function openStaffMonthlyAttendanceModal(empId) {
  const employees = getEmployees();
  const emp = employees.find(e => e.id === empId);
  if (!emp) return;

  const today = new Date();
  const reportYear = window.currentReportYear !== undefined ? window.currentReportYear : today.getFullYear();
  const reportMonth = window.currentReportMonth !== undefined ? window.currentReportMonth : today.getMonth();
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const monthName = `${monthNames[reportMonth]} ${reportYear}`;

  const stats = typeof getStaffMonthlyAttendanceStats === 'function' 
    ? getStaffMonthlyAttendanceStats(emp.id, reportYear, reportMonth)
    : { presentDays: 0, absentDays: 0, halfDays: 0, weeklyOffDays: 0, totalHoursText: '0h 00m', avgHoursText: '0h 00m', dailyLogs: [] };

  const sal = calculateSalaryBalance(emp.id);

  // Set Modal Header
  const titleEl = document.getElementById('monAttModalTitle');
  const subEl = document.getElementById('monAttModalSub');
  if (titleEl) titleEl.textContent = `${emp.name} — Rozana Haziri Register (${monthName})`;
  if (subEl) subEl.textContent = `${emp.role} • EMP ID: ${emp.id} • Fixed Salary: ₹${Number(emp.salary).toLocaleString('en-IN')}/mo`;

  // Set KPI Chips
  const kpisWrap = document.getElementById('monAttModalKpis');
  if (kpisWrap) {
    kpisWrap.innerHTML = `
      <div style="background:#f0fdf4; border:1px solid #bbf7d0; border-radius:10px; padding:0.65rem 0.85rem; text-align:center;">
        <span style="font-size:0.7rem; color:#166534; font-weight:700; text-transform:uppercase;">PRESENT DAYS</span>
        <div style="font-size:1.35rem; font-weight:900; color:#15803d; margin-top:0.2rem;">${stats.presentDays} <span style="font-size:0.75rem;">Din</span></div>
      </div>
      <div style="background:#fef2f2; border:1px solid #fecaca; border-radius:10px; padding:0.65rem 0.85rem; text-align:center;">
        <span style="font-size:0.7rem; color:#991b1b; font-weight:700; text-transform:uppercase;">ABSENT DAYS</span>
        <div style="font-size:1.35rem; font-weight:900; color:#dc2626; margin-top:0.2rem;">${stats.absentDays} <span style="font-size:0.75rem;">Din</span></div>
      </div>
      <div style="background:#fffbeb; border:1px solid #fde68a; border-radius:10px; padding:0.65rem 0.85rem; text-align:center;">
        <span style="font-size:0.7rem; color:#92400e; font-weight:700; text-transform:uppercase;">HALF DAYS</span>
        <div style="font-size:1.35rem; font-weight:900; color:#d97706; margin-top:0.2rem;">${stats.halfDays} <span style="font-size:0.75rem;">Din</span></div>
      </div>
      <div style="background:#eff6ff; border:1px solid #bfdbfe; border-radius:10px; padding:0.65rem 0.85rem; text-align:center;">
        <span style="font-size:0.7rem; color:#1e40af; font-weight:700; text-transform:uppercase;">TOTAL LOGGED TIME</span>
        <div style="font-size:1.35rem; font-weight:900; color:#1d4ed8; margin-top:0.2rem;">${stats.totalHoursText}</div>
      </div>
    `;
  }

  // Populate Day-by-Day Table Body
  const tableBody = document.getElementById('monAttTableBody');
  if (tableBody) {
    tableBody.innerHTML = stats.dailyLogs.map(log => {
      let statusBadge = '';
      let rowBg = '';

      if (log.isFuture) {
        statusBadge = `<span class="badge-mini" style="background:#f1f5f9; color:#94a3b8;">⚪ Aane Waala</span>`;
        rowBg = 'opacity:0.6;';
      } else if (log.status === 'Present') {
        statusBadge = `<span class="status-badge present">🟢 Present</span>`;
        rowBg = 'background:#ffffff;';
      } else if (log.status === 'Half Day') {
        statusBadge = `<span class="status-badge halfday">🟡 Half Day</span>`;
        rowBg = 'background:#fffdf5;';
      } else if (log.status === 'Weekly Off') {
        statusBadge = `<span class="badge-mini" style="background:#e2e8f0; color:#475569; font-weight:700;">⚪ Weekly Off</span>`;
        rowBg = 'background:#f8fafc;';
      } else {
        statusBadge = `<span class="status-badge absent">🔴 Absent</span>`;
        rowBg = 'background:#fef2f2;';
      }

      const isTodayTag = log.isToday ? `<span class="badge-mini" style="background:#dbeafe; color:#1d4ed8; font-size:0.65rem; margin-left:0.35rem;">AAJ</span>` : '';

      return `
        <tr style="${rowBg}">
          <td style="font-weight:700; color:#0f172a;">
            ${String(log.dayNum).padStart(2, '0')} ${monthNames[reportMonth].slice(0, 3)} (${log.dayName})
            ${isTodayTag}
          </td>
          <td>${statusBadge}</td>
          <td style="font-weight:700; color:#15803d;">${log.checkIn}</td>
          <td style="font-weight:700; color:#b45309;">${log.checkOut}</td>
          <td style="font-weight:800; color:#1e40af; font-family:var(--font-heading);">${log.hoursText}</td>
          <td style="font-size:0.78rem; color:#64748b;">${log.note}</td>
        </tr>
      `;
    }).join('');
  }

  openModal('staffMonthlyAttendanceModal');
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
  const shopHours = typeof calculateShopTodayWorkingHours === 'function'
    ? calculateShopTodayWorkingHours()
    : { hours: 0, mins: 0, text: '0h 00m' };

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
  if (hisaabWorkingHours) hisaabWorkingHours.textContent = shopHours.text;
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
