'use strict';

const SB_URL = "https://xuqtcfdpjpyinmvjsazq.supabase.co";
const SB_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh1cXRjZmRwanB5aW5tdmpzYXpxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA3MzIyNzksImV4cCI6MjA4NjMwODI3OX0.oB_PN-qq7o_KePypNvBeMGnIvisXOVpOu2e7WF-HXYA";
let db = null;

function initDB() {
  if (typeof window.supabase === 'undefined') return;
  try {
    db = window.supabase.createClient(SB_URL, SB_KEY, {
      auth: { persistSession: false }
    });
  } catch(e) { console.warn('Supabase init failed:', e.message); }
}

function waitForDB(cb, tries = 20) {
  if (typeof window.supabase !== 'undefined') { initDB(); cb(); return; }
  if (tries <= 0) return;
  setTimeout(() => waitForDB(cb, tries - 1), 200);
}

const $  = id  => document.getElementById(id);
const $$ = sel => document.querySelectorAll(sel);

let toastTimer = null;
function showToast(msg, type) {
  const el = $('toast');
  if (!el) return;
  el.textContent = msg;
  el.className = 'toast show' + (type === 'success' ? ' ok' : type === 'error' ? ' err' : '');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 3400);
}

function isDark() {
  return document.documentElement.getAttribute('data-theme') === 'dark';
}

function initTheme() {
  const btn = $('theme-btn');
  if (!btn) return;
  const apply = dark => {
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : '');
    btn.setAttribute('aria-label', dark ? 'Switch to light mode' : 'Switch to dark mode');
    iappReloadTheme();
  };
  apply(localStorage.getItem('tufn_theme') === 'dark');
  btn.addEventListener('click', () => {
    const dark = isDark();
    apply(!dark);
    localStorage.setItem('tufn_theme', dark ? 'light' : 'dark');
  });
}

function initMobileMenu() {
  const toggle = $('mobile-toggle');
  const menu   = $('mobile-menu');
  if (!toggle || !menu) return;
  const openMenu  = () => { menu.classList.add('open'); toggle.setAttribute('aria-expanded', 'true'); document.body.style.overflow = 'hidden'; };
  const closeMenu = () => { menu.classList.remove('open'); toggle.setAttribute('aria-expanded', 'false'); document.body.style.overflow = ''; };
  toggle.addEventListener('click', () => menu.classList.contains('open') ? closeMenu() : openMenu());
  menu.querySelectorAll('.mobile-link').forEach(l => l.addEventListener('click', closeMenu));
  document.addEventListener('click', e => {
    if (menu.classList.contains('open') && !e.target.closest('.header') && !e.target.closest('.mobile-menu')) closeMenu();
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && menu.classList.contains('open')) closeMenu();
  });
}

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

function initScrollTop() {
  const btn = $('scroll-top');
  if (!btn) return;
  let raf = false;
  window.addEventListener('scroll', () => {
    if (raf) return;
    raf = true;
    requestAnimationFrame(() => { btn.classList.toggle('show', window.scrollY > 320); raf = false; });
  }, { passive: true });
  btn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
}

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

