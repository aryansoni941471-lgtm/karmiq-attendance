// =============================================================================
// 10. EMPLOYEES DIRECTORY & ADD EMPLOYEE MODAL
// =============================================================================

function renderEmployees() {
  const employees = getEmployees();
  const attendance = getAttendance();
  const tbody = document.getElementById('employeeTableBody');
  if (!tbody) return;

  const bannerContainer = document.getElementById('staffLimitBannerContainer');
  const plan = (getActivePlan() || '').toLowerCase();
  if (bannerContainer) {
    if (plan !== 'pro' && employees.length >= 3) {
      bannerContainer.innerHTML = `
        <div class="free-limit-alert-bar" style="background:#fffbeb; border:1px solid #fde68a; border-radius:12px; padding:0.75rem 1rem; margin-bottom:1rem; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.5rem;">
          <div style="font-size:0.83rem; color:#92400e;">
            <strong>⚡ Free Starter Limit Reached (${employees.length}/3 Staff):</strong> Naye staff add karne, Printable QR ID Cards aur WhatsApp slips ke liye Dukandaar PRO activate karein.
          </div>
          <button type="button" class="btn btn-primary btn-xs" onclick="openUpiPaymentModal('pro')" style="background:#16a34a; border-color:#15803d; font-weight:800; padding:0.35rem 0.75rem;">
            ⚡ Upgrade to PRO (₹99/mo) &rarr;
          </button>
        </div>
      `;
    } else {
      bannerContainer.innerHTML = '';
    }
  }

  if (employees.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" style="text-align:center; padding:3.5rem 1rem; color:var(--text-muted);">
          <div style="font-size:2.2rem; margin-bottom:0.5rem;">👥</div>
          <strong style="font-size:1.1rem; color:var(--text-white); display:block; margin-bottom:0.35rem;">No Staff Members Added Yet</strong>
          <p style="font-size:0.85rem; margin-bottom:1.25rem; max-width:400px; margin-left:auto; margin-right:auto;">Add your first staff member to generate instant printable QR ID cards and start tracking attendance.</p>
          <button class="btn btn-primary btn-sm" onclick="openAddEmployeeModal()">+ Add Your First Staff</button>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = employees.map(emp => {
    const att = attendance[emp.id] || { status: 'Absent' };
    const wh = calculateWorkingHours(emp.id);
    const sal = calculateSalaryBalance(emp.id);
    const initials = emp.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
    const isLeft = emp.isLeft;
    const isOut = !isLeft && isEmployeeCurrentlyOut(emp.id);
    const outBreak = isOut ? getCurrentOutBreak(emp.id) : null;

    const effStatus = getEmployeeEffectiveStatus(emp.id);
    let statusBadge = effStatus.badgeHtml;

    let rowClass = '';
    if (isLeft) rowClass = 'row-highlight-left';
    else if (isOut) rowClass = 'row-highlight-out';
    else if (effStatus.key === 'Day Off') rowClass = 'row-highlight-dayoff';

    let actionBtns = `
      <button class="btn btn-secondary btn-xs" onclick="openStaffIdCardModal('${emp.id}')" title="View & Print ID QR">QR ID</button>
      <button class="btn btn-primary btn-xs" onclick="openEmployeeDetailsModal('${emp.id}')">Details</button>
      <button class="btn btn-xs ${isLeft ? 'btn-primary' : 'btn-secondary'}" onclick="markEmployeeAsLeft('${emp.id}')" title="${isLeft ? 'Wapas active karein' : 'Chala Gaya mark karein'}" style="${isLeft ? '' : 'color:#b45309; border-color:#fbbf24;'}">${isLeft ? '↩ Restore' : '🚪 Left'}</button>
    `;
    if (isOut) {
      actionBtns = `
        <button class="btn-toggle-in btn" onclick="markEmployeeReturned('${emp.id}')" title="Wapas aa gaye mark karein">✓ Back</button>
        <button class="btn btn-primary btn-xs" onclick="openEmployeeDetailsModal('${emp.id}')">Details</button>
        <button class="btn btn-xs btn-secondary" onclick="markEmployeeAsLeft('${emp.id}')" style="color:#b45309; border-color:#fbbf24;">🚪 Left</button>
      `;
    }

    const nameStyle = isLeft ? 'text-decoration:line-through; color:var(--text-muted);' : 'color:var(--text-dark); font-weight:700;';
    const avatarStyle = isLeft ? 'background:#e2e8f0; color:#94a3b8;' : '';
    const subInfo = isLeft
      ? `${emp.role} • Chala Gaya: ${emp.leftDate || 'Haal hi mein'}`
      : (isOut ? `${emp.role} • Bahar: ${outBreak ? outBreak.outTime + ' se' : ''} (${outBreak ? outBreak.reason : ''})` : `${emp.role} • ${emp.phone || 'No phone'}`);

    return `
      <tr id="emp-row-${emp.id}" class="${rowClass}">
        <td>
          <div style="display:flex; align-items:center; gap:0.75rem;">
            <div class="emp-avatar" style="${avatarStyle}">${initials}</div>
            <div>
              <strong style="font-size:0.95rem; ${nameStyle}">${emp.name}</strong>
              <div style="font-size:0.75rem; color:${isLeft ? '#94a3b8' : isOut ? '#c2410c' : 'var(--text-muted)'};">${subInfo}</div>
            </div>
          </div>
        </td>
        <td><span style="font-family:monospace; font-weight:700; color:${isLeft ? '#94a3b8' : 'var(--primary-700)'};">${emp.id}</span></td>
        <td>${statusBadge}</td>
        <td>
          ${isLeft
            ? `<span style="color:#94a3b8; font-size:0.85rem;">—</span>`
            : `<strong style="color:var(--primary-600); font-family:var(--font-heading);">${wh.text}</strong>
               <div style="font-size:0.7rem; color:var(--text-muted);">Target: 8h</div>`
          }
        </td>
        <td><strong style="color:${isLeft ? '#94a3b8' : 'var(--text-dark)'};">${isLeft ? '—' : ((typeof getCurrentRole === 'function' && getCurrentRole() === 'manager') ? '<span style="color:#b45309;">🔒 ₹••••</span>' : '₹' + Number(emp.salary).toLocaleString('en-IN'))}</strong></td>
        <td><strong style="color:${isLeft ? '#94a3b8' : '#d97706'};">${isLeft ? '—' : ((typeof getCurrentRole === 'function' && getCurrentRole() === 'manager') ? '<span style="color:#b45309;">🔒 ₹••••</span>' : '₹' + sal.due.toLocaleString('en-IN'))}</strong></td>
        <td class="text-right">
          <div style="display:inline-flex; gap:0.4rem; flex-wrap:wrap; justify-content:flex-end;">
            ${actionBtns}
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

function filterEmployeeTable() {
  const query = (document.getElementById('employeeSearchInput').value || '').toLowerCase();
  const filter = document.getElementById('employeeStatusFilter').value;
  const employees = getEmployees();
  const attendance = getAttendance();

  employees.forEach(emp => {
    const row = document.getElementById(`emp-row-${emp.id}`);
    if (!row) return;

    const att = attendance[emp.id] || { status: 'Absent' };
    const eff = getEmployeeEffectiveStatus(emp.id);
    const isLeft = emp.isLeft;
    const isOut = isEmployeeCurrentlyOut(emp.id);

    const matchesSearch = emp.name.toLowerCase().includes(query) ||
                          (emp.role && emp.role.toLowerCase().includes(query)) ||
                          emp.id.toLowerCase().includes(query);

    let matchesStatus = false;
    if (filter === 'all') matchesStatus = true;
    else if (filter === 'Left') matchesStatus = isLeft;
    else if (filter === 'Out') matchesStatus = isOut;
    else if (filter === 'Day Off') matchesStatus = !isLeft && eff.key === 'Day Off';
    else matchesStatus = !isLeft && (eff.key === filter || att.status === filter);

    row.style.display = (matchesSearch && matchesStatus) ? '' : 'none';
  });
}

function openAddEmployeeModal() {
  const employees = getEmployees();
  if ((getActivePlan() || '').toLowerCase() !== 'pro' && employees.length >= 3) {
    openFeaturePaywall('staff_limit');
    return;
  }

  const usedNums = employees.map(e => parseInt((e.id || '').replace(/\D/g, ''))).filter(n => !isNaN(n));
  const nextNum = (usedNums.length > 0 ? Math.max(...usedNums) : 1000) + 1;
  document.getElementById('empId').value = `EMP${nextNum}`;
  document.getElementById('empFullName').value = '';
  document.getElementById('empPhone').value = '';
  document.getElementById('empRole').value = '';
  document.getElementById('empSalary').value = '';
  
  const today = new Date().toISOString().slice(0, 10);
  const joinDateInput = document.getElementById('empJoinDate');
  if (joinDateInput) joinDateInput.value = today;

  openModal('addEmployeeModal');
}

function handleAddEmployee(e) {
  e.preventDefault();
  const employees = getEmployees();
  if ((getActivePlan() || '').toLowerCase() !== 'pro' && employees.length >= 3) {
    openFeaturePaywall('staff_limit');
    showToast('⚠️ Free Starter limit (3 Staff) reach ho chuki hai! Unlimited staff ke liye PRO lijiye.', 'warning');
    return;
  }

  const name = document.getElementById('empFullName').value.trim();
  const phone = document.getElementById('empPhone').value.trim();
  const empId = document.getElementById('empId').value.trim().toUpperCase();
  const role = document.getElementById('empRole').value.trim() || 'Staff';
  const joinDate = document.getElementById('empJoinDate').value || new Date().toISOString().slice(0, 10);
  const salary = Number(document.getElementById('empSalary').value);

  if (!name || !empId || !salary) {
    showToast('Please fill all required fields (Name, ID, Salary)', 'warning');
    return;
  }

  if (employees.some(emp => emp.id === empId)) {
    showToast(`Employee ID ${empId} already exists. Use a unique ID.`, 'warning');
    return;
  }

  const newEmp = { id: empId, name, role, phone, joinDate, salary };
  employees.push(newEmp);
  saveEmployees(employees);

  closeModal('addEmployeeModal');
  window.lastCreatedEmpId = empId;

  // Show Success creation preview
  const previewDiv = document.getElementById('createdEmpPreview');
  if (previewDiv) {
    previewDiv.innerHTML = `
      <div style="display:flex; align-items:center; justify-content:center; gap:1.25rem;">
        <div>${generateEmployeeQR(empId, 100)}</div>
        <div style="text-align:left;">
          <h4 style="color:var(--text-white); font-size:1.1rem; margin-bottom:0.25rem;">${name}</h4>
          <div style="color:var(--primary-500); font-weight:700; font-size:0.85rem;">${empId} • ${role}</div>
          <div style="font-size:0.8rem; color:var(--text-muted); margin-top:0.35rem;">Monthly Salary: ₹${salary.toLocaleString('en-IN')}</div>
        </div>
      </div>
    `;
  }

  openModal('employeeCreatedModal');
  renderAllViews();
  showToast(`Staff member ${name} added successfully!`, 'success');
}
