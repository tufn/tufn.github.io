const themeToggle = document.getElementById('theme-toggle');
const reviewForm = document.getElementById('review-form');
const feedbackForm = document.getElementById('feedback-form');
const starRating = document.querySelector('.star-rating');
const ratingValue = document.getElementById('rating-value');
const successModal = document.getElementById('success-modal');
const successMessage = document.getElementById('success-message');
const modalCloseBtns = document.querySelectorAll('.modal-close, .modal-close-btn');
const mobileMenuBtn = document.querySelector('.mobile-menu-btn');
const navLinks = document.querySelector('.nav-links');

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

if (localStorage.getItem('theme') === 'dark') {
    document.body.classList.add('dark-theme');
    themeToggle.querySelector('i').className = 'fas fa-sun';
}

if (starRating) {
    const stars = starRating.querySelectorAll('i');
    let currentRating = parseInt(ratingValue.value);
    
    updateStars(currentRating);
    
    stars.forEach(star => {
        star.addEventListener('click', () => {
            const rating = parseInt(star.dataset.rating);
            currentRating = rating;
            ratingValue.value = rating;
            updateStars(rating);
        });
        
        star.addEventListener('mouseover', () => {
            const rating = parseInt(star.dataset.rating);
            updateStars(rating, false);
        });
        
        star.addEventListener('mouseout', () => {
            updateStars(currentRating);
        });
    });
    
    function updateStars(rating, save = true) {
        if (save) currentRating = rating;
        stars.forEach(star => {
            const starRating = parseInt(star.dataset.rating);
            if (starRating <= rating) {
                star.className = 'fas fa-star active';
            } else {
                star.className = 'far fa-star';
            }
        });
    }
}

if (reviewForm) {
    reviewForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const formData = new FormData(reviewForm);
        const data = {
            name: sanitizeInput(formData.get('name')),
            email: formData.get('email') ? sanitizeInput(formData.get('email')) : undefined,
            rating: parseInt(formData.get('rating')),
            content: sanitizeInput(formData.get('content'))
        };
        
        if (data.name.length < 2 || data.name.length > 50) {
            showError('Name must be between 2 and 50 characters');
            return;
        }
        
        if (data.email && !isValidEmail(data.email)) {
            showError('Please enter a valid email address');
            return;
        }
        
        if (data.content.length < 10 || data.content.length > 500) {
            showError('Review must be between 10 and 500 characters');
            return;
        }
        
        try {
            const response = await fetch('/api/reviews', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            
            const result = await response.json();
            
            if (response.ok) {
                showSuccess('Thank you for your review! It will appear after moderation.');
                reviewForm.reset();
                updateStars(5);
                loadAndDisplayReviews();
            } else {
                showError(result.error || 'Failed to submit review');
            }
        } catch (error) {
            console.error('Error submitting review:', error);
            showError('Network error. Please try again.');
        }
    });
}

if (feedbackForm) {
    feedbackForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const formData = new FormData(feedbackForm);
        const data = {
            name: sanitizeInput(formData.get('name')),
            email: sanitizeInput(formData.get('email')),
            type: formData.get('type'),
            message: sanitizeInput(formData.get('message'))
        };
        
        if (data.name.length < 2 || data.name.length > 100) {
            showError('Name must be between 2 and 100 characters');
            return;
        }
        
        if (!isValidEmail(data.email)) {
            showError('Please enter a valid email address');
            return;
        }
        
        if (!data.type) {
            showError('Please select a feedback type');
            return;
        }
        
        if (data.message.length < 10 || data.message.length > 1000) {
            showError('Message must be between 10 and 1000 characters');
            return;
        }
        
        try {
            const response = await fetch('/api/feedback', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            
            const result = await response.json();
            
            if (response.ok) {
                showSuccess('Thank you for your feedback! We\'ll get back to you soon.');
                feedbackForm.reset();
            } else {
                showError(result.error || 'Failed to submit feedback');
            }
        } catch (error) {
            console.error('Error submitting feedback:', error);
            showError('Network error. Please try again.');
        }
    });
}

modalCloseBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        successModal.classList.remove('active');
    });
});

successModal.addEventListener('click', (e) => {
    if (e.target === successModal) {
        successModal.classList.remove('active');
    }
});

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