function initLightbox() {
  const lb   = $('lightbox');
  const img  = $('lightbox-img');
  const cBtn = $('lightbox-close');
  if (!lb || !img || !cBtn) return;
  const open  = (src, alt) => { img.src = src; img.alt = alt || 'Screenshot'; lb.classList.add('open'); document.body.style.overflow = 'hidden'; cBtn.focus(); };
  const close = () => { lb.classList.remove('open'); document.body.style.overflow = ''; img.src = ''; };
  cBtn.addEventListener('click', close);
  lb.addEventListener('click', e => { if (e.target === lb) close(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && lb.classList.contains('open')) close(); });
  document.addEventListener('click', e => {
    const el = e.target.closest('[data-lb]');
    if (!el) return;
    const src = el.dataset.lb;
    if (!src || !/^(\.\/)?images\//.test(src)) return;
    open(src, el.dataset.lbAlt || '');
  });
}

const DL_PLATFORMS = ['windows', 'mac', 'linux'];

const DL_RELEASE_URLS = {
  linux:   'https://github.com/tufn/tufn.github.io/releases/download/0.0.6/Tufn-0.0.6.AppImage',
  windows: 'https://github.com/tufn/tufn.github.io/releases/download/0.0.6/Tufn.Setup.0.0.6.exe'
};

let dlPendingPlatform = null;
let dlPendingManifest = null;
let dlDonationsData   = null;
let dlEmailPlatform   = null;

function fmtBytes(b) {
  if (!b || b <= 0) return '';
  const mb = b / (1024 * 1024);
  return mb >= 1 ? mb.toFixed(1) + ' MB' : (b / 1024).toFixed(0) + ' KB';
}

function fmtUSD(n) {
  return '$' + n.toLocaleString('en-US', { maximumFractionDigits: 0 });
}

function triggerDownload(url, filename) {
  const a = document.createElement('a');
  a.href = url;
  a.download = filename || '';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

async function fetchDownloadCount() {
  if (!db) return null;
  try {
    const { data, error } = await db.rpc('get_download_count');
    return (!error && typeof data === 'number') ? data : null;
  } catch { return null; }
}

async function insertDownload(email, os) {
  if (!db) return false;
  try {
    const { error } = await db.from('downloads').insert({ email, os });
    return !error;
  } catch { return false; }
}

function openEmailModal() {
  dlEmailPlatform = dlPendingPlatform;
  const overlay = $('dl-email-modal');
  if (!overlay) return;
  const input = $('dl-email-input');
  const errEl = $('dl-email-error');
  const btn   = $('dl-email-submit');
  if (input) input.value = '';
  if (errEl) errEl.textContent = '';
  if (btn)   { btn.disabled = false; btn.textContent = 'Download'; }
  overlay.classList.add('open');
  document.body.style.overflow = 'hidden';
  setTimeout(() => input?.focus(), 80);
}

function closeEmailModal() {
  const overlay = $('dl-email-modal');
  if (!overlay) return;
  overlay.classList.remove('open');
  document.body.style.overflow = '';
}

function initEmailModal() {
  $('dl-email-close')?.addEventListener('click', closeEmailModal);
  $('dl-email-modal')?.addEventListener('click', e => { if (e.target === $('dl-email-modal')) closeEmailModal(); });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && $('dl-email-modal')?.classList.contains('open')) closeEmailModal();
  });

  $('dl-email-submit')?.addEventListener('click', async () => {
    const input = $('dl-email-input');
    const errEl = $('dl-email-error');
    const btn   = $('dl-email-submit');
    const email = (input?.value || '').trim();

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      if (errEl) errEl.textContent = 'Please enter a valid email address.';
      input?.focus();
      return;
    }

    if (errEl) errEl.textContent = '';
    if (btn)   { btn.disabled = true; btn.textContent = 'Downloading…'; }

    await insertDownload(email, dlEmailPlatform);

    closeEmailModal();
    setTimeout(executePendingDownload, 120);

    fetchDownloadCount().then(count => {
      const el = $('stat-downloads');
      if (el && count !== null) el.textContent = count > 999 ? (count / 1000).toFixed(1) + 'k' : String(count);
    });
  });
}

async function loadManifest(platform) {
  try {
    const r = await fetch('downloads/' + platform + '/manifest.json', { cache: 'no-cache' });
    if (!r.ok) return null;
    return await r.json();
  } catch { return null; }
}

async function loadDonations() {
  try {
    const r = await fetch('donations.json', { cache: 'no-cache' });
    if (!r.ok) return null;
    return await r.json();
  } catch { return null; }
}

const PRICE_CACHE_TTL = 5 * 60 * 1000;
const COINBASE_IDS = { btc: 'BTC', eth: 'ETH', ltc: 'LTC' };

async function fetchCoinPrice(coin) {
  const cacheKey = 'tufn_price_' + coin;
  try {
    const cached = JSON.parse(localStorage.getItem(cacheKey) || 'null');
    if (cached && Date.now() - cached.ts < PRICE_CACHE_TTL) return cached.price;
  } catch {}
  try {
    const sym = COINBASE_IDS[coin];
    if (!sym) return null;
    const r = await fetch('https://api.coinbase.com/v2/prices/' + sym + '-USD/spot');
    if (!r.ok) return null;
    const d = await r.json();
    const price = parseFloat(d?.data?.amount);
    if (isNaN(price)) return null;
    try { localStorage.setItem(cacheKey, JSON.stringify({ price, ts: Date.now() })); } catch {}
    return price;
  } catch { return null; }
}

