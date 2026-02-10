// ==========================================
// TUFN - Main JavaScript
// ==========================================

// Supabase Configuration
const SUPABASE_URL = "https://hadkdtctdwwoucpyonob.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhhZGtkdGN0ZHd3b3VjcHlvbm9iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA3MjQyODYsImV4cCI6MjA4NjMwMDI4Nn0.hchfw9-mNT6qi5Ctbjwm7XcNT1QvzfjqoJ21kXBTHAg";

// Initialize Supabase Client (use different name to avoid conflict with global supabase object)
let tufnSupabase;

// Wait for Supabase library to load
const initSupabase = () => {
  if (typeof window.supabase !== 'undefined') {
    tufnSupabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    console.log('✅ Supabase initialized successfully');
    return true;
  }
  console.error('❌ Supabase library not loaded');
  return false;
};

// ==========================================
// DOM Elements
// ==========================================
const elements = {
  // Theme & Navigation
  themeToggle: document.getElementById('theme-toggle'),
  scrollTop: document.getElementById('scroll-top'),
  mobileMenuBtn: document.querySelector('.mobile-menu-btn'),
  navLinks: document.querySelector('.nav-links'),
  
  // Hero & Stats
  currentTimeEl: document.getElementById('current-time'),
  currentDateEl: document.getElementById('current-date'),
  waitlistCountEl: document.getElementById('waitlist-count'),
  
  // Tabs
  appTabs: document.querySelectorAll('.app-tab'),
  tabContents: document.querySelectorAll('.tab-content'),
  
  // Calendar
  calendarDays: document.querySelector('.calendar-days'),
  currentMonthEl: document.querySelector('.current-month'),
  prevMonthBtn: document.getElementById('prev-month'),
  nextMonthBtn: document.getElementById('next-month'),
  
  // Canvas
  drawingCanvas: document.getElementById('drawing-canvas'),
  canvasColor: document.getElementById('canvas-color'),
  toolBtns: document.querySelectorAll('.tool-btn'),
  
  // Waitlist Modal
  joinBtn: document.getElementById('join-waitlist'),
  newsletterBtn: document.getElementById('newsletter-signup'),
  waitlistModal: document.getElementById('waitlist-modal'),
  waitlistForm: document.getElementById('waitlist-form'),
  waitlistEmail: document.getElementById('waitlist-email'),
  submitWaitlist: document.getElementById('submit-waitlist'),
  emailError: document.getElementById('email-error'),
  successMessage: document.getElementById('success-message'),
  modalCloseBtns: document.querySelectorAll('.modal-close'),
  
  // FAQ
  faqItems: document.querySelectorAll('.faq-item'),
  
  // Toast
  toast: document.getElementById('toast')
};

// ==========================================
// Security & Validation
// ==========================================
const security = {
  rateLimits: new Map(),
  lastRequest: 0,
  
  // Sanitize text input
  sanitizeInput: (input) => {
    if (typeof input !== 'string') return input;
    return input
      .replace(/[<>]/g, '')
      .replace(/javascript:/gi, '')
      .replace(/on\w+=/gi, '')
      .trim()
      .substring(0, 500);
  },
  
  // Sanitize HTML
  sanitizeHTML: (html) => {
    const div = document.createElement('div');
    div.textContent = html;
    return div.innerHTML;
  },
  
  // Rate limiting
  checkRateLimit: (key, limit = 5, windowMs = 60000) => {
    const now = Date.now();
    const requests = security.rateLimits.get(key) || [];
    const recent = requests.filter(time => now - time < windowMs);
    
    if (recent.length >= limit) {
      return false;
    }
    
    recent.push(now);
    security.rateLimits.set(key, recent);
    return true;
  },
  
  // Email validation
  validateEmail: (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  },
  
  // Fingerprint validation
  validateFingerprint: (fp) => {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(fp);
  }
};

// ==========================================
// Fingerprint Management
// ==========================================
const getFingerprint = () => {
  let fp = localStorage.getItem('tufn_fp');
  if (!fp || !security.validateFingerprint(fp)) {
    fp = crypto.randomUUID();
    localStorage.setItem('tufn_fp', fp);
  }
  return fp;
};

