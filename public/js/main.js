// Football Team Manager - Main JavaScript
class FootballApp {
    constructor() {
        this.currentUser = null;
        this.socket = null;
        this.matches = [];
        this.init();
    }

    async init() {
        // Initialize Socket.IO
        this.socket = io();
        this.setupSocketListeners();
        
        // Check if user is already logged in
        await this.checkAuthStatus();
        
        // Setup event listeners
        this.setupEventListeners();
    }

    setupSocketListeners() {
        this.socket.on('connect', () => {
            console.log('Connected to server');
            this.socket.emit('join-room', 'football-team');
        });

        this.socket.on('attendance-update', (data) => {
            this.handleAttendanceUpdate(data);
            this.showNotification('Attendance Updated', `${data.playerName} marked as ${data.status}`, 'info');
        });

        this.socket.on('new-match', (data) => {
            this.loadMatches();
            this.showNotification('New Match Scheduled', data.message, 'success');
        });

        this.socket.on('match-updated', (data) => {
            this.loadMatches();
            this.showNotification('Match Updated', data.message, 'info');
        });

        this.socket.on('match-notification', (data) => {
            this.showNotification('Match Reminder', data.message, 'warning');
        });
    }

    setupEventListeners() {
        // Registration form
        const registerForm = document.getElementById('register-form-element');
        if (registerForm) {
            registerForm.addEventListener('submit', (e) => this.handleRegistration(e));
        }

        // Login form
        const loginForm = document.getElementById('login-form-element');
        if (loginForm) {
            loginForm.addEventListener('submit', (e) => this.handleLogin(e));
        }

        // Admin registration form
        const adminForm = document.getElementById('admin-form-element');
        if (adminForm) {
            adminForm.addEventListener('submit', (e) => this.handleAdminRegistration(e));
        }

        // Logout button
        const logoutBtn = document.getElementById('logout-btn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => this.handleLogout());
        }

        // Admin button
        const adminBtn = document.getElementById('admin-btn');
        if (adminBtn) {
            adminBtn.addEventListener('click', () => {
                window.location.href = '/admin';
            });
        }

        // Profile button
        const profileBtn = document.getElementById('profile-btn');
        if (profileBtn) {
            profileBtn.addEventListener('click', () => this.showProfile());
        }
    }

    async checkAuthStatus() {
        try {
            const response = await fetch('/api/auth/me');
            if (response.ok) {
                const data = await response.json();
                this.currentUser = data.player;
                this.showDashboard();
                await this.loadUserData();
            } else {
                this.showWelcomeScreen();
            }
        } catch (error) {
            console.error('Auth check failed:', error);
            this.showWelcomeScreen();
        } finally {
            this.hideLoadingScreen();
        }
    }

