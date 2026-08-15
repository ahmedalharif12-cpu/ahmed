/* ============================================
   PARTICLE BACKGROUND CANVAS
   ============================================ */
const canvas = document.getElementById('particlesCanvas');
const ctx = canvas.getContext('2d');

let particles = [];
let mouseX = 0;
let mouseY = 0;

function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
resizeCanvas();
window.addEventListener('resize', resizeCanvas);

class Particle {
  constructor() {
    this.reset();
  }

  reset() {
    this.x = Math.random() * canvas.width;
    this.y = Math.random() * canvas.height;
    this.size = Math.random() * 2.5 + 0.5;
    this.speedX = (Math.random() - 0.5) * 0.5;
    this.speedY = (Math.random() - 0.5) * 0.5;
    this.opacity = Math.random() * 0.5 + 0.1;
    this.hue = Math.random() * 60 + 230; // Blue-purple range
  }

  update() {
    this.x += this.speedX;
    this.y += this.speedY;

    // Mouse interaction
    const dx = mouseX - this.x;
    const dy = mouseY - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 150) {
      const force = (150 - dist) / 150;
      this.x -= dx * force * 0.01;
      this.y -= dy * force * 0.01;
    }

    if (this.x < 0 || this.x > canvas.width) this.speedX *= -1;
    if (this.y < 0 || this.y > canvas.height) this.speedY *= -1;
  }

  draw() {
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
    ctx.fillStyle = `hsla(${this.hue}, 60%, 60%, ${this.opacity})`;
    ctx.fill();
  }
}

// Create particles
const particleCount = Math.min(Math.floor(canvas.width * 0.05), 80);
for (let i = 0; i < particleCount; i++) {
  particles.push(new Particle());
}

// Draw connections between nearby particles
function drawConnections() {
  for (let i = 0; i < particles.length; i++) {
    for (let j = i + 1; j < particles.length; j++) {
      const dx = particles[i].x - particles[j].x;
      const dy = particles[i].y - particles[j].y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < 120) {
        ctx.beginPath();
        ctx.moveTo(particles[i].x, particles[i].y);
        ctx.lineTo(particles[j].x, particles[j].y);
        ctx.strokeStyle = `hsla(240, 30%, 50%, ${0.06 * (1 - dist / 120)})`;
        ctx.lineWidth = 0.5;
        ctx.stroke();
      }
    }
  }
}

function animateParticles() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  for (const p of particles) {
    p.update();
    p.draw();
  }

  drawConnections();
  requestAnimationFrame(animateParticles);
}

animateParticles();

// Track mouse for particle interaction
document.addEventListener('mousemove', (e) => {
  mouseX = e.clientX;
  mouseY = e.clientY;
});

/* ============================================
   3D TILT CARD EFFECT
   ============================================ */
const tiltCard = document.getElementById('tiltCard');
const tiltInner = tiltCard?.querySelector('.tilt-inner');
const tiltGlow = tiltCard?.querySelector('.tilt-glow');

