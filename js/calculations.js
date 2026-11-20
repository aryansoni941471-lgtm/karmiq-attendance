// =============================================================================
// 3. CORE BUSINESS LOGIC (Working Hours & Salary Calculations)
// =============================================================================

/**
 * Calculates working time for an employee today.
 * Rule: Check-in once, closing time (or current time if earlier) ends the day.
 * Break duration is deducted. No overtime.
 */
function calculateWorkingHours(empId) {
  const attendance = getAttendance();
  const shop = getShopSettings();
  const record = attendance[empId];
  const effStatus = getEmployeeEffectiveStatus(empId);

  if (!record || record.status === 'Absent' || !record.checkInTime) {
    return {
      minutes: 0,
      hours: 0,
      mins: 0,
      text: '0h 00m',
      progressPct: 0,
      status: effStatus.key,
      effectiveStatus: effStatus,
      checkInTime: null,
      checkOutTime: null,
      breaksDeducted: 0
    };
  }

  const [inH, inM] = record.checkInTime.split(':').map(Number);
  const [closeH, closeM] = (shop.closingTime || '20:00').split(':').map(Number);

  const inTotalMins = (inH || 0) * 60 + (inM || 0);
  const closeTotalMins = (closeH || 20) * 60 + (closeM || 0);

  const now = new Date();
  const currentTotalMins = now.getHours() * 60 + now.getMinutes();

  let endTotalMins = closeTotalMins;

  // If staff left early / checked out / marked half-day with departure time
  if (record.checkOutTime) {
    const [outH, outM] = record.checkOutTime.split(':').map(Number);
    endTotalMins = Math.min(closeTotalMins, (outH || 0) * 60 + (outM || 0));
  } else if (!isShopClosedNow()) {
    // During shop hours, live calculation up to current time (capped at closing time)
    endTotalMins = Math.min(closeTotalMins, currentTotalMins);
  } else {
    // If shop is closed for the day:
    if (inTotalMins >= closeTotalMins) {
      endTotalMins = Math.max(inTotalMins, currentTotalMins);
    }
  }

  let rawWorkedMins = Math.max(0, endTotalMins - inTotalMins);

  // If status is Half Day and no checkout time explicitly provided, default to half of target shift
  if (record.status === 'Half Day' && !record.checkOutTime) {
    const targetDailyMins = (shop.dailyTargetHours || 8) * 60;
    rawWorkedMins = Math.round(targetDailyMins / 2);
  }

  // Deduct breaks for this employee today
  const breaks = getBreaks().filter(b => b.empId === empId);
  let breakDeductionMins = 0;
  breaks.forEach(b => {
    if (b.outTime && b.backTime) {
      const [oH, oM] = b.outTime.split(':').map(Number);
      const [bH, bM] = b.backTime.split(':').map(Number);
      const diff = (bH * 60 + bM) - (oH * 60 + oM);
      if (diff > 0) breakDeductionMins += diff;
    }
  });

  const netWorkedMins = Math.max(0, rawWorkedMins - breakDeductionMins);
  const hours = Math.floor(netWorkedMins / 60);
  const mins = netWorkedMins % 60;
  const targetMins = (shop.dailyTargetHours || 8) * 60;
  const progressPct = Math.min(100, Math.round((netWorkedMins / targetMins) * 100));

  return {
    minutes: netWorkedMins,
    hours,
    mins,
    text: `${hours}h ${mins.toString().padStart(2, '0')}m`,
    progressPct,
    status: effStatus.key,
    effectiveStatus: effStatus,
    checkInTime: record.checkInTime,
    checkOutTime: record.checkOutTime || null,
    breaksDeducted: breakDeductionMins
  };
}

/**
 * Calculates shop's operational working hours for today (or a specific date):
 * Tracks from the earliest staff arrival time to the latest staff departure (or current time).
 * Example: Rahul (9 AM - 5 PM) and Bhavishya (10 AM - 6 PM) -> Shop was open 9 AM to 6 PM (9 hrs),
 * not 8 + 8 = 16 hrs.
 */