async function fetchBTCReceived(addr) {
  try {
    const r = await fetch('https://blockchain.info/q/getreceivedbyaddress/' + addr + '?confirmations=1', { cache: 'no-cache' });
    if (!r.ok) return 0;
    const satoshis = parseFloat(await r.text());
    return isNaN(satoshis) ? 0 : satoshis / 1e8;
  } catch { return 0; }
}

async function fetchETHReceived(addr) {
  try {
    const r = await fetch(
      'https://api.etherscan.io/api?module=account&action=txlist&address=' + addr +
      '&startblock=0&endblock=99999999&sort=asc&apikey=YourApiKeyToken',
      { cache: 'no-cache' }
    );
    if (!r.ok) return 0;
    const d = await r.json();
    if (d.status !== '1' || !Array.isArray(d.result)) return 0;
    const total = d.result
      .filter(tx => tx.to?.toLowerCase() === addr.toLowerCase() && tx.isError === '0')
      .reduce((sum, tx) => sum + parseFloat(tx.value) / 1e18, 0);
    return total;
  } catch { return 0; }
}

async function fetchLTCReceived(addr) {
  try {
    const r = await fetch('https://api.blockcypher.com/v1/ltc/main/addrs/' + addr + '/balance', { cache: 'no-cache' });
    if (!r.ok) return 0;
    const d = await r.json();
    return ((d.total_received || 0)) / 1e8;
  } catch { return 0; }
}

async function calcTotalUSD(wallets) {
  const coins = Object.keys(wallets).filter(c => wallets[c] && !wallets[c].includes('YOUR_'));
  if (!coins.length) return 0;

  const fetchers = {
    btc: addr => fetchBTCReceived(addr),
    eth: addr => fetchETHReceived(addr),
    ltc: addr => fetchLTCReceived(addr)
  };

  const results = await Promise.allSettled(
    coins.map(async coin => {
      const [amount, price] = await Promise.all([
        fetchers[coin] ? fetchers[coin](wallets[coin]) : Promise.resolve(0),
        fetchCoinPrice(coin)
      ]);
      return (amount || 0) * (price || 0);
    })
  );

  return results.reduce((sum, r) => sum + (r.status === 'fulfilled' ? r.value : 0), 0);
}

