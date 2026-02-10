<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
<script>
const supabase = supabase.createClient(
  "https://hadkdtctdwwoucpyonob.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhhZGtkdGN0ZHd3b3VjcHlvbm9iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA3MjQyODYsImV4cCI6MjA4NjMwMDI4Nn0.hchfw9-mNT6qi5Ctbjwm7XcNT1QvzfjqoJ21kXBTHAg"
);

const elements = {
    themeToggle: document.getElementById('theme-toggle'),
    mobileMenuBtn: document.querySelector('.mobile-menu-btn'),
    navLinks: document.querySelector('.nav-links'),
    downloadModal: document.getElementById('download-modal'),
    downloadBtns: document.querySelectorAll('.download-btn'),
    modalCloseBtns: document.querySelectorAll('.modal-close, .modal-close-btn'),
    currentTimeEl: document.getElementById('current-time'),
    calendarDays: document.querySelector('.calendar-days'),
    joinBtn: document.getElementById('join-waitlist'),
    waitlistCountEl: document.getElementById('waitlist-count'),
    emailInput: document.getElementById('waitlist-email'),
    appTabs: document.querySelectorAll('.app-tab'),
    tabContents: document.querySelectorAll('.tab-content')
};

const security = {
    rateLimits: new Map(),
    lastRequest: 0,
    
    sanitizeInput: (input) => {
        if (typeof input !== 'string') return input;
        return input
            .replace(/[<>]/g, '')
            .replace(/javascript:/gi, '')
            .replace(/on\w+=/gi, '')
            .trim()
            .substring(0, 500);
    },
    
    sanitizeHTML: (html) => {
        const div = document.createElement('div');
        div.textContent = html;
        return div.innerHTML;
    },
    
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
    
    validateFingerprint: (fp) => {
        return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(fp);
    }
};

const fingerprint = () => {
    let fp = localStorage.getItem('fp');
    if (!fp || !security.validateFingerprint(fp)) {
        fp = crypto.randomUUID();
        localStorage.setItem('fp', fp);
    }
    return fp;
};

const updateWaitlist = async () => {
    try {
        const { count, error } = await supabase
            .from('waitlist')
            .select('*', { count: 'exact', head: true });
        
        if (error) throw error;
        
        if (elements.waitlistCountEl && typeof count === 'number') {
            elements.waitlistCountEl.textContent = `${security.sanitizeHTML(count.toString())} Waitlist Signups`;
        }
    } catch (error) {
        console.error('Waitlist count error:', error);
    }
};

const initWaitlist = async () => {
    if (!elements.joinBtn) return;
    
    if (localStorage.getItem('waitlist_joined')) {
        elements.joinBtn.disabled = true;
        elements.joinBtn.textContent = "You're on the waitlist ✓";
        updateWaitlist();
        return;
    }
    
    elements.joinBtn.addEventListener('click', async () => {
        const now = Date.now();
        if (now - security.lastRequest < 2000) return;
        security.lastRequest = now;
        
        const rateLimitKey = `waitlist_${fingerprint()}`;
        if (!security.checkRateLimit(rateLimitKey, 3, 30000)) {
            alert('Please wait before trying again');
            return;
        }
        
        let email = null;
        if (elements.emailInput) {
            email = elements.emailInput.value.trim();
            if (!email) {
                alert('Please enter a valid email address!');
                return;
            }
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(email)) {
                alert('Please enter a valid email address!');
                return;
            }
        }
        
        try {
            const fp = security.sanitizeInput(fingerprint());
            const record = {
                fingerprint: fp,
                created_at: new Date().toISOString()
            };
            
            if (email) {
                record.email = security.sanitizeInput(email);
            }
            
            const { error } = await supabase
                .from('waitlist')
                .insert(record);
            
            if (error) throw error;
            
            localStorage.setItem('waitlist_joined', 'true');
            elements.joinBtn.disabled = true;
            elements.joinBtn.textContent = "You're on the waitlist ✓";
            if (elements.emailInput) {
                elements.emailInput.value = '';
            }
            updateWaitlist();
        } catch (error) {
            console.error('Waitlist error:', error);
            alert('Failed to join waitlist. Please try again.');
        }
    });
};

