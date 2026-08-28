/* ============================================
   DECOY LOGIN PAGE LOGIC
   Anyone who reaches /admin or /admin.html sees a page that looks
   exactly like the real dashboard login. Nothing here gives it away
   as fake. Whoever they are gets fingerprinted quietly in the
   background as soon as the page loads — no visible reaction, no
   taunt, nothing that would tip them off before they act.

   Lockout is enforced server-side by IP (see /api/decoy-status and
   /api/decoy-attempt in server.js), not by anything stored in this
   browser, so it can't be reset by clearing cookies/localStorage:
   - Attempts 1-4: a 35 second mockery message, then back to the
     (still fake) login form.
   - 5th attempt in a row: banned 1 day.
   - Any single failed attempt after a ban expires: banned again,
     10x longer than the last ban (10 days, then 100, ...).
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

  // ===== Check ban status BEFORE showing the fake login form =====
  // If this IP is already serving a ban, skip straight to the timer —
  // showing the login form to someone already banned would be a tell.
  fetch('/api/decoy-status')
    .then(function (r) { return r.json(); })
    .then(function (data) {
      if (data && data.banned) {
        showBanScreen(data.remaining_ms, data.ban_level);
      } else {
        wireLoginForm();
      }
    })
    .catch(function () {
      // If the check itself fails, fall back to the normal form —
      // fail open on UX, the server still enforces the real ban on submit.
      wireLoginForm();
    });

  function wireLoginForm() {
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
      // validation message, same as the real dashboard would. Doesn't
      // count as an attempt server-side either.
      if (!username || !password) {
        showError('أدخل اسم المستخدم وكلمة المرور');
        return;
      }

      lockError.style.display = 'none';
      unlockBtn.disabled = true;
      var originalHTML = unlockBtn.innerHTML;
      unlockBtn.innerHTML = '<span>جاري التحقق...</span>';

      var fp = (window.__getFingerprint) ? window.__getFingerprint() : ('fp_' + Date.now());

      // Log what they typed (for the admin dashboard) — separate from
      // the ban-counting call below.
      try {
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

      // The real strike/ban tracking — server-side, by IP.
      fetch('/api/decoy-attempt', { method: 'POST' })
        .then(function (r) { return r.json(); })
        .then(function (data) {
          // Small delay so it reads like a real login attempt, not an
          // instant giveaway, then the reveal.
          setTimeout(function () {
            if (data && data.banned) {
              showBanScreen(data.remaining_ms, data.ban_level);
            } else {
              showAttemptMockery();
            }
          }, 900);
        })
        .catch(function () {
          // If the ban-tracking call fails, still show the standard
          // per-attempt taunt so nothing looks broken.
          setTimeout(showAttemptMockery, 900);
        });
    });

    passwordInput && passwordInput.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') unlockBtn.click();
    });
  }

  // ===== Formats a duration for display — seconds for the short taunt,
  // "D يوم HH:MM:SS" for multi-day bans. =====
  function formatDuration(ms) {
    var totalSeconds = Math.max(0, Math.floor(ms / 1000));
    var days = Math.floor(totalSeconds / 86400);
    var hours = Math.floor((totalSeconds % 86400) / 3600);
    var mins = Math.floor((totalSeconds % 3600) / 60);
    var secs = totalSeconds % 60;
    var pad = function (n) { return n.toString().padStart(2, '0'); };
    if (days > 0) {
      return days + ' يوم ' + pad(hours) + ':' + pad(mins) + ':' + pad(secs);
    }
    return pad(hours) + ':' + pad(mins) + ':' + pad(secs);
  }

  // ===== Per-attempt taunt (attempts 1-4): fixed 35 seconds, then
  // reloads back to the (still fake) login form to bait another try. =====
  function showAttemptMockery() {
    document.body.innerHTML = '';
    document.body.style.cssText = 'margin:0;background:#000;overflow:hidden;';

    var screen = document.createElement('div');
    screen.style.cssText = 'position:fixed;inset:0;z-index:999999;background:#000;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:30px;gap:24px;';
    document.body.appendChild(screen);

    screen.innerHTML = '<div style="color:#ef4444;font-size:clamp(2.2rem,9vw,5rem);font-weight:900;text-shadow:0 0 60px rgba(239,68,68,0.6);">القم يا هطف</div>' +
      '<div style="color:#f59e0b;font-size:1.1rem;font-weight:700;">حاول مره ثانيه، انا واثق فيك</div>' +
      '<div id="attemptTimer" style="font-size:clamp(2rem,7vw,3.5rem);font-weight:900;font-family:monospace;color:#94a3b8;">00:35</div>';

    var endTime = Date.now() + 35000;
    var timerEl = document.getElementById('attemptTimer');
    var interval = setInterval(function () {
      var remaining = endTime - Date.now();
      if (remaining <= 0) {
        clearInterval(interval);
        window.location.reload();
        return;
      }
      timerEl.textContent = formatDuration(remaining);
    }, 1000);
  }

  // ===== Full ban screen: shown either immediately on page load (if
  // already banned) or right after the attempt that triggers a new ban. =====
  function showBanScreen(remainingMs, banLevel) {
    document.body.innerHTML = '';
    document.body.style.cssText = 'margin:0;background:#000;overflow:hidden;';

    var screen = document.createElement('div');
    screen.style.cssText = 'position:fixed;inset:0;z-index:999999;background:#000;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:30px;';
    document.body.appendChild(screen);

    setTimeout(function () {
      screen.innerHTML = '<div style="color:#ef4444;font-size:clamp(3rem,12vw,7rem);font-weight:900;text-shadow:0 0 60px rgba(239,68,68,0.6);">القم يا هطف</div>';

      setTimeout(function () {
        var endTime = Date.now() + remainingMs;
        screen.innerHTML = '' +
          '<div style="display:flex;flex-direction:column;align-items:center;gap:20px;">' +
          '  <div style="color:#ef4444;font-size:1.1rem;font-weight:700;">⛔ تم حظرك بعد محاولات متكررة (مستوى الحظر: ' + banLevel + ')</div>' +
          '  <div style="color:#94a3b8;font-size:0.9rem;">سيتم فتح الصفحة بعد انتهاء العداد — وأي محاولة فاشلة بعدها تضاعف مدة الحظر عشر مرات</div>' +
          '  <div id="banTimer" style="font-size:clamp(2rem,8vw,4rem);font-weight:900;font-family:monospace;color:#f59e0b;text-shadow:0 0 40px rgba(245,158,11,0.4);">' + formatDuration(remainingMs) + '</div>' +
          '  <div style="color:#475569;font-size:0.8rem;">لا تحاول تجاوز النظام</div>' +
          '</div>';

        var timerEl = document.getElementById('banTimer');
        var interval = setInterval(function () {
          var remaining = endTime - Date.now();
          if (remaining <= 0) {
            clearInterval(interval);
            screen.innerHTML = '<div style="color:#22c55e;font-size:1.5rem;font-weight:700;">انتهى وقت الحظر</div>';
            setTimeout(function () {
              window.location.reload();
            }, 2000);
            return;
          }
          timerEl.textContent = formatDuration(remaining);
        }, 1000);
      }, 2000);
    }, 2000);
  }
})();
