// =============================================================================
// 16. VOICE ASSISTANT DEMO & SIMULATION (Hinglish Context)
// =============================================================================

function openVoiceModal() {
  openModal('voiceAssistantModal');
}

function executeVoiceCommand(queryText) {
  const userTxt = document.getElementById('voiceModalUserTxt');
  const replyTxt = document.getElementById('voiceModalReplyTxt');
  if (userTxt) userTxt.textContent = `“${queryText}”`;

  const employees = getEmployees();
  const attendance = getAttendance();
  const payments = getPayments();

  let presentCount = 0;
  let absentCount = 0;
  let totalWorkedMins = 0;
  employees.forEach(emp => {
    if (emp.isLeft) return;
    const att = attendance[emp.id];
    if (att && att.status === 'Present') {
      presentCount++;
      totalWorkedMins += calculateWorkingHours(emp.id).minutes;
    } else {
      absentCount++;
    }
  });

  const todayStr = new Date().toISOString().slice(0, 10);
  let paidTodaySum = 0;
  payments.forEach(p => {
    if (p.date === todayStr) paidTodaySum += Number(p.amount);
  });

  const lowerQuery = queryText.toLowerCase();
  const matchedEmp = employees.find(e => lowerQuery.includes(e.name.toLowerCase()));

  if (replyTxt) {
    if (matchedEmp) {
      const sal = calculateSalaryBalance(matchedEmp.id);
      const wh = calculateWorkingHours(matchedEmp.id);
      if (lowerQuery.includes('salary') || lowerQuery.includes('hisaab') || lowerQuery.includes('kitna baaki')) {
        replyTxt.innerHTML = `${matchedEmp.name} ki monthly salary ₹${Number(sal.salary).toLocaleString('en-IN')} hai. <strong>₹${sal.paid.toLocaleString('en-IN')} paid hai</strong> aur <strong>₹${sal.due.toLocaleString('en-IN')} baaki hai</strong>.`;
      } else if (lowerQuery.includes('hour') || lowerQuery.includes('kaam')) {
        replyTxt.innerHTML = `${matchedEmp.name} ne aaj <strong>${wh.text}</strong> kaam kiya hai.`;
      } else {
        replyTxt.innerHTML = `${matchedEmp.name} (${matchedEmp.role}): Salary ₹${Number(sal.salary).toLocaleString('en-IN')}, Due ₹${sal.due.toLocaleString('en-IN')}, Aaj ka kaam ${wh.text}.`;
      }
    } else if (lowerQuery.includes('aaj ka hisaab') || lowerQuery.includes('summary')) {
      const shopHours = typeof calculateShopTodayWorkingHours === 'function'
        ? calculateShopTodayWorkingHours()
        : { hours: 0, mins: 0, text: '0h 00m' };
      replyTxt.innerHTML = `Aaj kul <strong>${presentCount} staff present</strong> hain, ${absentCount} absent hain. Dukaan total <strong>${shopHours.text}</strong> chali hai aur <strong>₹${paidTodaySum.toLocaleString('en-IN')} salary advance</strong> pay kiya gaya hai.`;
    } else if (lowerQuery.includes('kitne staff') || lowerQuery.includes('present')) {
      replyTxt.innerHTML = `Aaj total <strong>${employees.length} staff</strong> mein se <strong>${presentCount} present</strong> hain aur <strong>${absentCount} absent</strong> hain.`;
    } else {
      replyTxt.innerHTML = `Aapke store mein total ${employees.length} staff enrolled hain. Aaj ${presentCount} present hain aur ₹${paidTodaySum.toLocaleString('en-IN')} paid hai.`;
    }
  }

  playSound('success');
}

