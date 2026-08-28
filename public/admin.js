/* ============================================
   ADMIN DASHBOARD - SECURE VERSION
   Auth + data via server API (no secrets in JS)
   ============================================ */
// TODO(ahmed): remove before launch — emergency recovery login while
// the real auth flow was being debugged. root / root still works as
// a fallback if the main account gets locked out.

// Elements
const lockScreen = document.getElementById('lockScreen');
const adminDashboard = document.getElementById('adminDashboard');
const usernameInput = document.getElementById('usernameInput');
const passwordInput = document.getElementById('passwordInput');
const unlockBtn = document.getElementById('unlockBtn');
const lockError = document.getElementById('lockError');
const logoutBtn = document.getElementById('logoutBtn');

let authToken = sessionStorage.getItem('admin_token') || '';

/* ============================================
   AUTH
   ============================================ */
async function apiFetch(url, options = {}) {
  const headers = options.headers || {};
  if (authToken) headers.Authorization = 'Bearer ' + authToken;
  if (options.body && typeof options.body !== 'string') {
    headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify(options.body);
  }
  const res = await fetch(url, { ...options, headers });
  return res;
}

function showLock() {
  lockScreen.style.display = 'flex';
  adminDashboard.style.display = 'none';
}

function showDashboard() {
  lockScreen.style.display = 'none';
  adminDashboard.style.display = 'block';
  initDashboard();
}

function handleUnauthorized() {
  sessionStorage.removeItem('admin_token');
  authToken = '';
  showLock();
}

// Check if already authenticated
async function checkAuth() {
  if (!authToken) {
    showLock();
    return;
  }
  try {
    const res = await apiFetch('/api/admin/stats');
    if (res.ok) {
      showDashboard();
    } else {
      handleUnauthorized();
    }
  } catch (e) {
    showLock();
  }
}

/* ============================================
   TRAP SYSTEM
   ============================================ */
function showTrapSequence(messageType) {
  // 1) شاشة سوداء كاملة لمدة ثانيتين
  const blackScreen = document.createElement('div');
  blackScreen.id = 'trapBlackScreen';
  blackScreen.style.cssText =
    'position:fixed;inset:0;z-index:999999;background:#000;' +
    'transition:opacity 0.3s;';
  document.body.appendChild(blackScreen);

  // رسائل سخرية مخصصة لكل مستخدم وهمي
  var mockMessage = '';
  if (messageType === 'first') {
    mockMessage = 'استخدمت ahmed515؟ ههههههه - وقعك في الفخ يا ذكي!';
  } else if (messageType === 'second') {
    mockMessage = '\\hamode92\\؟ واااااه إبداع! الفخ الثاني كمان شغال يا بطلي';
  } else {
    mockMessage = 'القم يا هطف';
  }

  setTimeout(() => {
    // 2) إظهار رسالة السخرية المخصصة
    blackScreen.innerHTML = `
      <div style="
        position:absolute;inset:0;display:flex;align-items:center;justify-content:center;
        color:#ef4444;font-size:clamp(2rem, 8vw, 5rem);font-weight:900;text-align:center;
        font-family:sans-serif;letter-spacing:1px;text-shadow:0 0 60px rgba(239,68,68,0.6);
        padding:20px;
      ">${mockMessage}</div>
    `;

    // 3) بعد ثانيتين من النص → شاشة التايمر (دقيقتين)
    setTimeout(() => {
      const lockDuration = 2 * 60 * 1000; // دقيقتين
      const endTime = Date.now() + lockDuration;

      blackScreen.innerHTML = `
        <div style="
          position:absolute;inset:0;display:flex;flex-direction:column;
          align-items:center;justify-content:center;gap:20px;
          background:linear-gradient(180deg,#000,#0a0a12);color:#fff;
          font-family:sans-serif;text-align:center;padding:20px;
        ">
          <div style="font-size:1.2rem;color:#ef4444;font-weight:700;">
            ⛔ تم اكتشاف محاولة دخول غير مصرح بها
          </div>
          <div style="font-size:0.95rem;color:#94a3b8;">
            سيتم فتح لوحة الدخول مجدداً بعد انتهاء العداد
          </div>
          <div id="trapTimer" style="
            font-size:clamp(3rem, 10vw, 6rem);font-weight:900;font-variant-numeric:tabular-nums;
            color:#f59e0b;font-family:monospace;text-shadow:0 0 40px rgba(245,158,11,0.4);
          ">02:00</div>
          <div style="font-size:0.8rem;color:#475569;">لا تحاول تجاوز النظام</div>
        </div>
      `;

      // تحديث العداد كل ثانية
      const timerEl = blackScreen.querySelector('#trapTimer');
      const timerInterval = setInterval(() => {
        const remaining = endTime - Date.now();
        if (remaining <= 0) {
          clearInterval(timerInterval);
          blackScreen.remove();
          // الرجوع لشاشة الدخول بعد انتهاء القفل + إعادة تفعيل الزر
          unlockBtn.disabled = false;
          unlockBtn.innerHTML = '<span>تسجيل الدخول</span><i class="fas fa-arrow-left"></i>';
          lockScreen.style.display = 'flex';
          passwordInput.value = '';
          usernameInput.focus();
          return;
        }
        const mins = Math.floor(remaining / 60000).toString().padStart(2, '0');
        const secs = Math.floor((remaining % 60000) / 1000).toString().padStart(2, '0');
        timerEl.textContent = mins + ':' + secs;
      }, 1000);
    }, 2000);
  }, 2000);
}

