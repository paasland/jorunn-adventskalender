// Jorunns adventskalender – enkel server uten eksterne avhengigheter.
// Start:  ADMIN_PASSWORD=hemmelig node server.js
//
// Miljøvariabler:
//   ADMIN_PASSWORD  (påkrevd for admin)  passord til /admin.html
//   BYPASS_CODE     (valgfri)            hemmelig kode som åpner luker før datoen (admin-passordet virker også)
//   CALENDAR_YEAR   (valgfri)            året kalenderen gjelder for (standard: inneværende år)
//   PORT            (valgfri)            standard 3000
//   FAKE_DATE       (valgfri)            f.eks. 2026-12-10 for testing

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';
const BYPASS_CODE = process.env.BYPASS_CODE || '';
const PUBLIC_DIR = path.join(__dirname, 'public');
const DATA_FILE = path.join(__dirname, 'data', 'messages.json');

function osloNow() {
  if (process.env.FAKE_DATE) {
    const [y, m, d] = process.env.FAKE_DATE.split('-').map(Number);
    return { y, m, d };
  }
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Oslo', year: 'numeric', month: 'numeric', day: 'numeric',
  }).formatToParts(new Date());
  const get = t => Number(parts.find(p => p.type === t).value);
  return { y: get('year'), m: get('month'), d: get('day') };
}

function calendarYear() {
  return Number(process.env.CALENDAR_YEAR) || osloNow().y;
}

// Hvor mange luker er åpnet for vanlige besøkende i dag?
function unlockedDays() {
  const { y, m, d } = osloNow();
  const cy = calendarYear();
  if (y > cy) return 24;
  if (y === cy && m === 12) return Math.min(d, 24);
  return 0;
}

function loadMessages() {
  try { return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')); } catch { return {}; }
}
function saveMessages(obj) {
  const tmp = DATA_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(obj, null, 2), 'utf8');
  fs.renameSync(tmp, DATA_FILE);
}

function safeEqual(a, b) {
  const ha = crypto.createHash('sha256').update(String(a)).digest();
  const hb = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
}

// Enkel brute-force-beskyttelse: maks 10 feil per 10 min per IP
const fails = new Map();
function tooManyFails(ip) {
  const now = Date.now();
  const list = (fails.get(ip) || []).filter(t => now - t < 600000);
  fails.set(ip, list);
  return list.length >= 10;
}
function recordFail(ip) { (fails.get(ip) || fails.set(ip, []).get(ip)).push(Date.now()); }

function isAdmin(req) {
  return ADMIN_PASSWORD && safeEqual(req.headers['x-admin-password'] || '', ADMIN_PASSWORD);
}
function isBypass(req) {
  const code = req.headers['x-bypass-code'] || '';
  if (!code) return false;
  if (BYPASS_CODE && safeEqual(code, BYPASS_CODE)) return true;
  return !!(ADMIN_PASSWORD && safeEqual(code, ADMIN_PASSWORD));
}

function send(res, status, obj) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(obj));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', c => { data += c; if (data.length > 200000) { reject(new Error('too large')); req.destroy(); } });
    req.on('end', () => { try { resolve(data ? JSON.parse(data) : {}); } catch (e) { reject(e); } });
  });
}

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.ico': 'image/x-icon', '.json': 'application/json',
};

async function handleApi(req, res, url) {
  const ip = req.socket.remoteAddress;
  const p = url.pathname;

  if (req.method === 'GET' && p === '/api/status') {
    return send(res, 200, { unlocked: unlockedDays(), year: calendarYear() });
  }

  if (req.method === 'POST' && p === '/api/bypass-check') {
    if (tooManyFails(ip)) return send(res, 429, { error: 'For mange forsøk. Vent litt.' });
    if (isBypass(req)) return send(res, 200, { ok: true });
    recordFail(ip);
    return send(res, 401, { ok: false });
  }

  let m = p.match(/^\/api\/door\/(\d+)$/);
  if (req.method === 'GET' && m) {
    const n = Number(m[1]);
    if (n < 1 || n > 24) return send(res, 404, { error: 'Finnes ikke' });
    if (req.headers['x-bypass-code'] && tooManyFails(ip)) return send(res, 429, { error: 'For mange forsøk.' });
    const bypass = isBypass(req);
    if (req.headers['x-bypass-code'] && !bypass) recordFail(ip);
    if (!bypass && n > unlockedDays()) {
      return send(res, 403, { error: 'locked', day: n });
    }
    const text = loadMessages()[String(n)] || '';
    return send(res, 200, { day: n, text });
  }

  // --- admin ---
  if (p.startsWith('/api/admin/')) {
    if (!ADMIN_PASSWORD) return send(res, 503, { error: 'ADMIN_PASSWORD er ikke satt på serveren.' });
    if (tooManyFails(ip)) return send(res, 429, { error: 'For mange forsøk. Vent 10 minutter.' });
    if (!isAdmin(req)) { recordFail(ip); return send(res, 401, { error: 'Feil passord' }); }

    if (req.method === 'GET' && p === '/api/admin/messages') {
      return send(res, 200, { messages: loadMessages(), unlocked: unlockedDays(), year: calendarYear() });
    }
    if (req.method === 'PUT' && p === '/api/admin/messages') {
      let body;
      try { body = await readBody(req); } catch { return send(res, 400, { error: 'Ugyldig forespørsel' }); }
      const incoming = body.messages || {};
      const current = loadMessages();
      for (const [k, v] of Object.entries(incoming)) {
        const n = Number(k);
        if (Number.isInteger(n) && n >= 1 && n <= 24 && typeof v === 'string') {
          current[String(n)] = v.slice(0, 5000);
        }
      }
      saveMessages(current);
      return send(res, 200, { ok: true });
    }
    return send(res, 404, { error: 'Ukjent endepunkt' });
  }

  send(res, 404, { error: 'Ukjent endepunkt' });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  try {
    if (url.pathname.startsWith('/api/')) return await handleApi(req, res, url);

    let rel = decodeURIComponent(url.pathname);
    if (rel === '/') rel = '/index.html';
    if (rel === '/admin') rel = '/admin.html';
    const file = path.normalize(path.join(PUBLIC_DIR, rel));
    if (!file.startsWith(PUBLIC_DIR + path.sep)) { res.writeHead(403); return res.end('Forbidden'); }
    fs.readFile(file, (err, buf) => {
      if (err) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); return res.end('Ikke funnet'); }
      res.writeHead(200, {
        'Content-Type': MIME[path.extname(file)] || 'application/octet-stream',
        'X-Content-Type-Options': 'nosniff',
        'Referrer-Policy': 'no-referrer',
      });
      res.end(buf);
    });
  } catch (e) {
    console.error(e);
    send(res, 500, { error: 'Serverfeil' });
  }
});

server.listen(PORT, () => {
  console.log(`Adventskalender kjører på http://localhost:${PORT}`);
  if (!ADMIN_PASSWORD) console.warn('ADVARSEL: ADMIN_PASSWORD er ikke satt – admin er deaktivert.');
});
