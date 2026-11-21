// =============================================================================
// 12. ATTENDANCE SHEET & BREAKS LOGIC
// =============================================================================

function renderAttendancePane() {
  const employees = getEmployees();
  const viewDate = window.currentAttendanceViewDate || getLocalDateString();
  const isToday = (viewDate === getLocalDateString());
  const attendance = typeof getAttendanceForDate === 'function' ? getAttendanceForDate(viewDate) : getAttendance();
  const container = document.getElementById('attendanceDetailedList');
  if (!container) return;

  // Sync Date Picker input & badge in DOM
  const datePicker = document.getElementById('attendanceDatePicker');
  const dateBadge = document.getElementById('attendanceDateBadge');
  if (datePicker && datePicker.value !== viewDate) {
    datePicker.value = viewDate;
  }
  if (dateBadge) {
    if (isToday) {
      dateBadge.innerHTML = `🟢 Aaj Ki Haziri (${viewDate})`;
      dateBadge.style.background = '#dcfce7';
      dateBadge.style.color = '#15803d';
    } else {
      dateBadge.innerHTML = `📅 Purani Haziri (${viewDate})`;
      dateBadge.style.background = '#eff6ff';
      dateBadge.style.color = '#1d4ed8';
    }
  }

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
    const att = attendance[emp.id] || { status: 'Absent', checkInTime: null, checkOutTime: null };
    const initials = emp.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
    const isLeft = emp.isLeft;
    const isOut = isToday && !isLeft && (typeof isEmployeeCurrentlyOut === 'function' && isEmployeeCurrentlyOut(emp.id));
    const outBreak = isOut ? getCurrentOutBreak(emp.id) : null;
    const isHalfDay = att.status === 'Half Day';
    const isEarlyLeave = att.status === 'Early Leave';
    const isPresent = att.status === 'Present' || Boolean(att.checkInTime);
    const hasCheckedOut = Boolean(att.checkOutTime);

    // Compute working hours
    let hoursText = '0h 00m';
    let progressPct = 0;
    if (isToday && isPresent) {
      const wh = calculateWorkingHours(emp.id);
      hoursText = wh.text;
      progressPct = wh.progressPct;
    } else if (isPresent) {
      const calc = typeof calculateHoursForRecord === 'function' ? calculateHoursForRecord(att, getShopSettings()) : { text: '8h 00m' };
      hoursText = calc.text;
      progressPct = 100;
    } else if (isHalfDay) {
      hoursText = '4h 00m';
      progressPct = 50;
    }

    // Status pill
    let statusPill = '';
    if (isLeft) {
      statusPill = `<span class="status-badge left-staff">🚪 Chala Gaya</span>`;
    } else if (isOut) {
      statusPill = `<span class="status-badge out-now"><span class="out-pulse-dot"></span> Bahar Hai</span>`;
    } else if (isHalfDay) {
      statusPill = `<span class="status-badge halfday">🟡 Half Day</span>`;
    } else if (isPresent) {
      statusPill = hasCheckedOut 
        ? `<span class="status-badge present" style="background:#dcfce7; color:#15803d;">✓ Shift Complete</span>` 
        : `<span class="status-badge present">🟢 Present</span>`;
    } else {
      statusPill = `<span class="status-badge absent">🔴 Absent</span>`;
    }

    let cardBorderStyle = '';
    if (isLeft) {
      cardBorderStyle = 'border-left: 4px solid #cbd5e1; opacity: 0.6;';
    } else if (isOut) {
      cardBorderStyle = 'border-left: 4px solid #f97316; background: #fffaf5;';
    } else if (isHalfDay) {
      cardBorderStyle = 'border-left: 4px solid #f59e0b; background: #fffdf5;';
    } else if (isPresent) {
      cardBorderStyle = hasCheckedOut ? 'border-left: 4px solid #16a34a; background: #f0fdf4;' : 'border-left: 4px solid #2563eb; background: #ffffff;';
    } else {
      cardBorderStyle = 'border-left: 4px solid #ef4444; background: #fef2f2;';
    }

    // Dynamic Action Buttons
    let actionBtn = '';
    if (isLeft) {
      actionBtn = `<button class="btn btn-primary btn-xs" onclick="markEmployeeAsLeft('${emp.id}')">↩ Restore</button>`;
    } else if (isOut) {
      actionBtn = `
        <button class="btn-toggle-in btn" onclick="markEmployeeReturned('${emp.id}')" style="margin-right:0.4rem;">✓ Wapas Aa Gaye</button>
        <button class="btn btn-secondary btn-xs" onclick="openBreakModal('${emp.id}', 'break')">+ Break Log</button>
      `;
    } else if (isPresent && !hasCheckedOut) {
      actionBtn = `
        <button class="btn btn-warning btn-xs" onclick="manualMarkCheckOut('${emp.id}', '${viewDate}')" style="background:#f59e0b; border-color:#d97706; color:#ffffff; font-weight:700;">🚪 Punch Out (Gaya)</button>
        ${isToday ? `<button class="btn btn-secondary btn-xs" onclick="openBreakModal('${emp.id}', 'break')">+ Break</button>` : ''}
        <button class="btn btn-outline btn-xs" onclick="manualMarkAbsent('${emp.id}', '${viewDate}')" style="color:#dc2626; border-color:#fca5a5;">🔴 Mark Absent</button>
      `;
    } else if (isPresent && hasCheckedOut) {
      actionBtn = `
        <span class="badge-mini" style="background:#dcfce7; color:#15803d; font-weight:700; padding:0.25rem 0.5rem;">✓ Shift Ended</span>
        <button class="btn btn-secondary btn-xs" onclick="resetEmployeeToPresent('${emp.id}')" title="Reset check-out time">↩ Reset</button>
      `;
    } else if (isHalfDay) {
      actionBtn = `
        <button class="btn btn-outline btn-xs" onclick="manualMarkAbsent('${emp.id}', '${viewDate}')" style="color:#dc2626; border-color:#fca5a5;">🔴 Mark Absent</button>
      `;
    } else {
      // Absent employee
      actionBtn = `
        <button class="btn btn-warning-soft btn-xs" onclick="openBreakModal('${emp.id}', 'halfday')">🟡 Half Day</button>
      `;
    }

    const inTimeDisplay = att.checkInTime ? formatTime12h(att.checkInTime) : '—';
    const outTimeDisplay = att.checkOutTime 
      ? formatTime12h(att.checkOutTime) 
      : (isPresent ? (isToday ? '<span style="color:#2563eb; font-weight:700;">⏳ Kaam Par Hai</span>' : 'Closed @ 08:00 PM') : '—');

    return `
      <div class="att-detail-card" style="${cardBorderStyle}">
        <div class="att-emp-block">
          <div class="emp-avatar">${initials}</div>
          <div>
            <strong style="font-size:0.95rem; color:var(--text-dark);">${emp.name}</strong>
            <div style="font-size:0.75rem; color:var(--text-muted);">${emp.role} • ${emp.id}</div>
            ${att.note ? `<div style="font-size:0.75rem; color:#64748b; margin-top:0.2rem;">📝 ${att.note}</div>` : ''}
          </div>
        </div>

        <div class="att-timing-block">
          <div class="timing-col">
            <span class="t-lbl">Status</span>
            <div>${statusPill}</div>
          </div>
          <div class="timing-col">
            <span class="t-lbl">Kab Aaya (In-Time)</span>
            <span class="t-val" style="color:#15803d; font-weight:700;">${inTimeDisplay}</span>
          </div>
          <div class="timing-col">
            <span class="t-lbl">Kab Gaya (Out-Time)</span>
            <span class="t-val" style="color:#b45309; font-weight:700;">${outTimeDisplay}</span>
          </div>
          <div class="timing-col">
            <span class="t-lbl">Kaam Ka Samay</span>
            <strong style="color:#1d4ed8; font-size:1.05rem;">${hoursText}</strong>
          </div>
        </div>

        <div class="att-progress-block">
          <div class="flex-between" style="font-size:0.8rem; margin-bottom:0.25rem;">
            <strong style="color:${isOut ? '#c2410c' : isHalfDay ? '#b45309' : 'var(--primary-600)'}; font-family:var(--font-heading); font-size:1.05rem;">${hoursText}</strong>
            <span style="color:var(--text-muted);">Target: 8h</span>
          </div>
          <div class="progress-bar-track">
            <div class="progress-bar-fill" style="width:${progressPct}%; background: ${isOut ? 'linear-gradient(90deg, #f97316, #fb923c)' : isHalfDay ? 'linear-gradient(90deg, #f59e0b, #fbbf24)' : ''}"></div>
          </div>
        </div>

        <div style="display:flex; gap:0.4rem; flex-wrap:wrap; align-items:center;">
          ${actionBtn}
        </div>
      </div>
    `;
  }).join('');
}

// Date switcher controls for Attendance Pane
function onAttendanceDateChange(dateStr) {
  if (!dateStr) return;
  window.currentAttendanceViewDate = dateStr;
  renderAttendancePane();
}

function changeAttendanceDate(deltaDays) {
  const cur = window.currentAttendanceViewDate || getLocalDateString();
  const d = new Date(cur);
  d.setDate(d.getDate() + deltaDays);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  window.currentAttendanceViewDate = `${yyyy}-${mm}-${dd}`;
  renderAttendancePane();
}

function setAttendanceDateToday() {
  window.currentAttendanceViewDate = getLocalDateString();
  renderAttendancePane();
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
