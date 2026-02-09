// DOM Elements
const themeToggle = document.getElementById('theme-toggle');
const mobileMenuBtn = document.querySelector('.mobile-menu-btn');
const navLinks = document.querySelector('.nav-links');
const downloadModal = document.getElementById('download-modal');
const downloadBtns = document.querySelectorAll('.download-btn');
const modalCloseBtns = document.querySelectorAll('.modal-close, .modal-close-btn');
const downloadMessage = document.getElementById('download-message');
const manualDownloadLink = document.getElementById('manual-download-link');
const installSteps = document.querySelectorAll('#step1, #step2, #step3');

// App Preview Elements
const appTabs = document.querySelectorAll('.app-tab');
const tabContents = document.querySelectorAll('.tab-content');
const currentTimeEl = document.getElementById('current-time');
const calendarDays = document.querySelector('.calendar-days');

// Theme Toggle
themeToggle.addEventListener('click', () => {
    document.body.classList.toggle('dark-theme');
    const icon = themeToggle.querySelector('i');
    if (document.body.classList.contains('dark-theme')) {
        icon.className = 'fas fa-sun';
        localStorage.setItem('theme', 'dark');
    } else {
        icon.className = 'fas fa-moon';
        localStorage.setItem('theme', 'light');
    }
});

// Load saved theme
if (localStorage.getItem('theme') === 'dark') {
    document.body.classList.add('dark-theme');
    themeToggle.querySelector('i').className = 'fas fa-sun';
}

// Mobile Menu
if (mobileMenuBtn && navLinks) {
    mobileMenuBtn.addEventListener('click', () => {
        navLinks.style.display = navLinks.style.display === 'flex' ? 'none' : 'flex';
    });
    
    window.addEventListener('resize', () => {
        if (window.innerWidth > 768) {
            navLinks.style.display = '';
        }
    });
}

// Smooth scrolling for anchor links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        
        const targetId = this.getAttribute('href');
        if (targetId === '#') return;
        
        const targetElement = document.querySelector(targetId);
        if (targetElement) {
            if (navLinks && window.innerWidth <= 768) {
                navLinks.style.display = 'none';
            }
            
            window.scrollTo({
                top: targetElement.offsetTop - 80,
                behavior: 'smooth'
            });
        }
    });
});

// App Preview Tabs
appTabs.forEach(tab => {
    tab.addEventListener('click', () => {
        // Remove active class from all tabs and contents
        appTabs.forEach(t => t.classList.remove('active'));
        tabContents.forEach(c => c.classList.remove('active'));
        
        // Add active class to clicked tab
        tab.classList.add('active');
        
        // Show corresponding content
        const tabId = tab.getAttribute('data-tab');
        const content = document.getElementById(`${tabId}-tab`);
        if (content) {
            content.classList.add('active');
        }
    });
});

// Update real-time clock
function updateClock() {
    const now = new Date();
    const hours = now.getHours().toString().padStart(2, '0');
    const minutes = now.getMinutes().toString().padStart(2, '0');
    if (currentTimeEl) {
        currentTimeEl.textContent = `${hours}:${minutes}`;
    }
}

// Initialize calendar
function initCalendar() {
    if (!calendarDays) return;
    
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDay = firstDay.getDay();
    
    // Adjust starting day for Monday-first week
    const adjustedStartingDay = startingDay === 0 ? 6 : startingDay - 1;
    
    let calendarHTML = '';
    
    // Previous month days
    const prevMonthLastDay = new Date(year, month, 0).getDate();
    for (let i = 0; i < adjustedStartingDay; i++) {
        const day = prevMonthLastDay - adjustedStartingDay + i + 1;
        calendarHTML += `<div class="calendar-day prev-month">${day}</div>`;
    }
    
    // Current month days
    for (let day = 1; day <= daysInMonth; day++) {
        const isToday = day === today.getDate() && month === today.getMonth();
        const className = isToday ? 'calendar-day today' : 'calendar-day';
        calendarHTML += `<div class="${className}">${day}</div>`;
    }
    
    // Next month days
    const totalCells = 42; // 6 weeks
    const remainingCells = totalCells - (adjustedStartingDay + daysInMonth);
    for (let day = 1; day <= remainingCells; day++) {
        calendarHTML += `<div class="calendar-day next-month">${day}</div>`;
    }
    
    calendarDays.innerHTML = calendarHTML;
    
    // Update current month display
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 
                       'July', 'August', 'September', 'October', 'November', 'December'];
    const currentMonthEl = document.querySelector('.current-month');
    if (currentMonthEl) {
        currentMonthEl.textContent = `${monthNames[month]} ${year}`;
    }
}

// Download functionality
downloadBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        const os = btn.getAttribute('data-os');
        showDownloadModal(os);
    });
});