// ==========================================
// Toast Notifications
// ==========================================
const showToast = (message, type = 'info') => {
  if (!elements.toast) return;
  
  elements.toast.textContent = message;
  elements.toast.className = `toast ${type} show`;
  
  setTimeout(() => {
    elements.toast.classList.remove('show');
  }, 3000);
};

// ==========================================
// Waitlist Functions
// ==========================================
const updateWaitlistCount = async () => {
  if (!tufnSupabase) {
    console.log('Supabase not initialized yet');
    if (elements.waitlistCountEl) {
      elements.waitlistCountEl.textContent = '0';
    }
    return;
  }
  
  try {
    const { count, error } = await tufnSupabase
      .from('waitlist')
      .select('*', { count: 'exact', head: true });
    
    if (error) {
      console.error('Error fetching waitlist count:', error);
      if (elements.waitlistCountEl) {
        elements.waitlistCountEl.textContent = '0';
      }
      return;
    }
    
    if (elements.waitlistCountEl && typeof count === 'number') {
      animateNumber(elements.waitlistCountEl, count);
    }
  } catch (error) {
    console.error('Waitlist count error:', error);
    if (elements.waitlistCountEl) {
      elements.waitlistCountEl.textContent = '0';
    }
  }
};

const animateNumber = (element, target) => {
  const duration = 1000;
  const start = parseInt(element.textContent) || 0;
  const increment = (target - start) / (duration / 16);
  let current = start;
  
  const timer = setInterval(() => {
    current += increment;
    if ((increment > 0 && current >= target) || (increment < 0 && current <= target)) {
      element.textContent = target;
      clearInterval(timer);
    } else {
      element.textContent = Math.floor(current);
    }
  }, 16);
};

const initWaitlist = () => {
  console.log('Initializing waitlist...');
  
  if (!elements.joinBtn) {
    console.error('Join button not found');
    return;
  }
  
  // Check if user already joined
  if (localStorage.getItem('waitlist_joined')) {
    elements.joinBtn.disabled = true;
    elements.joinBtn.innerHTML = '<i class="fas fa-check"></i> You\'re on the waitlist!';
    elements.joinBtn.classList.remove('pulse');
    
    if (elements.newsletterBtn) {
      elements.newsletterBtn.disabled = true;
      elements.newsletterBtn.innerHTML = '<i class="fas fa-check"></i> Already subscribed';
    }
    return;
  }
  
  // Join button click - open modal
  const openModal = (e) => {
    e.preventDefault();
    console.log('Opening waitlist modal...');
    
    if (!elements.waitlistModal) {
      console.error('Waitlist modal not found');
      return;
    }
    
    elements.waitlistModal.classList.add('active');
    setTimeout(() => {
      elements.waitlistEmail?.focus();
    }, 100);
  };
  
  elements.joinBtn.addEventListener('click', openModal);
  console.log('Join button listener added');
  
  if (elements.newsletterBtn) {
    elements.newsletterBtn.addEventListener('click', openModal);
    console.log('Newsletter button listener added');
  }
  
  // Form submission
  if (elements.waitlistForm) {
    elements.waitlistForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      console.log('Form submitted');
      
      if (!tufnSupabase) {
        showToast('Service not ready. Please try again in a moment.', 'error');
        return;
      }
      
      // Rate limiting
      const now = Date.now();
      if (now - security.lastRequest < 2000) {
        showToast('Please wait before trying again', 'warning');
        return;
      }
      security.lastRequest = now;
      
      const rateLimitKey = `waitlist_${getFingerprint()}`;
      if (!security.checkRateLimit(rateLimitKey, 3, 30000)) {
        showToast('Too many requests. Please wait before trying again.', 'error');
        return;
      }
      
      // Get and validate email
      const email = elements.waitlistEmail.value.trim();
      if (!email) {
        elements.emailError.textContent = 'Email is required';
        elements.waitlistEmail.focus();
        return;
      }
      
      if (!security.validateEmail(email)) {
        elements.emailError.textContent = 'Please enter a valid email address';
        elements.waitlistEmail.focus();
        return;
      }
      
      // Clear previous errors
      elements.emailError.textContent = '';
      
      // Disable submit button
      elements.submitWaitlist.disabled = true;
      elements.submitWaitlist.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Joining...';
      
      try {
        const fp = security.sanitizeInput(getFingerprint());
        const sanitizedEmail = security.sanitizeInput(email);
        
        console.log('Inserting into waitlist...');
        
        // Insert into Supabase
        const { data, error } = await tufnSupabase
          .from('waitlist')
          .insert({
            fingerprint: fp,
            email: sanitizedEmail,
            created_at: new Date().toISOString()
          })
          .select();
        
        if (error) {
          console.error('Supabase error:', error);
          // Check if duplicate
          if (error.code === '23505' || error.message.includes('duplicate')) {
            throw new Error('This email is already on the waitlist');
          }
          throw error;
        }
        
        console.log('Successfully added to waitlist:', data);
        
        // Success
        localStorage.setItem('waitlist_joined', 'true');
        elements.waitlistEmail.value = '';
        elements.successMessage.style.display = 'block';
        
        setTimeout(() => {
          elements.waitlistModal.classList.remove('active');
          elements.successMessage.style.display = 'none';
          elements.joinBtn.disabled = true;
          elements.joinBtn.innerHTML = '<i class="fas fa-check"></i> You\'re on the waitlist!';
          elements.joinBtn.classList.remove('pulse');
          
          if (elements.newsletterBtn) {
            elements.newsletterBtn.disabled = true;
            elements.newsletterBtn.innerHTML = '<i class="fas fa-check"></i> Already subscribed';
          }
        }, 2000);
        
        updateWaitlistCount();
        showToast('Successfully joined the waitlist!', 'success');
        
      } catch (error) {
        console.error('Waitlist submission error:', error);
        elements.emailError.textContent = error.message || 'Failed to join waitlist. Please try again.';
        showToast(error.message || 'Failed to join waitlist', 'error');
      } finally {
        elements.submitWaitlist.disabled = false;
        elements.submitWaitlist.innerHTML = '<i class="fas fa-paper-plane"></i> Join Waitlist';
      }
    });
  }
};

