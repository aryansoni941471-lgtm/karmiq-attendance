/**
 * KARMIQ — Kaam ka smart hisaab
 * Master JavaScript Entry Point & Module Index
 * 
 * =============================================================================
 * 📂 MODULAR CODEBASE ARCHITECTURE
 * =============================================================================
 * Pehle saara code iss single script.js file mein tha (4,800+ lines).
 * Ab code ko clean, focused aur domain-specific files mein divide kar diya gaya hai:
 *
 * 📁 js/
 * ├── state.js            -> Multi-tenant Store Registry, Global Keys & Defaults
 * ├── storage.js          -> LocalStorage & Supabase sync, Date Rollover (12 AM reset)
 * ├── calculations.js     -> Working Hours, Late-Fine, Overtime, Salary Math & QR Generator
 * ├── ui.js               -> Audio Chimes, View & Tab Switching, Modals, Toast Alerts
 * ├── auth.js             -> 3-Step Store Signup, Owner/Manager/Kiosk Auth, Credentials
 * ├── dashboard.js        -> Dashboard Overview, KPI Cards, Live Clock
 * ├── employees.js        -> Staff Directory, Add/Edit/Delete Employee
 * ├── scanner.js          -> QR Scanner Terminal, Live Camera Scanner, Punch Processing
 * ├── attendance.js       -> Attendance Sheet, Manual Punch, Breaks & Departures
 * ├── salary.js           -> Salary Ledger, Advance Cash/UPI Payments, Slips
 * ├── employee-profile.js -> Staff ID Card Modal, Printable QR Badges
 * ├── reports.js          -> Reports Pane, Aaj Ka Hisaab, WhatsApp Summary Export
 * ├── assistant.js        -> Hinglish Voice Assistant, Video Guide Walkthrough
 * ├── roles-kiosk.js      -> Multi-Device Roles (Owner vs Manager), PIN Pad, Kiosk Mode
 * ├── subscription.js     -> Plans & Pricing, ROI Calculator, Paywalls, UPI Verification
 * └── app.js              -> Master renderAllViews(), initApp() & Background Timers
 *
 * NOTE: Original monolithic file is safely preserved in `script.bundle.js`.
 * All active script references are loaded in `index.html` from the `js/` directory.
 * =============================================================================
 */

// Module Status Verification
if (typeof window !== 'undefined') {
  console.log('✅ Karmiq: Modular architecture active from /js directory.');
}