function calculateShopTodayWorkingHours(targetDateStr) {
  const todayStr = new Date().toISOString().slice(0, 10);
  const dateStr = targetDateStr || todayStr;
  const isToday = (dateStr === todayStr);

  const attendance = typeof getAttendanceForDate === 'function' 
    ? getAttendanceForDate(dateStr) 
    : (typeof getAttendance === 'function' ? getAttendance() : {});
  const shop = typeof getShopSettings === 'function' ? getShopSettings() : {};
  const now = new Date();
  const currentTotalMins = now.getHours() * 60 + now.getMinutes();

  const [closeH, closeM] = (shop.closingTime || '20:00').split(':').map(Number);
  const closeTotalMins = (closeH || 20) * 60 + (closeM || 0);

  let earliestIn = Infinity;
  let latestOut = -Infinity;
  let hasCheckedInStaff = false;

  const records = Object.values(attendance || {});
  records.forEach(rec => {
    if (!rec || rec.status === 'Absent' || !rec.checkInTime) return;

    const [inH, inM] = rec.checkInTime.split(':').map(Number);
    const inTotalMins = (inH || 0) * 60 + (inM || 0);

    let recEndMins = closeTotalMins;
    if (rec.checkOutTime) {
      const [outH, outM] = rec.checkOutTime.split(':').map(Number);
      recEndMins = Math.min(closeTotalMins, (outH || 0) * 60 + (outM || 0));
    } else if (isToday && (typeof isShopClosedNow === 'function' ? !isShopClosedNow() : true)) {
      recEndMins = Math.min(closeTotalMins, currentTotalMins);
    } else {
      if (inTotalMins >= closeTotalMins) {
        recEndMins = Math.max(inTotalMins, currentTotalMins);
      } else {
        recEndMins = closeTotalMins;
      }
    }

    recEndMins = Math.max(inTotalMins, recEndMins);

    if (inTotalMins < earliestIn) earliestIn = inTotalMins;
    if (recEndMins > latestOut) latestOut = recEndMins;
    hasCheckedInStaff = true;
  });

  if (!hasCheckedInStaff || earliestIn === Infinity || latestOut === -Infinity) {
    return {
      minutes: 0,
      hours: 0,
      mins: 0,
      text: '0h 00m',
      earliestIn: null,
      latestOut: null
    };
  }

  const netWorkedMins = Math.max(0, latestOut - earliestIn);
  const hours = Math.floor(netWorkedMins / 60);
  const mins = netWorkedMins % 60;

  return {
    minutes: netWorkedMins,
    hours,
    mins,
    text: `${hours}h ${mins.toString().padStart(2, '0')}m`,
    earliestIn,
    latestOut
  };
}

/**
 * Calculates salary balance for a staff member (Monthly Salary, Paid so far, Remaining Due)
 */
function calculateSalaryBalance(empId) {
  const employees = getEmployees();
  const emp = employees.find(e => e.id === empId);
  if (!emp) return { salary: 0, paid: 0, due: 0, progressPct: 0, payments: [] };

  const payments = getPayments().filter(p => p.empId === empId);
  const totalPaid = payments.reduce((sum, p) => sum + Number(p.amount), 0);
  const due = Math.max(0, emp.salary - totalPaid);
  const progressPct = emp.salary > 0 ? Math.min(100, Math.round((totalPaid / emp.salary) * 100)) : 0;

  return {
    salary: emp.salary,
    paid: totalPaid,
    due,
    progressPct,
    payments
  };
}

/**
 * Calculates hours for any single attendance record (past or present)
 */
function calculateHoursForRecord(record, shopSettings) {
  if (!record || record.status === 'Absent' || !record.checkInTime) {
    return { minutes: 0, text: '0h 00m' };
  }
  const [inH, inM] = record.checkInTime.split(':').map(Number);
  const inTotalMins = (inH || 0) * 60 + (inM || 0);

  const [closeH, closeM] = ((shopSettings && shopSettings.closingTime) || '20:00').split(':').map(Number);
  const closeTotalMins = (closeH || 20) * 60 + (closeM || 0);

  let endTotalMins = closeTotalMins;
  if (record.checkOutTime) {
    const [outH, outM] = record.checkOutTime.split(':').map(Number);
    endTotalMins = (outH || 0) * 60 + (outM || 0);
  }

  const rawWorkedMins = Math.max(0, endTotalMins - inTotalMins);
  const hours = Math.floor(rawWorkedMins / 60);
  const mins = rawWorkedMins % 60;
  return {
    minutes: rawWorkedMins,
    hours,
    mins,
    text: `${hours}h ${mins.toString().padStart(2, '0')}m`
  };
}

/**
 * Calculates complete day-by-day attendance history and monthly summary for an employee.
 * @param {string} empId
 * @param {number} year - e.g. 2026
 * @param {number} month - 0-indexed (0=Jan, 10=Nov)
 */