// ==========================================
// Theme Toggle
// ==========================================
const initTheme = () => {
  if (!elements.themeToggle) return;
  
  // Load saved theme
  const savedTheme = localStorage.getItem('tufn_theme');
  if (savedTheme === 'dark') {
    document.body.classList.add('dark-theme');
    elements.themeToggle.querySelector('i').className = 'fas fa-sun';
  }
  
  // Toggle theme
  elements.themeToggle.addEventListener('click', () => {
    const icon = elements.themeToggle.querySelector('i');
    const isDark = document.body.classList.toggle('dark-theme');
    icon.className = isDark ? 'fas fa-sun' : 'fas fa-moon';
    localStorage.setItem('tufn_theme', isDark ? 'dark' : 'light');
  });
};

// ==========================================
// Mobile Menu
// ==========================================
const initMobileMenu = () => {
  if (!elements.mobileMenuBtn || !elements.navLinks) return;
  
  elements.mobileMenuBtn.addEventListener('click', () => {
    elements.navLinks.classList.toggle('active');
    const icon = elements.mobileMenuBtn.querySelector('i');
    icon.className = elements.navLinks.classList.contains('active') 
      ? 'fas fa-times' 
      : 'fas fa-bars';
  });
  
  // Close menu when clicking outside
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.nav') && elements.navLinks.classList.contains('active')) {
      elements.navLinks.classList.remove('active');
      elements.mobileMenuBtn.querySelector('i').className = 'fas fa-bars';
    }
  });
};

// ==========================================
// Smooth Scroll
// ==========================================
const initSmoothScroll = () => {
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', (e) => {
      e.preventDefault();
      const targetId = anchor.getAttribute('href');
      if (targetId === '#') return;
      
      const target = document.querySelector(targetId);
      if (!target) return;
      
      // Close mobile menu if open
      if (elements.navLinks?.classList.contains('active')) {
        elements.navLinks.classList.remove('active');
        elements.mobileMenuBtn.querySelector('i').className = 'fas fa-bars';
      }
      
      // Scroll to target
      const headerOffset = 80;
      const elementPosition = target.offsetTop;
      const offsetPosition = elementPosition - headerOffset;
      
      window.scrollTo({
        top: offsetPosition,
        behavior: 'smooth'
      });
    });
  });
};

