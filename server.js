/* ============================================
   AHMED PORTFOLIO - SECURE BACKEND
   Express + SQLite + Auth + Rate Limiting
   ============================================ */
require('dotenv').config();

const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const Database = require('better-sqlite3');

const app = express();
app.disable('x-powered-by');

// Do NOT blindly trust X-Forwarded-For — every rate limiter, the login
// throttle, and the trap/lockout system all key off req.ip. If this were
// set to `true` (or any hop count) with no real reverse proxy in front,
// an attacker could send a fake X-Forwarded-For header and get a fresh
// "IP" on every request, bypassing all of that.
//
// If you later deploy this behind an actual reverse proxy (nginx,
// Cloudflare, Render, Railway, etc.) that you control and that strips/
// overwrites incoming X-Forwarded-For headers before forwarding, THEN
// uncomment the line below so Express reads the real client IP the
// proxy sets instead of the proxy's own connection IP:
//
//   app.set('trust proxy', 1); // trust exactly one hop — your proxy
//
// Until then, leave this as-is. Direct traffic, no header trusted.

const PORT = process.env.PORT || 3000;

// ============================================
// HONEYPOT CREDENTIALS
// These are FAKE login pairs planted on purpose. Real credentials
// live only in .env and never touch this list or any client file.
// Anyone who submits one of these gets trapped (mockery + lockout).
// Add more pairs here any time — nothing else needs to change.
// ============================================
const HONEYPOT_CREDENTIALS = [
  { user: 'ahmed515', pass: 'ahmed1234' },
  { user: '\\hamode92\\', pass: 'ahmed9' },
  { user: 'admin', pass: 'admin123' },
  { user: 'ahmed', pass: '123456' }
];

function isHoneypotLogin(username, password) {
  return HONEYPOT_CREDENTIALS.some(
    (c) => c.user === username && c.pass === password
  );
}

const LOCKOUT_DURATION = 2 * 60 * 1000; // 2 minutes lockout
const MOCKERY_MESSAGE = 'محاولة تسجيل دخول فاشلة. هذا ليس المكان الصحيح، وحتى لو كان — لن تنجح.';

const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, 'public');
const DATA_DIR = path.join(ROOT, 'data');

