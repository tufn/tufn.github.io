const SB_URL = "https://xuqtcfdpjpyinmvjsazq.supabase.co";
const SB_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh1cXRjZmRwanB5aW5tdmpzYXpxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA3MzIyNzksImV4cCI6MjA4NjMwODI3OX0.oB_PN-qq7o_KePypNvBeMGnIvisXOVpOu2e7WF-HXYA";

let db = null;
let rtChannel = null;

const $ = (id) => document.getElementById(id);
const $$ = (sel) => document.querySelectorAll(sel);

const initDB = () => {
  if (typeof window.supabase !== "undefined") {
    db = window.supabase.createClient(SB_URL, SB_KEY, {
      realtime: { params: { eventsPerSecond: 2 } }
    });
    return true;
  }
  return false;
};

const sec = {
  rateMap: new Map(),
  reqMap: new Map(),
  blocked: new Set(),
  lastReq: 0,

  clean: (s) => {
    if (typeof s !== "string") return s;
    return s.replace(/[<>]/g,"").replace(/javascript:/gi,"").replace(/on\w+=/gi,"")
            .replace(/data:/gi,"").replace(/[\x00-\x1F\x7F]/g,"").trim().substring(0,500);
  },

  safeHTML: (s) => { const d = document.createElement("div"); d.textContent = s; return d.innerHTML; },

  emailClean: (e) => {
    const c = e.toLowerCase().trim();
    return /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/.test(c) ? c : null;
  },

  validateEmail: (e) => {
    if (!e || typeof e !== "string" || e.length < 5 || e.length > 254) return false;
    if (!/^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/.test(e)) return false;
    const bad = ["tempmail.com","10minutemail.com","guerrillamail.com","mailinator.com"];
    if (bad.includes(e.split("@")[1]?.toLowerCase())) return false;
    return true;
  },

  rateLimit: (key, limit = 5, ms = 60000) => {
    const now = Date.now();
    const reqs = (sec.rateMap.get(key) || []).filter(t => now - t < ms);
    if (reqs.length >= limit) return false;
    reqs.push(now); sec.rateMap.set(key, reqs); return true;
  },

  checkPattern: (fp) => {
    const now = Date.now();
    const hist = (sec.reqMap.get(fp) || []).filter(t => now - t < 300000);
    if (hist.length > 10) { sec.blocked.add(fp); return false; }
    hist.push(now); sec.reqMap.set(fp, hist); return true;
  },

  isBlocked: (fp) => sec.blocked.has(fp),
  validateFP: (fp) => /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(fp),
};

const getFP = () => {
  let fp = localStorage.getItem("tufn_fp");
  if (!fp || !sec.validateFP(fp)) {
    fp = crypto.randomUUID();
    localStorage.setItem("tufn_fp", fp);
    localStorage.setItem("tufn_fp_ts", Date.now().toString());
  }
  return fp;
};

let toastTimer = null;
const showToast = (msg, type = "info") => {
  const el = $("toast"); if (!el) return;
  const icons = { success: "check-circle", error: "times-circle", info: "info-circle" };
  el.innerHTML = `<i class="fas fa-${icons[type] || "info-circle"}"></i> ${sec.safeHTML(msg)}`;
  el.className = `toast ${type} visible`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("visible"), 3200);
};

const animNum = (el, target) => {
  const start = parseInt(el.textContent.replace(/\D/g,"")) || 0;
  if (start === target) return;
  const dur = 700, step = (target - start) / (dur / 16);
  let cur = start;
  const t = setInterval(() => {
    cur += step;
    if ((step > 0 && cur >= target) || (step < 0 && cur <= target)) {
      el.textContent = target.toLocaleString(); clearInterval(t);
    } else {
      el.textContent = Math.floor(cur).toLocaleString();
    }
  }, 16);
};

const fetchCount = async () => {
  const el = $("waitlist-count");
  if (!el) return;

  if (!db) {
    if (initRetries < MAX_RETRIES) {
      initRetries++;
      setTimeout(fetchCount, 500);
    }
    return;
  }

  try {
    const { data, error } = await db.rpc("get_waitlist_count");
    if (error) {
      console.error(error);
      el.textContent = "0";
      return;
    }

    const count = Array.isArray(data) ? data[0] : data;
    animNum(el, count || 0);

  } catch (err) {
    console.error(err);
    el.textContent = "0";
  }
};