// ==========================================
// Scroll to Top Button
// ==========================================
const initScrollTop = () => {
  if (!elements.scrollTop) return;
  
  window.addEventListener('scroll', () => {
    if (window.pageYOffset > 300) {
      elements.scrollTop.classList.add('visible');
    } else {
      elements.scrollTop.classList.remove('visible');
    }
  });
  
  elements.scrollTop.addEventListener('click', () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  });
};

// ==========================================
// App Tabs
// ==========================================
const initTabs = () => {
  elements.appTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const tabId = tab.dataset.tab;
      
      // Remove active class from all tabs and contents
      elements.appTabs.forEach(t => t.classList.remove('active'));
      elements.tabContents.forEach(c => c.classList.remove('active'));
      
      // Add active class to clicked tab and corresponding content
      tab.classList.add('active');
      const content = document.getElementById(`${tabId}-tab`);
      if (content) {
        content.classList.add('active');
      }
    });
  });
};

// ==========================================
// Clock & Date
// ==========================================
const updateClock = () => {
  const now = new Date();
  
  if (elements.currentTimeEl) {
    const hours = now.getHours().toString().padStart(2, '0');
    const minutes = now.getMinutes().toString().padStart(2, '0');
    elements.currentTimeEl.textContent = `${hours}:${minutes}`;
  }
  
  if (elements.currentDateEl) {
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    elements.currentDateEl.textContent = now.toLocaleDateString('en-US', options);
  }
};

// ==========================================
// Calendar
// ==========================================
let currentMonth = new Date().getMonth();
let currentYear = new Date().getFullYear();

const initCalendar = () => {
  if (!elements.calendarDays) return;
  
  renderCalendar();
  
  elements.prevMonthBtn?.addEventListener('click', () => {
    currentMonth--;
    if (currentMonth < 0) {
      currentMonth = 11;
      currentYear--;
    }
    renderCalendar();
  });
  
  elements.nextMonthBtn?.addEventListener('click', () => {
    currentMonth++;
    if (currentMonth > 11) {
      currentMonth = 0;
      currentYear++;
    }
    renderCalendar();
  });
};

const renderCalendar = () => {
  const firstDay = new Date(currentYear, currentMonth, 1).getDay() || 7;
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const today = new Date();
  
  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];
  
  if (elements.currentMonthEl) {
    elements.currentMonthEl.textContent = `${monthNames[currentMonth]} ${currentYear}`;
  }
  
  let html = '';
  const totalCells = 42;
  
  for (let i = 1 - (firstDay - 1); i <= totalCells - (firstDay - 1); i++) {
    const isOtherMonth = i < 1 || i > daysInMonth;
    const isToday = i === today.getDate() && 
                    currentMonth === today.getMonth() && 
                    currentYear === today.getFullYear();
    
    let className = 'calendar-day';
    if (isOtherMonth) className += ' other';
    if (isToday) className += ' today';
    
    const dayNum = isOtherMonth 
      ? (i < 1 ? new Date(currentYear, currentMonth, i).getDate() : i - daysInMonth)
      : i;
    
    html += `<div class="${security.sanitizeHTML(className)}">${security.sanitizeHTML(dayNum.toString())}</div>`;
  }
  
  elements.calendarDays.innerHTML = html;
};

