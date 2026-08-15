/* ============================================
   DECOY LOGIN PAGE LOGIC
   Anyone who reaches /admin or /admin.html sees a page that looks
   exactly like the real dashboard login. Nothing here gives it away
   as fake. Whoever they are gets fingerprinted quietly in the
   background as soon as the page loads — no visible reaction, no
   taunt, nothing that would tip them off before they act.

   The moment they submit ANY username/password, the real reveal
   happens: black screen -> mockery -> 2 minute timer.
   ============================================ */

(function () {
  'use strict';

  // ===== Fingerprint silently on load — no visible sign anything is wrong =====
  if (window.__reportIntruder) {
    window.__reportIntruder('فتح صفحة تسجيل الدخول الوهمية (/admin)');
  }

  // ===== Background movement logging (silent — no reaction shown) =====
  ['click', 'keydown', 'mousemove'].forEach(function (evt) {
    document.addEventListener(evt, function (e) {
      if (!window.__logIntruderEvent) return;
      var detail = '';
      if (evt === 'click') {
        detail = 'نقر على: ' + ((e.target && e.target.tagName) || 'unknown') + ' ' + ((e.target && e.target.id) || '');
      } else if (evt === 'keydown') {
        detail = 'ضغط زر: ' + (e.key || '');
      } else if (evt === 'mousemove') {
        detail = 'تحريك الماوس إلى: ' + e.clientX + ',' + e.clientY;
      }
      window.__logIntruderEvent(evt === 'mousemove' ? 'تحريك' : evt, detail);
    }, { once: true });
  });

  window.addEventListener('beforeunload', function () {
    if (window.__logIntruderEvent) {
      window.__logIntruderEvent('غادر الصفحة', 'غادر بدون تسجيل دخول');
    }
  });

  // ===== The login form itself =====
  var usernameInput = document.getElementById('usernameInput');
  var passwordInput = document.getElementById('passwordInput');
  var unlockBtn = document.getElementById('unlockBtn');
  var lockError = document.getElementById('lockError');

  if (!unlockBtn) return;

  function showError(text) {
    lockError.textContent = text;
    lockError.style.display = 'block';
  }

  unlockBtn.addEventListener('click', function () {
    var username = (usernameInput.value || '').trim();
    var password = passwordInput.value || '';

    // Behave like the real form: empty fields just show a normal
    // validation message, same as the real dashboard would.
    if (!username || !password) {
      showError('أدخل اسم المستخدم وكلمة المرور');
      return;
    }

    lockError.style.display = 'none';
    unlockBtn.disabled = true;
    var originalHTML = unlockBtn.innerHTML;
    unlockBtn.innerHTML = '<span>جاري التحقق...</span>';

    // Capture whatever they typed, with the device fingerprint.
    try {
      var fp = (window.__getFingerprint) ? window.__getFingerprint() : ('fp_' + Date.now());
      fetch('/api/intruder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fingerprint: fp,
          username: username,
          reason: 'حاول تسجيل الدخول بصفحة الفخ (يوزر: ' + username + ')'
        })
      }).catch(function () {});
    } catch (e) { /* silent */ }

    if (window.__logIntruderEvent) {
      window.__logIntruderEvent('محاولة دخول وهمية', 'يوزر: ' + username);
    }

    // Small delay so it reads like a real login attempt, not an
    // instant giveaway, then the reveal.
    setTimeout(function () {
      unlockBtn.innerHTML = originalHTML;
      unlockBtn.disabled = false;
      showTrapSequence();
    }, 900);
  });

  passwordInput && passwordInput.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') unlockBtn.click();
  });

  function showTrapSequence() {
    document.body.innerHTML = '';
    document.body.style.cssText = 'margin:0;background:#000;overflow:hidden;';

    var blackScreen = document.createElement('div');
    blackScreen.style.cssText = 'position:fixed;inset:0;z-index:999999;background:#000;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:30px;';
    document.body.appendChild(blackScreen);

    setTimeout(function () {
      blackScreen.innerHTML = '<div style="color:#ef4444;font-size:clamp(3rem,12vw,7rem);font-weight:900;text-shadow:0 0 60px rgba(239,68,68,0.6);">القم يا هطف</div>';

      setTimeout(function () {
        var endTime = Date.now() + (2 * 60 * 1000);
        blackScreen.innerHTML = '' +
          '<div style="display:flex;flex-direction:column;align-items:center;gap:20px;">' +
          '  <div style="color:#ef4444;font-size:1.1rem;font-weight:700;">⛔ تم اكتشاف محاولة دخول غير مصرح بها</div>' +
          '  <div style="color:#94a3b8;font-size:0.9rem;">سيتم فتح الصفحة بعد انتهاء العداد</div>' +
          '  <div id="trapTimer" style="font-size:clamp(3rem,10vw,5rem);font-weight:900;font-family:monospace;color:#f59e0b;text-shadow:0 0 40px rgba(245,158,11,0.4);">02:00</div>' +
          '  <div style="color:#475569;font-size:0.8rem;">لا تحاول تجاوز النظام</div>' +
          '</div>';

        var timerEl = document.getElementById('trapTimer');
        var interval = setInterval(function () {
          var remaining = endTime - Date.now();
          if (remaining <= 0) {
            clearInterval(interval);
            blackScreen.innerHTML = '<div style="color:#22c55e;font-size:1.5rem;font-weight:700;">انتهى وقت القفل</div>';
            setTimeout(function () {
              window.location.reload();
            }, 2000);
            return;
          }
          var mins = Math.floor(remaining / 60000).toString().padStart(2, '0');
          var secs = Math.floor((remaining % 60000) / 1000).toString().padStart(2, '0');
          timerEl.textContent = mins + ':' + secs;
        }, 1000);
      }, 2000);
    }, 2000);
  }
})();