    async handleRegistration(e) {
        e.preventDefault();
        const formData = new FormData(e.target);
        const data = Object.fromEntries(formData);

        try {
            const response = await fetch('/api/auth/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(data),
            });

            const result = await response.json();

            if (response.ok) {
                this.currentUser = result.player;
                this.showNotification('Welcome!', 'Profile created successfully', 'success');
                this.showDashboard();
                await this.loadUserData();
            } else {
                this.showNotification('Registration Failed', result.error, 'error');
            }
        } catch (error) {
            console.error('Registration error:', error);
            this.showNotification('Error', 'Registration failed. Please try again.', 'error');
        }
    }

    async handleLogin(e) {
        e.preventDefault();
        const formData = new FormData(e.target);
        const data = Object.fromEntries(formData);

        try {
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(data),
            });

            const result = await response.json();

            if (response.ok) {
                this.currentUser = result.player;
                this.showNotification('Welcome Back!', 'Login successful', 'success');
                this.showDashboard();
                await this.loadUserData();
            } else {
                this.showNotification('Login Failed', result.error, 'error');
            }
        } catch (error) {
            console.error('Login error:', error);
            this.showNotification('Error', 'Login failed. Please try again.', 'error');
        }
    }

    async handleAdminRegistration(e) {
        e.preventDefault();
        const formData = new FormData(e.target);
        const data = Object.fromEntries(formData);

        try {
            const response = await fetch('/api/auth/register-admin', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(data),
            });

            const result = await response.json();

            if (response.ok) {
                this.currentUser = result.player;
                this.showNotification('Admin Created!', 'Admin account created successfully', 'success');
                this.showDashboard();
                await this.loadUserData();
            } else {
                this.showNotification('Admin Creation Failed', result.error, 'error');
            }
        } catch (error) {
            console.error('Admin registration error:', error);
            this.showNotification('Error', 'Admin registration failed. Please try again.', 'error');
        }
    }

    async handleLogout() {
        try {
            await fetch('/api/auth/logout', { method: 'POST' });
            this.currentUser = null;
            this.showWelcomeScreen();
            this.showNotification('Goodbye!', 'Logged out successfully', 'info');
        } catch (error) {
            console.error('Logout error:', error);
        }
    }

    async loadUserData() {
        await Promise.all([
            this.loadUserProfile(),
            this.loadMatches()
        ]);
    }

    async loadUserProfile() {
        try {
            const response = await fetch(`/api/players/${this.currentUser.id}`);
            if (response.ok) {
                const data = await response.json();
                this.updateUserDisplay(data.player, data.stats);
            }
        } catch (error) {
            console.error('Error loading user profile:', error);
        }
    }

    async loadMatches() {
        try {
            const [upcomingResponse, allResponse] = await Promise.all([
                fetch('/api/matches/upcoming'),
                fetch('/api/matches/')
            ]);

            if (upcomingResponse.ok && allResponse.ok) {
                const upcomingData = await upcomingResponse.json();
                const allData = await allResponse.json();
                
                this.matches = allData.matches;
                this.displayUpcomingMatches(upcomingData.matches);
                this.displayRecentMatches(allData.matches.filter(m => new Date(m.match_date) <= new Date()));
            }
        } catch (error) {
            console.error('Error loading matches:', error);
        }
    }

    updateUserDisplay(player, stats) {
        document.getElementById('user-name').textContent = player.name;
        document.getElementById('user-position').textContent = this.getPositionName(player.position);
        
        if (player.jersey_number) {
            const jerseyElement = document.getElementById('user-jersey');
            jerseyElement.textContent = `#${player.jersey_number}`;
            jerseyElement.style.display = 'inline';
        }

        document.getElementById('user-matches').textContent = stats.matches_played || 0;
        document.getElementById('user-goals').textContent = stats.total_goals || 0;

        // Show admin button if user is admin
        if (player.is_admin) {
            document.getElementById('admin-btn').style.display = 'block';
        }
    }

    displayUpcomingMatches(matches) {
        const container = document.getElementById('upcoming-matches');
        
        if (matches.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <h3>No upcoming matches</h3>
                    <p>Check back later for new match schedules</p>
                </div>
            `;
            return;
        }

        container.innerHTML = matches.map(match => this.createMatchCard(match, true)).join('');
    }

    displayRecentMatches(matches) {
        const container = document.getElementById('recent-matches');
        const recentMatches = matches.slice(0, 5); // Show only 5 most recent
        
        if (recentMatches.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <h3>No recent matches</h3>
                    <p>Matches will appear here after they're completed</p>
                </div>
            `;
            return;
        }

        container.innerHTML = recentMatches.map(match => this.createMatchCard(match, false)).join('');
    }

    createMatchCard(match, isUpcoming) {
        const matchDate = new Date(match.match_date);
        const userStatus = match.user_status || 'out';
        
        return `
            <div class="match-card">
                <div class="match-header">
                    <h3 class="match-title">${match.title}</h3>
                    <div class="match-date">
                        ${matchDate.toLocaleDateString()} at ${matchDate.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                    </div>
                </div>
                
                <div class="match-info">
                    ${match.location ? `<div class="match-location">📍 ${match.location}</div>` : ''}
                    ${match.description ? `<div class="match-description">${match.description}</div>` : ''}
                </div>

                <div class="match-stats">
                    <div class="match-stat in">
                        <div class="match-stat-value">${match.players_in || 0}</div>
                        <div class="match-stat-label">In</div>
                    </div>
                    <div class="match-stat out">
                        <div class="match-stat-value">${match.players_out || 0}</div>
                        <div class="match-stat-label">Out</div>
                    </div>
                    <div class="match-stat">
                        <div class="match-stat-value">${match.players_maybe || 0}</div>
                        <div class="match-stat-label">Maybe</div>
                    </div>
                </div>

                ${isUpcoming ? `
                    <div class="match-actions">
                        <button class="attendance-btn in ${userStatus === 'in' ? 'active' : ''}" 
                                onclick="app.markAttendance(${match.id}, 'in')">
                            ✓ I'm In
                        </button>
                        <button class="attendance-btn out ${userStatus === 'out' ? 'active' : ''}" 
                                onclick="app.markAttendance(${match.id}, 'out')">
                            ✗ I'm Out
                        </button>
                        <button class="attendance-btn maybe ${userStatus === 'maybe' ? 'active' : ''}" 
                                onclick="app.markAttendance(${match.id}, 'maybe')">
                            ? Maybe
                        </button>
                    </div>
                ` : ''}
            </div>
        `;
    }

    async markAttendance(matchId, status) {
        try {
            const response = await fetch(`/api/matches/${matchId}/attendance`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ status }),
            });

            const result = await response.json();

            if (response.ok) {
                this.showNotification('Attendance Updated', `Marked as ${status}`, 'success');
                await this.loadMatches(); // Reload to show updated counts
            } else {
                this.showNotification('Error', result.error, 'error');
            }
        } catch (error) {
            console.error('Error marking attendance:', error);
            this.showNotification('Error', 'Failed to update attendance', 'error');
        }
    }

    handleAttendanceUpdate(data) {
        // Update the UI with real-time attendance changes
        const matchCards = document.querySelectorAll('.match-card');
        matchCards.forEach(card => {
            const matchId = card.querySelector('[onclick*="markAttendance"]')?.onclick?.toString().match(/markAttendance\((\d+)/)?.[1];
            if (matchId == data.matchId) {
                const inStat = card.querySelector('.match-stat.in .match-stat-value');
                const outStat = card.querySelector('.match-stat.out .match-stat-value');
                const maybeStat = card.querySelector('.match-stat .match-stat-value');
                
                if (inStat) inStat.textContent = data.attendanceCount.players_in || 0;
                if (outStat) outStat.textContent = data.attendanceCount.players_out || 0;
                if (maybeStat) maybeStat.textContent = data.attendanceCount.players_maybe || 0;
            }
        });
    }

    showProfile() {
        // TODO: Implement profile modal/page
        this.showNotification('Profile', 'Profile page coming soon!', 'info');
    }

    getPositionName(position) {
        const positions = {
            'GK': 'Goalkeeper',
            'DEF': 'Defender',
            'MID': 'Midfielder',
            'FWD': 'Forward'
        };
        return positions[position] || position;
    }

    showWelcomeScreen() {
        document.getElementById('loading-screen').style.display = 'none';
        document.getElementById('welcome-screen').style.display = 'flex';
        document.getElementById('dashboard').style.display = 'none';
    }

    showDashboard() {
        document.getElementById('loading-screen').style.display = 'none';
        document.getElementById('welcome-screen').style.display = 'none';
        document.getElementById('dashboard').style.display = 'block';
    }

    hideLoadingScreen() {
        document.getElementById('loading-screen').style.display = 'none';
    }

    showNotification(title, message, type = 'info') {
        const container = document.getElementById('notifications-container');
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        
        notification.innerHTML = `
            <button class="notification-close">&times;</button>
            <div class="notification-title">${title}</div>
            <div class="notification-message">${message}</div>
        `;

        container.appendChild(notification);

        // Close button functionality
        notification.querySelector('.notification-close').addEventListener('click', () => {
            notification.remove();
        });

        // Auto-remove after 5 seconds
        setTimeout(() => {
            if (notification.parentNode) {
                notification.remove();
            }
        }, 5000);
    }
}

// Auth form switching functions
function showRegisterForm() {
    document.getElementById('register-form').classList.add('active');
    document.getElementById('login-form').classList.remove('active');
    document.getElementById('admin-form').classList.remove('active');
}

function showLoginForm() {
    document.getElementById('register-form').classList.remove('active');
    document.getElementById('login-form').classList.add('active');
    document.getElementById('admin-form').classList.remove('active');
}

function showAdminForm() {
    document.getElementById('register-form').classList.remove('active');
    document.getElementById('login-form').classList.remove('active');
    document.getElementById('admin-form').classList.add('active');
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.app = new FootballApp();
});

// Service Worker registration for PWA functionality
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
            .then(registration => {
                console.log('SW registered: ', registration);
            })
            .catch(registrationError => {
                console.log('SW registration failed: ', registrationError);
            });
    });
}