const initRealtime = () => {
  if (!db || rtChannel) return;
  rtChannel = db.channel("wl-inserts")
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "waitlist" }, () => {
      const el = $("waitlist-count"); if (!el) return;
      const cur = parseInt(el.textContent.replace(/\D/g,"")) || 0;
      animNum(el, cur + 1);
    })
    .subscribe();
};

const openModal = () => {
  const m = $("waitlist-modal"); if (!m) return;
  m.classList.add("open");
  setTimeout(() => $("wl-email")?.focus(), 100);
};

const closeModal = () => {
  const m = $("waitlist-modal"); if (!m) return;
  m.classList.remove("open");
  const err = $("wl-error"); if (err) err.textContent = "";
};

const markJoined = () => {
  localStorage.setItem("tufn_joined","1");
  ["join-waitlist","nav-waitlist","cta-waitlist"].forEach(id => {
    const b = $(id); if (!b) return;
    b.disabled = true;
    b.innerHTML = '<i class="fas fa-check"></i> You\'re on the list!';
  });
};

const initWaitlist = () => {
  if (localStorage.getItem("tufn_joined")) { markJoined(); return; }
  ["join-waitlist","nav-waitlist","cta-waitlist"].forEach(id => $(id)?.addEventListener("click", openModal));
  $("modal-close")?.addEventListener("click", closeModal);
  $("waitlist-modal")?.addEventListener("click", e => { if (e.target === $("waitlist-modal")) closeModal(); });
  document.addEventListener("keydown", e => { if (e.key === "Escape") closeModal(); });

  $("waitlist-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!db) { showToast("Service unavailable. Try again.", "error"); return; }

    const fp = getFP();
    if (sec.isBlocked(fp)) { showToast("Access temporarily blocked.", "error"); return; }
    if (!sec.checkPattern(fp)) { showToast("Too many attempts. Please wait.", "error"); return; }
    const now = Date.now();
    if (now - sec.lastReq < 2000) { showToast("Please wait a moment.", "error"); return; }
    sec.lastReq = now;
    if (!sec.rateLimit(`wl_${fp}`, 3, 30000)) { showToast("Too many requests. Please wait.", "error"); return; }

    const rawEmail = $("wl-email")?.value.trim() ?? "";
    const errEl = $("wl-error");
    if (!rawEmail) { if (errEl) errEl.textContent = "Email is required"; return; }
    if (!sec.validateEmail(rawEmail)) { if (errEl) errEl.textContent = "Please enter a valid email address"; return; }
    const email = sec.emailClean(rawEmail);
    if (!email) { if (errEl) errEl.textContent = "Invalid email format"; return; }
    if (errEl) errEl.textContent = "";

    const btn = $("wl-submit");
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Joining…';

    try {
      const { error } = await db.from("waitlist").insert({
        fingerprint: sec.clean(fp), email, created_at: new Date().toISOString()
      });
      if (error) {
        if (error.code === "23505" || error.message?.includes("duplicate"))
          throw new Error("This email is already on the waitlist.");
        throw new Error("Failed to join. Please try again.");
      }
      const succ = $("modal-success"), form = $("waitlist-form");
      if (succ) succ.classList.add("show");
      if (form) form.style.display = "none";
      setTimeout(() => {
        closeModal(); markJoined(); fetchCount();
        if (succ) succ.classList.remove("show");
        if (form) form.style.display = "";
      }, 2200);
      showToast("Welcome to the waitlist!", "success");
    } catch (err) {
      if (errEl) errEl.textContent = err.message || "Something went wrong.";
      showToast(err.message || "Failed to join.", "error");
    } finally {
      btn.disabled = false;
      btn.innerHTML = '<i class="fas fa-paper-plane"></i> Join Waitlist';
    }
  });
};

const initTheme = () => {
  const btn = $("theme-btn"); if (!btn) return;
  if (localStorage.getItem("tufn_theme") === "dark") {
    document.documentElement.setAttribute("data-theme","dark");
    btn.querySelector("i").className = "fas fa-sun";
  }
  btn.addEventListener("click", () => {
    const dark = document.documentElement.getAttribute("data-theme") === "dark";
    document.documentElement.setAttribute("data-theme", dark ? "" : "dark");
    btn.querySelector("i").className = dark ? "fas fa-moon" : "fas fa-sun";
    localStorage.setItem("tufn_theme", dark ? "light" : "dark");
  });
};

