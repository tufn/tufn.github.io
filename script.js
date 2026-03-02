'use strict';

/* ─────────────────────────────────────────────────────────
   SUPABASE
───────────────────────────────────────────────────────── */
const SB_URL = "https://xuqtcfdpjpyinmvjsazq.supabase.co";
const SB_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh1cXRjZmRwanB5aW5tdmpzYXpxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA3MzIyNzksImV4cCI6MjA4NjMwODI3OX0.oB_PN-qq7o_KePypNvBeMGnIvisXOVpOu2e7WF-HXYA";

let db        = null;
let rtChannel = null;

const $  = id  => document.getElementById(id);
const $$ = sel => document.querySelectorAll(sel);

function initDB() {
  if (typeof window.supabase === 'undefined') return;
  try {
    db = window.supabase.createClient(SB_URL, SB_KEY, {
      realtime: { params: { eventsPerSecond: 2 } },
      auth: { persistSession: false }
    });
  } catch (e) {
    console.warn('Supabase init failed:', e.message);
  }
}

/* ─────────────────────────────────────────────────────────
   SECURITY HELPERS
───────────────────────────────────────────────────────── */
const sec = {
  rateMap: new Map(),
  reqMap:  new Map(),
  blocked: new Set(),
  lastReq: 0,

  esc(s) {
    if (typeof s !== 'string') return String(s);
    return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
            .replace(/"/g,'&quot;').replace(/'/g,'&#x27;');
  },

  clean(s) {
    if (typeof s !== 'string') return '';
    return s.replace(/[<>"'`]/g,'').replace(/javascript:/gi,'')
            .replace(/on\w+\s*=/gi,'').replace(/[\x00-\x1F\x7F]/g,'')
            .trim().slice(0, 500);
  },

  emailNorm(e) {
    if (typeof e !== 'string') return null;
    const c = e.toLowerCase().trim();
    return /^[a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,}$/.test(c) ? c : null;
  },

  emailValid(e) {
    if (!e || typeof e !== 'string' || e.length < 5 || e.length > 254) return false;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e)) return false;
    const dom = e.split('@')[1]?.toLowerCase() ?? '';
    const blocked = ['tempmail.com','10minutemail.com','guerrillamail.com','mailinator.com','throwaway.email','yopmail.com'];
    return !blocked.includes(dom);
  },

  rateLimit(key, max, ms) {
    const now  = Date.now();
    const hits = (this.rateMap.get(key) || []).filter(t => now - t < ms);
    if (hits.length >= max) return false;
    hits.push(now);
    this.rateMap.set(key, hits);
    return true;
  },

  checkBurst(fp) {
    const now  = Date.now();
    const hist = (this.reqMap.get(fp) || []).filter(t => now - t < 300_000);
    if (hist.length > 10) { this.blocked.add(fp); return false; }
    hist.push(now);
    this.reqMap.set(fp, hist);
    return true;
  },

  isBlocked(fp) { return this.blocked.has(fp); },
  validFP(fp)   { return typeof fp === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(fp); }
};

function getFP() {
  let fp = localStorage.getItem('tufn_fp');
  if (!fp || !sec.validFP(fp)) {
    fp = crypto.randomUUID();
    localStorage.setItem('tufn_fp', fp);
    localStorage.setItem('tufn_fp_ts', Date.now().toString());
  }
  return fp;
}

/* ─────────────────────────────────────────────────────────
   TOAST
───────────────────────────────────────────────────────── */
let toastTimer = null;
function showToast(msg, type = 'info') {
  const el = $('toast');
  if (!el) return;
  el.textContent = sec.clean(msg);
  el.className = 'toast show' + (type === 'success' ? ' ok' : type === 'error' ? ' err' : '');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 3400);
}

/* ─────────────────────────────────────────────────────────
   WAITLIST COUNT
───────────────────────────────────────────────────────── */
function animCount(el, target) {
  if (!el) return;
  const from = parseInt(el.textContent.replace(/\D/g, '')) || 0;
  if (from === target) return;
  const step  = (target - from) / (700 / 16);
  let   cur   = from;
  const timer = setInterval(() => {
    cur += step;
    const done = step > 0 ? cur >= target : cur <= target;
    if (done) { el.textContent = target.toLocaleString(); clearInterval(timer); }
    else       { el.textContent = Math.floor(cur).toLocaleString(); }
  }, 16);
}