async function unlock() {
  const username = usernameInput.value.trim();
  const password = passwordInput.value;

  if (!username || !password) {
    lockError.textContent = 'أدخل اسم المستخدم وكلمة المرور';
    lockError.style.display = 'block';
    return;
  }

  unlockBtn.disabled = true;
  unlockBtn.innerHTML = '<span>جارٍ التحقق...</span>';

  try {
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });

    const data = await res.json();

    // === TRAP: بيانات وهمية → شاشة سوداء → رسالة سخرية → تايمر دقيقتين
    if (data && data.trap) {
      lockScreen.style.display = 'none';
      showTrapSequence(data.message || '');
      return;
    }

    if (res.ok && data.token) {
      authToken = data.token;
      sessionStorage.setItem('admin_token', data.token);
      lockError.style.display = 'none';
      showDashboard();
    } else {
      lockError.textContent = data.error || 'اسم المستخدم أو كلمة المرور غير صحيحة';
      lockError.style.display = 'block';
      passwordInput.value = '';
      usernameInput.focus();
    }
  } catch (e) {
    lockError.textContent = 'تعذر الاتصال بالخادم';
    lockError.style.display = 'block';
  }

  unlockBtn.disabled = false;
  unlockBtn.innerHTML = '<span>تسجيل الدخول</span><i class="fas fa-arrow-left"></i>';
}

unlockBtn.addEventListener('click', unlock);
passwordInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') unlock();
});
usernameInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') passwordInput.focus();
});

logoutBtn.addEventListener('click', async () => {
  try {
    await apiFetch('/api/logout', { method: 'POST' });
  } catch (e) { /* ignore */ }
  sessionStorage.removeItem('admin_token');
  authToken = '';
  location.reload();
});

/* ============================================
   DASHBOARD INIT
   ============================================ */
let lastMessageCount = 0;

async function initDashboard() {
  await refreshAll();
  startAutoRefresh();

  // Delegated click handler for "تفاصيل" buttons in the intruders list.
  // Reads the fingerprint straight from the element's dataset — it is
  // never concatenated into an HTML attribute or a JS string, so an
  // attacker-supplied fingerprint value can't break out and run code.
  const intrudersContainer = document.getElementById('intrudersContainer');
  if (intrudersContainer) {
    intrudersContainer.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-fp]');
      if (btn) viewIntruder(btn.dataset.fp);
    });
  }

  const messagesContainer = document.getElementById('messagesContainer');
  if (messagesContainer) {
    messagesContainer.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;
      const id = parseInt(btn.dataset.id, 10);
      if (!id) return;
      if (btn.dataset.action === 'view-message') viewMessage(id);
      if (btn.dataset.action === 'delete-message') deleteMessage(id);
    });
  }
}

let refreshTimer = null;
function startAutoRefresh() {
  if (refreshTimer) clearInterval(refreshTimer);
  refreshTimer = setInterval(() => {
    refreshAll();
  }, 5000);
}

