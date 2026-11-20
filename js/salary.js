// =============================================================================
// 13. SALARY & PARTIAL PAYMENTS LEDGER
// =============================================================================

function renderSalaryPane() {
  const employees = getEmployees();
  const tbody = document.getElementById('salaryTableBody');
  if (!tbody) return;

  if (typeof getCurrentRole === 'function' && getCurrentRole() === 'manager') {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align:center; padding:3.5rem 1rem;">
          <div style="font-size:2.8rem; margin-bottom:0.75rem;">🔒</div>
          <strong style="font-size:1.15rem; color:#92400e; display:block; margin-bottom:0.4rem;">Salary Records Protected (Manager Mode)</strong>
          <p style="font-size:0.85rem; color:var(--text-muted); max-width:440px; margin:0 auto 1.25rem auto; line-height:1.45;">
            Manager role is active on this device. Individual employee salaries and payment ledgers are locked to maintain store confidentiality.
          </p>
          <button class="btn btn-primary btn-sm" onclick="promptUnlockWithPin('salary')">Unlock with Owner PIN</button>
        </td>
      </tr>
    `;
    const salTotalPayroll = document.getElementById('salTotalPayroll');
    const salTotalPaid = document.getElementById('salTotalPaid');
    const salTotalRemaining = document.getElementById('salTotalRemaining');
    if (salTotalPayroll) salTotalPayroll.textContent = '🔒 ₹••••';
    if (salTotalPaid) salTotalPaid.textContent = '🔒 ₹••••';
    if (salTotalRemaining) salTotalRemaining.textContent = '🔒 ₹••••';
    return;
  }

  if (employees.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align:center; padding:3.5rem 1rem; color:var(--text-muted);">
          <div style="font-size:2.2rem; margin-bottom:0.5rem;">💰</div>
          <strong style="font-size:1.1rem; color:var(--text-white); display:block; margin-bottom:0.35rem;">No Salary Records Found</strong>
          <p style="font-size:0.85rem; margin-bottom:1.25rem;">Add employees with their monthly salary to manage advances and balances.</p>
          <button class="btn btn-primary btn-sm" onclick="openAddEmployeeModal()">+ Add Staff</button>
        </td>
      </tr>
    `;
    const salTotalPayroll = document.getElementById('salTotalPayroll');
    const salTotalPaid = document.getElementById('salTotalPaid');
    const salTotalRemaining = document.getElementById('salTotalRemaining');
    if (salTotalPayroll) salTotalPayroll.textContent = '₹0';
    if (salTotalPaid) salTotalPaid.textContent = '₹0';
    if (salTotalRemaining) salTotalRemaining.textContent = '₹0';
    return;
  }

  let totalMonthlySalary = 0;
  let totalAdvancesPaid = 0;

  tbody.innerHTML = employees.map(emp => {
    const sal = calculateSalaryBalance(emp.id);
    totalMonthlySalary += sal.salary;
    totalAdvancesPaid += sal.paid;

    return `
      <tr>
        <td>
          <strong style="color:var(--text-white); font-size:0.95rem;">${emp.name}</strong>
          <div style="font-size:0.75rem; color:var(--text-muted);">${emp.role} • ${emp.id}</div>
        </td>
        <td><strong>₹${Number(sal.salary).toLocaleString('en-IN')}</strong></td>
        <td><strong class="text-green">₹${sal.paid.toLocaleString('en-IN')}</strong></td>
        <td><strong class="text-amber">₹${sal.due.toLocaleString('en-IN')}</strong></td>
        <td>
          <div style="width:140px;">
            <div class="progress-bar-track">
              <div class="progress-bar-fill" style="width:${sal.progressPct}%; background:linear-gradient(90deg, #10b981, #f59e0b);"></div>
            </div>
            <div style="font-size:0.7rem; color:var(--text-muted); margin-top:0.2rem;">${sal.progressPct}% paid</div>
          </div>
        </td>
        <td class="text-right">
          <button class="btn btn-primary btn-xs" onclick="openPaymentModal('${emp.id}')">+ Record Advance</button>
        </td>
      </tr>
    `;
  }).join('');

  const totalRemainingDue = Math.max(0, totalMonthlySalary - totalAdvancesPaid);

  const salTotalPayroll = document.getElementById('salTotalPayroll');
  const salTotalPaid = document.getElementById('salTotalPaid');
  const salTotalRemaining = document.getElementById('salTotalRemaining');

  if (salTotalPayroll) salTotalPayroll.textContent = `₹${totalMonthlySalary.toLocaleString('en-IN')}`;
  if (salTotalPaid) salTotalPaid.textContent = `₹${totalAdvancesPaid.toLocaleString('en-IN')}`;
  if (salTotalRemaining) salTotalRemaining.textContent = `₹${totalRemainingDue.toLocaleString('en-IN')}`;
}

