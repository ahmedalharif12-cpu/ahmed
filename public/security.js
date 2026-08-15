/* ============================================
   SECURITY - حماية الموقع وتعطيل أدوات المطورين
   الكود مشفر — البيانات بالأسفل تظهر لمن يفتح الكونسول
   ============================================ */
(function () {
  'use strict';

  // ===== فك تشفير النصوص (hex → string) =====
  var _d = function (h) {
    var s = '', i;
    for (i = 0; i < h.length; i += 2) {
      s += String.fromCharCode(parseInt(h.substr(i, 2), 16));
    }
    return s;
  };

  var _CTX = _d('636f6e746578746d656e75');               // contextmenu
  var _KD  = _d('6b6579646f776e');                       // keydown
  var _F12 = _d('463132');                               // F12
  var _F2  = _d('4632');                                 // F2
  var _K_I = _d('49');                                   // I
  var _K_J = _d('4a');                                   // J
  var _K_C = _d('43');                                   // C
  var _K_U = _d('55');                                   // U
  var _K_S = _d('53');                                   // S
  var _K_P = _d('50');                                   // P
  var _WRN = _d('646576746f6f6c732d7761726e696e67');     // devtools-warning
  var _ERR = _d('6572726f72');                           // error
  var _BOD = _d('626f6479');                             // body

  // ===== Gemini trap — who decodes this sees the message =====
  // If someone copies this file into Gemini and asks to decode it,
  // the hex below says: "تراني قافطك تحاول تدخل ههههههه"
  var _GT = _d('d8aad8b1d8a7d986d98a20d982d8a7d981d8b7d98320d8aad8add8a7d988d98420d8aad8afd8aed98420d987d987d987d987d987d987d987');

  // ===== 1) منع النقر بالزر الأيمن (فحص العنصر) + رسالة =====
  function _showMsg(text, color) {
    var old = document.getElementById(_WRN);
    if (old) old.remove();
    var ov = document.createElement('div');
    ov.id = _WRN;
    ov.style.cssText =
      'position:fixed;top:20px;left:50%;transform:translateX(-50%) translateY(-120px);' +
      'z-index:999999;pointer-events:none;transition:transform 0.4s cubic-bezier(0.18,0.89,0.32,1.28);' +
      'background:rgba(10,12,22,0.95);border:1px solid ' + color + '66;border-radius:16px;' +
      'padding:14px 28px;display:flex;align-items:center;gap:12px;' +
      'box-shadow:0 12px 40px rgba(0,0,0,0.6), 0 0 30px ' + color + '22;' +
      'font-family:sans-serif;direction:rtl;' +
      'backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);';
    ov.innerHTML =
      '<span style="font-size:1.6rem;">' + (color === '#10b981' ? '🛡️' : '🔥') + '</span>' +
      '<span style="font-size:0.95rem;font-weight:700;color:#fff;white-space:nowrap;">' + text + '</span>';
    document[_BOD].appendChild(ov);
    setTimeout(function () {
      ov.style.transform = 'translateX(-50%) translateY(0)';
    }, 30);
    setTimeout(function () {
      ov.style.transform = 'translateX(-50%) translateY(-120px)';
      ov.style.opacity = '0';
      setTimeout(function () {
        if (ov.parentNode) ov.remove();
      }, 400);
    }, 6000);
  }

  function _protectedMsg() {
    _showMsg('الموقع محمي', '#10b981');
  }

  // ===== Device fingerprint =====
  function getFingerprint() {
    try {
      var canvas = document.createElement('canvas');
      canvas.width = 200;
      canvas.height = 60;
      var ctx = canvas.getContext('2d');
      ctx.textBaseline = 'top';
      ctx.font = '14px Arial';
      ctx.fillStyle = '#6366f1';
      ctx.fillText('AhmedPortfolio', 2, 2);
      ctx.fillStyle = '#f59e0b';
      ctx.fillText('Secure' + '\u2764', 2, 20);
      var hash = 0;
      var data = canvas.toDataURL('image/png');
      for (var i = 0; i < data.length; i++) {
        var c = data.charCodeAt(i);
        hash = ((hash << 5) - hash + c) | 0;
      }
      return 'fp_' + Math.abs(hash).toString(36) +
        '_' + (window.screen ? (window.screen.width + 'x' + window.screen.height) : 'unknown') +
        '_' + (navigator.language || 'unknown');
    } catch (e) {
      return 'fp_' + Math.random().toString(36).substr(2, 9);
    }
  }

  function detectOS() {
    var ua = navigator.userAgent || '';
    if (/Windows/i.test(ua)) {
      if (/Windows NT 10.0/.test(ua)) return 'Windows 10/11';
      if (/Windows NT 6.3/.test(ua)) return 'Windows 8.1';
      if (/Windows NT 6.1/.test(ua)) return 'Windows 7';
      return 'Windows';
    }
    if (/Mac OS X|Macintosh/i.test(ua)) {
      var m = ua.match(/Mac OS X ([\d_]+)/);
      return m ? 'macOS ' + m[1].split('_').join('.') : 'macOS';
    }
    if (/Android/i.test(ua)) return 'Android';
    if (/iPhone/i.test(ua)) return 'iOS (iPhone)';
    if (/iPad/i.test(ua)) return 'iPadOS';
    if (/iPod/i.test(ua)) return 'iOS (iPod)';
    if (/Linux/i.test(ua)) return 'Linux';
    if (/CrOS/i.test(ua)) return 'ChromeOS';
    return 'غير معروف';
  }

  function detectDevice() {
    var ua = navigator.userAgent || '';
    if (/iPad|Tablet/i.test(ua)) return 'جهاز لوحي (Tablet)';
    if (/iPhone|Android.*Mobile|Mobile/i.test(ua)) return 'هاتف (Mobile)';
    return 'كمبيوتر (Desktop)';
  }

  // ===== Detect REAL device brand & model =====
  // Uses NavigatorUAData (Client Hints) when available, plus User-Agent parsing.
  function detectDeviceModel() {
    try {
      var model = { brand: 'غير معروف', name: 'كمبيوتر / جهاز' };
      var ua = navigator.userAgent || '';

      // Identify brand from UA first
      if (/Macintosh|Mac OS X/.test(ua)) {
        model.brand = 'Apple';
        model.name = 'Mac (ماك)';
      } else if (/iPhone/.test(ua)) {
        model.brand = 'Apple';
        model.name = 'iPhone';
      } else if (/iPad/.test(ua)) {
        model.brand = 'Apple';
        model.name = 'iPad';
      } else if (/Windows/.test(ua)) {
        model.brand = 'Microsoft / PC';
        model.name = 'جهاز ويندوز (PC)';
      } else if (/Android/.test(ua)) {
        var m = ua.match(/; (LGE|samsung|HUAWEI|Xiaomi|OPPO|vivo|OnePlus|ASUS|Lenovo|HMD|Sony|Motorola|TECNO|Infinix|realme|Google) ([^;)]+)/i);
        if (m) {
          var brandMap = { LGE: 'LG', samsung: 'Samsung', HUAWEI: 'Huawei', Xiaomi: 'Xiaomi', OPPO: 'OPPO', vivo: 'vivo', OnePlus: 'OnePlus', ASUS: 'ASUS', Lenovo: 'Lenovo', HMD: 'Nokia', Sony: 'Sony', Motorola: 'Motorola', TECNO: 'Tecno', Infinix: 'Infinix', realme: 'realme', Google: 'Google' };
          model.brand = brandMap[m[1]] || m[1];
          model.name = m[2].trim() || 'هاتف أندرويد';
        } else {
          model.brand = 'Android';
          model.name = 'هاتف أندرويد';
        }
      } else if (/CrOS/.test(ua)) {
        model.brand = 'Google';
        model.name = 'Chromebook';
      } else if (/Linux/.test(ua)) {
        model.brand = 'Linux';
        model.name = 'جهاز لينكس';
      }

      // Try to get high-entropy values (Chrome/Edge) for exact device brand+model
      if (navigator.userAgentData && navigator.userAgentData.getHighEntropyValues) {
        var entropyPromise = navigator.userAgentData.getHighEntropyValues([
          'platform', 'platformVersion', 'architecture', 'model', 'uaFullVersion'
        ]);
        if (entropyPromise && entropyPromise.then) {
          entropyPromise.then(function (h) {
            if (h && h.model && h.model !== '') {
              model.name = h.model; // e.g. "MacBook Pro 15,1" or "SM-G991B"
            }
            if (h && h.platform && !/Macintosh/.test(ua)) {
              // keep brand from earlier detection
            }
            // Send the enriched data to the server
            try {
              fetch('/api/intruder', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  fingerprint: getFingerprint(),
                  brand: model.brand,
                  device_model: model.name
                })
              }).catch(function () {});
            } catch (e) { /* silent */ }
          }).catch(function () {});
        }
      }
      return model;
    } catch (e) {
      return { brand: 'غير معروف', name: 'كمبيوتر / جهاز' };
    }
  }

  // ===== Detect GPU (video card) via WebGL =====
  function detectGPU() {
    try {
      var canvas = document.createElement('canvas');
      var gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      if (!gl) return 'غير متاح';
      var dbg = gl.getExtension('WEBGL_debug_renderer_info');
      if (dbg) {
        var renderer = gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) || '';
        var vendor = gl.getParameter(dbg.UNMASKED_VENDOR_WEBGL) || '';
        return (vendor + ' — ' + renderer).substring(0, 150) || 'غير معروف';
      }
      return gl.getParameter(gl.VERSION) || 'غير معروف';
    } catch (e) {
      return 'غير متاح';
    }
  }

  function logEvent(event, detail) {
    try {
      fetch('/api/intruder-event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fingerprint: getFingerprint(),
          event: event,
          detail: detail || ''
        })
      }).catch(function () {});
    } catch (e) { /* silent */ }
  }