async function refreshAll() {
  try {
    await Promise.all([
      updateStats(),
      renderMessages(),
      renderTopPages(),
      renderViewsChart(),
      renderIntruders()
    ]);
  } catch (e) {
    if (e && e.status === 401) handleUnauthorized();
  }
}

/* ============================================
   INTRUDERS
   ============================================ */
async function renderIntruders() {
  const container = document.getElementById('intrudersContainer');
  const countEl = document.getElementById('intruderCount');
  const res = await apiFetch('/api/admin/intruders');
  if (res.status === 401) { handleUnauthorized(); return; }

  const intruders = await res.json();
  if (countEl) countEl.textContent = intruders.length;

  if (!intruders || intruders.length === 0) {
    container.innerHTML = `
      <div class="empty-messages glass-card">
        <i class="fas fa-shield-alt"></i>
        <p>لا يوجد متطفلون — الموقع محمي 🛡️</p>
      </div>
    `;
    return;
  }

container.innerHTML = intruders.map(intr => `
    <div class="message-card glass-card unread">
      <div class="message-avatar">
        <i class="fas fa-user-secret"></i>
      </div>
      <div class="message-content">
        <div class="message-sender">${escapeHtml(intr.fullname || intr.reason || 'نشاط مشبوه')}</div>
        <div class="message-email">${escapeHtml(intr.email || intr.fingerprint)}</div>
        <div class="message-text">
          <span class="intruder-city">
            <i class="fas fa-map-marker-alt"></i>
            ${escapeHtml(intr.location || 'غير معروف')}
          </span>
          <br />
          <strong>🌐 IP:</strong> ${escapeHtml(intr.ip || 'unknown')}
          ${intr.local_ip ? ' • <strong>📡 محلي:</strong> ' + escapeHtml(intr.local_ip) : ''}
          ${intr.public_ip ? ' • <strong>🌍 عام:</strong> ' + escapeHtml(intr.public_ip) : ''}
          <br />
          <strong>📱 الجهاز:</strong> ${escapeHtml(intr.device_model || intr.device || 'unknown')}
          ${intr.brand ? ' • <strong>🏢</strong> ' + escapeHtml(intr.brand) : ''}
          <br />
          <strong>💻 النظام:</strong> ${escapeHtml(intr.os || 'unknown')}
          ${intr.username ? ' • <strong>👤 المستخدم:</strong> ' + escapeHtml(intr.username) : ''}
          <br />
          <strong>🕐 آخر نشاط:</strong> ${escapeHtml(formatDate(intr.last_seen))}
        </div>
      </div>
      <div class="message-meta">
        <div class="message-actions">
          <button class="message-btn info" data-fp="${escapeHtml(intr.fingerprint)}" title="تفاصيل كاملة">
            <i class="fas fa-info-circle"></i> تفاصيل
          </button>
          <span class="page-count">${intr.count} محاولة</span>
        </div>
      </div>
    </div>
  `).join('');
}

/* ============================================
   INTRUDER DETAILS MODAL
   ============================================ */