async function fetchCount() {
  const el = $('waitlist-count');
  if (!el || !db) return;
  try {
    const { data, error } = await db.rpc('get_waitlist_count');
    if (error) { el.textContent = '--'; return; }
    let n = 0;
    if      (typeof data === 'number')  n = data;
    else if (Array.isArray(data))       n = data[0]?.count ?? data[0] ?? 0;
    else if (data?.count !== undefined) n = data.count;
    animCount(el, Number(n) || 0);
  } catch { el.textContent = '--'; }
}

function initRealtime() {
  if (!db || rtChannel) return;
  rtChannel = db.channel('wl-inserts')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'waitlist' }, () => {
      const el  = $('waitlist-count');
      if (!el) return;
      const cur = parseInt(el.textContent.replace(/\D/g, '')) || 0;
      animCount(el, cur + 1);
    })
    .subscribe();
}

/* ─────────────────────────────────────────────────────────
   MODAL
───────────────────────────────────────────────────────── */
function openModal() {
  const m = $('waitlist-modal');
  if (!m) return;
  m.classList.add('open');
  document.body.style.overflow = 'hidden';
  setTimeout(() => $('wl-email')?.focus(), 80);
}

function closeModal() {
  const m = $('waitlist-modal');
  if (!m) return;
  m.classList.remove('open');
  document.body.style.overflow = '';
  const err = $('wl-error');
  if (err) err.textContent = '';
}

function markJoined() {
  localStorage.setItem('tufn_joined', '1');
  ['join-waitlist','nav-waitlist','cta-waitlist','mobile-waitlist'].forEach(id => {
    const b = $(id);
    if (!b) return;
    b.disabled    = true;
    b.textContent = "You're on the list!";
  });
}

function initWaitlist() {
  if (localStorage.getItem('tufn_joined')) { markJoined(); return; }

  ['join-waitlist','nav-waitlist','cta-waitlist','mobile-waitlist']
    .forEach(id => $(id)?.addEventListener('click', openModal));

  $('modal-close')?.addEventListener('click', closeModal);
  $('waitlist-modal')?.addEventListener('click', e => {
    if (e.target === $('waitlist-modal')) closeModal();
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && $('waitlist-modal')?.classList.contains('open')) closeModal();
  });

  $('waitlist-form')?.addEventListener('submit', async e => {
    e.preventDefault();
    if (!db) { showToast('Service unavailable. Try again later.', 'error'); return; }

    const fp = getFP();
    if (sec.isBlocked(fp))            { showToast('Too many attempts. Please wait.', 'error'); return; }
    if (!sec.checkBurst(fp))          { showToast('Too many attempts. Please wait.', 'error'); return; }
    const now = Date.now();
    if (now - sec.lastReq < 2000)     { showToast('Please wait a moment.', 'error'); return; }
    sec.lastReq = now;
    if (!sec.rateLimit(`wl_${fp}`, 3, 30_000)) { showToast('Too many requests.', 'error'); return; }

    const raw   = $('wl-email')?.value.trim() ?? '';
    const errEl = $('wl-error');

    if (!raw)                 { if (errEl) errEl.textContent = 'Email is required.'; return; }
    if (!sec.emailValid(raw)) { if (errEl) errEl.textContent = 'Please enter a valid email address.'; return; }
    const email = sec.emailNorm(raw);
    if (!email)               { if (errEl) errEl.textContent = 'Invalid email format.'; return; }
    if (errEl) errEl.textContent = '';

    const btn = $('wl-submit');
    btn.disabled    = true;
    btn.textContent = 'Joining…';

    try {
      const { error } = await db.from('waitlist').insert({
        fingerprint: sec.clean(fp),
        email,
        created_at: new Date().toISOString()
      });
      if (error) {
        if (error.code === '23505' || (error.message || '').includes('duplicate'))
          throw new Error('This email is already on the waitlist.');
        throw new Error('Something went wrong. Please try again.');
      }
      const ok   = $('modal-ok');
      const form = $('waitlist-form');
      if (ok)   ok.removeAttribute('hidden');
      if (form) form.style.display = 'none';
      setTimeout(() => {
        closeModal();
        markJoined();
        fetchCount();
        if (ok)   ok.setAttribute('hidden', '');
        if (form) form.style.display = '';
      }, 2400);
      showToast('Welcome to the waitlist!', 'success');
    } catch (err) {
      if (errEl) errEl.textContent = err.message || 'Something went wrong.';
      showToast(err.message || 'Failed to join.', 'error');
    } finally {
      btn.disabled    = false;
      btn.textContent = 'Join Waitlist';
    }
  });
}

