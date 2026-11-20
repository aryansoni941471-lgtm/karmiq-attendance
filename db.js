// ============================================================
// KARMIQ — Supabase Database Layer (db.js)
// All async cloud operations — hybrid with localStorage
// ============================================================


// ============================================================
// A. FORMAT TRANSFORMS (Supabase <-> Local)
// ============================================================

function _storeToLocal(s) {
  if (!s) return null;
  return {
    shopName: s.shop_name,
    ownerName: s.owner_name,
    phone: s.phone || '',
    category: s.category || 'Retail Shop',
    openingTime: s.opening_time || '09:00',
    closingTime: s.closing_time || '20:00',
    dailyTargetHours: s.daily_target_hours || 8
  };
}

function _usersToSec(adminRow, managerRow, currentSec) {
  const sec = { ...(currentSec || DEFAULT_SECURITY_SETTINGS) };
  if (adminRow) {
    sec.adminUser    = adminRow.username;
    sec.adminPass    = adminRow.password_hash;
    sec.ownerPin     = adminRow.owner_pin || '1234';
    sec.kioskCode    = adminRow.kiosk_code || 'TERM-101';
  }
  if (managerRow) {
    sec.managerUser = managerRow.username;
    sec.managerPass = managerRow.password_hash;
    if (managerRow.created_at) sec.managerUpdatedAt = managerRow.created_at;
    sec.isManagerRegistered = true;
  }
  return sec;
}

function _empToSupa(storeId, e) {
  return {
    store_id:      storeId,
    emp_code:      e.id,
    name:          e.name,
    phone:         e.phone   || null,
    role:          e.role    || 'Staff',
    salary_type:   e.salaryType || 'monthly',
    salary:        parseFloat(e.salary) || 0,
    join_date:     e.joinDate   || new Date().toISOString().slice(0, 10),
    is_left:       e.isLeft     || false,
    left_date:     e.leftDate   || null,
    profile_color: e.profileColor || '#6366f1'
  };
}

function _empToLocal(r) {
  return {
    id:           r.emp_code,
    name:         r.name,
    phone:        r.phone          || '',
    role:         r.role           || 'Staff',
    salaryType:   r.salary_type    || 'monthly',
    salary:       parseFloat(r.salary) || 0,
    joinDate:     r.join_date      || new Date().toISOString().slice(0, 10),
    isLeft:       r.is_left        || false,
    leftDate:     r.left_date      || null,
    profileColor: r.profile_color  || '#6366f1',
    _supaId:      r.id             // Supabase UUID — used for FK references
  };
}


// ============================================================
// B. STORE AUTH OPERATIONS
// ============================================================

/**
 * Register a new store in Supabase.
 * Returns { storeId, error }
 */
async function dbSignupStore({ shopName, ownerName, phone, category, adminUser, adminPass, adminPin, managerUser, managerPass, kioskCode }) {
  const db = getDB();
  if (!db) return { error: 'not_connected', localOnly: true };

  try {
    // 1. Insert store row
    const { data: store, error: storeErr } = await db
      .from('stores')
      .insert({ shop_name: shopName, owner_name: ownerName, phone, category: category || 'Retail Shop' })
      .select()
      .single();

    if (storeErr) {
      if (storeErr.code === '23505') return { error: 'phone_exists', message: `Is phone number (${phone}) se store pehle se registered hai!` };
      throw storeErr;
    }

    const storeId = store.id; // Supabase UUID

    // 2. Insert admin user
    const { error: adminErr } = await db.from('store_users').insert({
      store_id:      storeId,
      username:      adminUser,
      password_hash: adminPass,
      role:          'admin',
      owner_pin:     adminPin,
      kiosk_code:    kioskCode || 'TERM-101'
    });
    if (adminErr) throw adminErr;

    // 3. Insert manager user (defaults)
    const { error: mgrErr } = await db.from('store_users').insert({
      store_id:      storeId,
      username:      managerUser || 'manager',
      password_hash: managerPass || 'mgr123',
      role:          'manager'
    });
    if (mgrErr && mgrErr.code !== '23505') console.warn('Manager insert:', mgrErr.message);

    return { storeId };

  } catch (err) {
    console.error('dbSignupStore:', err);
    return { error: err.message };
  }
}


/**
 * Login as Admin — returns { storeId, store, user } or { error }
 */