function openPaymentModal(empId = '') {
  const employees = getEmployees().filter(e => !e.isLeft);
  const select = document.getElementById('payEmployeeSelect');
  if (select) {
    if (employees.length === 0) {
      select.innerHTML = `<option value="">No active staff available</option>`;
    } else {
      select.innerHTML = employees.map(emp => `
        <option value="${emp.id}" ${emp.id === empId ? 'selected' : ''}>${emp.name} (${emp.id})</option>
      `).join('');
    }
  }

  const amtEl = document.getElementById('payAmount');
  const txnEl = document.getElementById('payTxnId');
  const noteEl = document.getElementById('payNote');
  if (amtEl) amtEl.value = '';
  if (txnEl) txnEl.value = '';
  if (noteEl) noteEl.value = '';
  
  const today = new Date().toISOString().slice(0, 10);
  const payDateInput = document.getElementById('payDate');
  if (payDateInput) payDateInput.value = today;

  const errorSpan = document.getElementById('payAmountError');
  if (errorSpan) errorSpan.style.display = 'none';

  const waCheck = document.getElementById('paySendWhatsappSlip');
  const isPro = typeof getActivePlan === 'function' && (getActivePlan() || '').toLowerCase() === 'pro';
  if (waCheck) {
    waCheck.checked = isPro;
  }

  updatePayModalInfo();
  openModal('recordPaymentModal');
}

function updatePayModalInfo() {
  const select = document.getElementById('payEmployeeSelect');
  const pill = document.getElementById('payModalBalancePill');
  if (!select || !select.value) {
    if (pill) pill.innerHTML = '<span>Select a staff member</span>';
    return;
  }

  const empId = select.value;
  const sal = calculateSalaryBalance(empId);

  if (pill) {
    pill.innerHTML = `
      <span>Monthly: ₹${sal.salary.toLocaleString('en-IN')}</span> | 
      <span>Paid: ₹${sal.paid.toLocaleString('en-IN')}</span> | 
      <strong>Remaining Due: ₹${sal.due.toLocaleString('en-IN')}</strong>
    `;
  }
}

function handleRecordPayment(e) {
  e.preventDefault();
  const empId = document.getElementById('payEmployeeSelect').value;
  if (!empId) {
    showToast('Please select a staff member', 'warning');
    return;
  }

  const amount = Number(document.getElementById('payAmount').value);
  const date = document.getElementById('payDate').value || new Date().toISOString().slice(0, 10);
  const modeRadios = document.getElementsByName('payMode');
  let mode = 'UPI';
  for (let r of modeRadios) { if (r.checked) mode = r.value; }
  const txnId = document.getElementById('payTxnId').value.trim();
  const note = document.getElementById('payNote').value.trim();

  const sal = calculateSalaryBalance(empId);
  const errorSpan = document.getElementById('payAmountError');

  if (isNaN(amount) || amount <= 0) {
    if (errorSpan) {
      errorSpan.textContent = 'Please enter a valid positive amount.';
      errorSpan.style.display = 'block';
    }
    return;
  }

  if (amount > sal.due) {
    if (errorSpan) {
      errorSpan.textContent = `Amount cannot exceed remaining balance of ₹${sal.due.toLocaleString('en-IN')}.`;
      errorSpan.style.display = 'block';
    }
    return;
  }

  if (errorSpan) errorSpan.style.display = 'none';

  const payments = getPayments();
  const newPay = {
    id: `PAY-${Date.now()}`,
    empId,
    amount,
    date,
    mode,
    txnId,
    note: note || `Salary advance via ${mode}`
  };

  payments.push(newPay);
  savePayments(payments);

  closeModal('recordPaymentModal');
  renderAllViews();

  const sendWa = document.getElementById('paySendWhatsappSlip')?.checked;
  const isPro = typeof getActivePlan === 'function' && (getActivePlan() || '').toLowerCase() === 'pro';
  if (sendWa && isPro) {
    showToast(`Recorded ₹${amount.toLocaleString('en-IN')} payment! Opening WhatsApp slip...`, 'success');
    if (typeof shareAdvanceWhatsapp === 'function') shareAdvanceWhatsapp(newPay);
  } else if (sendWa && !isPro) {
    showToast(`Recorded ₹${amount.toLocaleString('en-IN')} payment via ${mode}!`, 'success');
    if (typeof openFeaturePaywall === 'function') openFeaturePaywall('whatsapp_slips');
  } else {
    showToast(`Recorded ₹${amount.toLocaleString('en-IN')} payment via ${mode}!`, 'success');
  }
}