/* ─────────────────────────────────────────────────────────
   THEME  (CSS: data-theme="dark")
   Also updates the interactive image when theme changes.
───────────────────────────────────────────────────────── */
function isDark() {
  return document.documentElement.getAttribute('data-theme') === 'dark';
}

function initTheme() {
  const btn = $('theme-btn');
  if (!btn) return;

  const apply = dark => {
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : '');
    btn.setAttribute('aria-label', dark ? 'Switch to light mode' : 'Switch to dark mode');
    // Reload interactive image for new theme variant
    iappReloadTheme();
  };

  apply(localStorage.getItem('tufn_theme') === 'dark');

  btn.addEventListener('click', () => {
    const dark = isDark();
    apply(!dark);
    localStorage.setItem('tufn_theme', dark ? 'light' : 'dark');
  });
}

/* ─────────────────────────────────────────────────────────
   MOBILE MENU
───────────────────────────────────────────────────────── */
function initMobileMenu() {
  const toggle = $('mobile-toggle');
  const menu   = $('mobile-menu');
  if (!toggle || !menu) return;

  const openMenu  = () => {
    menu.classList.add('open');
    toggle.setAttribute('aria-expanded', 'true');
    document.body.style.overflow = 'hidden';
  };
  const closeMenu = () => {
    menu.classList.remove('open');
    toggle.setAttribute('aria-expanded', 'false');
    document.body.style.overflow = '';
  };

  toggle.addEventListener('click', () =>
    menu.classList.contains('open') ? closeMenu() : openMenu()
  );

  menu.querySelectorAll('.mobile-link').forEach(l => l.addEventListener('click', closeMenu));
  $('mobile-waitlist')?.addEventListener('click', () => { closeMenu(); openModal(); });

  document.addEventListener('click', e => {
    if (menu.classList.contains('open') &&
        !e.target.closest('.header') &&
        !e.target.closest('.mobile-menu')) closeMenu();
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && menu.classList.contains('open')) closeMenu();
  });
}

/* ─────────────────────────────────────────────────────────
   SMOOTH SCROLL
───────────────────────────────────────────────────────── */
function initSmoothScroll() {
  document.querySelectorAll('a[href^="#"]').forEach(a => {
    a.addEventListener('click', e => {
      const id = a.getAttribute('href');
      if (!id || id === '#') return;
      const target = document.querySelector(id);
      if (!target) return;
      e.preventDefault();
      const mm = $('mobile-menu');
      if (mm?.classList.contains('open')) {
        mm.classList.remove('open');
        $('mobile-toggle')?.setAttribute('aria-expanded', 'false');
        document.body.style.overflow = '';
      }
      window.scrollTo({ top: target.getBoundingClientRect().top + window.scrollY - 66, behavior: 'smooth' });
    });
  });
}

/* ─────────────────────────────────────────────────────────
   SCROLL TOP
───────────────────────────────────────────────────────── */
function initScrollTop() {
  const btn = $('scroll-top');
  if (!btn) return;
  let raf = false;
  window.addEventListener('scroll', () => {
    if (raf) return;
    raf = true;
    requestAnimationFrame(() => {
      btn.classList.toggle('show', window.scrollY > 320);
      raf = false;
    });
  }, { passive: true });
  btn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
}

/* ─────────────────────────────────────────────────────────
   FAQ
───────────────────────────────────────────────────────── */
function initFAQ() {
  $$('.faq-item').forEach(item => {
    const btn = item.querySelector('.faq-q');
    const ans = item.querySelector('.faq-a');
    if (!btn || !ans) return;

    btn.addEventListener('click', () => {
      const was = item.classList.contains('open');
      $$('.faq-item').forEach(i => {
        i.classList.remove('open');
        i.querySelector('.faq-q')?.setAttribute('aria-expanded', 'false');
        i.querySelector('.faq-a')?.setAttribute('hidden', '');
      });
      if (!was) {
        item.classList.add('open');
        btn.setAttribute('aria-expanded', 'true');
        ans.removeAttribute('hidden');
      }
    });
  });
}