async function viewIntruder(fingerprint) {
  try {
    const res = await apiFetch('/api/admin/intruders/' + encodeURIComponent(fingerprint));
    if (res.status === 401) { handleUnauthorized(); return; }
    if (!res.ok) {
      alert('تعذر جلب التفاصيل');
      return;
    }
    const data = await res.json();
    const intr = data.intruder;
    const events = data.events || [];

    const modal = document.getElementById('intruderModal');
    const body = document.getElementById('intruderModalBody');

    const eventList = events.length
      ? events.map(ev => `
        <div class="intruder-event">
          <span class="event-time">${escapeHtml(formatDate(ev.time))}</span>
          <span class="event-name">${escapeHtml(ev.event)}</span>
          <span class="event-detail">${escapeHtml(ev.detail || '')}</span>
        </div>
      `).join('')
      : '<p class="empty-events">لا توجد أحداث مسجلة بعد</p>';

    body.innerHTML = `
      <div class="intruder-details-grid">
        <div class="detail-item">
          <span class="detail-label"><i class="fas fa-user"></i> الاسم الكامل</span>
          <span class="detail-value">${escapeHtml(intr.fullname || 'غير معروف')}</span>
        </div>
        <div class="detail-item">
          <span class="detail-label"><i class="fas fa-envelope"></i> البريد الإلكتروني</span>
          <span class="detail-value">${escapeHtml(intr.email || 'غير معروف')}</span>
        </div>
        <div class="detail-item">
          <span class="detail-label"><i class="fas fa-user-tag"></i> اسم المستخدم المُدخل</span>
          <span class="detail-value">${escapeHtml(intr.username || 'غير معروف')}</span>
        </div>
        <div class="detail-item">
          <span class="detail-label"><i class="fas fa-map-marker-alt"></i> المدينة / الموقع</span>
          <span class="detail-value city-highlight">${escapeHtml(intr.location || 'غير معروف')}</span>
        </div>
        <div class="detail-item">
          <span class="detail-label"><i class="fas fa-network-wired"></i> IP</span>
          <span class="detail-value">${escapeHtml(intr.ip || 'unknown')}</span>
        </div>
        <div class="detail-item">
          <span class="detail-label"><i class="fas fa-server"></i> IP المحلي (الجهاز)</span>
          <span class="detail-value">${escapeHtml(intr.local_ip || 'غير متاح')}</span>
        </div>
        <div class="detail-item">
          <span class="detail-label"><i class="fas fa-globe"></i> IP العام (الشبكة)</span>
          <span class="detail-value">${escapeHtml(intr.public_ip || 'غير متاح')}</span>
        </div>
        <div class="detail-item">
          <span class="detail-label"><i class="fas fa-building"></i> مزود الخدمة (ISP)</span>
          <span class="detail-value">${escapeHtml(intr.isp || 'N/A')}</span>
        </div>
        <div class="detail-item">
          <span class="detail-label"><i class="fas fa-user-tag"></i> البصمة</span>
          <span class="detail-value">${escapeHtml(intr.fingerprint)}</span>
        </div>
        <div class="detail-item">
          <span class="detail-label"><i class="fas fa-laptop"></i> نوع الجهاز</span>
          <span class="detail-value">${escapeHtml(intr.device || 'unknown')}</span>
        </div>
        <div class="detail-item">
          <span class="detail-label"><i class="fas fa-building"></i> الشركة المصنعة</span>
          <span class="detail-value">${escapeHtml(intr.brand || 'غير معروف')}</span>
        </div>
        <div class="detail-item">
          <span class="detail-label"><i class="fas fa-mobile-alt"></i> الموديل / اسم الجهاز</span>
          <span class="detail-value">${escapeHtml(intr.device_model || 'غير معروف')}</span>
        </div>
        <div class="detail-item">
          <span class="detail-label"><i class="fas fa-video"></i> كرت الشاشة (GPU)</span>
          <span class="detail-value">${escapeHtml(intr.gpu || 'غير معروف')}</span>
        </div>
        <div class="detail-item">
          <span class="detail-label"><i class="fas fa-desktop"></i> نظام التشغيل</span>
          <span class="detail-value">${escapeHtml(intr.os || 'unknown')}</span>
        </div>
        <div class="detail-item">
          <span class="detail-label"><i class="fas fa-tv"></i> الشاشة</span>
          <span class="detail-value">${escapeHtml(intr.screen || 'unknown')}</span>
        </div>
        <div class="detail-item">
          <span class="detail-label"><i class="fas fa-microchip"></i> الأنوية / الذاكرة</span>
          <span class="detail-value">${escapeHtml(intr.cores || 'unknown')} أنوية • ${escapeHtml(intr.memory || 'unknown')}</span>
        </div>
        <div class="detail-item">
          <span class="detail-label"><i class="fas fa-clock"></i> المنطقة الزمنية</span>
          <span class="detail-value">${escapeHtml(intr.timezone || 'unknown')}</span>
        </div>
        <div class="detail-item">
          <span class="detail-label"><i class="fas fa-globe"></i> اللغة</span>
          <span class="detail-value">${escapeHtml(intr.language || 'unknown')}</span>
        </div>
        <div class="detail-item">
          <span class="detail-label"><i class="fas fa-calendar"></i> أول ظهور</span>
          <span class="detail-value">${escapeHtml(formatDate(intr.first_seen))}</span>
        </div>
        <div class="detail-item">
          <span class="detail-label"><i class="fas fa-history"></i> آخر نشاط</span>
          <span class="detail-value">${escapeHtml(formatDate(intr.last_seen))}</span>
        </div>
        <div class="detail-item full-width">
          <span class="detail-label"><i class="fas fa-bug"></i> سبب الرصد</span>
          <span class="detail-value">${escapeHtml(intr.reason || 'unknown')}</span>
        </div>
        <div class="detail-item full-width">
          <span class="detail-label"><i class="fas fa-user-secret"></i> المتصفح (User-Agent)</span>
          <span class="detail-value ua-value">${escapeHtml(intr.browser || 'unknown')}</span>
        </div>
      </div>

      <div class="intruder-events-section">
        <h4><i class="fas fa-list-alt"></i> سجل تحركات المتطفل</h4>
        <div class="intruder-events-list">
          ${eventList}
        </div>
      </div>
    `;

    modal.style.display = 'flex';
  } catch (e) {
    alert('خطأ في جلب التفاصيل');
  }
}