function animateCount(el, target, formatter) {
  if (!el) return;
  const duration = 1000;
  const start = performance.now();
  const step = ts => {
    const p    = Math.min((ts - start) / duration, 1);
    const ease = 1 - Math.pow(1 - p, 3);
    el.textContent = formatter(Math.round(ease * target));
    if (p < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

function animateBar(el, pct) {
  if (!el) return;
  el.style.transition = 'none';
  el.style.width = '0%';
  requestAnimationFrame(() => requestAnimationFrame(() => {
    el.style.transition = 'width 1.1s cubic-bezier(.2,.8,.3,1)';
    el.style.width = Math.min(pct, 100) + '%';
  }));
}

function setDlCardLoaded(platform, manifest) {
  const fnEl = $('dlf-' + platform);
  const szEl = $('dls-' + platform);
  const btn  = document.querySelector('.dl-btn[data-platform="' + platform + '"]');
  if (fnEl) fnEl.textContent = manifest.file || '—';
  if (szEl) szEl.textContent = manifest.size_bytes ? fmtBytes(manifest.size_bytes) : '';
  if (manifest.sha1) {
    const hashRow = $('dlh-' + platform);
    const hashVal = $('dlhv-' + platform);
    if (hashRow) hashRow.hidden = false;
    if (hashVal) hashVal.textContent = manifest.sha1;
  }
  if (btn) btn.disabled = false;
}

function setDlCardError(platform) {
  const fnEl = $('dlf-' + platform);
  const szEl = $('dls-' + platform);
  if (fnEl) fnEl.textContent = 'Not available';
  if (szEl) szEl.textContent = '';
}

function openDonationModal(platform, manifest) {
  dlPendingPlatform = platform;
  dlPendingManifest = manifest;

  const overlay = $('dl-modal');
  if (!overlay) return;

  const raisedEl  = $('dm-raised');
  const barEl     = $('dm-bar');
  const targetLbl = $('dm-target-lbl');
  const liveEl    = $('dm-live');

  if (raisedEl)  raisedEl.textContent  = '…';
  if (barEl)     barEl.style.width     = '0%';
  if (liveEl)    liveEl.style.opacity  = '0';

  overlay.classList.add('open');
  document.body.style.overflow = 'hidden';

  loadDonations().then(async data => {
    dlDonationsData = data;
    if (!data) return;

    const wallets = data.wallets || {};
    const target  = Number(data.target) || 500;

    if (targetLbl) targetLbl.textContent = 'of ' + fmtUSD(target) + ' goal';

    ['btc', 'eth', 'ltc'].forEach(coin => {
      const el = $('da-' + coin);
      if (el && wallets[coin] && !wallets[coin].includes('YOUR_')) {
        el.textContent = wallets[coin];
      } else if (el) {
        el.textContent = 'not configured';
        const panel = $('dp-' + coin);
        const tab   = document.querySelector('.dl-coin-tab[data-coin="' + coin + '"]');
        if (panel) panel.style.opacity = '0.4';
        if (tab)   tab.style.opacity   = '0.4';
      }
    });

    const usd = await calcTotalUSD(wallets);
    const pct = target > 0 ? (usd / target) * 100 : 0;

    if (usd === null || usd === 0) {
      if (raisedEl) raisedEl.textContent = '—';
    } else {
      animateCount(raisedEl, Math.round(usd), n => fmtUSD(n));
    }
    animateBar(barEl, pct);
    if (liveEl) liveEl.style.opacity = '1';
  });
}

function closeDonationModal() {
  const overlay = $('dl-modal');
  if (!overlay) return;
  overlay.classList.remove('open');
  document.body.style.overflow = '';
}

function executePendingDownload() {
  if (!dlPendingManifest || !dlPendingPlatform) return;
  const releaseUrl = DL_RELEASE_URLS[dlPendingPlatform];
  const url = releaseUrl || ('downloads/' + dlPendingPlatform + '/' + dlPendingManifest.file);
  triggerDownload(url, dlPendingManifest.file);
  const btn = document.querySelector('.dl-btn[data-platform="' + dlPendingPlatform + '"]');
  if (btn) {
    const orig = btn.innerHTML;
    btn.innerHTML = '<svg aria-hidden="true" width="14" height="14" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg> Downloading…';
    setTimeout(() => { btn.innerHTML = orig; }, 3000);
  }
  const nudge = $('dln-' + dlPendingPlatform);
  if (nudge) nudge.hidden = false;
  dlPendingPlatform = null;
  dlPendingManifest = null;
}

function initDownloads() {
  DL_PLATFORMS.forEach(async platform => {
    const manifest = await loadManifest(platform);
    if (manifest && manifest.file) setDlCardLoaded(platform, manifest);
    else setDlCardError(platform);
  });

  fetchDownloadCount().then(count => {
    const el = $('stat-downloads');
    if (el && count !== null) el.textContent = count > 999 ? (count / 1000).toFixed(1) + 'k' : String(count);
  });

  document.addEventListener('click', e => {
    const btn = e.target.closest('.dl-btn');
    if (!btn || btn.disabled) return;
    const platform = btn.dataset.platform;
    loadManifest(platform).then(manifest => {
      if (!manifest || !manifest.file) { showToast('File not found. Try again later.', 'error'); return; }
      openDonationModal(platform, manifest);
    });
  });

  $('dl-modal-close')?.addEventListener('click', closeDonationModal);
  $('dl-modal')?.addEventListener('click', e => { if (e.target === $('dl-modal')) closeDonationModal(); });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && $('dl-modal')?.classList.contains('open')) closeDonationModal();
  });

  $('dl-modal-skip')?.addEventListener('click', () => {
    closeDonationModal();
    setTimeout(openEmailModal, 120);
  });

  $$('.dl-coin-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      $$('.dl-coin-tab').forEach(t => t.classList.remove('active'));
      $$('.dl-wallet-panel').forEach(p => p.classList.remove('active'));
      tab.classList.add('active');
      const panel = $('dp-' + tab.dataset.coin);
      if (panel) panel.classList.add('active');
    });
  });

  document.addEventListener('click', e => {
    const btn = e.target.closest('.dl-addr-copy');
    if (!btn) return;
    const el = $(btn.dataset.addr);
    if (!el || el.textContent === '—' || el.textContent === 'not configured') return;
    navigator.clipboard.writeText(el.textContent).then(() => {
      showToast('Address copied to clipboard', 'success');
    }).catch(() => {
      showToast('Could not copy to clipboard', 'error');
    });
  });

  $$('.dl-copy-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const el = $(btn.dataset.copy);
      if (!el || !el.textContent || el.textContent === '—') return;
      navigator.clipboard.writeText(el.textContent).then(() => {
        showToast('SHA-1 copied to clipboard', 'success');
      }).catch(() => {
        showToast('Could not copy to clipboard', 'error');
      });
    });
  });

  initEmailModal();

  document.addEventListener('click', e => {
    const a = e.target.closest('[data-action="open-donation"]');
    if (!a) return;
    e.preventDefault();
    loadDonations().then(data => {
      const platform = dlPendingPlatform || DL_PLATFORMS[0];
      loadManifest(platform).then(manifest => {
        openDonationModal(platform, manifest || {});
      });
    });
  });
}

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

