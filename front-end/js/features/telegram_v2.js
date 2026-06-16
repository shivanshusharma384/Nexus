/* =========================================================
   telegram.js  —  Nexus Multi-Chat — Telegram Auth & QR Login
   Requires: config.js, helpers.js, sidebar.js
   ========================================================= */

(function () {
  const tgOverlay  = document.getElementById('tgAuthOverlay');
  const tgClose    = document.getElementById('tgAuthClose');
  const tgPhoneBtn = document.getElementById('tgPhoneBtn');
  const tgPhoneIn  = document.getElementById('tgPhoneInput');
  const tgCountry  = document.getElementById('tgCountrySelect');

  /* ── QR Code generation (using qrcode-generator library) ── */
  // We'll use a lightweight QR code approach with canvas
  
  let qrTimer = null;
  let qrCountdown = 30;  // seconds before QR refresh
  let qrIntervalId = null;

  /* ── Open / Close ── */
  NexusApp.openTgAuthOverlay = function () {
    if (!tgOverlay) return;
    tgOverlay.classList.add('open');
    tgOverlay.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    
    lucide.createIcons();
    startQrSession();
  };

  NexusApp.closeTgAuthOverlay = function () {
    if (!tgOverlay) return;
    tgOverlay.classList.remove('open');
    tgOverlay.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    stopQrTimer();
  };

  /* ── Close button ── */
  tgClose?.addEventListener('click', () => {
    NexusApp.closeTgAuthOverlay();
    // De-select tg nav, revert to X
    const platformBtnsAll = document.querySelectorAll('.nav-platform-btn');
    platformBtnsAll.forEach(b => b.classList.remove('active'));
    const firstBtn = document.querySelector('.nav-platform-btn[data-channel="x"]');
    if (firstBtn) firstBtn.classList.add('active');
  });

  /* ── Backdrop click ── */
  tgOverlay?.addEventListener('click', (e) => {
    if (e.target === tgOverlay) tgClose?.click();
  });

  /* ── Escape key ── */
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && tgOverlay?.classList.contains('open')) {
      tgClose?.click();
    }
  });



  /* ── Phone number login ── */
  tgPhoneBtn?.addEventListener('click', () => {
    const phone = (tgCountry?.value || '+1') + (tgPhoneIn?.value || '').replace(/\D/g, '');
    if (!tgPhoneIn?.value || tgPhoneIn.value.trim().length < 5) {
      shakeBtn(tgPhoneBtn);
      return;
    }

    tgPhoneBtn.classList.add('loading');
    tgPhoneBtn.querySelector('span').textContent = 'Sending code…';

    // Simulate – in real integration this would call Telegram API
    setTimeout(() => {
      tgPhoneBtn.classList.remove('loading');
      tgPhoneBtn.querySelector('span').textContent = 'Next';
      showToast('📱 Verification code sent to ' + phone);
    }, 2000);
  });

  /* ── QR Code Generation ── */
  function generateQrData() {
    // Generate a realistic-looking Telegram login token
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let token = '';
    for (let i = 0; i < 32; i++) {
      token += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return 'tg://login?token=' + token;
  }

  function drawQrCode(data) {
    const canvas = document.getElementById('tgQrCanvas');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    const size = 180;
    canvas.width = size;
    canvas.height = size;

    // Use the QR code library if available, otherwise draw a realistic animated QR
    if (typeof QRCode !== 'undefined') {
      // If qrcode-generator library is loaded
      const qr = QRCode(0, 'M');
      qr.addData(data);
      qr.make();
      
      const moduleCount = qr.getModuleCount();
      const cellSize = size / moduleCount;
      
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, size, size);
      
      // Draw modules with animation
      for (let row = 0; row < moduleCount; row++) {
        for (let col = 0; col < moduleCount; col++) {
          if (qr.isDark(row, col)) {
            const x = col * cellSize;
            const y = row * cellSize;
            // Leave center empty for logo
            const centerX = size / 2;
            const centerY = size / 2;
            const dist = Math.sqrt((x + cellSize/2 - centerX) ** 2 + (y + cellSize/2 - centerY) ** 2);
            if (dist < 28) continue; // Skip center for logo
            
            ctx.fillStyle = '#1a1a2e';
            // Rounded modules
            const pad = cellSize * 0.12;
            const r = cellSize * 0.2;
            roundRect(ctx, x + pad, y + pad, cellSize - pad * 2, cellSize - pad * 2, r);
            ctx.fill();
          }
        }
      }
    } else {
      // Fallback: generate a realistic QR pattern with canvas
      drawRealisticQr(ctx, size, data);
    }
  }

  function drawRealisticQr(ctx, size, data) {
    const moduleSize = 5;
    const modules = Math.floor(size / moduleSize);
    
    // Clear to white
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, size, size);
    
    // Seed from data string for consistent patterns
    let seed = 0;
    for (let i = 0; i < data.length; i++) {
      seed = ((seed << 5) - seed + data.charCodeAt(i)) | 0;
    }
    
    function seededRandom() {
      seed = (seed * 16807 + 0) % 2147483647;
      return (seed & 0x7fffffff) / 0x7fffffff;
    }

    // Draw finder patterns (3 corners)
    function drawFinder(ox, oy) {
      // Outer border
      ctx.fillStyle = '#1a1a2e';
      roundRect(ctx, ox, oy, moduleSize * 7, moduleSize * 7, 3);
      ctx.fill();
      // White gap
      ctx.fillStyle = '#ffffff';
      roundRect(ctx, ox + moduleSize, oy + moduleSize, moduleSize * 5, moduleSize * 5, 2);
      ctx.fill();
      // Inner square
      ctx.fillStyle = '#1a1a2e';
      roundRect(ctx, ox + moduleSize * 2, oy + moduleSize * 2, moduleSize * 3, moduleSize * 3, 2);
      ctx.fill();
    }

    drawFinder(0, 0);
    drawFinder(size - moduleSize * 7, 0);
    drawFinder(0, size - moduleSize * 7);

    // Draw timing patterns
    ctx.fillStyle = '#1a1a2e';
    for (let i = 8; i < modules - 8; i++) {
      if (i % 2 === 0) {
        roundRect(ctx, i * moduleSize, 6 * moduleSize, moduleSize - 1, moduleSize - 1, 1);
        ctx.fill();
        roundRect(ctx, 6 * moduleSize, i * moduleSize, moduleSize - 1, moduleSize - 1, 1);
        ctx.fill();
      }
    }

    // Draw data modules (randomized but consistent from seed)
    const centerX = size / 2;
    const centerY = size / 2;

    for (let row = 0; row < modules; row++) {
      for (let col = 0; col < modules; col++) {
        const x = col * moduleSize;
        const y = row * moduleSize;

        // Skip finder pattern areas
        if (
          (col < 8 && row < 8) ||
          (col >= modules - 8 && row < 8) ||
          (col < 8 && row >= modules - 8)
        ) continue;

        // Skip timing pattern areas  
        if (col === 6 || row === 6) continue;

        // Skip center for logo overlay
        const dist = Math.sqrt((x + moduleSize/2 - centerX) ** 2 + (y + moduleSize/2 - centerY) ** 2);
        if (dist < 24) continue;

        // Random fill
        if (seededRandom() > 0.52) {
          ctx.fillStyle = '#1a1a2e';
          roundRect(ctx, x + 0.5, y + 0.5, moduleSize - 1, moduleSize - 1, 1);
          ctx.fill();
        }
      }
    }
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  /* ── QR Timer / Refresh ── */
  function startQrSession() {
    const container = document.querySelector('.tg-qr-container');
    const timerText = document.getElementById('tgQrTimerText');
    const ringProgress = document.querySelector('.ring-progress');
    const circumference = 62.83; // 2 * PI * 10

    // Generate new QR
    const qrData = generateQrData();
    
    // Animate regeneration
    if (container) {
      container.classList.add('regenerating');
      setTimeout(() => {
        drawQrCode(qrData);
        container.classList.remove('regenerating');
      }, 400);
    } else {
      drawQrCode(qrData);
    }

    // Reset countdown
    qrCountdown = 30;
    stopQrTimer();

    qrIntervalId = setInterval(() => {
      qrCountdown--;
      if (timerText) timerText.textContent = `QR refreshes in ${qrCountdown}s`;
      if (ringProgress) {
        const offset = circumference * (1 - qrCountdown / 30);
        ringProgress.style.strokeDashoffset = offset;
      }
      if (qrCountdown <= 0) {
        startQrSession(); // Regenerate
      }
    }, 1000);
  }

  function stopQrTimer() {
    if (qrIntervalId) {
      clearInterval(qrIntervalId);
      qrIntervalId = null;
    }
  }

  /* ── Toast notification ── */
  function showToast(msg) {
    if (NexusApp.showEmailToast) {
      NexusApp.showEmailToast(msg);
      return;
    }
    // Fallback toast
    const toast = document.createElement('div');
    toast.textContent = msg;
    toast.style.cssText = `
      position:fixed;bottom:24px;left:50%;transform:translateX(-50%);
      background:var(--surface-2);color:var(--text-1);padding:12px 24px;
      border-radius:12px;font-size:13px;z-index:99999;
      box-shadow:0 8px 32px rgba(0,0,0,0.3);
      animation:tgFadeUp 0.4s ease both;
    `;
    document.body.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transition = 'opacity 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }

  function shakeBtn(btn) {
    if (!btn) return;
    btn.style.animation = 'none';
    btn.offsetHeight; // Reflow
    btn.style.animation = 'tgShake 0.4s ease';
    setTimeout(() => btn.style.animation = '', 400);
  }

  // Shake keyframe (inject once)
  const shakeStyle = document.createElement('style');
  shakeStyle.textContent = `
    @keyframes tgShake {
      0%, 100% { transform: translateX(0); }
      15% { transform: translateX(-6px); }
      30% { transform: translateX(5px); }
      45% { transform: translateX(-4px); }
      60% { transform: translateX(3px); }
      75% { transform: translateX(-2px); }
    }
  `;
  document.head.appendChild(shakeStyle);

  /* ── Phone input formatting ── */
  tgPhoneIn?.addEventListener('input', () => {
    let v = tgPhoneIn.value.replace(/\D/g, '');
    // Auto format: XXX XXX XXXX
    if (v.length > 6) {
      v = v.slice(0, 3) + ' ' + v.slice(3, 6) + ' ' + v.slice(6, 10);
    } else if (v.length > 3) {
      v = v.slice(0, 3) + ' ' + v.slice(3);
    }
    tgPhoneIn.value = v;
  });

  tgPhoneIn?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') tgPhoneBtn?.click();
  });

})();