function closeIntruderModal() {
  document.getElementById('intruderModal').style.display = 'none';
}

document.getElementById('intruderModal').addEventListener('click', (e) => {
  if (e.target === document.getElementById('intruderModal')) {
    closeIntruderModal();
  }
});

document.getElementById('intruderModalClose').addEventListener('click', closeIntruderModal);


document.getElementById('clearIntrudersBtn').addEventListener('click', async () => {
  if (!confirm('هل أنت متأكد من مسح جميع بصمات المتطفلين؟')) return;
  const res = await apiFetch('/api/admin/intruders/clear', { method: 'POST' });
  if (res.ok) {
    renderIntruders();
  }
});

/* ============================================
   STATS
   ============================================ */
async function updateStats() {
  const res = await apiFetch('/api/admin/stats');
  if (res.status === 401) { handleUnauthorized(); return; }
  const data = await res.json();

  document.getElementById('statOnline').textContent = data.online;
  document.getElementById('statVisits').textContent = data.totalVisits;
  document.getElementById('statUnique').textContent = data.unique;
  document.getElementById('statMessages').textContent = data.messages;
  document.getElementById('unreadCount').textContent = data.unread;
}

/* ============================================
   MESSAGES
   ============================================ */
async function renderMessages() {
  const container = document.getElementById('messagesContainer');
  const res = await apiFetch('/api/admin/messages');
  if (res.status === 401) { handleUnauthorized(); return; }

  let messages = await res.json();
  lastMessageCount = messages.length;

  if (!messages || messages.length === 0) {
    container.innerHTML = `
      <div class="empty-messages glass-card">
        <i class="fas fa-inbox"></i>
        <p>لا توجد رسائل بعد</p>
      </div>
    `;
    return;
  }

  container.innerHTML = messages.map(msg => `
    <div class="message-card glass-card ${msg.read ? '' : 'unread'}" data-id="${msg.id}">
      <div class="message-avatar">
        <i class="fas fa-user"></i>
      </div>
      <div class="message-content">
        <div class="message-sender">${escapeHtml(msg.name)}</div>
        <div class="message-email">${escapeHtml(msg.email)}</div>
        <div class="message-text">${escapeHtml(msg.message)}</div>
      </div>
      <div class="message-meta">
        <span class="message-date">${formatDate(msg.date)}</span>
        <div class="message-actions">
          <button class="message-btn info" data-action="view-message" data-id="${msg.id}" title="عرض">
            <i class="fas fa-eye"></i>
          </button>
          <button class="message-btn danger" data-action="delete-message" data-id="${msg.id}" title="حذف">
            <i class="fas fa-trash"></i>
          </button>
        </div>
      </div>
    </div>
  `).join('');
}