function iappImgPath(sectionKey) {
  const s = IAPP_SECTIONS[sectionKey];
  if (!s) return null;
  const suffix = isDark() ? '_d' : '_w';
  return s.dir ? `${IAPP_BASE}/${s.dir}/${s.file}${suffix}.png` : `${IAPP_BASE}/${s.file}${suffix}.png`;
}

let iappCurrent    = 'dashboard';
let iappTransiting = false;
let iappImgEl       = null;
let iappPlaceEl     = null;
let iappChromeLblEl = null;
let iappSpotsEl     = null;

function renderHotspots(sectionKey) {
  if (!iappSpotsEl) return;
  iappSpotsEl.innerHTML = '';
  const s = IAPP_SECTIONS[sectionKey];
  if (!s || !s.hotspots?.length) return;
  s.hotspots.forEach(spot => {
    const el = document.createElement('button');
    el.className = 'ispot';
    el.type = 'button';
    el.title = spot.label || spot.target;
    el.dataset.target = spot.target;
    el.dataset.label  = spot.label || spot.target;
    el.setAttribute('aria-label', `Navigate to ${spot.label || spot.target}`);
    el.style.left   = spot.x + '%';
    el.style.top    = spot.y + '%';
    el.style.width  = spot.w + '%';
    el.style.height = spot.h + '%';
    el.addEventListener('click', () => iappNavigate(spot.target));
    el.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); iappNavigate(spot.target); } });
    iappSpotsEl.appendChild(el);
  });
}

function iappNavigate(sectionKey) {
  if (!IAPP_SECTIONS[sectionKey]) return;
  if (sectionKey === iappCurrent && iappImgEl?.classList.contains('loaded')) return;
  if (iappTransiting) return;

  iappCurrent = sectionKey;
  iappTransiting = true;

  $$('.iapp-tab').forEach(t => {
    const active = t.dataset.section === sectionKey;
    t.classList.toggle('active', active);
    t.setAttribute('aria-selected', String(active));
  });

  const s = IAPP_SECTIONS[sectionKey];
  if (iappChromeLblEl) iappChromeLblEl.textContent = s.label;
  if (iappImgEl) iappImgEl.classList.remove('loaded');

  setTimeout(() => {
    const src = iappImgPath(sectionKey);
    if (!src || !iappImgEl) { iappTransiting = false; return; }

    const newImg = new Image();
    newImg.onload = () => {
      iappImgEl.src = src;
      iappImgEl.alt = `Tufn ${sectionKey} view`;
      if (iappPlaceEl) iappPlaceEl.classList.add('hidden');
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          iappImgEl.classList.add('loaded');
          iappTransiting = false;
        });
      });
      renderHotspots(sectionKey);
    };
    newImg.onerror = () => {
      iappImgEl.src = '';
      iappImgEl.classList.remove('loaded');
      if (iappPlaceEl) {
        iappPlaceEl.classList.remove('hidden');
        const span = iappPlaceEl.querySelector('span');
        if (span) span.textContent = `Missing: ${IAPP_SECTIONS[sectionKey]?.dir || ''}/${IAPP_SECTIONS[sectionKey]?.file}${isDark() ? '_d' : '_w'}.png`;
      }
      renderHotspots(sectionKey);
      iappTransiting = false;
    };
    newImg.src = src;
  }, 180);
}

function iappReloadTheme() {
  if (!iappImgEl) return;
  const cur = iappCurrent;
  iappCurrent = '__force__';
  iappNavigate(cur);
}