const initMobileMenu = () => {
  const toggle = $("mobile-toggle"), menu = $("mobile-menu"); if (!toggle || !menu) return;
  toggle.addEventListener("click", () => {
    const o = menu.classList.toggle("open");
    toggle.querySelector("i").className = o ? "fas fa-times" : "fas fa-bars";
  });
  document.addEventListener("click", e => {
    if (!e.target.closest(".header") && !e.target.closest(".mobile-menu")) {
      menu.classList.remove("open");
      toggle.querySelector("i").className = "fas fa-bars";
    }
  });
};

const initSmoothScroll = () => {
  document.querySelectorAll('a[href^="#"]').forEach(a => {
    a.addEventListener("click", e => {
      const id = a.getAttribute("href"); if (id === "#") return;
      const target = document.querySelector(id); if (!target) return;
      e.preventDefault();
      $("mobile-menu")?.classList.remove("open");
      window.scrollTo({ top: target.offsetTop - 70, behavior: "smooth" });
    });
  });
};

const initScrollUp = () => {
  const btn = $("scroll-up"); if (!btn) return;
  let tick = false;
  window.addEventListener("scroll", () => {
    if (!tick) { requestAnimationFrame(() => { btn.classList.toggle("show", window.scrollY > 300); tick = false; }); tick = true; }
  });
  btn.addEventListener("click", () => window.scrollTo({ top: 0, behavior: "smooth" }));
};

const updateClock = () => {
  const now = new Date();
  const tEl = $("m-time"), dEl = $("m-date"), gEl = $("dash-greeting");
  if (tEl) tEl.textContent = now.getHours().toString().padStart(2,"0") + ":" + now.getMinutes().toString().padStart(2,"0");
  if (dEl) dEl.textContent = now.toLocaleDateString("en-US", { weekday:"long", month:"long", day:"numeric" });
  if (gEl) {
    const h = now.getHours();
    gEl.textContent = h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
  }
};

const initSidebar = () => {
  $$(".sidebar-btn[data-tab]").forEach(btn => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.tab;
      $$(".sidebar-btn[data-tab]").forEach(b => b.classList.remove("on"));
      $$(".mpanel").forEach(p => p.classList.remove("on"));
      btn.classList.add("on");
      $(`tab-${id}`)?.classList.add("on");
      if (id === "canvas") setTimeout(resizeCanvas, 60);
    });
  });
};

const initFAQ = () => {
  $$(".faq-item").forEach(item => {
    item.querySelector(".faq-q")?.addEventListener("click", () => {
      const was = item.classList.contains("open");
      $$(".faq-item").forEach(i => i.classList.remove("open"));
      if (!was) item.classList.add("open");
    });
  });
};

const initRoadmap = () => {
  const bar = $("rm-progress"); if (!bar) return;
  const items = $$(".rm-item");
  const done = [...items].filter(i => i.classList.contains("done")).length;
  setTimeout(() => { bar.style.height = `${(done / items.length) * 100}%`; }, 500);
};

let calM = new Date().getMonth(), calY = new Date().getFullYear();
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const EVENT_DAYS = new Set([3,8,11,15,22,27]);

