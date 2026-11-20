// =============================================================================
// 11. QR SCANNER TERMINAL & LIVE REAL-TIME CAMERA SCANNER
// =============================================================================

let liveHtml5QrScanner = null;
let isCameraScannerRunning = false;
let currentFacingMode = 'environment'; // Default to back camera for phone devices
let lastProcessedScanId = null;
let lastProcessedTime = 0;
let nativeMediaStream = null;

async function setupScannerTab() {
  const employees = getEmployees().filter(e => !e.isLeft);
  const select = document.getElementById('simEmployeeSelect');
  if (select) {
    if (employees.length === 0) {
      select.innerHTML = `<option value="">-- No active staff added --</option>`;
    } else {
      select.innerHTML = employees.map(emp => `
        <option value="${emp.id}">${emp.name} (${emp.id} - ${emp.role})</option>
      `).join('');
    }
  }

  renderScannerLog();
  // Automatically start live camera scanner when entering scanner tab
  startLiveCameraScanner();
}

async function startLiveCameraScanner() {
  if (isCameraScannerRunning) return;

  const statusText = document.getElementById('cameraStatusText');
  const statusDot = document.getElementById('cameraStatusDot');
  const btnToggleText = document.getElementById('btnToggleCameraText');
  const promptLabel = document.getElementById('cameraPromptLabel');
  const gridOverlay = document.getElementById('cameraGridOverlay');

  if (statusText) statusText.textContent = 'Connecting Camera...';
  if (statusDot) statusDot.className = 'pulse-amber';

  try {
    const videoEl = document.getElementById('cameraVideo');
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error('Camera API not supported in this browser/context');
    }

    nativeMediaStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: currentFacingMode },
      audio: false
    });
    videoEl.srcObject = nativeMediaStream;
    videoEl.style.display = 'block';
    await videoEl.play();

    isCameraScannerRunning = true;
    if (statusText) statusText.textContent = 'Camera Active • Scanning...';
    if (statusDot) statusDot.className = 'pulse-green';
    if (btnToggleText) btnToggleText.textContent = 'Stop Camera';
    if (promptLabel) promptLabel.textContent = 'POINT QR CODE AT CAMERA';
    if (gridOverlay) gridOverlay.style.opacity = '0.1';

    // Scan loop: every 200ms (lightweight, saves CPU/battery)
    const scanCanvas = document.createElement('canvas');
    const scanCtx = scanCanvas.getContext('2d', { willReadFrequently: true });
    const hasBarcodeDetector = 'BarcodeDetector' in window;
    let barcodeDetector = null;
    if (hasBarcodeDetector) {
      try { barcodeDetector = new window.BarcodeDetector({ formats: ['qr_code'] }); } catch(e) {}
    }

    const scanTick = async () => {
      if (!isCameraScannerRunning) return;
      try {
        if (videoEl.readyState >= 2 && videoEl.videoWidth > 0) {
          if (barcodeDetector) {
            // Native BarcodeDetector — fastest, no canvas needed
            const codes = await barcodeDetector.detect(videoEl);
            if (codes && codes.length > 0) handleCameraDecodedText(codes[0].rawValue);
          } else if (window.KarmiqQrGenerator && window.KarmiqQrGenerator.decodeFromVideo) {
            // Custom engine fallback
            const result = window.KarmiqQrGenerator.decodeFromVideo(videoEl, scanCanvas, scanCtx);
            if (result) handleCameraDecodedText(result);
          }
        }
      } catch (e) { /* ignore per-frame decode errors */ }
      if (isCameraScannerRunning) setTimeout(scanTick, 200);
    };
    setTimeout(scanTick, 500); // slight delay to let video settle
    return;

  } catch (err) {
    console.warn('Camera start failed:', err.message);
  }

  // Camera unavailable
  isCameraScannerRunning = false;
  if (statusText) statusText.textContent = 'Camera Unavailable';
  if (statusDot) statusDot.className = 'pulse-red';
  if (btnToggleText) btnToggleText.textContent = 'Start Camera Scanner';
  if (promptLabel) promptLabel.textContent = 'Camera blocked — use Upload QR or Manual Test below';
}

async function stopLiveCameraScanner() {
  if (liveHtml5QrScanner && isCameraScannerRunning) {
    try {
      await liveHtml5QrScanner.stop();
    } catch (e) {
      console.warn('Stop Html5Qrcode error:', e);
    }
  }

  if (nativeMediaStream) {
    nativeMediaStream.getTracks().forEach(track => track.stop());
    nativeMediaStream = null;
  }

  const videoEl = document.getElementById('cameraVideo');
  if (videoEl) {
    videoEl.srcObject = null;
    videoEl.style.display = 'none';
  }

  isCameraScannerRunning = false;
  const statusText = document.getElementById('cameraStatusText');
  const statusDot = document.getElementById('cameraStatusDot');
  const btnToggleText = document.getElementById('btnToggleCameraText');
  const promptLabel = document.getElementById('cameraPromptLabel');
  const gridOverlay = document.getElementById('cameraGridOverlay');

  if (statusText) statusText.textContent = 'Camera Paused';
  if (statusDot) statusDot.className = 'pulse-amber';
  if (btnToggleText) btnToggleText.textContent = 'Start Camera Scanner';
  if (promptLabel) promptLabel.textContent = 'CLICK START TO SCAN';
  if (gridOverlay) gridOverlay.style.opacity = '1';
}