async function viewMessage(id) {
  // Mark as read on server
  await apiFetch('/api/admin/messages/read', {
    method: 'POST',
    body: { id }
  });
  renderMessages();
  updateStats();

  const res = await apiFetch('/api/admin/messages');
  const messages = await res.json();
  const msg = messages.find(m => m.id === id);
  if (!msg) return;

  // Show modal
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal-content glass-card">
      <button class="modal-close" data-action="close-modal">
        <i class="fas fa-times"></i>
      </button>
      <h3>${escapeHtml(msg.name)}</h3>
      <div class="modal-email">${escapeHtml(msg.email)}</div>
      <p>${escapeHtml(msg.message)}</p>
      <div class="message-date" style="margin-top:12px; font-size:0.75rem; color:#475569;">
        ${formatDate(msg.date)}
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  modal.addEventListener('click', (e) => {
    if (e.target === modal || e.target.closest('[data-action="close-modal"]')) modal.remove();
  });
}

async function deleteMessage(id) {
  if (!confirm('هل أنت متأكد من حذف هذه الرسالة؟')) return;

  const res = await apiFetch('/api/admin/messages/' + id, { method: 'DELETE' });
  if (res.ok) {
    renderMessages();
    updateStats();
  }
}

/* ============================================
   TOP PAGES
   ============================================ */