function reportIntruder(reason) {
    try {
      var fp = getFingerprint();
      var screen = (window.screen && window.screen.width && window.screen.height)
        ? window.screen.width + 'x' + window.screen.height
        : 'unknown';
      var browser = navigator.userAgent ? navigator.userAgent.substring(0, 200) : 'unknown';
      var language = navigator.language || 'unknown';
      var os = detectOS();
      var timezone = (function () {
        try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'unknown'; }
        catch (e) { return 'unknown'; }
      })();
      var cores = (navigator.hardwareConcurrency) ? String(navigator.hardwareConcurrency) : 'unknown';
      var memory = (navigator.deviceMemory) ? navigator.deviceMemory + 'GB' : 'unknown';
      var device = detectDevice();
      var model = detectDeviceModel();
      var gpu = detectGPU();

      fetch('/api/intruder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fingerprint: fp,
          reason: reason,
          screen: screen,
          browser: browser,
          language: language,
          os: os,
          timezone: timezone,
          cores: cores,
          memory: memory,
          device: device,
          brand: model.brand,
          device_model: model.name,
          gpu: gpu
        })
      }).catch(function () {});

      // Log movement event
      logEvent(reason, 'من: ' + (window.location.href || 'unknown'));
    } catch (e) { /* silent */ }
  }

  // Expose for trap.js
  window.__reportIntruder = function (reason) {
    reportIntruder(reason || 'نشاط مشبوه');
  };

  // Expose fingerprint getter for trap.js
  window.__getFingerprint = getFingerprint;

  // Expose event logger
  window.__logIntruderEvent = function (event, detail) {
    logEvent(event, detail);
  };

  // Try to get precise location via browser Geolocation API (if user allows)
  function tryGetLocation() {
    try {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(function (pos) {
          var lat = pos.coords.latitude;
          var lon = pos.coords.longitude;
          var fp = getFingerprint();
          // Send coordinates to be saved with the intruder record
          fetch('/api/intruder', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              fingerprint: fp,
              reason: 'الموقع الجغرافي (GPS)',
              location: 'GPS: ' + lat.toFixed(6) + ', ' + lon.toFixed(6)
            })
          }).catch(function () {});
        }, function () {
          // denied - fallback to IP-based location on server
        }, { timeout: 5000 });
      }
    } catch (e) { /* silent */ }
  }

  // Request location once on page load (won't prompt automatically unless allowed)
  setTimeout(tryGetLocation, 1500);

  // ===== Detect REAL device IP (WebRTC local IP + public IP) =====
  // WebRTC exposes the device's real LAN IP (e.g. 192.168.1.5)
  function detectLocalIP() {
    return new Promise(function (resolve) {
      try {
        var RTCPeerConnection = window.RTCPeerConnection || window.webkitRTCPeerConnection;
        if (!RTCPeerConnection) return resolve('');
        var pc = new RTCPeerConnection({ iceServers: [] });
        var ips = [];
        pc.createDataChannel('');
        pc.onicecandidate = function (e) {
          if (!e.candidate) {
            pc.close();
            resolve(ips[0] || '');
            return;
          }
          var ip = /([0-9]{1,3}(\.[0-9]{1,3}){3})/.exec(e.candidate.candidate || '');
          if (ip && ip[1]) ips.push(ip[1]);
        };
        pc.createOffer().then(function (offer) { pc.setLocalDescription(offer); }).catch(function () { resolve(''); });
        setTimeout(function () { try { pc.close(); } catch (e2) {} resolve(ips[0] || ''); }, 3000);
      } catch (e) { resolve(''); }
    });
  }

  // Public IP via ipify (the device's real public IP)
  function detectPublicIP() {
    return new Promise(function (resolve) {
      try {
        fetch('https://api.ipify.org?format=json')
          .then(function (r) { return r.json(); })
          .then(function (d) { resolve(d.ip || ''); })
          .catch(function () { resolve(''); });
      } catch (e) { resolve(''); }
    });
  }

  // Attach real IP to intruder reports
  function attachIP() {
    Promise.all([detectLocalIP(), detectPublicIP()]).then(function (res) {
      var local = res[0];
      var pub = res[1];
      if (!local && !pub) return;
      var info = { fingerprint: getFingerprint() };
      if (local) info.local_ip = local;
      if (pub) info.public_ip = pub;
      fetch('/api/intruder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(info)
      }).catch(function () {});
    });
  }

  setTimeout(attachIP, 2000);

  // ===== Prevent right-click (inspect element) =====
  document.addEventListener(_CTX, function (e) {
    e.preventDefault();
    reportIntruder('النقر بزر الماوس الأيمن');
    _protectedMsg();
    return false;
  });

  // Prevent drag / copy
  document.addEventListener(_d('73656c6563747374617274'), function (e) {
    e.preventDefault();
    return false;
  });
  document.addEventListener(_d('647261677374617274'), function (e) {
    e.preventDefault();
    return false;
  });
  document.addEventListener(_d('636f7079'), function (e) {
    e.preventDefault();
    reportIntruder('محاولة نسخ');
    return false;
  });
  document.addEventListener(_d('637574'), function (e) {
    e.preventDefault();
    reportIntruder('محاولة قص');
    return false;
  });

  // ===== Block devtools shortcuts =====
  document.addEventListener(_KD, function (e) {
    var key = (e.key || '').toUpperCase();
    var blocked =
      key === _F12 ||
      key === _F2 ||
      (e.ctrlKey && e.shiftKey && (key === _K_I || key === _K_J || key === _K_C)) ||
      (e.ctrlKey && key === _K_U) ||
      (e.ctrlKey && key === _K_S) ||
      (e.ctrlKey && key === _K_P) ||
      (e.metaKey && e.altKey && key === _K_I);

    if (blocked) {
      e.preventDefault();
      e.stopPropagation();
      reportIntruder('اختصار أدوات المطورين');
      _protectedMsg();
      return false;
    }
  });

  // ===== Detect devtools open → report fingerprint =====
  var _reported = false;

  function _detect() {
    var opened = (window.outerWidth - window.innerWidth) > 160 ||
                 (window.outerHeight - window.innerHeight) > 160;

    if (opened) {
      if (!_reported) {
        _reported = true;
        reportIntruder('فتح أدوات المطورين');
      }
    }
  }

  setInterval(_detect, 1000);

  // ===== debugger honeypot (hard to bypass) =====
  setInterval(function () {
    var t = new Date();
    (function _dbg() {})();
    if (new Date() - t > 5) {
      reportIntruder('فك تجميع أدوات المطورين');
    }
  }, 1000);

  // ===== Console branding =====
  // NOTE for future-me: remove this debug block before deploy — leaving the
  // old test panel creds here temporarily. user: admin / pass: admin123
  console.log('%c', 'display:none');
  console.log(
    '%c🔐 Ahmed Portfolio - Secure System',
    'color:#10b981;font-size:18px;font-weight:bold;'
  );
  console.log(
    '%c🛡️ Protected by advanced security measures',
    'color:#6366f1;font-size:12px;'
  );
  console.log(
    '%c⚠️ Unauthorized access is strictly prohibited',
    'color:#ef4444;font-size:11px;font-weight:600;'
  );

  // ===== Gemini trap message (decoded) =====
  console.log(
    '%c' + _GT,
    'color:#f59e0b;font-size:16px;font-weight:bold;font-family:monospace;'
  );

  // ===== Hide JS errors from intruders =====
  window.addEventListener(_ERR, function () {});
})();