/* ─────────────────────────────────────────────────────────
   LIGHTBOX
───────────────────────────────────────────────────────── */
function initLightbox() {
  const lb   = $('lightbox');
  const img  = $('lightbox-img');
  const cBtn = $('lightbox-close');
  if (!lb || !img || !cBtn) return;

  const open  = (src, alt) => {
    img.src = src;
    img.alt = alt || 'Screenshot';
    lb.classList.add('open');
    document.body.style.overflow = 'hidden';
    cBtn.focus();
  };
  const close = () => {
    lb.classList.remove('open');
    document.body.style.overflow = '';
    img.src = '';
  };

  cBtn.addEventListener('click', close);
  lb.addEventListener('click', e => { if (e.target === lb) close(); });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && lb.classList.contains('open')) close();
  });

  document.addEventListener('click', e => {
    const el = e.target.closest('[data-lb]');
    if (!el) return;
    const src = el.dataset.lb;
    if (!src || !/^(\.\/)?images\//.test(src)) return;
    open(src, el.dataset.lbAlt || '');
  });
}

/* ═════════════════════════════════════════════════════════
   INTERACTIVE APP PREVIEW
   ─────────────────────────────────────────────────────
   Structure:
     interactive/home_w.png            ← default/dashboard light
     interactive/home_d.png            ← default/dashboard dark
     interactive/<section>/<name>_w.png  ← section light
     interactive/<section>/<name>_d.png  ← section dark

   Suffix: _w = light theme,  _d = dark theme

   Hotspots are defined as % of image width/height so they
   scale perfectly with any resolution.

   HOTSPOT FORMAT (edit freely):
   {
     x: number,     // left edge in % of image width
     y: number,     // top edge in % of image height
     w: number,     // width in %
     h: number,     // height in %
     target: string // section name to navigate to
   }
═════════════════════════════════════════════════════════ */

/* ── IMAGE REGISTRY ──────────────────────────────────── */
const IAPP_BASE = './interactive';

const IAPP_SECTIONS = {
  dashboard: {
    label: 'tufn — dashboard',
    dir: '',
    file: 'home',
    hotspots: [
      { x:0, y:9.4,  w:6.3, h:2.8, target:'dashboard', label:'dashboard' },
      { x:0, y:13.9, w:6.3, h:2.8, target:'notes',     label:'notes' },
      { x:0, y:18.0, w:6.3, h:2.8, target:'canvas',    label:'canvas' },
      { x:0, y:22.2, w:6.3, h:2.8, target:'tasks',     label:'tasks' },
      { x:0, y:26.6, w:6.3, h:2.8, target:'calendar',  label:'calendar' },
      { x:0, y:30.8, w:6.3, h:2.8, target:'timer',     label:'timer' },
    ]
  },
  notes: {
    label: 'tufn — notes',
    dir: 'notes',
    file: 'notes',
    hotspots: [
      { x:0, y:9.4,  w:6.3, h:2.8, target:'dashboard', label:'dashboard' },
      { x:0, y:13.9, w:6.3, h:2.8, target:'notes',     label:'notes' },
      { x:0, y:18.0, w:6.3, h:2.8, target:'canvas',    label:'canvas' },
      { x:0, y:22.2, w:6.3, h:2.8, target:'tasks',     label:'tasks' },
      { x:0, y:26.6, w:6.3, h:2.8, target:'calendar',  label:'calendar' },
      { x:0, y:30.8, w:6.3, h:2.8, target:'timer',     label:'timer' },
    ]
  },
  tasks: {
    label: 'tufn — tasks',
    dir: 'tasks',
    file: 'tasks',
    hotspots: [
      { x:0, y:9.4,  w:6.3, h:2.8, target:'dashboard', label:'dashboard' },
      { x:0, y:13.9, w:6.3, h:2.8, target:'notes',     label:'notes' },
      { x:0, y:18.0, w:6.3, h:2.8, target:'canvas',    label:'canvas' },
      { x:0, y:22.2, w:6.3, h:2.8, target:'tasks',     label:'tasks' },
      { x:0, y:26.6, w:6.3, h:2.8, target:'calendar',  label:'calendar' },
      { x:0, y:30.8, w:6.3, h:2.8, target:'timer',     label:'timer' },
    ]
  },
  canvas: {
    label: 'tufn — canvas',
    dir: 'canvas',
    file: 'canvas',
    hotspots: [
      { x:0, y:9.4,  w:6.3, h:2.8, target:'dashboard', label:'dashboard' },
      { x:0, y:13.9, w:6.3, h:2.8, target:'notes',     label:'notes' },
      { x:0, y:18.0, w:6.3, h:2.8, target:'canvas',    label:'canvas' },
      { x:0, y:22.2, w:6.3, h:2.8, target:'tasks',     label:'tasks' },
      { x:0, y:26.6, w:6.3, h:2.8, target:'calendar',  label:'calendar' },
      { x:0, y:30.8, w:6.3, h:2.8, target:'timer',     label:'timer' },
    ]
  },
  calendar: {
    label: 'tufn — calendar',
    dir: 'calendar',
    file: 'calendar',
    hotspots: [
      { x:0, y:9.4,  w:6.3, h:2.8, target:'dashboard', label:'dashboard' },
      { x:0, y:13.9, w:6.3, h:2.8, target:'notes',     label:'notes' },
      { x:0, y:18.0, w:6.3, h:2.8, target:'canvas',    label:'canvas' },
      { x:0, y:22.2, w:6.3, h:2.8, target:'tasks',     label:'tasks' },
      { x:0, y:26.6, w:6.3, h:2.8, target:'calendar',  label:'calendar' },
      { x:0, y:30.8, w:6.3, h:2.8, target:'timer',     label:'timer' },
    ]
  },
  timer: {
    label: 'tufn — focus timer',
    dir: 'timer',
    file: 'timer',
    hotspots: [
      { x:0, y:9.4,  w:6.3, h:2.8, target:'dashboard', label:'dashboard' },
      { x:0, y:13.9, w:6.3, h:2.8, target:'notes',     label:'notes' },
      { x:0, y:18.0, w:6.3, h:2.8, target:'canvas',    label:'canvas' },
      { x:0, y:22.2, w:6.3, h:2.8, target:'tasks',     label:'tasks' },
      { x:0, y:26.6, w:6.3, h:2.8, target:'calendar',  label:'calendar' },
      { x:0, y:30.8, w:6.3, h:2.8, target:'timer',     label:'timer' },
    ]
  }
};