const renderCal = () => {
  const el = $("cal-days"), mEl = $("cal-month"); if (!el) return;
  if (mEl) mEl.textContent = `${MONTHS[calM].slice(0,3)} ${calY}`;
  const firstDay = (new Date(calY, calM, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(calY, calM + 1, 0).getDate();
  const today = new Date();
  let html = "";
  for (let i = 1 - firstDay; i <= 42 - firstDay; i++) {
    const isOther = i < 1 || i > daysInMonth;
    const isToday = i === today.getDate() && calM === today.getMonth() && calY === today.getFullYear();
    const day = isOther ? (i < 1 ? new Date(calY,calM,i).getDate() : i - daysInMonth) : i;
    const cls = ["cal-day", isOther?"other":"", isToday?"today":""].filter(Boolean).join(" ");
    const dot = (!isOther && EVENT_DAYS.has(i)) ? `<span class="cal-dot"></span>` : "";
    html += `<div class="${cls}">${day}${dot}</div>`;
  }
  el.innerHTML = html;
};

const initCalendar = () => {
  if (!$("cal-days")) return;
  renderCal();
  $("cal-prev")?.addEventListener("click", () => { calM--; if (calM < 0) { calM=11; calY--; } renderCal(); });
  $("cal-next")?.addEventListener("click", () => { calM++; if (calM > 11) { calM=0; calY++; } renderCal(); });
};

const initDemoTasks = () => {
  $$("[data-demo-task]").forEach(task => {
    task.addEventListener("click", () => {
      const check = task.querySelector(".m-check");
      const isDone = task.classList.toggle("done");
      if (check) check.innerHTML = isDone ? '<i class="fas fa-check"></i>' : "";
    });
  });
};

const initPomodoro = () => {
  const display = $("pomo-display"), ringFill = $("pomo-ring-fill");
  const labelEl = $("pomo-label"), startBtn = $("pomo-start"), resetBtn = $("pomo-reset");
  if (!display || !startBtn) return;

  const SESSIONS = [
    { label: "Focus session", dur: 25 * 60, color: "var(--ink)" },
    { label: "Short break", dur: 5 * 60, color: "var(--success)" },
    { label: "Long break", dur: 15 * 60, color: "var(--info)" },
  ];
  let sessIdx = 0, timeLeft = SESSIONS[0].dur, timer = null, running = false;
  const CIRC = 2 * Math.PI * 22;

  const fmt = (s) => `${Math.floor(s/60).toString().padStart(2,"0")}:${(s%60).toString().padStart(2,"0")}`;

  const render = () => {
    if (display) display.textContent = fmt(timeLeft);
    if (labelEl) labelEl.textContent = SESSIONS[sessIdx].label;
    if (ringFill) {
      ringFill.style.strokeDasharray = CIRC;
      ringFill.style.strokeDashoffset = CIRC * (1 - timeLeft / SESSIONS[sessIdx].dur);
      ringFill.style.stroke = SESSIONS[sessIdx].color;
    }
  };

  startBtn.addEventListener("click", () => {
    if (running) {
      clearInterval(timer); timer = null; running = false;
      startBtn.textContent = "Resume"; startBtn.classList.remove("primary");
    } else {
      running = true; startBtn.textContent = "Pause"; startBtn.classList.add("primary");
      timer = setInterval(() => {
        timeLeft--;
        if (timeLeft <= 0) {
          clearInterval(timer); timer = null; running = false;
          sessIdx = (sessIdx + 1) % SESSIONS.length;
          timeLeft = SESSIONS[sessIdx].dur;
          startBtn.textContent = "Start"; startBtn.classList.remove("primary");
        }
        render();
      }, 1000);
    }
  });

  resetBtn?.addEventListener("click", () => {
    clearInterval(timer); timer = null; running = false;
    timeLeft = SESSIONS[sessIdx].dur;
    startBtn.textContent = "Start"; startBtn.classList.remove("primary");
    render();
  });

  render();
};

let canvasHistory = [];
let currentColor = "#111110", currentStroke = 2, currentTool = "pen";

const resizeCanvas = () => {
  const canvas = $("drawing-canvas"); if (!canvas) return;
  const area = canvas.parentElement;
  const rect = area.getBoundingClientRect();
  if (!rect.width || !rect.height) return;
  const tmp = canvas.toDataURL();
  canvas.width = Math.floor(rect.width);
  canvas.height = Math.floor(rect.height);
  if (tmp !== "data:,") {
    const img = new Image();
    img.onload = () => canvas.getContext("2d").drawImage(img, 0, 0);
    img.src = tmp;
  }
};

const initCanvas = () => {
  const canvas = $("drawing-canvas"); if (!canvas) return;
  const ctx = canvas.getContext("2d");
  let drawing = false, lx = 0, ly = 0;

  resizeCanvas();
  let rt; window.addEventListener("resize", () => { clearTimeout(rt); rt = setTimeout(resizeCanvas, 250); });

  const saveState = () => {
    canvasHistory.push(canvas.toDataURL());
    if (canvasHistory.length > 20) canvasHistory.shift();
  };

  $$(".ctool[data-tool]").forEach(b => {
    b.addEventListener("click", () => {
      $$(".ctool[data-tool]").forEach(x => x.classList.remove("on"));
      b.classList.add("on"); currentTool = b.dataset.tool;
    });
  });

  $$(".stroke-btn[data-stroke]").forEach(b => {
    b.addEventListener("click", () => {
      $$(".stroke-btn").forEach(x => x.classList.remove("on"));
      b.classList.add("on"); currentStroke = parseInt(b.dataset.stroke);
    });
  });

  $$(".c-swatch[data-color]").forEach(sw => {
    sw.addEventListener("click", () => {
      $$(".c-swatch").forEach(x => x.classList.remove("on"));
      sw.classList.add("on"); currentColor = sw.dataset.color;
      const cp = $("canvas-color"); if (cp) cp.value = currentColor;
    });
  });

  $("canvas-color")?.addEventListener("input", e => {
    currentColor = e.target.value;
    $$(".c-swatch").forEach(x => x.classList.remove("on"));
  });

  $("canvas-undo")?.addEventListener("click", () => {
    if (!canvasHistory.length) return;
    const last = canvasHistory.pop();
    const img = new Image();
    img.onload = () => { ctx.clearRect(0,0,canvas.width,canvas.height); ctx.drawImage(img,0,0); };
    img.src = last;
  });

  $("canvas-clear")?.addEventListener("click", () => {
    saveState(); ctx.clearRect(0,0,canvas.width,canvas.height);
    const hint = $("canvas-hint"); if (hint) hint.style.opacity = "1";
  });

  const coords = (e, r) => ({
    x: (e.clientX ?? e.touches?.[0]?.clientX) - r.left,
    y: (e.clientY ?? e.touches?.[0]?.clientY) - r.top
  });

  const start = (e) => {
    drawing = true;
    const c = coords(e, canvas.getBoundingClientRect()); lx = c.x; ly = c.y;
    saveState();
    const hint = $("canvas-hint"); if (hint) hint.style.opacity = "0";
  };

  const draw = (e) => {
    if (!drawing) return; e.preventDefault();
    const c = coords(e, canvas.getBoundingClientRect());
    ctx.beginPath(); ctx.moveTo(lx, ly); ctx.lineTo(c.x, c.y);
    ctx.lineCap = "round"; ctx.lineJoin = "round";
    if (currentTool === "eraser") {
      ctx.globalCompositeOperation = "destination-out";
      ctx.lineWidth = 18; ctx.stroke();
      ctx.globalCompositeOperation = "source-over";
    } else if (currentTool === "marker") {
      ctx.globalAlpha = 0.35;
      ctx.strokeStyle = currentColor; ctx.lineWidth = currentStroke * 4; ctx.stroke();
      ctx.globalAlpha = 1;
    } else {
      ctx.strokeStyle = currentColor; ctx.lineWidth = currentStroke; ctx.stroke();
    }
    lx = c.x; ly = c.y;
  };

  const stop = () => { drawing = false; };

  canvas.addEventListener("mousedown", start);
  canvas.addEventListener("mousemove", draw);
  canvas.addEventListener("mouseup", stop);
  canvas.addEventListener("mouseleave", stop);
  canvas.addEventListener("touchstart", start, { passive: false });
  canvas.addEventListener("touchmove", draw, { passive: false });
  canvas.addEventListener("touchend", stop);
};

const cleanupSec = () => {
  const now = Date.now();
  for (const [k, v] of sec.rateMap) if (!v.some(t => now - t < 600000)) sec.rateMap.delete(k);
  for (const [k, v] of sec.reqMap)  if (!v.some(t => now - t < 300000)) sec.reqMap.delete(k);
  const ts = parseInt(localStorage.getItem("tufn_fp_ts") || "0");
  if (ts && now - ts > 2592000000) { localStorage.removeItem("tufn_fp"); localStorage.removeItem("tufn_fp_ts"); }
};

const waitForDB = (callback, retries = 10) => {
  if (db) { callback(); return; }
  if (retries <= 0) return;
  setTimeout(() => waitForDB(callback, retries - 1), 300);
};

document.addEventListener("DOMContentLoaded", () => {
  initDB();
  initTheme();
  initMobileMenu();
  initSmoothScroll();
  initScrollUp();
  initSidebar();
  initFAQ();
  initRoadmap();
  updateClock();
  setInterval(updateClock, 30000);
  initCalendar();
  initCanvas();
  initDemoTasks();
  initPomodoro();
  initWaitlist();

  waitForDB(() => {
    fetchCount();
    initRealtime();
    setInterval(fetchCount, 45000);
  });

  setInterval(cleanupSec, 300000);
});

window.addEventListener("beforeunload", () => {
  if (rtChannel && db) db.removeChannel(rtChannel);
  sec.rateMap.clear(); sec.reqMap.clear();
});