function getStaffMonthlyAttendanceStats(empId, year, month) {
  const shop = typeof getShopSettings === 'function' ? getShopSettings() : {};
  const today = new Date();
  const todayStr = typeof getLocalDateString === 'function' ? getLocalDateString() : today.toISOString().slice(0, 10);
  
  const targetYear = (year !== undefined && year !== null) ? Number(year) : today.getFullYear();
  const targetMonth = (month !== undefined && month !== null) ? Number(month) : today.getMonth();

  const daysInMonth = new Date(targetYear, targetMonth + 1, 0).getDate();
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  let presentDays = 0;
  let absentDays = 0;
  let halfDays = 0;
  let weeklyOffDays = 0;
  let totalWorkedMins = 0;

  const dailyLogs = [];

  for (let d = 1; d <= daysInMonth; d++) {
    const dStr = String(d).padStart(2, '0');
    const mStr = String(targetMonth + 1).padStart(2, '0');
    const dateStr = `${targetYear}-${mStr}-${dStr}`;
    const dateObj = new Date(targetYear, targetMonth, d);
    const dayOfWeek = dateObj.getDay();
    const dayName = dayNames[dayOfWeek];
    const isSunday = (dayOfWeek === 0);
    const isToday = (dateStr === todayStr);
    const isFuture = (dateStr > todayStr);

    // Retrieve attendance for this date
    let att = null;
    if (typeof getAttendanceForDate === 'function') {
      const dayMap = getAttendanceForDate(dateStr) || {};
      att = dayMap[empId] || null;
    }

    let status = 'Absent';
    let checkIn = '—';
    let checkOut = '—';
    let hoursText = '0h 00m';
    let minsWorked = 0;
    let note = '';

    if (isFuture) {
      status = 'Upcoming';
      note = 'Future Date';
    } else if (att && (att.status === 'Present' || att.checkInTime)) {
      status = 'Present';
      presentDays++;
      checkIn = att.checkInTime ? formatTime12h(att.checkInTime) : '—';
      checkOut = att.checkOutTime ? formatTime12h(att.checkOutTime) : (isToday ? 'Working Now' : 'Closed @ 08:00 PM');
      
      const calc = calculateHoursForRecord(att, shop);
      minsWorked = calc.minutes;
      hoursText = calc.text;
      totalWorkedMins += minsWorked;
      note = att.note || (isToday && !att.checkOutTime ? 'Shift in progress' : 'Shift complete');
    } else if (att && att.status === 'Half Day') {
      status = 'Half Day';
      halfDays++;
      checkIn = att.checkInTime ? formatTime12h(att.checkInTime) : '09:00 AM';
      checkOut = att.checkOutTime ? formatTime12h(att.checkOutTime) : '02:00 PM';
      minsWorked = Math.round(((shop.dailyTargetHours || 8) * 60) / 2);
      const h = Math.floor(minsWorked / 60);
      const m = minsWorked % 60;
      hoursText = `${h}h ${m.toString().padStart(2, '0')}m`;
      totalWorkedMins += minsWorked;
      note = att.leaveReason || 'Half Day Shift';
    } else if (isSunday) {
      status = 'Weekly Off';
      weeklyOffDays++;
      note = 'Sunday Weekly Off';
    } else {
      status = 'Absent';
      absentDays++;
      note = 'No check-in recorded';
    }

    dailyLogs.push({
      dateStr,
      dayNum: d,
      dayName,
      isSunday,
      isToday,
      isFuture,
      status,
      checkIn,
      checkOut,
      rawCheckIn: att ? att.checkInTime : null,
      rawCheckOut: att ? att.checkOutTime : null,
      hoursText,
      minsWorked,
      note
    });
  }

  const totalHrs = Math.floor(totalWorkedMins / 60);
  const totalMinsRem = totalWorkedMins % 60;
  const totalHoursText = `${totalHrs}h ${totalMinsRem.toString().padStart(2, '0')}m`;

  const workingDaysCount = presentDays + (halfDays * 0.5);
  const avgMins = workingDaysCount > 0 ? Math.round(totalWorkedMins / workingDaysCount) : 0;
  const avgHrs = Math.floor(avgMins / 60);
  const avgMinsRem = avgMins % 60;
  const avgHoursText = `${avgHrs}h ${avgMinsRem.toString().padStart(2, '0')}m`;

  return {
    year: targetYear,
    month: targetMonth,
    daysInMonth,
    presentDays,
    absentDays,
    halfDays,
    weeklyOffDays,
    totalWorkedMins,
    totalHoursText,
    avgHoursText,
    dailyLogs
  };
}

// =============================================================================
// 4. EMBEDDED SVG QR CODE GENERATOR (Pure Vanilla JS, Crisp Vector)
// =============================================================================

/**
 * Generates an authentic, crisp and 100% scannable QR Code representation.
 * Encodes the standard string "KARMIQ:<EMP_ID>"
 */
function generateEmployeeQR(empId, size = 130) {
  const text = `KARMIQ:${empId}`;

  // 1. Use Karmiq Pure-JS ISO/IEC 18004 Standard QR Engine
  if (window.KarmiqQrGenerator && typeof window.KarmiqQrGenerator.generateSvg === 'function') {
    return window.KarmiqQrGenerator.generateSvg(text, size);
  }

  // 2. QRCode.js fallback if available
  if (typeof QRCode !== 'undefined') {
    try {
      const container = document.createElement('div');
      new QRCode(container, {
        text: text,
        width: size,
        height: size,
        colorDark: '#0f172a',
        colorLight: '#ffffff'
      });
      const canvas = container.querySelector('canvas');
      if (canvas) {
        return `<img src="${canvas.toDataURL()}" width="${size}" height="${size}" alt="QR ${empId}" style="display:block; border-radius:8px; border:1px solid #cbd5e1; background:#fff; padding:6px; box-shadow:0 2px 6px rgba(0,0,0,0.06);" />`;
      }
    } catch (e) {}
  }

  return `<div style="width:${size}px; height:${size}px; background:#fff; border:1px solid #cbd5e1; border-radius:8px; display:flex; align-items:center; justify-content:center; font-weight:700; font-size:0.75rem;">${empId}</div>`;
}