if (elements.themeToggle) {
    elements.themeToggle.addEventListener('click', () => {
        const icon = elements.themeToggle.querySelector('i');
        const isDark = document.body.classList.toggle('dark-theme');
        icon.className = isDark ? 'fas fa-sun' : 'fas fa-moon';
        localStorage.setItem('theme', isDark ? 'dark' : 'light');
    });
    
    if (localStorage.getItem('theme') === 'dark') {
        document.body.classList.add('dark-theme');
        elements.themeToggle.querySelector('i').className = 'fas fa-sun';
    }
}

if (elements.mobileMenuBtn) {
    elements.mobileMenuBtn.addEventListener('click', () => {
        elements.navLinks.style.display = 
            elements.navLinks.style.display === 'flex' ? 'none' : 'flex';
    });
}

window.addEventListener('resize', () => {
    if (window.innerWidth > 768 && elements.navLinks) {
        elements.navLinks.style.display = '';
    }
});

document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', e => {
        e.preventDefault();
        const targetId = security.sanitizeInput(anchor.getAttribute('href'));
        const target = document.querySelector(targetId);
        if (!target) return;
        
        if (elements.navLinks && window.innerWidth <= 768) {
            elements.navLinks.style.display = 'none';
        }
        
        window.scrollTo({
            top: target.offsetTop - 80,
            behavior: 'smooth'
        });
    });
});

elements.appTabs.forEach(tab => {
    tab.addEventListener('click', () => {
        const tabId = security.sanitizeInput(tab.dataset.tab);
        elements.appTabs.forEach(t => t.classList.remove('active'));
        elements.tabContents.forEach(c => c.classList.remove('active'));
        tab.classList.add('active');
        document.getElementById(`${tabId}-tab`)?.classList.add('active');
    });
});

const updateClock = () => {
    const now = new Date();
    if (elements.currentTimeEl) {
        elements.currentTimeEl.textContent = 
            `${now.getHours().toString().padStart(2, '0')}:` +
            `${now.getMinutes().toString().padStart(2, '0')}`;
    }
};

const initCalendar = () => {
    if (!elements.calendarDays) return;
    
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const firstDay = new Date(year, month, 1).getDay() || 7;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    
    let html = '';
    for (let i = 1 - (firstDay - 1); i <= 42 - (firstDay - 1); i++) {
        const isOther = i < 1 || i > daysInMonth;
        const isToday = i === now.getDate();
        const className = isOther ? 'calendar-day other' : 
                         isToday ? 'calendar-day today' : 'calendar-day';
        const dayNum = isOther ? ((i + daysInMonth - 1) % daysInMonth) + 1 : i;
        html += `<div class="${security.sanitizeHTML(className)}">` +
                security.sanitizeHTML(dayNum.toString()) + '</div>';
    }
    elements.calendarDays.innerHTML = html;
};

elements.downloadBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        if (!security.checkRateLimit('download_modal', 10, 60000)) return;
        elements.downloadModal.classList.add('active');
    });
});

elements.modalCloseBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        elements.downloadModal.classList.remove('active');
    });
});

if (elements.downloadModal) {
    elements.downloadModal.addEventListener('click', e => {
        if (e.target === elements.downloadModal) {
            elements.downloadModal.classList.remove('active');
        }
    });
}

document.addEventListener('DOMContentLoaded', () => {
    updateClock();
    setInterval(updateClock, 60000);
    initCalendar();
    initWaitlist();
    
    setInterval(() => {
        const now = Date.now();
        for (const [key, times] of security.rateLimits) {
            const validTimes = times.filter(time => now - time < 600000);
            if (validTimes.length === 0) {
                security.rateLimits.delete(key);
            } else {
                security.rateLimits.set(key, validTimes);
            }
        }
    }, 300000);
});

window.addEventListener('beforeunload', () => {
    security.rateLimits.clear();
});
</script>