async function dbLoginAdmin(username, password) {
  const db = getDB();
  if (!db) return { error: 'not_connected' };

  try {
    const { data: users, error } = await db
      .from('store_users')
      .select(`id, store_id, username, password_hash, owner_pin, kiosk_code,
               stores (id, shop_name, owner_name, phone, category, opening_time, closing_time, daily_target_hours)`)
      .eq('role', 'admin');

    if (error) throw error;
    if (!users || users.length === 0) return { error: 'no_stores' };

    const match = users.find(u => {
      const uMatch = u.username.toLowerCase() === username.toLowerCase();
      const pMatch = u.stores?.phone === username;
      const passOk = u.password_hash === password || u.owner_pin === password;
      return (uMatch || pMatch) && passOk;
    });

    if (!match) return { error: 'invalid_credentials' };
    return { storeId: match.store_id, store: match.stores, user: match };

  } catch (err) {
    console.error('dbLoginAdmin:', err);
    return { error: err.message };
  }
}


/**
 * Login as Manager — returns { storeId, store, user } or { error }
 */
async function dbLoginManager(username, password) {
  const db = getDB();
  if (!db) return { error: 'not_connected' };

  try {
    const { data: users, error } = await db
      .from('store_users')
      .select(`id, store_id, username, password_hash,
               stores (id, shop_name, owner_name, phone, category, opening_time, closing_time, daily_target_hours, subscription_plan)`)
      .eq('role', 'manager');

    if (error) throw error;

    const match = users?.find(u =>
      u.username.toLowerCase() === username.toLowerCase() &&
      u.password_hash === password
    );

    if (!match) return { error: 'invalid_credentials' };
    return { storeId: match.store_id, store: match.stores, user: match };

  } catch (err) {
    console.error('dbLoginManager:', err);
    return { error: err.message };
  }
}


/**
 * Login as Kiosk — returns { storeId, store, user } or { error }
 */
async function dbLoginKiosk(code) {
  const db = getDB();
  if (!db) return { error: 'not_connected' };

  try {
    const { data: users, error } = await db
      .from('store_users')
      .select(`id, store_id, username, kiosk_code, owner_pin,
               stores (id, shop_name, owner_name, phone)`)
      .eq('role', 'admin');

    if (error) throw error;

    const match = users?.find(u =>
      (u.kiosk_code && u.kiosk_code.toUpperCase() === code.toUpperCase()) ||
      u.owner_pin === code
    );

    if (!match) return { error: 'invalid_credentials' };
    return { storeId: match.store_id, store: match.stores, user: match };

  } catch (err) {
    console.error('dbLoginKiosk:', err);
    return { error: err.message };
  }
}


/**
 * Get admin + manager users for a store
 */
async function dbGetStoreUsers(storeId) {
  const db = getDB();
  if (!db || !storeId) return { admin: null, manager: null };
  try {
    const { data } = await db.from('store_users').select('*').eq('store_id', storeId);
    return {
      admin:   data?.find(u => u.role === 'admin')   || null,
      manager: data?.find(u => u.role === 'manager') || null
    };
  } catch (err) {
    console.warn('dbGetStoreUsers:', err);
    return { admin: null, manager: null };
  }
}


/**
 * Update store info in Supabase
 */
async function dbUpdateStore(storeId, shopData) {
  const db = getDB();
  if (!db || !storeId) return;
  try {
    await db.from('stores').update({
      shop_name:          shopData.shopName,
      owner_name:         shopData.ownerName,
      phone:              shopData.phone,
      category:           shopData.category,
      opening_time:       shopData.openingTime,
      closing_time:       shopData.closingTime,
      daily_target_hours: shopData.dailyTargetHours
    }).eq('id', storeId);
  } catch (err) { console.warn('dbUpdateStore:', err); }
}


/**
 * Update admin credentials in Supabase
 */
async function dbUpdateAdminCreds(storeId, { username, password, pin, kioskCode }) {
  const db = getDB();
  if (!db || !storeId) return;
  const upd = {};
  if (username)  upd.username      = username;
  if (password)  upd.password_hash = password;
  if (pin)       upd.owner_pin     = pin;
  if (kioskCode) upd.kiosk_code    = kioskCode;
  try {
    const { data, error } = await db.from('store_users').update(upd).eq('store_id', storeId).eq('role', 'admin').select();
    if (error) console.warn('dbUpdateAdminCreds:', error);
    if (!data || data.length === 0) {
      await db.from('store_users').insert({ store_id: storeId, role: 'admin', ...upd });
    }
  } catch (err) { console.warn('dbUpdateAdminCreds:', err); }
}


/**
 * Update manager credentials in Supabase
 */