let iappFsOpen    = false;
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
    el.addEventListener('click', () => { iappNavigate(spot.target); iappFsSync(spot.target); });
    spotsEl.appendChild(el);
  });
}

function iappFsSync(sectionKey) {
  const img = $('iapp-fs-img');
  const lbl = $('iapp-fs-lbl');
  const s   = IAPP_SECTIONS[sectionKey];
  if (!img || !s) return;
  const suffix = isDark() ? '_d' : '_w';
  const path   = s.dir ? `${IAPP_BASE}/${s.dir}/${s.file}${suffix}.png` : `${IAPP_BASE}/${s.file}${suffix}.png`;
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
    icon.innerHTML = iappFsCompact
      ? '<path d="M1 6h10M6 1v10" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>'
      : '<path d="M2 6h8M6 2v8" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>';
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

  $('iapp-expand')?.addEventListener('click', iappFsOpen_);
  $('iapp-expand2')?.addEventListener('click', iappFsOpen_);
  $('iapp-fs-close')?.addEventListener('click', iappFsClose);
  $('iapp-fs-resize')?.addEventListener('click', iappFsToggleSize);
  $('iapp-fs')?.addEventListener('click', e => { if (e.target === $('iapp-fs')) iappFsClose(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && iappFsOpen) iappFsClose(); });

  iappNavigate('dashboard');
}

const IMP_LABELS = ['cosmetic','cosmetic','minor','minor','notable','notable','significant','significant','major','critical','critical'];
const IMP_COLORS = ['#4caf87','#4caf87','#7cb87a','#a8c46a','#d4b84a','#e8a030','#e07830','#d05030','#c03030','#a01818','#7a0a0a'];

const RP_SPAM = [
  /(.)\1{9,}/,
  /https?:\/\//i,
  /\b(viagra|casino|lottery|winner|congratulations|click here|free money)\b/i,
  /[^\x00-\x7F]{20,}/
];

const RP_MAX_PER_DAY  = 3;
const RP_COOLDOWN_MS  = 60_000;
const RP_MIN_AGE_MS   = 6_000;
const RP_MIN_LEN      = 20;
const RP_MAX_LEN      = 2000;

let rpPageLoadTime = Date.now();
let rpPending = false;

function rpGetFP() {
  let fp = localStorage.getItem('tufn_fp');
  if (!fp) { fp = crypto.randomUUID(); localStorage.setItem('tufn_fp', fp); }
  return fp;
}

function rpGetHistory() {
  try { return JSON.parse(localStorage.getItem('tufn_rp_hist') || '[]'); } catch { return []; }
}

function rpSaveHistory(hist) {
  localStorage.setItem('tufn_rp_hist', JSON.stringify(hist));
}

function rpPruneHistory() {
  const day = Date.now() - 86_400_000;
  const hist = rpGetHistory().filter(t => t > day);
  rpSaveHistory(hist);
  return hist;
}

function rpRemainingToday() {
  return Math.max(0, RP_MAX_PER_DAY - rpPruneHistory().length);
}

function rpLastSubmit() {
  const hist = rpGetHistory();
  return hist.length ? Math.max(...hist) : 0;
}

function rpUpdateLimitNote() {
  const el = $('rp-limit-note');
  if (!el) return;
  const rem = rpRemainingToday();
  el.textContent = rem === RP_MAX_PER_DAY ? '' : rem === 0 ? 'Daily limit reached.' : rem + ' report' + (rem === 1 ? '' : 's') + ' left today.';
}

function rpSetError(msg) {
  const el = $('rp-error');
  if (el) el.textContent = msg;
}

function rpCheckSpam(text) {
  return RP_SPAM.some(re => re.test(text));
}

function rpImpLabel(v) {
  return v + ' — ' + IMP_LABELS[v];
}

function openReportModal() {
  const overlay = $('rp-modal');
  if (!overlay) return;
  rpPageLoadTime = rpPageLoadTime || Date.now();
  overlay.classList.add('open');
  document.body.style.overflow = 'hidden';
  rpUpdateLimitNote();
  rpSetError('');
  $('rp-ok')?.setAttribute('hidden', '');
  const fw = $('rp-form-wrap');
  if (fw) fw.style.display = '';
  setTimeout(() => $('rp-text')?.focus(), 80);
}