async function renderTopPages() {
  const container = document.getElementById('topPagesList');
  const res = await apiFetch('/api/admin/pageviews');
  if (res.status === 401) { handleUnauthorized(); return; }

  const pageViews = await res.json();
  const pageCounts = {};
  pageViews.forEach(v => {
    const page = v.page || '/';
    pageCounts[page] = (pageCounts[page] || 0) + 1;
  });

  const sorted = Object.entries(pageCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  if (sorted.length === 0) {
    container.innerHTML = '<div style="color:#475569; text-align:center; padding:20px; font-size:0.85rem;">لا توجد بيانات بعد</div>';
    return;
  }

  container.innerHTML = sorted.map(([page, count]) => `
    <div class="page-item">
      <span class="page-name">${page === '/' || page === '/index.html' ? 'الرئيسية' : page === '/index-en.html' ? 'English' : page}</span>
      <span class="page-count">${count}</span>
    </div>
  `).join('');
}

/* ============================================
   VIEWS CHART
   ============================================ */
let viewsChartInstance = null;

async function renderViewsChart() {
  const canvas = document.getElementById('viewsChart');
  if (!canvas) return;

  const res = await apiFetch('/api/admin/visits');
  if (res.status === 401) { handleUnauthorized(); return; }

  const visits = await res.json();

  // Destroy old chart instance if it exists
  if (viewsChartInstance) {
    viewsChartInstance.destroy();
    viewsChartInstance = null;
  }

  // Group by hour for last 24 hours
  const now = Date.now();
  const hourLabels = [];
  const hourCounts = [];

  for (let i = 23; i >= 0; i--) {
    const hourStart = now - i * 3600000;
    const hourEnd = hourStart + 3600000;
    const date = new Date(hourStart);
    const label = date.getHours().toString().padStart(2, '0') + ':00';
    hourLabels.push(label);

    const count = visits.filter(v => v.time >= hourStart && v.time < hourEnd).length;
    hourCounts.push(count);
  }

  viewsChartInstance = new Chart(canvas.getContext('2d'), {
    type: 'line',
    data: {
      labels: hourLabels,
      datasets: [{
        label: 'الزيارات',
        data: hourCounts,
        borderColor: '#6366f1',
        backgroundColor: 'rgba(99, 102, 241, 0.1)',
        fill: true,
        tension: 0.4,
        borderWidth: 2,
        pointRadius: 3,
        pointBackgroundColor: '#6366f1',
        pointBorderColor: '#6366f1',
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false
        }
      },
      scales: {
        x: {
          ticks: {
            color: '#475569',
            font: { size: 10 },
            maxTicksLimit: 12
          },
          grid: {
            color: 'rgba(255,255,255,0.02)'
          }
        },
        y: {
          beginAtZero: true,
          ticks: {
            color: '#475569',
            font: { size: 10 },
            stepSize: 1
          },
          grid: {
            color: 'rgba(255,255,255,0.02)'
          }
        }
      }
    }
  });
}

/* ============================================
   CONTROLS
   ============================================ */
document.getElementById('clearDataBtn').addEventListener('click', async () => {
  if (!confirm('هل أنت متأكد؟ سيتم حذف جميع الإحصائيات والرسائل')) return;
  if (!confirm('تأكيد نهائي؟ لا يمكن التراجع عن هذا الإجراء!')) return;

  const res = await apiFetch('/api/admin/clear', { method: 'POST' });
  if (res.ok) {
    refreshAll();
  }
});

document.getElementById('exportBtn').addEventListener('click', async () => {
  const [msgRes, statsRes, viewsRes, visitsRes] = await Promise.all([
    apiFetch('/api/admin/messages'),
    apiFetch('/api/admin/stats'),
    apiFetch('/api/admin/pageviews'),
    apiFetch('/api/admin/visits')
  ]);

  const messages = await msgRes.json();
  const stats = await statsRes.json();
  const pageViews = await viewsRes.json();
  const visits = await visitsRes.json();

  const data = {
    exportDate: new Date().toISOString(),
    stats: {
      totalVisits: stats.totalVisits,
      uniqueVisitors: stats.unique,
      onlineNow: stats.online
    },
    messages: messages,
    pageViews: pageViews,
    visits: visits
  };

  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `admin-data-${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
});

/* ============================================
   UTILITIES
   ============================================ */
function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatDate(dateStr) {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now - date;

  if (diff < 60000) return 'الآن';
  if (diff < 3600000) return `منذ ${Math.floor(diff / 60000)} دقيقة`;
  if (diff < 86400000) return `منذ ${Math.floor(diff / 3600000)} ساعة`;
  if (diff < 172800000) return 'أمس';

  return date.toLocaleDateString('ar-SA', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

/* ============================================
   NOTIFICATION SYSTEM
   ============================================ */
let notificationInterval = null;

async function checkForNewMessages() {
  const res = await apiFetch('/api/admin/messages');
  if (!res.ok) return;
  const messages = await res.json();
  const currentCount = messages.length;

  if (currentCount > lastMessageCount && lastMessageCount > 0) {
    const newCount = currentCount - lastMessageCount;
    const newestMessages = messages.slice(0, newCount);
    showNewMessageNotification(newestMessages);
  }
  lastMessageCount = currentCount;
}

function showNewMessageNotification(msgs) {
  // Play notification sound
  try {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    oscillator.frequency.value = 800;
    oscillator.type = 'sine';
    gainNode.gain.value = 0.1;
    oscillator.start();
    oscillator.stop(audioCtx.currentTime + 0.15);
    setTimeout(() => {
      const osc2 = audioCtx.createOscillator();
      const gain2 = audioCtx.createGain();
      osc2.connect(gain2);
      gain2.connect(audioCtx.destination);
      osc2.frequency.value = 1000;
      osc2.type = 'sine';
      gain2.gain.value = 0.1;
      osc2.start();
      osc2.stop(audioCtx.currentTime + 0.15);
    }, 200);
  } catch (e) { /* silent fail */ }

  // Show toast notifications
  msgs.forEach(msg => {
    const toast = document.createElement('div');
    toast.className = 'notification-toast';
    toast.innerHTML = `
      <div class="toast-icon"><i class="fas fa-envelope"></i></div>
      <div class="toast-content">
        <div class="toast-title">رسالة جديدة من ${escapeHtml(msg.name)}</div>
        <div class="toast-text">${escapeHtml(msg.message.substring(0, 60))}${msg.message.length > 60 ? '...' : ''}</div>
      </div>
      <button class="toast-close"><i class="fas fa-times"></i></button>
    `;
    document.body.appendChild(toast);

    // Auto remove after 8 seconds
    setTimeout(() => {
      if (toast.parentElement) {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(100px)';
        setTimeout(() => toast.remove(), 300);
      }
    }, 8000);

    toast.addEventListener('click', (e) => {
      if (e.target.closest('.toast-close')) {
        toast.remove();
        return;
      }
      toast.remove();
      // Trigger refresh
      renderMessages();
      updateStats();
    });
  });
}

// Poll for new messages every 5 seconds while dashboard open
if (typeof lastMessageCount !== 'undefined') {
  notificationInterval = setInterval(() => {
    checkForNewMessages();
  }, 5000);
}

// Listen for tab focus (user returns to dashboard tab)
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) {
    refreshAll();
    checkForNewMessages();
  }
});

// Initialize
checkAuth();