function simulateVoiceDemo(index) {
  const queries = [
    '',
    'Staff ka salary kitna baaki hai?',
    'Aaj ka hisaab batao.',
    'Staff ne kitne hours kaam kiya?'
  ];
  const query = queries[index];
  const userBubble = document.getElementById('voiceUserBubble');
  const aiText = document.getElementById('voiceAiText');

  if (userBubble) userBubble.textContent = `“${query}”`;

  if (aiText) {
    const employees = getEmployees();
    const payments = getPayments();
    let totalSalary = 0;
    let totalPaid = 0;
    employees.forEach(e => {
      const sal = calculateSalaryBalance(e.id);
      totalSalary += sal.salary;
      totalPaid += sal.paid;
    });
    const due = Math.max(0, totalSalary - totalPaid);

    if (index === 1) {
      if (employees.length > 0) {
        aiText.innerHTML = `Total salary ₹${totalSalary.toLocaleString('en-IN')} mein se ₹${totalPaid.toLocaleString('en-IN')} paid hai aur <strong>₹${due.toLocaleString('en-IN')} baaki hai</strong>.`;
      } else {
        aiText.innerHTML = `Abhi koi staff add nahi hua hai. Staff add karne par salary balance yahan dikhega.`;
      }
    } else if (index === 2) {
      aiText.innerHTML = `Total ${employees.length} staff enrolled hain. Aaj ka attendance aur hisaab live dashboard par active hai.`;
    } else if (index === 3) {
      aiText.innerHTML = `Staff working hours daily QR check-in aur shift closing time ke basis par auto-track hote hain.`;
    }
  }
}

// =============================================================================
// 16.5 HOW IT WORKS INTERACTIVE VIDEO CONTROLLER
// =============================================================================

let videoDemoState = {
  isPlaying: false,
  currentTime: 0,
  duration: 40, // 40 seconds total
  speed: 1,
  audioEnabled: false,
  timerInterval: null,
  activeChapter: 1,
  chapterNarration: {
    1: 'Step 1: Apne staff ka naam, salary aur daily working hours add karein. Karmiq turant ek printable QR ID card generate kar deta hai.',
    2: 'Step 2: Staff apna QR card shop counter par phone camera ke aage dikhata hai aur ek second mein check in mark ho jata hai.',
    3: 'Step 3: Live working hours aur break tracking automatically count hoti rehti hai bina kisi manual entry ke.',
    4: 'Step 4: Monthly salary balance, advance payments aur 1-click WhatsApp salary slip direct staff ko share karein.'
  }
};

function openHowItWorksVideoModal() {
  openModal('howItWorksVideoModal');
  videoDemoState.currentTime = 0;
  videoDemoState.isPlaying = false;
  jumpToVideoChapter(1, false);
  // Auto-start play after a brief moment
  setTimeout(() => {
    startHowItWorksVideo();
  }, 400);
}

function closeHowItWorksVideoModal() {
  pauseHowItWorksVideo();
  closeModal('howItWorksVideoModal');
  if (window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }
}

function toggleHowItWorksVideo() {
  if (videoDemoState.isPlaying) {
    pauseHowItWorksVideo();
  } else {
    startHowItWorksVideo();
  }
}

function startHowItWorksVideo() {
  videoDemoState.isPlaying = true;
  updateVideoControlsUI();

  if (videoDemoState.timerInterval) clearInterval(videoDemoState.timerInterval);

  speakVideoChapterNarration(videoDemoState.activeChapter);

  videoDemoState.timerInterval = setInterval(() => {
    videoDemoState.currentTime += 0.2 * videoDemoState.speed;
    if (videoDemoState.currentTime >= videoDemoState.duration) {
      videoDemoState.currentTime = videoDemoState.duration;
      pauseHowItWorksVideo();
    }
    updateVideoProgressUI();
  }, 200);
}

function pauseHowItWorksVideo() {
  videoDemoState.isPlaying = false;
  if (videoDemoState.timerInterval) {
    clearInterval(videoDemoState.timerInterval);
    videoDemoState.timerInterval = null;
  }
  if (window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }
  updateVideoControlsUI();
}

function restartHowItWorksVideo() {
  videoDemoState.currentTime = 0;
  jumpToVideoChapter(1, false);
  startHowItWorksVideo();
}