function showDownloadModal(os) {
    // Update modal content based on OS
    let downloadUrl, fileName, osName, instructions;
    
    switch(os) {
        case 'windows':
            downloadUrl = '/downloads/tufn-windows.exe';
            fileName = 'tufn-windows.exe';
            osName = 'Windows';
            instructions = [
                'Run the downloaded tufn-windows.exe file',
                'Follow the setup wizard instructions',
                'Launch Tufn from Start Menu or desktop shortcut'
            ];
            break;
        case 'macos':
            downloadUrl = '/downloads/tufn-macos.dmg';
            fileName = 'tufn-macos.dmg';
            osName = 'macOS';
            instructions = [
                'Open the downloaded tufn-macos.dmg file',
                'Drag Tufn.app to the Applications folder',
                'Launch Tufn from Applications or Launchpad'
            ];
            break;
        case 'linux':
            downloadUrl = '/downloads/tufn-linux.deb';
            fileName = 'tufn-linux.deb';
            osName = 'Linux';
            instructions = [
                'Double-click the downloaded .deb file',
                'Install using your package manager',
                'Launch Tufn from applications menu or terminal'
            ];
            break;
        default:
            return;
    }
    
    // Update modal content
    downloadMessage.textContent = `Downloading Tufn for ${osName}...`;
    manualDownloadLink.href = downloadUrl;
    manualDownloadLink.textContent = `download ${fileName}`;
    
    // Update installation steps
    installSteps.forEach((step, index) => {
        if (instructions[index]) {
            step.textContent = instructions[index];
        }
    });
    
    // Show modal
    downloadModal.classList.add('active');
    
    // Start download after a brief delay
    setTimeout(() => {
        simulateDownload(fileName, osName);
    }, 1000);
}

function simulateDownload(fileName, osName) {
    // In a real implementation, this would trigger an actual download
    // For demo purposes, we'll just update the message
    downloadMessage.innerHTML = `
        Download complete! <br>
        <small>File: ${fileName}</small><br><br>
        If the download didn't start, <a href="#" id="manual-download" data-file="${fileName}">click here to download manually</a>.
    `;
    
    // Add event listener for manual download link
    const manualLink = document.getElementById('manual-download');
    if (manualLink) {
        manualLink.addEventListener('click', (e) => {
            e.preventDefault();
            // In a real implementation, this would trigger the download
            alert(`In a real implementation, this would download ${fileName}`);
        });
    }
}

// Close modal
modalCloseBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        downloadModal.classList.remove('active');
    });
});

downloadModal.addEventListener('click', (e) => {
    if (e.target === downloadModal) {
        downloadModal.classList.remove('active');
    }
});

// Task interactions
document.addEventListener('click', (e) => {
    // Task completion
    if (e.target.closest('.task-checkbox label')) {
        const checkbox = e.target.closest('.task-checkbox').querySelector('input[type="checkbox"]');
        checkbox.checked = !checkbox.checked;
        e.target.closest('.task-item').classList.toggle('completed');
    }
    
    // New note button
    if (e.target.closest('.new-note-btn')) {
        alert('In the actual app, this would open a new note editor.');
    }
    
    // Add task button
    if (e.target.closest('.add-task button')) {
        const input = e.target.closest('.add-task').querySelector('input');
        if (input.value.trim()) {
            alert(`In the actual app, this would add task: "${input.value}"`);
            input.value = '';
        }
    }
});

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    // Initialize clock
    updateClock();
    setInterval(updateClock, 60000); // Update every minute
    
    // Initialize calendar
    initCalendar();
    
    // Add some interactivity to canvas tools
    const canvasTools = document.querySelectorAll('.canvas-tool');
    canvasTools.forEach(tool => {
        tool.addEventListener('click', () => {
            canvasTools.forEach(t => t.classList.remove('active'));
            tool.classList.add('active');
        });
    });
    
    // Add filter functionality
    const filterBtns = document.querySelectorAll('.filter-btn');
    filterBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            filterBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
        });
    });
    
    // Calendar navigation
    const calendarNav = document.querySelector('.calendar-nav');
    if (calendarNav) {
        calendarNav.addEventListener('click', (e) => {
            if (e.target.closest('button')) {
                // In a real implementation, this would change the calendar month
                alert('In the actual app, this would navigate to the previous/next month.');
            }
        });
    }
    
    // Make app preview cards interactive
    const previewCards = document.querySelectorAll('.preview-card');
    previewCards.forEach(card => {
        card.addEventListener('click', () => {
            if (card.classList.contains('card-4')) {
                // Quick note card
                const noteText = prompt('Enter your quick note:');
                if (noteText) {
                    card.querySelector('.note-preview').textContent = noteText;
                }
            }
        });
    });
});