async function loadAndDisplayReviews() {
    try {
        const response = await fetch('/api/reviews');
        
        if (!response.ok) {
            throw new Error(`API error: ${response.status}`);
        }
        
        const result = await response.json();
        
        if (result.success && result.data && result.data.length > 0) {
            displayReviews(result.data);
            updateReviewStats(result.stats);
        }
    } catch (error) {
        console.error('Error loading reviews:', error);
    }
}

function displayReviews(reviews) {
    const reviewsList = document.querySelector('.reviews-list');
    if (!reviewsList) return;
    
    reviewsList.innerHTML = '';
    
    reviews.sort((a, b) => new Date(b.date) - new Date(a.date));
    
    const reviewsToShow = reviews.slice(0, 3);
    
    reviewsToShow.forEach(review => {
        const reviewCard = createReviewCard(review);
        reviewsList.appendChild(reviewCard);
    });
}

function createReviewCard(review) {
    const card = document.createElement('div');
    card.className = 'review-card';
    
    const reviewDate = new Date(review.date);
    const timeDiff = Date.now() - reviewDate.getTime();
    const daysAgo = Math.floor(timeDiff / (1000 * 3600 * 24));
    const dateText = daysAgo === 0 ? 'Today' : 
                    daysAgo === 1 ? 'Yesterday' : 
                    `${daysAgo} days ago`;
    
    const nameParts = review.name.split(' ');
    const initials = nameParts.length > 1 
        ? `${nameParts[0][0]}${nameParts[1][0]}`.toUpperCase()
        : review.name.substring(0, 2).toUpperCase();
    
    let starsHtml = '';
    for (let i = 1; i <= 5; i++) {
        if (i <= review.rating) {
            starsHtml += '<i class="fas fa-star"></i>';
        } else {
            starsHtml += '<i class="far fa-star"></i>';
        }
    }
    
    card.innerHTML = `
        <div class="review-header">
            <div class="reviewer">
                <div class="reviewer-avatar">${initials}</div>
                <div class="reviewer-info">
                    <div class="reviewer-name">${review.name}</div>
                    <div class="review-date">${dateText}</div>
                </div>
            </div>
            <div class="review-rating">
                ${starsHtml}
            </div>
        </div>
        <div class="review-content">
            "${review.content}"
        </div>
    `;
    
    return card;
}

function updateReviewStats(stats) {
    if (!stats) return;
    
    const averageRatingEl = document.querySelector('.rating-number');
    if (averageRatingEl && stats.average) {
        averageRatingEl.textContent = stats.average.toFixed(1);
    }
    
    const ratingCountEl = document.querySelector('.rating-count');
    if (ratingCountEl && stats.total) {
        ratingCountEl.textContent = `Based on ${stats.total} reviews`;
    }
    
    const heroStatNumber = document.querySelector('.hero-stats .stat:nth-child(2) .stat-number');
    if (heroStatNumber && stats.average) {
        heroStatNumber.textContent = stats.average.toFixed(1);
    }
    
    updateRatingBars(stats);
}

function updateRatingBars(stats) {
    if (!stats.distribution) return;
    
    const total = stats.total || 1;
    const distributions = [
        { stars: 5, count: stats.distribution[5] || 0 },
        { stars: 4, count: stats.distribution[4] || 0 },
        { stars: 3, count: stats.distribution[3] || 0 },
        { stars: 2, count: stats.distribution[2] || 0 },
        { stars: 1, count: stats.distribution[1] || 0 }
    ];
    
    const ratingBars = document.querySelectorAll('.rating-bar');
    ratingBars.forEach((bar, index) => {
        if (distributions[index]) {
            const percentage = total > 0 ? Math.round((distributions[index].count / total) * 100) : 0;
            const fill = bar.querySelector('.fill');
            if (fill) {
                fill.style.width = `${percentage}%`;
            }
            const percentageSpan = bar.querySelector('span:last-child');
            if (percentageSpan) {
                percentageSpan.textContent = `${percentage}%`;
            }
        }
    });
}

document.addEventListener('DOMContentLoaded', async () => {
    await loadAndDisplayReviews();
});

function sanitizeInput(input) {
    const div = document.createElement('div');
    div.textContent = input;
    return div.innerHTML;
}

function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

function showSuccess(message) {
    successMessage.textContent = message;
    successModal.classList.add('active');
}

function showError(message) {
    alert(`Error: ${message}`);
}