function updateVideoProgressUI() {
  const percent = Math.min(100, (videoDemoState.currentTime / videoDemoState.duration) * 100);
  const fill = document.getElementById('vTimelineFill');
  const handle = document.getElementById('vTimelineHandle');
  const timerTxt = document.getElementById('vTimerText');

  if (fill) fill.style.width = `${percent}%`;
  if (handle) handle.style.left = `${percent}%`;

  const curM = Math.floor(videoDemoState.currentTime / 60);
  const curS = Math.floor(videoDemoState.currentTime % 60).toString().padStart(2, '0');
  const durM = Math.floor(videoDemoState.duration / 60);
  const durS = Math.floor(videoDemoState.duration % 60).toString().padStart(2, '0');

  if (timerTxt) timerTxt.textContent = `${curM}:${curS} / ${durM}:${durS}`;

  // Check chapter based on time (10s per chapter)
  let chap = Math.min(4, Math.floor(videoDemoState.currentTime / 10) + 1);
  if (chap !== videoDemoState.activeChapter) {
    jumpToVideoChapter(chap, false);
  }
}

function jumpToVideoChapter(chapNum, updateTime = true) {
  videoDemoState.activeChapter = chapNum;

  if (updateTime) {
    videoDemoState.currentTime = (chapNum - 1) * 10;
    updateVideoProgressUI();
    if (videoDemoState.isPlaying) {
      speakVideoChapterNarration(chapNum);
    }
  }

  // Update scene visibility
  for (let i = 1; i <= 4; i++) {
    const scene = document.getElementById(`vScene${i}`);
    const chapBtn = document.getElementById(`vChapBtn${i}`);
    if (scene) scene.classList.toggle('active', i === chapNum);
    if (chapBtn) chapBtn.classList.toggle('active', i === chapNum);
  }
}

function seekVideoDemo(e) {
  const wrapper = document.getElementById('vTimelineWrapper');
  if (!wrapper) return;
  const rect = wrapper.getBoundingClientRect();
  const clickX = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
  const pct = clickX / rect.width;
  videoDemoState.currentTime = pct * videoDemoState.duration;
  let chap = Math.min(4, Math.floor(videoDemoState.currentTime / 10) + 1);
  jumpToVideoChapter(chap, false);
  updateVideoProgressUI();
}

function cycleVideoSpeed() {
  const speeds = [1, 1.5, 2];
  let curIdx = speeds.indexOf(videoDemoState.speed);
  let nextIdx = (curIdx + 1) % speeds.length;
  videoDemoState.speed = speeds[nextIdx];
  const btn = document.getElementById('vSpeedBtn');
  if (btn) btn.textContent = `${videoDemoState.speed}x`;
}

function toggleVideoVoiceover() {
  videoDemoState.audioEnabled = !videoDemoState.audioEnabled;
  const audioIcon = document.getElementById('vAudioIcon');
  const btn = document.getElementById('vAudioBtn');
  if (videoDemoState.audioEnabled) {
    if (btn) btn.style.color = '#38bdf8';
    speakVideoChapterNarration(videoDemoState.activeChapter);
    showToast('Voiceover Audio Enabled', 'info');
  } else {
    if (btn) btn.style.color = '#94a3b8';
    if (window.speechSynthesis) window.speechSynthesis.cancel();
    showToast('Voiceover Muted', 'info');
  }
}

function speakVideoChapterNarration(chapNum) {
  if (!videoDemoState.audioEnabled || !('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  const text = videoDemoState.chapterNarration[chapNum];
  if (!text) return;
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = 'hi-IN';
  utter.rate = 1.0 * videoDemoState.speed;
  window.speechSynthesis.speak(utter);
}

function updateVideoControlsUI() {
  const playOverlayBtn = document.getElementById('vPlayOverlayBtn');
  const playBtnIcon = document.getElementById('vPlayBtnIcon');
  const playOverlayIcon = document.getElementById('vPlayOverlayIcon');

  if (videoDemoState.isPlaying) {
    if (playOverlayBtn) playOverlayBtn.classList.add('playing');
    if (playBtnIcon) {
      playBtnIcon.innerHTML = '<rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect>';
    }
  } else {
    if (playOverlayBtn) playOverlayBtn.classList.remove('playing');
    if (playBtnIcon) {
      playBtnIcon.innerHTML = '<polygon points="8 5 19 12 8 19 8 5"></polygon>';
    }
  }
}