function closeReportModal() {
  const overlay = $('rp-modal');
  if (!overlay) return;
  overlay.classList.remove('open');
  document.body.style.overflow = '';
}

function initReport() {
  $('nav-report')?.addEventListener('click', openReportModal);
  $('mobile-report')?.addEventListener('click', () => { closeReportModal(); openReportModal(); });
  $('rp-modal-close')?.addEventListener('click', closeReportModal);
  $('rp-modal')?.addEventListener('click', e => { if (e.target === $('rp-modal')) closeReportModal(); });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && $('rp-modal')?.classList.contains('open')) closeReportModal();
  });

  const slider  = $('rp-imp');
  const impLbl  = $('rp-imp-label');
  const textarea = $('rp-text');
  const charEl  = $('rp-chars');

  if (slider && impLbl) {
    const updateSlider = () => {
      const v = parseInt(slider.value);
      impLbl.textContent = rpImpLabel(v);
      impLbl.style.color = IMP_COLORS[v];
      slider.style.setProperty('--rp-fill', IMP_COLORS[v]);
      slider.style.setProperty('--rp-pct', (v / 10 * 100) + '%');
    };
    slider.addEventListener('input', updateSlider);
    updateSlider();
  }

  if (textarea && charEl) {
    textarea.addEventListener('input', () => {
      charEl.textContent = textarea.value.length;
    });
  }

  $('rp-submit')?.addEventListener('click', async () => {
    if (rpPending) return;

    rpSetError('');

    if ($('rp-trap')?.value) return;

    const age = Date.now() - rpPageLoadTime;
    if (age < RP_MIN_AGE_MS) {
      rpSetError('Too fast — please wait a moment.');
      return;
    }

    const sinceLastMs = Date.now() - rpLastSubmit();
    if (sinceLastMs < RP_COOLDOWN_MS) {
      const secs = Math.ceil((RP_COOLDOWN_MS - sinceLastMs) / 1000);
      rpSetError('Please wait ' + secs + 's before submitting another report.');
      return;
    }

    const rem = rpRemainingToday();
    if (rem <= 0) {
      rpSetError('Daily limit of ' + RP_MAX_PER_DAY + ' reports reached. Try again tomorrow.');
      return;
    }

    const text = (textarea?.value || '').trim();
    if (text.length < RP_MIN_LEN) {
      rpSetError('Description too short — please add at least ' + RP_MIN_LEN + ' characters.');
      textarea?.focus();
      return;
    }
    if (text.length > RP_MAX_LEN) {
      rpSetError('Description too long (max ' + RP_MAX_LEN + ' chars).');
      return;
    }

    if (rpCheckSpam(text)) {
      rpSetError('Report flagged as spam. If this is a mistake, email us directly.');
      return;
    }

    const versionRaw = $('rp-version')?.value || '1.0.0';
    const imp        = parseInt(slider?.value || '5');
    const fp         = rpGetFP();

    if (!db) {
      rpSetError('Service unavailable — try again in a moment.');
      waitForDB(() => {});
      return;
    }

    rpPending = true;
    const btn = $('rp-submit');
    const origText = btn?.textContent;
    if (btn) { btn.disabled = true; btn.textContent = 'Submitting…'; }

    try {
      const os = dlEmailPlatform || null;
      const { error } = await db.from('reports').insert({
        report:  text,
        version: { version: versionRaw },
        imp:     imp,
        fp:      fp.slice(0, 16),
        os:      os
      });

      if (error) throw new Error(error.message || 'Submission failed.');

      const hist = rpGetHistory();
      hist.push(Date.now());
      rpSaveHistory(hist);

      $('rp-ok')?.removeAttribute('hidden');
      const fw = $('rp-form-wrap');
      if (fw) fw.style.display = 'none';
      showToast('Report submitted — thank you!', 'success');

      setTimeout(closeReportModal, 2800);

    } catch(err) {
      rpSetError(err.message || 'Something went wrong.');
    } finally {
      rpPending = false;
      if (btn) { btn.disabled = false; btn.textContent = origText; }
      rpUpdateLimitNote();
    }
  });
}

document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  initMobileMenu();
  initSmoothScroll();
  initScrollTop();
  initFAQ();
  initLightbox();
  initIapp();
  waitForDB(() => { initDownloads(); initReport(); });
});
