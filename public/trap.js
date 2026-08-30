/* ============================================
   DECOY LOGIN PAGE LOGIC
   Anyone who reaches /admin or /admin.html sees a page that looks
   exactly like the real dashboard login, and it BEHAVES like one too:
   every single submit — whether it's a person typing once or a
   brute-force tool hammering it thousands of times — gets back the
   exact same plain "اسم المستخدم أو كلمة المرور غير صحيحة" message.
   No mockery text, no countdown, no "you've been banned" reveal.
   A scripted tool has nothing to detect here — it just looks like a
   login that never succeeds, so it keeps wasting its own time instead
   of flagging this as a honeypot and moving on.

   Everything interesting still happens silently server-side: the
   visitor is fingerprinted on load, every attempt is logged with
   whatever they typed, and repeated attempts are still tracked and
   throttled server-side (see /api/decoy-attempt in server.js) — that
   data just never surfaces back to the browser.
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

    if (!username || !password) {
      showError('أدخل اسم المستخدم وكلمة المرور');
      return;
    }

    lockError.style.display = 'none';
    unlockBtn.disabled = true;
    var originalHTML = unlockBtn.innerHTML;
    unlockBtn.innerHTML = '<span>جاري التحقق...</span>';

    var fp = (window.__getFingerprint) ? window.__getFingerprint() : ('fp_' + Date.now());

    // Log what they typed (for the real admin dashboard only — never
    // shown back to this page).
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

    // Still counted server-side (see /api/decoy-attempt) so the admin
    // dashboard has the full picture — but the response is never used
    // to change what this page shows. Fire and forget.
    fetch('/api/decoy-attempt', { method: 'POST' }).catch(function () {});

    // Small delay so it reads like a real auth check against a
    // database, not an instant canned response.
    setTimeout(function () {
      unlockBtn.innerHTML = originalHTML;
      unlockBtn.disabled = false;
      showError('اسم المستخدم أو كلمة المرور غير صحيحة');
      passwordInput.value = '';
    }, 700 + Math.floor(Math.random() * 400));
  });

  passwordInput && passwordInput.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') unlockBtn.click();
  });
})();