async function dbUpdateManagerCreds(storeId, { username, password }) {
  const db = getDB();
  if (!db || !storeId) return;
  const upd = {};
  if (username) upd.username      = username;
  if (password) upd.password_hash = password;
  try {
    const { data, error } = await db.from('store_users').update(upd).eq('store_id', storeId).eq('role', 'manager').select();
    if (error) console.warn('dbUpdateManagerCreds:', error);
    if (!data || data.length === 0) {
      await db.from('store_users').insert({ store_id: storeId, role: 'manager', ...upd });
    }
  } catch (err) { console.warn('dbUpdateManagerCreds:', err); }
}


// ============================================================
// C. EMPLOYEE OPERATIONS
// ============================================================

async function dbGetEmployees(storeId) {
  const db = getDB();
  if (!db || !storeId) return null;
  try {
    const { data, error } = await db
      .from('employees').select('*').eq('store_id', storeId).order('emp_code');
    if (error) throw error;
    return data ? data.map(_empToLocal) : [];
  } catch (err) {
    console.warn('dbGetEmployees:', err);
    return null;
  }
}

async function dbSyncEmployees(storeId, localEmps) {
  const db = getDB();
  if (!db || !storeId || !Array.isArray(localEmps)) return;
  if (localEmps.length === 0) return;
  try {
    const rows = localEmps.map(e => _empToSupa(storeId, e));
    await db.from('employees').upsert(rows, { onConflict: 'store_id,emp_code' });
  } catch (err) { console.warn('dbSyncEmployees:', err); }
}


// ============================================================
// D. ATTENDANCE OPERATIONS
// ============================================================

async function dbGetTodayAttendance(storeId) {
  const db = getDB();
  if (!db || !storeId) return null;
  const today = new Date().toISOString().slice(0, 10);
  try {
    const { data, error } = await db
      .from('attendance')
      .select('*, employees(emp_code)')
      .eq('store_id', storeId)
      .eq('date', today);
    if (error) throw error;
    const result = {};
    data?.forEach(r => {
      const code = r.employees?.emp_code;
      if (code) result[code] = {
        status: r.status,
        checkInTime:  r.check_in_time  || '',
        checkOutTime: r.check_out_time || '',
        notes:        r.notes          || '',
        markedBy:     r.marked_by      || 'admin'
      };
    });
    return result;
  } catch (err) {
    console.warn('dbGetTodayAttendance:', err);
    return null;
  }
}

async function dbSyncAttendance(storeId, localAtt) {
  const db = getDB();
  if (!db || !storeId || !localAtt) return;
  const today = new Date().toISOString().slice(0, 10);
  try {
    // Build emp_code → supabase UUID map
    const { data: emps } = await db.from('employees').select('id, emp_code').eq('store_id', storeId);
    if (!emps?.length) return;
    const codeToId = Object.fromEntries(emps.map(e => [e.emp_code, e.id]));

    const rows = Object.entries(localAtt)
      .map(([code, att]) => ({
        store_id:       storeId,
        employee_id:    codeToId[code],
        date:           today,
        status:         att.status        || 'Absent',
        check_in_time:  att.checkInTime   || null,
        check_out_time: att.checkOutTime  || null,
        notes:          att.notes         || null,
        marked_by:      att.markedBy      || 'admin'
      }))
      .filter(r => r.employee_id);

    if (rows.length > 0) {
      await db.from('attendance').upsert(rows, { onConflict: 'store_id,employee_id,date' });
    }
  } catch (err) { console.warn('dbSyncAttendance:', err); }
}


// ============================================================
// E. BREAKS OPERATIONS
// ============================================================

async function dbGetTodayBreaks(storeId) {
  const db = getDB();
  if (!db || !storeId) return null;
  const today = new Date().toISOString().slice(0, 10);
  try {
    const { data, error } = await db
      .from('breaks')
      .select('*, employees(emp_code)')
      .eq('store_id', storeId)
      .eq('date', today);
    if (error) throw error;
    return data ? data.map(r => ({
      empId:    r.employees?.emp_code,
      outTime:  r.out_time,
      backTime: r.back_time || null,
      reason:   r.reason    || '',
      _supaId:  r.id
    })) : [];
  } catch (err) {
    console.warn('dbGetTodayBreaks:', err);
    return null;
  }
}