// ==========================================
// Canvas Drawing
// ==========================================
const initCanvas = () => {
  const canvas = elements.drawingCanvas;
  if (!canvas) return;
  
  const ctx = canvas.getContext('2d');
  let isDrawing = false;
  let lastX = 0;
  let lastY = 0;
  let currentTool = 'pen';
  let currentColor = elements.canvasColor?.value || '#6366f1';
  
  // Set canvas size
  const resizeCanvas = () => {
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;
  };
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);
  
  // Tool selection
  elements.toolBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      elements.toolBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentTool = btn.dataset.tool;
    });
  });
  
  // Color picker
  elements.canvasColor?.addEventListener('change', (e) => {
    currentColor = e.target.value;
  });
  
  // Drawing functions
  const startDrawing = (e) => {
    isDrawing = true;
    const rect = canvas.getBoundingClientRect();
    lastX = e.clientX - rect.left;
    lastY = e.clientY - rect.top;
  };
  
  const draw = (e) => {
    if (!isDrawing) return;
    
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    ctx.beginPath();
    ctx.moveTo(lastX, lastY);
    ctx.lineTo(x, y);
    
    if (currentTool === 'pen') {
      ctx.strokeStyle = currentColor;
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.stroke();
    } else if (currentTool === 'eraser') {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.lineWidth = 10;
      ctx.lineCap = 'round';
      ctx.stroke();
      ctx.globalCompositeOperation = 'source-over';
    }
    
    lastX = x;
    lastY = y;
  };
  
  const stopDrawing = () => {
    isDrawing = false;
  };
  
  canvas.addEventListener('mousedown', startDrawing);
  canvas.addEventListener('mousemove', draw);
  canvas.addEventListener('mouseup', stopDrawing);
  canvas.addEventListener('mouseleave', stopDrawing);
  
  // Touch support
  canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    const touch = e.touches[0];
    const mouseEvent = new MouseEvent('mousedown', {
      clientX: touch.clientX,
      clientY: touch.clientY
    });
    canvas.dispatchEvent(mouseEvent);
  });
  
  canvas.addEventListener('touchmove', (e) => {
    e.preventDefault();
    const touch = e.touches[0];
    const mouseEvent = new MouseEvent('mousemove', {
      clientX: touch.clientX,
      clientY: touch.clientY
    });
    canvas.dispatchEvent(mouseEvent);
  });
  
  canvas.addEventListener('touchend', (e) => {
    e.preventDefault();
    const mouseEvent = new MouseEvent('mouseup', {});
    canvas.dispatchEvent(mouseEvent);
  });
};

// ==========================================
// FAQ Accordion
// ==========================================
const initFAQ = () => {
  elements.faqItems.forEach(item => {
    const question = item.querySelector('.faq-question');
    if (!question) return;
    
    question.addEventListener('click', () => {
      const isActive = item.classList.contains('active');
      
      // Close all items
      elements.faqItems.forEach(i => i.classList.remove('active'));
      
      // Open clicked item if it wasn't active
      if (!isActive) {
        item.classList.add('active');
      }
    });
  });
};

// ==========================================
// Modal Controls
// ==========================================
const initModals = () => {
  // Close buttons
  elements.modalCloseBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      elements.waitlistModal?.classList.remove('active');
      elements.emailError.textContent = '';
      elements.successMessage.style.display = 'none';
    });
  });
  
  // Click outside to close
  elements.waitlistModal?.addEventListener('click', (e) => {
    if (e.target === elements.waitlistModal) {
      elements.waitlistModal.classList.remove('active');
      elements.emailError.textContent = '';
      elements.successMessage.style.display = 'none';
    }
  });
  
  // ESC key to close
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      elements.waitlistModal?.classList.remove('active');
      elements.emailError.textContent = '';
      elements.successMessage.style.display = 'none';
    }
  });
};

// ==========================================
// Cleanup Rate Limits
// ==========================================
const cleanupRateLimits = () => {
  const now = Date.now();
  for (const [key, times] of security.rateLimits) {
    const validTimes = times.filter(time => now - time < 600000);
    if (validTimes.length === 0) {
      security.rateLimits.delete(key);
    } else {
      security.rateLimits.set(key, validTimes);
    }
  }
};

// ==========================================
// Initialize Everything
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
  console.log('DOM Content Loaded');
  
  // Initialize Supabase first
  initSupabase();
  
  // Initialize all features
  initTheme();
  initMobileMenu();
  initSmoothScroll();
  initScrollTop();
  initTabs();
  initCalendar();
  initCanvas();
  initFAQ();
  initModals();
  initWaitlist();
  
  // Update clock and date
  updateClock();
  setInterval(updateClock, 60000);
  
  // Update waitlist count
  setTimeout(() => {
    updateWaitlistCount();
  }, 500);
  
  // Cleanup rate limits periodically
  setInterval(cleanupRateLimits, 300000);
  
  console.log('All initialization complete');
});

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
  security.rateLimits.clear();
});