/* Resolve image path for current section and theme */
function iappImgPath(sectionKey) {
  const s      = IAPP_SECTIONS[sectionKey];
  if (!s) return null;
  const suffix = isDark() ? '_d' : '_w';
  if (s.dir) {
    return `${IAPP_BASE}/${s.dir}/${s.file}${suffix}.png`;
  } else {
    return `${IAPP_BASE}/${s.file}${suffix}.png`;
  }
}

/* ── STATE ───────────────────────────────────────────── */
let iappCurrent    = 'dashboard';
let iappTransiting = false;

/* ── REFS ────────────────────────────────────────────── */
let iappImgEl       = null;
let iappPlaceEl     = null;
let iappChromeLblEl = null;
let iappSpotsEl     = null;

/* ── HOTSPOT RENDERING ───────────────────────────────── */
function renderHotspots(sectionKey) {
  if (!iappSpotsEl) return;
  iappSpotsEl.innerHTML = '';

  const s = IAPP_SECTIONS[sectionKey];
  if (!s || !s.hotspots?.length) return;

  s.hotspots.forEach(spot => {
    const el = document.createElement('button');
    el.className   = 'ispot';
    el.type        = 'button';
    el.title       = spot.label || spot.target;
    el.dataset.target = spot.target;
    el.dataset.label  = spot.label || spot.target;
    el.setAttribute('aria-label', `Navigate to ${spot.label || spot.target}`);

    // Position as % of the image container
    el.style.left   = spot.x + '%';
    el.style.top    = spot.y + '%';
    el.style.width  = spot.w + '%';
    el.style.height = spot.h + '%';

    // No pulse dot — clean hotspots only

    el.addEventListener('click', () => iappNavigate(spot.target));
    el.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); iappNavigate(spot.target); }
    });

    iappSpotsEl.appendChild(el);
  });
}