if (tiltCard && tiltInner) {
  tiltCard.addEventListener('mousemove', (e) => {
    const rect = tiltCard.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    const rotateX = (y - centerY) / centerY * -12;
    const rotateY = (x - centerX) / centerX * 12;

    tiltInner.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(1.02, 1.02, 1.02)`;

    if (tiltGlow) {
      const px = (x / rect.width) * 100;
      const py = (y / rect.height) * 100;
      tiltGlow.style.setProperty('--mouse-x', px + '%');
      tiltGlow.style.setProperty('--mouse-y', py + '%');
    }
  });

  tiltCard.addEventListener('mouseleave', () => {
    tiltInner.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)';
  });
}

/* ============================================
   GLASS CARD TILT (data-tilt attribute)
   ============================================ */
document.querySelectorAll('[data-tilt]').forEach((card) => {
  card.addEventListener('mousemove', (e) => {
    const rect = card.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    const rotateX = (y - centerY) / centerY * -6;
    const rotateY = (x - centerX) / centerX * 6;

    card.style.transform = `perspective(800px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateY(-4px)`;
  });

  card.addEventListener('mouseleave', () => {
    card.style.transform = 'perspective(800px) rotateX(0deg) rotateY(0deg) translateY(0)';
  });
});

/* ============================================
   NAVBAR TOGGLE
   ============================================ */
const navToggle = document.getElementById('navToggle');
const navLinks = document.getElementById('navLinks');

if (navToggle && navLinks) {
  navToggle.addEventListener('click', () => {
    navLinks.classList.toggle('show');
    navToggle.classList.toggle('active');
  });

  navLinks.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', () => {
      navLinks.classList.remove('show');
      navToggle.classList.remove('active');
    });
  });
}

/* ============================================
   NAVBAR BACKGROUND ON SCROLL
   ============================================ */
const navbar = document.getElementById('navbar');
if (navbar) {
  window.addEventListener('scroll', () => {
    if (window.scrollY > 50) {
      navbar.style.background = 'rgba(8, 8, 14, 0.95)';
    } else {
      navbar.style.background = 'rgba(8, 8, 14, 0.8)';
    }
  });
}

/* ============================================
   SKILL BAR ANIMATION ON SCROLL
   ============================================ */
const skillFills = document.querySelectorAll('.skill-fill');

const observer = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        const fill = entry.target;
        const width = fill.style.width;
        fill.style.width = '0%';
        setTimeout(() => {
          fill.style.width = width;
        }, 100);
      }
    });
  },
  { threshold: 0.3 }
);

skillFills.forEach((fill) => observer.observe(fill));

/* ============================================
   SECURE TRACKING (Server-side via API)
   ============================================ */
let visitorId = '';

function getVisitorId() {
  try {
    let id = localStorage.getItem('visitor_id');
    if (!id) {
      id = 'v_' + Date.now() + '_' + Math.random().toString(36).substr(2, 8);
      localStorage.setItem('visitor_id', id);
    }
    return id;
  } catch (e) {
    return 'v_' + Date.now() + '_' + Math.random().toString(36).substr(2, 8);
  }
}

function apiPost(url, data) {
  return fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data || {})
  }).catch(() => null);
}

// Track a visit (runs once per session)
function trackVisit() {
  visitorId = getVisitorId();
  apiPost('/api/visit', { visitorId });
}

// Keep-alive every 30 seconds
function startKeepAlive() {
  setInterval(() => {
    if (visitorId) apiPost('/api/heartbeat', { visitorId });
  }, 30000);
}

// Page view tracking
function trackPageView() {
  if (!visitorId) visitorId = getVisitorId();
  apiPost('/api/pageview', {
    visitorId,
    page: window.location.pathname
  });
}

// Initialize tracking
trackVisit();
startKeepAlive();
trackPageView();

/* ============================================
   CONTACT FORM SUBMIT (saves to database)
   ============================================ */
const contactForm = document.getElementById('contactForm');
if (contactForm) {
  contactForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const nameInput = contactForm.querySelector('input[name="name"]');
    const emailInput = contactForm.querySelector('input[name="email"]');
    const msgTextarea = contactForm.querySelector('textarea[name="message"]');

    const btn = contactForm.querySelector('.btn-primary');
    const originalText = btn.innerHTML;
    btn.disabled = true;

    // Send message to server database
    const result = await apiPost('/api/messages', {
      name: nameInput.value,
      email: emailInput.value,
      message: msgTextarea.value
    });

    // Also attach the submitted name/email to this device's fingerprint
    // (so the admin can see who filled the form, if they later get flagged)
    try {
      fetch('/api/intruder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fingerprint: getVisitorId(),
          fullname: nameInput.value,
          email: emailInput.value,
          reason: 'زائر قام بالتسجيل/التواصل مع الموقع'
        })
      }).catch(() => {});
    } catch (e) { /* silent */ }

    btn.disabled = false;
    if (result && result.ok) {
      btn.innerHTML = 'تم الإرسال <i class="fas fa-check"></i>';
      btn.style.background = 'linear-gradient(135deg, #22c55e, #16a34a)';
      setTimeout(() => {
        btn.innerHTML = originalText;
        btn.style.background = '';
      }, 3000);
      contactForm.reset();
    } else {
      btn.innerHTML = 'خطأ <i class="fas fa-times"></i>';
      btn.style.background = 'linear-gradient(135deg, #ef4444, #dc2626)';
      setTimeout(() => {
        btn.innerHTML = originalText;
        btn.style.background = '';
      }, 3000);
    }
  });
}

/* ============================================
   SECRET ADMIN ACCESS (server-verified code)
   The access code is stored on the server only.
   Typed characters are sent to /api/access-check
   which returns the secret path only on a match.
   ============================================ */
function isTypingField(e) {
  const tag = (e.target.tagName || '').toLowerCase();
  const isInput = e.target.isContentEditable;
  return (
    tag === 'input' ||
    tag === 'textarea' ||
    tag === 'select' ||
    isInput
  );
}

let typedBuffer = '';
let bufferTimer = null;

function checkAccessCode() {
  if (!typedBuffer) return;
  const code = typedBuffer;
  typedBuffer = '';

  fetch('/api/access-check', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code })
  })
    .then((r) => r.json())
    .then((data) => {
      if (data.ok && data.secretPath) {
        window.location.href = '/' + data.secretPath;
      }
    })
    .catch(() => {});
}

document.addEventListener('keydown', (e) => {
  // Ignore typing in form fields
  if (isTypingField(e)) return;

  // Collect single character keys only
  if (e.key && e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
    typedBuffer += e.key.toLowerCase();
    if (typedBuffer.length > 15) typedBuffer = typedBuffer.slice(-15);

    clearTimeout(bufferTimer);
    bufferTimer = setTimeout(checkAccessCode, 500);
  }
});

/* ============================================
   OLD LOCAL FALLBACK (kept for reference, unused)
   ============================================ */
// function _oldOfflineLoginCheck(u, p) {
//   // legacy fallback from before the server-side auth was wired up
//   return u === 'ahmed' && p === '123456';
// }

/* ============================================
   SMOOTH SCROLL FOR ANCHOR LINKS
   ============================================ */
document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
  anchor.addEventListener('click', (e) => {
    const href = anchor.getAttribute('href');
    if (href === '#') return;
    const target = document.querySelector(href);
    if (target) {
      e.preventDefault();
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });
});