function toggleLiveCamera() {
  if (isCameraScannerRunning) {
    stopLiveCameraScanner();
  } else {
    startLiveCameraScanner();
  }
}

async function switchLiveCamera() {
  currentFacingMode = (currentFacingMode === 'environment') ? 'user' : 'environment';
  if (isCameraScannerRunning) {
    await stopLiveCameraScanner();
    await startLiveCameraScanner();
  }
  showToast(`Switched camera mode: ${currentFacingMode === 'environment' ? 'Back / Rear Camera' : 'Front / Selfie Camera'}`, 'info');
}

// Upload QR Image Scanner Handler
async function handleQrImageUpload(event) {
  const file = event.target.files && event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async function(e) {
    const img = new Image();
    img.onload = async function() {
      // 1. Try native BarcodeDetector
      if ('BarcodeDetector' in window) {
        try {
          const detector = new window.BarcodeDetector({ formats: ['qr_code'] });
          const codes = await detector.detect(img);
          if (codes && codes.length > 0 && codes[0].rawValue) {
            handleCameraDecodedText(codes[0].rawValue);
            return;
          }
        } catch (err) {
          console.warn('BarcodeDetector image detect warning:', err);
        }
      }

      // 2. Fallback: Extract image data via canvas
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        ctx.drawImage(img, 0, 0);

        if (typeof jsQR !== 'undefined') {
          const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const code = jsQR(imgData.data, imgData.width, imgData.height);
          if (code && code.data) {
            handleCameraDecodedText(code.data);
            return;
          }
        }
      } catch (err) {
        console.warn('Canvas QR parse warning:', err);
      }

      showToast('Could not find a readable Karmiq QR code in this photo. Please try with clearer lighting or enter employee ID.', 'warning');
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
  event.target.value = '';
}

function parseEmployeeId(decodedString) {
  if (!decodedString) return '';
  const text = String(decodedString).trim();

  // Pattern 1: KARMIQ:EMP001
  if (text.startsWith('KARMIQ:')) {
    return text.replace('KARMIQ:', '').trim();
  }

  // Pattern 2: JSON payload
  try {
    const json = JSON.parse(text);
    if (json.id || json.empId || json.employeeId) {
      return (json.id || json.empId || json.employeeId).trim();
    }
  } catch (e) {}

  // Pattern 3: Direct match with existing employees
  const employees = getEmployees();
  const directMatch = employees.find(e => e.id.toLowerCase() === text.toLowerCase());
  if (directMatch) return directMatch.id;

  // Pattern 4: EMP\d+ regex
  const regexMatch = text.match(/EMP\d+/i);
  if (regexMatch) return regexMatch[0].toUpperCase();

  return text;
}

function handleCameraDecodedText(decodedText) {
  const empId = parseEmployeeId(decodedText);
  if (!empId) return;

  const now = Date.now();
  // Cooldown debounce: 3 seconds to avoid multi-beeping on the same card in front of camera
  if (empId === lastProcessedScanId && (now - lastProcessedTime < 3000)) {
    return;
  }

  lastProcessedScanId = empId;
  lastProcessedTime = now;
  processQrScan(empId);
}

function renderScannerLog() {
  const employees = getEmployees();
  const attendance = getAttendance();
  const logContainer = document.getElementById('scannerLiveLogs');
  const countBadge = document.getElementById('scannerPresentCount');

  let presentCount = 0;
  const logs = [];

  employees.forEach(emp => {
    const att = attendance[emp.id];
    if (att && att.status !== 'Absent' && att.checkInTime) {
      presentCount++;
      logs.push({
        emp,
        checkInTime: att.checkInTime,
        status: att.status,
        source: att.source || 'Live QR Scan'
      });
    }
  });

  if (countBadge) countBadge.textContent = `${presentCount} Present Today`;

  if (logContainer) {
    if (logs.length === 0) {
      logContainer.innerHTML = `<div style="padding:2rem; text-align:center; color:var(--text-muted); font-size:0.875rem;">No check-ins recorded yet today.<br><span style="font-size:0.78rem; opacity:0.8;">Scan an employee QR code to record attendance.</span></div>`;
    } else {
      logContainer.innerHTML = logs.reverse().map(item => `
        <div class="scanner-log-item">
          <div class="log-staff">
            <span style="font-size:1rem;">🟢</span>
            <div>
              <strong style="font-size:0.85rem; color:var(--text-white);">${item.emp.name}</strong>
              <div style="font-size:0.7rem; color:var(--text-muted);">${item.emp.id} • ${item.source}</div>
            </div>
          </div>
          <div class="log-time">${item.checkInTime}</div>
        </div>
      `).join('');
    }
  }
}

function triggerSimulatedScan() {
  const select = document.getElementById('simEmployeeSelect');
  if (!select || !select.value) {
    showToast('Please add a staff member first to test scanning.', 'warning');
    return;
  }
  const empId = select.value;
  processQrScan(empId);
}

function processQrScan(empId) {
  const employees = getEmployees();
  const attendance = getAttendance();
  const emp = employees.find(e => e.id.toUpperCase() === empId.toUpperCase());

  if (!emp) {
    showToast(`Unrecognized QR code (${empId}). Please scan a registered Karmiq staff QR.`, 'warning');
    return;
  }

  const existing = attendance[emp.id];
  const overlay = document.getElementById('scannerFeedbackOverlay');
  const card = document.getElementById('scannerFeedbackCard');
  const icon = document.getElementById('feedbackIcon');
  const title = document.getElementById('feedbackTitle');
  const details = document.getElementById('feedbackDetails');
  const hours = document.getElementById('feedbackHours');

  // Check duplicate prevention / Punch-Out
  if (existing && existing.status === 'Present' && existing.checkInTime) {
    // If not checked out yet, record Punch-Out (Ghar Jaana / Check-Out)
    if (!existing.checkOutTime) {
      const nowTime = new Date();
      const hoursStr = nowTime.getHours().toString().padStart(2, '0');
      const minsStr = nowTime.getMinutes().toString().padStart(2, '0');
      const checkOutStamp = `${hoursStr}:${minsStr}`;

      existing.checkOutTime = checkOutStamp;
      saveAttendance(attendance);

      const wh = calculateWorkingHours(emp.id);
      playSound('success');
      if (card) card.className = 'feedback-card';
      if (icon) icon.textContent = '🚪';
      if (title) title.textContent = 'Check-Out (Punch Out) Recorded!';
      if (details) details.textContent = `${emp.name} • Out Time: ${checkOutStamp} (In Time: ${existing.checkInTime})`;
      if (hours) hours.textContent = `Total Working Time Today: ${wh.text}`;
      if (overlay) overlay.classList.add('show');
      showToast(`✓ Punch Out Marked: ${emp.name} at ${checkOutStamp} (Total: ${wh.text})`, 'success');

      renderScannerLog();
      renderOverview();
      setTimeout(() => {
        if (overlay) overlay.classList.remove('show');
      }, 3000);
      return;
    }

    // Already checked in AND checked out
    playSound('duplicate');
    if (card) card.className = 'feedback-card duplicate';
    if (icon) icon.textContent = '✓';
    if (title) title.textContent = 'Shift Completed Today';
    if (details) details.textContent = `${emp.name} is already checked in at ${existing.checkInTime} and checked out at ${existing.checkOutTime}.`;
    if (hours) hours.textContent = `Daily shift completed for today.`;
    if (overlay) overlay.classList.add('show');
    showToast(`${emp.name} already punched out at ${existing.checkOutTime}.`, 'info');
    
    setTimeout(() => {
      if (overlay) overlay.classList.remove('show');
    }, 2800);
    return;
  }

  // Record Attendance
  const nowTime = new Date();
  const hoursStr = nowTime.getHours().toString().padStart(2, '0');
  const minsStr = nowTime.getMinutes().toString().padStart(2, '0');
  const checkInStamp = `${hoursStr}:${minsStr}`;

  attendance[emp.id] = {
    status: 'Present',
    checkInTime: checkInStamp,
    source: 'Live QR Camera'
  };
  saveAttendance(attendance);

  playSound('success');
  if (card) card.className = 'feedback-card';
  if (icon) icon.textContent = '✓';
  if (title) title.textContent = 'Attendance Marked Successfully';
  if (details) details.textContent = `${emp.name} • ${checkInStamp}`;
  if (hours) hours.textContent = `Working hours tracking active until shop closes`;
  if (overlay) overlay.classList.add('show');

  renderScannerLog();
  renderOverview();
  showToast(`✓ Attendance marked: ${emp.name} (${checkInStamp})`, 'success');

  setTimeout(() => {
    if (overlay) overlay.classList.remove('show');
  }, 2600);
}

// Live terminal clock updater
setInterval(() => {
  const clock = document.getElementById('terminalLiveClock');
  if (clock) {
    const d = new Date();
    clock.textContent = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
  }
}, 1000);