/* ── NAVIGATE TO SECTION ─────────────────────────────── */
function iappNavigate(sectionKey) {
  if (!IAPP_SECTIONS[sectionKey]) return;
  if (sectionKey === iappCurrent && iappImgEl?.classList.contains('loaded')) return;
  if (iappTransiting) return;

  iappCurrent = sectionKey;
  iappTransiting = true;

  // Update tab bar
  $$('.iapp-tab').forEach(t => {
    const active = t.dataset.section === sectionKey;
    t.classList.toggle('active', active);
    t.setAttribute('aria-selected', String(active));
  });

  // Update chrome label
  const s = IAPP_SECTIONS[sectionKey];
  if (iappChromeLblEl) iappChromeLblEl.textContent = s.label;

  // Fade out image
  if (iappImgEl) {
    iappImgEl.classList.remove('loaded');
  }

  // Load new image after brief fade
  setTimeout(() => {
    const src = iappImgPath(sectionKey);
    if (!src || !iappImgEl) { iappTransiting = false; return; }

    const newImg = new Image();
    newImg.onload = () => {
      iappImgEl.src = src;
      iappImgEl.alt = `Tufn ${sectionKey} view`;

      // Hide placeholder once first image loads
      if (iappPlaceEl) iappPlaceEl.classList.add('hidden');

      // Fade in
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          iappImgEl.classList.add('loaded');
          iappTransiting = false;
        });
      });

      // Render hotspots for this section
      renderHotspots(sectionKey);
    };

    newImg.onerror = () => {
      // Image missing — show placeholder message
      iappImgEl.src = '';
      iappImgEl.classList.remove('loaded');
      if (iappPlaceEl) {
        iappPlaceEl.classList.remove('hidden');
        const span = iappPlaceEl.querySelector('span');
        if (span) span.textContent = `Missing: ${IAPP_SECTIONS[sectionKey]?.dir || ''}/${IAPP_SECTIONS[sectionKey]?.file}${isDark() ? '_d' : '_w'}.png`;
      }
      renderHotspots(sectionKey); // still render spots
      iappTransiting = false;
    };

    newImg.src = src;
  }, 180);
}

/* ── RELOAD ON THEME CHANGE ──────────────────────────── */
function iappReloadTheme() {
  // Re-navigate to current section to pick up _w or _d variant
  if (!iappImgEl) return;
  const cur = iappCurrent;
  iappCurrent = '__force__'; // trick navigator into not short-circuiting
  iappNavigate(cur);
}

/* ── INIT ────────────────────────────────────────────── */
/* ── FULLSCREEN ──────────────────────────────────────────── */
let iappFsOpen = false;
let iappFsCompact = false;

function iappFsRenderSpots(sectionKey) {
  const spotsEl = $('iapp-fs-spots');
  if (!spotsEl) return;
  spotsEl.innerHTML = '';
  const s = IAPP_SECTIONS[sectionKey];
  if (!s || !s.hotspots?.length) return;
  s.hotspots.forEach(spot => {
    const el = document.createElement('button');
    el.className = 'ispot';
    el.type = 'button';
    el.title = spot.label || spot.target;
    el.dataset.label = spot.label || spot.target;
    el.setAttribute('aria-label', `Navigate to ${spot.label || spot.target}`);
    el.style.left   = spot.x + '%';
    el.style.top    = spot.y + '%';
    el.style.width  = spot.w + '%';
    el.style.height = spot.h + '%';
    el.addEventListener('click', () => {
      iappNavigate(spot.target);
      iappFsSync(spot.target);
    });
    spotsEl.appendChild(el);
  });
}

function iappFsSync(sectionKey) {
  const img   = $('iapp-fs-img');
  const lbl   = $('iapp-fs-lbl');
  const s     = IAPP_SECTIONS[sectionKey];
  if (!img || !s) return;
  const suffix = isDark() ? '_d' : '_w';
  const path   = s.dir ? `${IAPP_BASE}/${s.dir}/${s.file}${suffix}.png`
                       : `${IAPP_BASE}/${s.file}${suffix}.png`;
  img.src = path;
  if (lbl) lbl.textContent = s.label;
  iappFsRenderSpots(sectionKey);
}

function iappFsOpen_() {
  const overlay = $('iapp-fs');
  if (!overlay) return;
  overlay.hidden = false;
  document.body.style.overflow = 'hidden';
  iappFsOpen = true;
  iappFsSync(iappCurrent);
}

function iappFsClose() {
  const overlay = $('iapp-fs');
  if (!overlay) return;
  overlay.hidden = true;
  document.body.style.overflow = '';
  iappFsOpen = false;
}