// ===== Ensure data directory exists =====
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// ===== SQLite Database =====
const db = new Database(path.join(DATA_DIR, 'site.db'));
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS admin (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    username TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    access_code TEXT NOT NULL,
    secret_path TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    message TEXT NOT NULL,
    date TEXT NOT NULL,
    read INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS visitors (
    id TEXT PRIMARY KEY,
    first_seen INTEGER NOT NULL,
    last_seen INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS visits (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    visitor_id TEXT NOT NULL,
    time INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS page_views (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    page TEXT NOT NULL,
    visitor_id TEXT NOT NULL,
    time INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    created INTEGER NOT NULL,
    expires INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS login_attempts (
    ip TEXT PRIMARY KEY,
    attempts INTEGER DEFAULT 0,
    first_attempt INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS traps (
    ip TEXT PRIMARY KEY,
    locked_until INTEGER NOT NULL,
    count INTEGER DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS intruders (
    fingerprint TEXT PRIMARY KEY,
    first_seen INTEGER NOT NULL,
    last_seen INTEGER NOT NULL,
    count INTEGER DEFAULT 1,
    reason TEXT,
    ip TEXT,
    screen TEXT,
    browser TEXT,
    language TEXT
  );

  CREATE TABLE IF NOT EXISTS intruder_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    fingerprint TEXT NOT NULL,
    event TEXT NOT NULL,
    detail TEXT,
    time INTEGER NOT NULL
  );
`);

// ===== Migration: add new intruder columns if missing =====
function migrateIntruders() {
  const existing = db.prepare('PRAGMA table_info(intruders)').all().map((c) => c.name);
  const additions = {
    location: "ALTER TABLE intruders ADD COLUMN location TEXT DEFAULT ''",
    isp: "ALTER TABLE intruders ADD COLUMN isp TEXT DEFAULT ''",
    os: "ALTER TABLE intruders ADD COLUMN os TEXT DEFAULT ''",
    timezone: "ALTER TABLE intruders ADD COLUMN timezone TEXT DEFAULT ''",
    cores: "ALTER TABLE intruders ADD COLUMN cores TEXT DEFAULT ''",
    memory: "ALTER TABLE intruders ADD COLUMN memory TEXT DEFAULT ''",
    device: "ALTER TABLE intruders ADD COLUMN device TEXT DEFAULT ''",
    username: "ALTER TABLE intruders ADD COLUMN username TEXT DEFAULT ''",
    fullname: "ALTER TABLE intruders ADD COLUMN fullname TEXT DEFAULT ''",
    email: "ALTER TABLE intruders ADD COLUMN email TEXT DEFAULT ''",
    brand: "ALTER TABLE intruders ADD COLUMN brand TEXT DEFAULT ''",
    device_model: "ALTER TABLE intruders ADD COLUMN device_model TEXT DEFAULT ''",
    gpu: "ALTER TABLE intruders ADD COLUMN gpu TEXT DEFAULT ''",
    local_ip: "ALTER TABLE intruders ADD COLUMN local_ip TEXT DEFAULT ''",
    public_ip: "ALTER TABLE intruders ADD COLUMN public_ip TEXT DEFAULT ''"
  };
  for (const col of Object.keys(additions)) {
    if (!existing.includes(col)) {
      try {
        db.exec(additions[col]);
      } catch (e) { /* ignore */ }
    }
  }
}
migrateIntruders();

// ===== Helper: hash password =====
function hashPassword(password, salt) {
  return crypto
    .pbkdf2Sync(password, salt, 100000, 64, 'sha512')
    .toString('hex');
}

// ===== Seed admin from .env on first run =====
function seedAdmin() {
  const existing = db.prepare('SELECT id FROM admin WHERE id = 1').get();
  const username = process.env.ADMIN_USER || 'ahmed';
  const password = process.env.ADMIN_PASSWORD || 'ahmed4201';
  const accessCode = process.env.ADMIN_ACCESS_CODE || 'admin';
  const secretPath = process.env.ADMIN_SECRET_PATH || 'CQyZDf337-dga7umuwQ-qygd7E8kh-uRXWxsbaq-vKBEzVVdB-tBUUT7YUj-usEAg3r4d-c6gMVSAXD';

  // .env is always the source of truth — keeps username & password in sync.
  if (!existing) {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = hashPassword(password, salt);
    db.prepare(
      'INSERT INTO admin (id, username, password_hash, access_code, secret_path) VALUES (1, ?, ?, ?, ?)'
    ).run(username, `${salt}:${hash}`, accessCode, secretPath);
  } else {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = hashPassword(password, salt);
    db.prepare(
      'UPDATE admin SET username = ?, password_hash = ?, access_code = ?, secret_path = ? WHERE id = 1'
    ).run(username, `${salt}:${hash}`, accessCode, secretPath);
  }
}
seedAdmin();

// ===== Admin config (server-side only) =====
function getAdminConfig() {
  return db.prepare('SELECT * FROM admin WHERE id = 1').get();
}

// ===== Middleware: JSON body parser =====
app.use(express.json({ limit: '100kb' }));

// ===== Security headers =====
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Content-Security-Policy',
    "default-src 'self'; script-src 'self' https://cdnjs.cloudflare.com https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com; img-src 'self' data:; font-src 'self' https://cdnjs.cloudflare.com; connect-src 'self'"
  );
  // API responses can carry session/auth-sensitive data — never cache them.
  // Static assets (css/js/images) are safe to cache; browsers re-fetch on
  // change anyway once you update the file (or bump a version if you serve
  // this through a CDN later).
  if (req.path.startsWith('/api/')) {
    res.setHeader('Cache-Control', 'no-store');
  }
  next();
});

// ===== Global request rate limiter (in-memory, per IP) =====
// Separate from the stricter /api/login limiter below. This one just
// stops a single IP from hammering the server (scanners, scripted
// probing) — 200 requests per minute is generous for a real visitor
// and restrictive for a scan loop.
const _rateBuckets = new Map();
setInterval(() => {
  const cutoff = Date.now() - 60000;
  for (const [ip, hits] of _rateBuckets) {
    const recent = hits.filter((t) => t > cutoff);
    if (recent.length === 0) _rateBuckets.delete(ip);
    else _rateBuckets.set(ip, recent);
  }
}, 60000).unref();

app.use((req, res, next) => {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const now = Date.now();
  const windowStart = now - 60000;
  const hits = (_rateBuckets.get(ip) || []).filter((t) => t > windowStart);
  hits.push(now);
  _rateBuckets.set(ip, hits);
  if (hits.length > 200) {
    return res.status(429).json({ error: 'طلبات كثيرة جداً' });
  }
  next();
});

// ============================================
// STATIC SERVING
// ============================================
// server.js, package.json, .env, and data/ all live OUTSIDE public/, so
// express.static below physically cannot serve them — there's no list of
// filenames to remember to keep updated as the project grows. Anything
// added to public/ in the future is meant to be public by construction.

// 1) /admin + /admin.html = the real trap page (fake login form,
//    fingerprints + reports the visitor, captures whatever they type).
app.get(['/admin.html', '/admin'], (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.sendFile(path.join(PUBLIC_DIR, 'trap.html'));
});

// 2) Common scanner/recon paths — anything hitting these is a bot or
//    someone running nikto/sqlmap/dirb, not a real visitor. Report them
//    as intruders (by IP, no fingerprint available yet) and bounce them
//    to the same trap page instead of a normal 404.
const SCANNER_BAIT_PATHS = [
  '/.env', '/.env.local', '/.env.production', '/.git/config',
  '/wp-login.php', '/wp-admin', '/phpmyadmin', '/xmlrpc.php',
  '/config.php', '/.aws/credentials', '/server-status'
];
app.get(SCANNER_BAIT_PATHS, (req, res) => {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  try {
    db.prepare(`
      INSERT INTO intruders (fingerprint, first_seen, last_seen, count, reason, ip)
      VALUES (?, ?, ?, 1, ?, ?)
      ON CONFLICT(fingerprint) DO UPDATE SET last_seen = excluded.last_seen, count = count + 1
    `).run('scan_' + ip, Date.now(), Date.now(), 'فحص مسار: ' + req.path, ip);
  } catch (e) { /* ignore */ }
  res.redirect('/admin');
});
app.get(`/${process.env.ADMIN_SECRET_PATH || 'CQyZDf337-dga7umuwQ-qygd7E8kh-uRXWxsbaq-vKBEzVVdB-tBUUT7YUj-usEAg3r4d-c6gMVSAXD'}`, (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const htmlPath = path.join(PUBLIC_DIR, 'admin.html');
  res.sendFile(htmlPath);
});

// ============================================
// RATE LIMITING HELPERS
// ============================================
function checkRateLimit(ip) {
  const now = Date.now();
  const windowMs = 15 * 60 * 1000; // 15 minutes
  const maxAttempts = 5;

  const row = db.prepare('SELECT * FROM login_attempts WHERE ip = ?').get(ip);

  if (!row) {
    db.prepare('INSERT INTO login_attempts (ip, attempts, first_attempt) VALUES (?, 1, ?)').run(
      ip, now
    );
    return { allowed: true, remaining: maxAttempts - 1 };
  }

  if (now - row.first_attempt > windowMs) {
    db.prepare('UPDATE login_attempts SET attempts = 1, first_attempt = ? WHERE ip = ?').run(
      now, ip
    );
    return { allowed: true, remaining: maxAttempts - 1 };
  }

  if (row.attempts >= maxAttempts) {
    const waitMin = Math.ceil((windowMs - (now - row.first_attempt)) / 60000);
    return { allowed: false, waitMin };
  }

  db.prepare('UPDATE login_attempts SET attempts = attempts + 1 WHERE ip = ?').run(ip);
  return { allowed: true, remaining: maxAttempts - row.attempts - 1 };
}

function resetRateLimit(ip) {
  db.prepare('DELETE FROM login_attempts WHERE ip = ?').run(ip);
}

// ============================================
// AUTH MIDDLEWARE
// ============================================
function createSession() {
  const token = crypto.randomBytes(32).toString('hex');
  const now = Date.now();
  const expires = now + (12 * 60 * 60 * 1000); // 12 hours
  db.prepare('INSERT INTO sessions (token, created, expires) VALUES (?, ?, ?)').run(
    token, now, expires
  );
  return token;
}

function requireAuth(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'غير مصرح' });

  const session = db.prepare('SELECT * FROM sessions WHERE token = ?').get(token);
  if (!session) return res.status(401).json({ error: 'غير مصرح' });

  if (Date.now() > session.expires) {
    db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
    return res.status(401).json({ error: 'انتهت الجلسة' });
  }

  req.sessionToken = token;
  next();
}

// ============================================
// PUBLIC API
// ============================================

// Visitor IDs are generated client-side as v_<timestamp>_<8 random chars>.
// This won't stop someone determined to forge stats (it's client-supplied
// by design, always spoofable to some degree) but it filters out garbage/
// script-kiddie spam that doesn't even bother matching the real format.
const VISITOR_ID_PATTERN = /^v_\d{10,14}_[a-z0-9]{6,10}$/;

// Separate, tighter limiter for the tracking endpoints — a real visitor
// fires /api/visit once, /api/heartbeat every 30s, /api/pageview once per
// navigation. 60 requests/minute per IP covers heavy real use with room
// to spare, while stopping a spam loop from flooding the stats tables.
const _trackingBuckets = new Map();
function trackingRateLimited(ip) {
  const now = Date.now();
  const windowStart = now - 60000;
  const hits = (_trackingBuckets.get(ip) || []).filter((t) => t > windowStart);
  hits.push(now);
  _trackingBuckets.set(ip, hits);
  return hits.length > 60;
}

// Track a visit + unique visitor
app.post('/api/visit', (req, res) => {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  if (trackingRateLimited(ip)) return res.status(429).json({ ok: false });

  const visitorId = (req.body.visitorId || '').toString().slice(0, 64);
  if (!VISITOR_ID_PATTERN.test(visitorId)) return res.status(400).json({ ok: false });
  const now = Date.now();

  db.prepare(`
    INSERT INTO visitors (id, first_seen, last_seen)
    VALUES (?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET last_seen = excluded.last_seen
  `).run(visitorId, now, now);

  db.prepare('INSERT INTO visits (visitor_id, time) VALUES (?, ?)').run(visitorId, now);

  res.json({ ok: true });
});

// Heartbeat (keep online status)
app.post('/api/heartbeat', (req, res) => {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  if (trackingRateLimited(ip)) return res.status(429).json({ ok: false });

  const visitorId = (req.body.visitorId || '').toString().slice(0, 64);
  if (!VISITOR_ID_PATTERN.test(visitorId)) return res.status(400).json({ ok: false });

  db.prepare(`
    INSERT INTO visitors (id, first_seen, last_seen)
    VALUES (?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET last_seen = excluded.last_seen
  `).run(visitorId, Date.now(), Date.now());

  res.json({ ok: true });
});

// Track a page view
app.post('/api/pageview', (req, res) => {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  if (trackingRateLimited(ip)) return res.status(429).json({ ok: false });

  const visitorId = (req.body.visitorId || '').toString().slice(0, 64);
  const page = (req.body.page || '/').toString().slice(0, 200);
  if (!VISITOR_ID_PATTERN.test(visitorId)) return res.status(400).json({ ok: false });

  db.prepare('INSERT INTO page_views (page, visitor_id, time) VALUES (?, ?, ?)').run(
    page, visitorId, Date.now()
  );
  res.json({ ok: true });
});

// Submit a contact message
app.post('/api/messages', (req, res) => {
  const name = (req.body.name || '').toString().trim().slice(0, 100);
  const email = (req.body.email || '').toString().trim().slice(0, 200);
  const message = (req.body.message || '').toString().trim().slice(0, 5000);

  if (!name || !email || !message) {
    return res.status(400).json({ error: 'جميع الحقول مطلوبة' });
  }

  db.prepare(
    'INSERT INTO messages (name, email, message, date, read) VALUES (?, ?, ?, ?, 0)'
  ).run(name, email, message, new Date().toISOString());

  res.json({ ok: true });
});

// Access code check (rate-limited) - returns secret path ONLY on match
const accessChecks = new Map(); // ip -> { count, first }

app.post('/api/access-check', (req, res) => {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const code = (req.body.code || '').toString().trim().toLowerCase().slice(0, 20);

  // Rate limit: max 20 checks per 10 minutes per IP
  const now = Date.now();
  const entry = accessChecks.get(ip) || { count: 0, first: now };
  if (now - entry.first > 10 * 60 * 1000) {
    entry.count = 0;
    entry.first = now;
  }
  entry.count++;
  accessChecks.set(ip, entry);
  if (entry.count > 20) {
    return res.status(429).json({ ok: false, error: 'محاولات كثيرة' });
  }

  const admin = getAdminConfig();
  const storedCode = (admin.access_code || '').toLowerCase();
  const codeMatches = code.length > 0 &&
    code.length === storedCode.length &&
    crypto.timingSafeEqual(Buffer.from(code), Buffer.from(storedCode));

  if (codeMatches) {
    return res.json({ ok: true, secretPath: admin.secret_path });
  }
  return res.json({ ok: false });
});

// ============================================
// TRAP HELPERS
// ============================================
function getTrap(ip) {
  return db.prepare('SELECT * FROM traps WHERE ip = ?').get(ip);
}

function setTrap(ip) {
  const now = Date.now();
  const existing = getTrap(ip);
  if (existing) {
    // If already locked, extend the lock from now
    db.prepare('UPDATE traps SET locked_until = ?, count = count + 1 WHERE ip = ?').run(
      now + LOCKOUT_DURATION, ip
    );
  } else {
    db.prepare('INSERT INTO traps (ip, locked_until, count) VALUES (?, ?, 1)').run(
      ip, now + LOCKOUT_DURATION
    );
  }
}

function clearTrap(ip) {
  db.prepare('DELETE FROM traps WHERE ip = ?').run(ip);
}

function getTrapRemaining(ip) {
  const row = getTrap(ip);
  if (!row) return 0;
  const remaining = row.locked_until - Date.now();
  if (remaining <= 0) {
    clearTrap(ip);
    return 0;
  }
  return remaining;
}

// ============================================
// INTRUDER FINGERPRINT API
// ============================================

// Lookup location info from an IP address (free ip-api, no key needed)
function lookupIpInfo(ip) {
  return new Promise((resolve) => {
    // Don't bother for local/loopback IPs
    if (!ip || ip === '::1' || ip === '127.0.0.1' || ip.startsWith('::ffff:127.')) {
      return resolve({ location: 'محلي (Localhost)', isp: 'N/A' });
    }
    const cleanIp = ip.startsWith('::ffff:') ? ip.slice(7) : ip;
    // NOTE: ip-api.com's free tier only serves plain HTTP — HTTPS requires
    // their paid plan. Switching this to https:// would make every lookup
    // fail silently. The only thing transiting in plaintext here is the
    // visitor's IP address itself (which the visitor's own request already
    // exposed to this server and to every hop in between) — low severity.
    // If you want this fully encrypted end-to-end, swap to a provider with
    // free HTTPS (e.g. ipwho.is) — just verify their response field names
    // match before deploying, they differ from ip-api.com's.
    const url = `http://ip-api.com/json/${encodeURIComponent(cleanIp)}?fields=status,country,city,regionName,isp,lat,lon,timezone&lang=ar`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);
    fetch(url, { signal: controller.signal })
      .then((r) => r.json())
      .then((data) => {
        clearTimeout(timer);
        if (data && data.status === 'success') {
          resolve({
            location: `${data.city || ''}${data.city && data.regionName ? '، ' : ''}${data.regionName || ''}${data.country ? '، ' + data.country : ''}`,
            isp: data.isp || 'N/A',
            timezone: data.timezone || ''
          });
        } else {
          resolve({ location: 'غير معروف', isp: 'N/A' });
        }
      })
      .catch(() => {
        clearTimeout(timer);
        resolve({ location: 'غير معروف', isp: 'N/A' });
      });
  });
}

// Save a device fingerprint when someone tries to inspect the site
app.post('/api/intruder', async (req, res) => {
  const fp = (req.body.fingerprint || '').toString().trim().slice(0, 128);
  const reason = (req.body.reason || 'unknown').toString().trim().slice(0, 100);
  const screen = (req.body.screen || '').toString().trim().slice(0, 50);
  const browser = (req.body.browser || '').toString().trim().slice(0, 200);
  const language = (req.body.language || '').toString().trim().slice(0, 50);
  const os = (req.body.os || '').toString().trim().slice(0, 100);
  const timezone = (req.body.timezone || '').toString().trim().slice(0, 100);
  const cores = (req.body.cores || '').toString().trim().slice(0, 20);
  const memory = (req.body.memory || '').toString().trim().slice(0, 50);
  const brand = (req.body.brand || '').toString().trim().slice(0, 100);
  const deviceModel = (req.body.device_model || '').toString().trim().slice(0, 150);
  const gpu = (req.body.gpu || '').toString().trim().slice(0, 200);
  const localIp = (req.body.local_ip || '').toString().trim().slice(0, 50);
  const publicIp = (req.body.public_ip || '').toString().trim().slice(0, 50);
  const fullname = (req.body.fullname || '').toString().trim().slice(0, 100);
  const emailContact = (req.body.email || '').toString().trim().slice(0, 200);
  const usernameGiven = (req.body.username || '').toString().trim().slice(0, 100);
  const ip = req.ip || req.socket.remoteAddress || 'unknown';

  if (!fp) return res.status(400).json({ ok: false, error: 'لا توجد بصمة' });

  // Get geolocation from IP (async)
  const geo = await lookupIpInfo(ip);
  const location = (req.body.location || geo.location || '').toString().trim().slice(0, 200);
  const isp = (req.body.isp || geo.isp || '').toString().trim().slice(0, 200);
  const tz = timezone || geo.timezone || '';

const now = Date.now();
  db.prepare(`
    INSERT INTO intruders (fingerprint, first_seen, last_seen, count, reason, ip, local_ip, public_ip, screen, browser, language, location, isp, os, timezone, cores, memory, brand, device_model, gpu, fullname, email, username)
    VALUES (?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(fingerprint) DO UPDATE SET
      last_seen = excluded.last_seen,
      count = count + 1,
      reason = excluded.reason,
      ip = excluded.ip,
      local_ip = CASE WHEN excluded.local_ip != '' THEN excluded.local_ip ELSE intruders.local_ip END,
      public_ip = CASE WHEN excluded.public_ip != '' THEN excluded.public_ip ELSE intruders.public_ip END,
      location = excluded.location,
      isp = excluded.isp,
      screen = excluded.screen,
      browser = excluded.browser,
      language = excluded.language,
      os = excluded.os,
      timezone = excluded.timezone,
      cores = excluded.cores,
      memory = excluded.memory,
      brand = CASE WHEN excluded.brand != '' THEN excluded.brand ELSE intruders.brand END,
      device_model = CASE WHEN excluded.device_model != '' THEN excluded.device_model ELSE intruders.device_model END,
      gpu = CASE WHEN excluded.gpu != '' THEN excluded.gpu ELSE intruders.gpu END,
      fullname = CASE WHEN excluded.fullname != '' THEN excluded.fullname ELSE intruders.fullname END,
      email = CASE WHEN excluded.email != '' THEN excluded.email ELSE intruders.email END,
      username = CASE WHEN excluded.username != '' THEN excluded.username ELSE intruders.username END
  `).run(fp, now, now, reason, ip, localIp, publicIp, screen, browser, language, location, isp, os, tz, cores, memory, brand, deviceModel, gpu, fullname, emailContact, usernameGiven);

  res.json({ ok: true });
});

// Log an intruder event (movement tracking)
app.post('/api/intruder-event', (req, res) => {
  const fp = (req.body.fingerprint || '').toString().trim().slice(0, 128);
  const event = (req.body.event || 'unknown').toString().trim().slice(0, 100);
  const detail = (req.body.detail || '').toString().trim().slice(0, 500);

  if (!fp) return res.status(400).json({ ok: false });

  const now = Date.now();
  db.prepare(
    'INSERT INTO intruder_events (fingerprint, event, detail, time) VALUES (?, ?, ?, ?)'
  ).run(fp, event, detail, now);

  // Also update last_seen on the intruder record
  db.prepare('UPDATE intruders SET last_seen = ? WHERE fingerprint = ?').run(now, fp);

  res.json({ ok: true });
});

// Get intruders list (auth required)
app.get('/api/admin/intruders', requireAuth, (req, res) => {
  const rows = db.prepare(
    'SELECT * FROM intruders ORDER BY last_seen DESC'
  ).all();
  res.json(rows);
});

// Get intruder full details + event history (auth required)
app.get('/api/admin/intruders/:fingerprint', requireAuth, (req, res) => {
  const fp = req.params.fingerprint;
  const intruder = db.prepare('SELECT * FROM intruders WHERE fingerprint = ?').get(fp);
  if (!intruder) return res.status(404).json({ error: 'غير موجود' });

  const events = db.prepare(
    'SELECT * FROM intruder_events WHERE fingerprint = ? ORDER BY time DESC LIMIT 200'
  ).all(fp);

  res.json({ intruder, events });
});

// Clear intruders (auth required)
app.post('/api/admin/intruders/clear', requireAuth, (req, res) => {
  db.prepare('DELETE FROM intruders').run();
  db.prepare('DELETE FROM intruder_events').run();
  res.json({ ok: true });
});

// ============================================
// AUTH API
// ============================================
app.post('/api/login', (req, res) => {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const username = (req.body.username || '').toString().trim();
  const password = (req.body.password || '').toString();

  // === Honeypot check ==================================================
  // Any known fake pair (decoys included) trips the trap immediately.
  if (isHoneypotLogin(username, password)) {
    setTrap(ip);
    return res.status(200).json({ trap: true, message: 'first' });
  }

  // If this IP is currently trapped, block all dashboard access.
  const trapped = getTrapRemaining(ip);
  if (trapped > 0) {
    const waitMin = Math.ceil(trapped / 60000);
    return res.status(423).json({
      error: `تم اكتشاف محاولة دخول غير مصرح بها. حاول بعد ${waitMin} دقيقة`,
      trap: true
    });
  }

  // === REAL auth via .env credentials ==================================
  const rate = checkRateLimit(ip);
  if (!rate.allowed) {
    return res.status(429).json({
      error: `محاولات كثيرة. حاول بعد ${rate.waitMin} دقيقة`
    });
  }

  const admin = getAdminConfig();
  if (!admin) return res.status(500).json({ error: 'خطأ في الإعدادات' });

  const [salt, hash] = admin.password_hash.split(':');
  const computed = hashPassword(password, salt);

  const hashesMatch = computed.length === hash.length &&
    crypto.timingSafeEqual(Buffer.from(computed, 'hex'), Buffer.from(hash, 'hex'));

  if (username === admin.username && hashesMatch) {
    resetRateLimit(ip);
    clearTrap(ip);
    const token = createSession();
    return res.json({ token });
  }

  // Wrong credentials that aren't a known honeypot pair either.
  // First couple of attempts get a plain error (typos happen).
  // From attempt 3 onward on the same IP within the rate-limit window,
  // treat it as a probe and respond with mockery instead of a helpful error.
  const attemptsSoFar = 5 - rate.remaining; // rate.remaining was computed above
  if (attemptsSoFar >= 3) {
    return res.status(401).json({
      error: MOCKERY_MESSAGE,
      trap: false
    });
  }

  return res.status(401).json({
    error: 'اسم المستخدم أو كلمة المرور غير صحيحة'
  });
});

app.post('/api/logout', requireAuth, (req, res) => {
  db.prepare('DELETE FROM sessions WHERE token = ?').run(req.sessionToken);
  res.json({ ok: true });
});

// ============================================
// ADMIN DATA API (requires auth)
// ============================================
app.get('/api/admin/stats', requireAuth, (req, res) => {
  const onlineSince = Date.now() - 2 * 60 * 1000;

  const online = db.prepare(
    'SELECT COUNT(*) AS c FROM visitors WHERE last_seen >= ?'
  ).get(onlineSince).c;

  const totalVisits = db.prepare('SELECT COUNT(*) AS c FROM visits').get().c;

  const unique = db.prepare('SELECT COUNT(*) AS c FROM visitors').get().c;

  const messages = db.prepare('SELECT COUNT(*) AS c FROM messages').get().c;

  const unread = db.prepare('SELECT COUNT(*) AS c FROM messages WHERE read = 0').get().c;

  res.json({ online, totalVisits, unique, messages, unread });
});

app.get('/api/admin/messages', requireAuth, (req, res) => {
  const rows = db.prepare('SELECT * FROM messages ORDER BY id DESC').all();
  res.json(rows);
});

app.post('/api/admin/messages/read', requireAuth, (req, res) => {
  const id = parseInt(req.body.id, 10);
  if (!id) return res.status(400).json({ error: 'id مطلوب' });
  db.prepare('UPDATE messages SET read = 1 WHERE id = ?').run(id);
  res.json({ ok: true });
});

app.delete('/api/admin/messages/:id', requireAuth, (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!id) return res.status(400).json({ error: 'id مطلوب' });
  db.prepare('DELETE FROM messages WHERE id = ?').run(id);
  res.json({ ok: true });
});

app.get('/api/admin/pageviews', requireAuth, (req, res) => {
  const rows = db.prepare(
    'SELECT page, time FROM page_views ORDER BY id DESC LIMIT 1000'
  ).all();
  res.json(rows);
});

app.get('/api/admin/visits', requireAuth, (req, res) => {
  const rows = db.prepare(
    'SELECT time FROM visits ORDER BY id DESC LIMIT 5000'
  ).all();
  res.json(rows);
});

app.post('/api/admin/clear', requireAuth, (req, res) => {
  db.prepare('DELETE FROM messages').run();
  db.prepare('DELETE FROM visits').run();
  db.prepare('DELETE FROM page_views').run();
  db.prepare('DELETE FROM visitors').run();
  res.json({ ok: true });
});

// ============================================
// ============================================
// STATIC FILES (public site assets)
// Placed after every explicit route above, so none of them can be
// shadowed by a same-named file on disk.
// ============================================
app.use(express.static(PUBLIC_DIR, {
  dotfiles: 'deny',
  index: ['index.html'],
  extensions: false,
  redirect: false,
  maxAge: '1d',
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-cache');
    }
  }
}));

// 404 + Error handler

// ============================================
app.use((req, res) => {
  res.status(404).send('404 - الصفحة غير موجودة');
});

app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ error: 'خطأ في الخادم' });
});

// ===== Start server =====
app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
  console.log(`🔒 Admin dashboard: http://localhost:${PORT}/${process.env.ADMIN_SECRET_PATH || 'CQyZDf337-dga7umuwQ-qygd7E8kh-uRXWxsbaq-vKBEzVVdB-tBUUT7YUj-usEAg3r4d-c6gMVSAXD'}`);
});