async function dbSyncBreaks(storeId, localBreaks) {
  const db = getDB();
  if (!db || !storeId || !Array.isArray(localBreaks)) return;
  const today = new Date().toISOString().slice(0, 10);
  try {
    const { data: emps } = await db.from('employees').select('id, emp_code').eq('store_id', storeId);
    if (!emps?.length) return;
    const codeToId = Object.fromEntries(emps.map(e => [e.emp_code, e.id]));

    // Delete today's breaks and re-insert (clean sync)
    await db.from('breaks').delete().eq('store_id', storeId).eq('date', today);

    const rows = localBreaks
      .map(b => ({
        store_id:    storeId,
        employee_id: codeToId[b.empId],
        date:        today,
        out_time:    b.outTime,
        back_time:   b.backTime || null,
        reason:      b.reason   || null
      }))
      .filter(r => r.employee_id && r.out_time);

    if (rows.length > 0) await db.from('breaks').insert(rows);
  } catch (err) { console.warn('dbSyncBreaks:', err); }
}


// ============================================================
// F. PAYMENTS OPERATIONS
// ============================================================

async function dbGetPayments(storeId) {
  const db = getDB();
  if (!db || !storeId) return null;
  try {
    const { data, error } = await db
      .from('payments')
      .select('*, employees(emp_code)')
      .eq('store_id', storeId)
      .order('paid_at', { ascending: false });
    if (error) throw error;
    return data ? data.map(r => ({
      id:      r.id ? `PAY-${r.id.substring(0, 8)}` : `PAY-${Date.now()}`,
      empId:   r.employees?.emp_code,
      type:    r.payment_type || 'salary',
      amount:  parseFloat(r.amount) || 0,
      date:    r.paid_at ? r.paid_at.slice(0, 10) : new Date().toISOString().slice(0, 10),
      mode:    (r.payment_type && r.payment_type !== 'salary') ? r.payment_type.toUpperCase() : 'CASH',
      month:   r.month   || '',
      note:    r.note    || '',
      paidBy:  r.paid_by || 'admin',
      paidAt:  r.paid_at,
      _supaId: r.id
    })) : [];
  } catch (err) {
    console.warn('dbGetPayments:', err);
    return null;
  }
}

async function dbSyncPayments(storeId, localPays) {
  const db = getDB();
  if (!db || !storeId || !Array.isArray(localPays)) return;
  try {
    const { data: emps } = await db.from('employees').select('id, emp_code').eq('store_id', storeId);
    if (!emps?.length) return;
    const codeToId = Object.fromEntries(emps.map(e => [e.emp_code, e.id]));

    // Only push new payments (no _supaId yet)
    const newOnes = localPays.filter(p => !p._supaId);
    if (newOnes.length === 0) return;

    const rows = newOnes
      .map(p => ({
        store_id:     storeId,
        employee_id:  codeToId[p.empId],
        payment_type: p.type   || 'salary',
        amount:       parseFloat(p.amount) || 0,
        month:        p.month  || null,
        note:         p.note   || null,
        paid_by:      p.paidBy || 'admin'
      }))
      .filter(r => r.employee_id);

    if (rows.length > 0) await db.from('payments').insert(rows);
  } catch (err) { console.warn('dbSyncPayments:', err); }
}


// ============================================================
// G. FULL PULL: Supabase → localStorage
// Call after login to populate latest data
// ============================================================

async function dbSyncFromCloud(storeId) {
  const db = getDB();
  if (!db || !storeId) return;

  console.log('🔄 Syncing from Supabase cloud...');

  try {
    // 1. Shop settings
    const { data: store } = await db.from('stores').select('*').eq('id', storeId).single();
    if (store) localStorage.setItem(STORAGE_KEYS.SHOP, JSON.stringify(_storeToLocal(store)));

    // 2. Security settings (from store_users)
    const { admin, manager } = await dbGetStoreUsers(storeId);
    if (admin || manager) {
      const currentSec = getSecuritySettings();
      const sec = _usersToSec(admin, manager, currentSec);
      sec.currentRole = currentSec.currentRole;
      saveSecuritySettings(sec);
    }

    // 3. Employees
    const employees = await dbGetEmployees(storeId);
    if (employees !== null) localStorage.setItem(STORAGE_KEYS.EMPLOYEES, JSON.stringify(employees));

    // 4. Today's attendance
    const attendance = await dbGetTodayAttendance(storeId);
    if (attendance !== null) localStorage.setItem(STORAGE_KEYS.ATTENDANCE, JSON.stringify(attendance));

    // 5. Today's breaks
    const breaks = await dbGetTodayBreaks(storeId);
    if (breaks !== null) localStorage.setItem(STORAGE_KEYS.BREAKS, JSON.stringify(breaks));

    // 6. Payments
    const payments = await dbGetPayments(storeId);
    if (payments !== null) localStorage.setItem(STORAGE_KEYS.PAYMENTS, JSON.stringify(payments));

    console.log('✅ Cloud sync complete!');
    renderAllViews();

  } catch (err) {
    console.warn('dbSyncFromCloud error:', err);
  }
}