function iappFsToggleSize() {
  const box  = $('iapp-fs-box');
  const icon = $('iapp-fs-resize-icon');
  if (!box) return;
  iappFsCompact = !iappFsCompact;
  box.classList.toggle('compact', iappFsCompact);
  if (icon) {
    if (iappFsCompact) {
      icon.innerHTML = '<path d="M1 6h10M6 1v10" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>';
    } else {
      icon.innerHTML = '<path d="M2 6h8M6 2v8" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>';
    }
  }
}

function initIapp() {
  iappImgEl       = $('iapp-img');
  iappPlaceEl     = $('iapp-placeholder');
  iappChromeLblEl = $('iapp-chrome-lbl');
  iappSpotsEl     = $('iapp-spots');

  if (!iappImgEl) return;

  $$('.iapp-tab').forEach(tab => {
    tab.addEventListener('click', () => iappNavigate(tab.dataset.section));
  });

  // Expand buttons
  $('iapp-expand')?.addEventListener('click', iappFsOpen_);
  $('iapp-expand2')?.addEventListener('click', iappFsOpen_);

  // Fullscreen controls
  $('iapp-fs-close')?.addEventListener('click', iappFsClose);
  $('iapp-fs-resize')?.addEventListener('click', iappFsToggleSize);

  // Close on backdrop click
  $('iapp-fs')?.addEventListener('click', e => {
    if (e.target === $('iapp-fs')) iappFsClose();
  });

  // Escape key
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && iappFsOpen) iappFsClose();
  });

  iappNavigate('dashboard');
}

/* ─────────────────────────────────────────────────────────
   VERSION GALLERY (screenshots section)
───────────────────────────────────────────────────────── */
const IMGS_BASE = './images';

const VERSION_REGISTRY = [
  {
    version: 'A0.0.1',
    date: '2025-10-14',
    title: 'Foundation',
    description: 'Initial build: Notes, Canvas, Tasklist, and Dashboard integration. Core architecture established.',
    images: ['img.png'],
    changes: ['Core architecture','Notes panel','Task list','Canvas drawing','Dashboard']
  },
  {
    version: 'A0.0.5',
    date: '2026-02-12',
    title: 'Polish & Timer',
    description: 'Reimagined UI overhaul, built-in Pomodoro timer, calendar rendering fix, task completion bug fixes, and performance improvements.',
    images: ['img.png'],
    changes: ['UI overhaul','Pomodoro timer','Calendar fixes','Bug fixes','Dark mode']
  }
];

function imgPath(ver, name) { return `${IMGS_BASE}/${ver}/${name}`; }
function colCls(n) { return n === 1 ? 'c1' : n === 2 ? 'c2' : ''; }

function makeShotEl(src, alt, cls) {
  const div       = document.createElement('div');
  div.className   = cls;
  div.dataset.lb    = src;
  div.dataset.lbAlt = alt;
  div.tabIndex    = 0;
  div.setAttribute('role', 'button');
  div.setAttribute('aria-label', 'View screenshot fullscreen');
  const img   = document.createElement('img');
  img.src     = src;
  img.alt     = alt;
  img.loading = 'lazy';
  div.appendChild(img);
  return div;
}

function initVersionGallery() {
  const shotsGrid  = $('shots-grid');
  const shotsMeta  = $('shots-meta');
  const chipWrap   = $('ver-chip-wrap');
  const verTabs    = $('ver-tabs');
  const verGallery = $('ver-gallery');

  if (!shotsGrid) return;

  const all = VERSION_REGISTRY.map(meta => ({
    meta,
    images: (meta.images || []).map(n => imgPath(meta.version, n))
  }));

  if (!all.length) {
    shotsGrid.innerHTML = '<div class="shots-no-img">No screenshots yet.</div>';
    return;
  }

  const latest = all[all.length - 1];

  // Chip
  if (chipWrap) {
    chipWrap.innerHTML = `<div class="ver-chip"><strong>${sec.esc(latest.meta.version)}</strong><span> — </span><span>${sec.esc(latest.meta.title)}</span></div>`;
  }

  // Latest shots grid
  shotsGrid.className  = `shots-grid ${colCls(latest.images.length)}`;
  shotsGrid.innerHTML  = '';
  if (latest.images.length) {
    latest.images.forEach(src => shotsGrid.appendChild(makeShotEl(src, `Tufn ${latest.meta.version}`, 'shot-item')));
  } else {
    shotsGrid.innerHTML = '<div class="shots-no-img">No screenshots yet.</div>';
  }

  // Meta row
  if (shotsMeta) {
    const tags = (latest.meta.changes || []).slice(0, 5)
      .map(c => `<span class="meta-tag">${sec.esc(c)}</span>`).join('');
    shotsMeta.innerHTML = `
      <div class="meta-ver">${sec.esc(latest.meta.version)} · ${sec.esc(latest.meta.date || '')}</div>
      <div class="meta-desc">${sec.esc(latest.meta.description || '')}</div>
      <div class="meta-tags">${tags}</div>
    `;
  }

  // Version tabs
  if (!verTabs || !verGallery) return;

  verTabs.innerHTML = '';
  all.forEach((v, i) => {
    const btn = document.createElement('button');
    btn.className = 'ver-tab' + (i === all.length - 1 ? ' active' : '');
    btn.textContent = v.meta.version;
    btn.setAttribute('role', 'tab');
    btn.setAttribute('aria-selected', String(i === all.length - 1));
    btn.dataset.idx = i;
    btn.type = 'button';
    verTabs.appendChild(btn);
  });

  function renderPanel(idx) {
    const v = all[idx];
    verGallery.innerHTML = '';
    const panel = document.createElement('div');
    panel.className = 'ver-panel active';

    const head = document.createElement('div');
    head.className = 'ver-head';
    head.innerHTML = `
      <div>
        <div class="ver-title">${sec.esc(v.meta.version)} — ${sec.esc(v.meta.title)}</div>
        <div class="ver-desc">${sec.esc(v.meta.description || '')}</div>
      </div>
      <div class="ver-date">${sec.esc(v.meta.date || '')}</div>
    `;
    panel.appendChild(head);

    const grid = document.createElement('div');
    grid.className = `ver-grid ${colCls(v.images.length)}`;
    if (v.images.length) {
      v.images.forEach(src => grid.appendChild(makeShotEl(src, `${v.meta.version} screenshot`, 'ver-item')));
    } else {
      grid.innerHTML = '<div class="ver-noimg">No screenshots for this version yet.</div>';
    }
    panel.appendChild(grid);
    verGallery.appendChild(panel);
  }

  renderPanel(all.length - 1);

  verTabs.addEventListener('click', e => {
    const btn = e.target.closest('.ver-tab');
    if (!btn) return;
    $$('.ver-tab').forEach(t => {
      t.classList.remove('active');
      t.setAttribute('aria-selected', 'false');
    });
    btn.classList.add('active');
    btn.setAttribute('aria-selected', 'true');
    renderPanel(parseInt(btn.dataset.idx, 10));
  });
}

/* ─────────────────────────────────────────────────────────
   SECURITY CLEANUP
───────────────────────────────────────────────────────── */
function cleanupSec() {
  const now = Date.now();
  for (const [k,v] of sec.rateMap) if (!v.some(t => now-t < 600_000)) sec.rateMap.delete(k);
  for (const [k,v] of sec.reqMap)  if (!v.some(t => now-t < 300_000)) sec.reqMap.delete(k);
  const ts = parseInt(localStorage.getItem('tufn_fp_ts') || '0', 10);
  if (ts && now - ts > 30*24*3600*1000) {
    localStorage.removeItem('tufn_fp');
    localStorage.removeItem('tufn_fp_ts');
  }
}

function waitForDB(cb, tries = 15) {
  if (db) { cb(); return; }
  if (tries <= 0) return;
  setTimeout(() => waitForDB(cb, tries - 1), 300);
}

/* ─────────────────────────────────────────────────────────
   BOOT
───────────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  initDB();
  initTheme();        // sets theme first (needed by iapp)
  initMobileMenu();
  initSmoothScroll();
  initScrollTop();
  initFAQ();
  initLightbox();
  initVersionGallery();
  initWaitlist();
  initIapp();         // must come after initTheme

  waitForDB(() => {
    fetchCount();
    initRealtime();
    setInterval(fetchCount, 60_000);
  });

  setInterval(cleanupSec, 300_000);
});

window.addEventListener('beforeunload', () => {
  try { if (rtChannel && db) db.removeChannel(rtChannel); } catch {}
  sec.rateMap.clear();
  sec.reqMap.clear();
});