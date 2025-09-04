// FootyCount - Admin Panel JavaScript
class AdminApp {
    constructor() {
        this.currentUser = null;
        this.socket = null;
        this.activeTab = 'matches';
        this.matches = [];
        this.players = [];
        this.init();
    }

    async init() {
        // Initialize Socket.IO
        this.socket = io();
        this.setupSocketListeners();
        
        // Check admin authentication
        await this.checkAuthStatus();
        
        // Setup event listeners
        this.setupEventListeners();
        
        // Load initial data
        await this.loadDashboardData();
    }

    setupSocketListeners() {
        this.socket.on('connect', () => {
            console.log('Admin connected to server');
            this.socket.emit('join-room', 'football-admin');
        });

        this.socket.on('attendance-update', (data) => {
            this.handleAttendanceUpdate(data);
        });

        this.socket.on('new-match', () => {
            this.loadMatches();
        });
    }

    setupEventListeners() {
        // Tab switching
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.switchTab(e.target.dataset.tab);
            });
        });

        // Modal controls
        document.querySelector('.close').addEventListener('click', () => {
            this.closeMatchModal();
        });

        window.addEventListener('click', (e) => {
            const modal = document.getElementById('match-modal');
            if (e.target === modal) {
                this.closeMatchModal();
            }
        });

        // Match form
        document.getElementById('match-form').addEventListener('submit', (e) => {
            this.handleMatchSubmit(e);
        });

        // Create match buttons
        document.getElementById('create-match-btn').addEventListener('click', () => {
            this.showCreateMatchModal();
        });

        document.getElementById('add-match-btn').addEventListener('click', () => {
            this.showCreateMatchModal();
        });

        // Logout
        document.getElementById('logout-btn').addEventListener('click', () => {
            this.handleLogout();
        });

        // Players search
        document.getElementById('players-search').addEventListener('input', (e) => {
            this.filterPlayers(e.target.value);
        });
    }

    async checkAuthStatus() {
        try {
            const response = await fetch('/api/auth/me');
            if (response.ok) {
                const data = await response.json();
                if (!data.player.is_admin) {
                    window.location.href = '/';
                    return;
                }
                this.currentUser = data.player;
            } else {
                window.location.href = '/';
            }
        } catch (error) {
            console.error('Auth check failed:', error);
            window.location.href = '/';
        }
    }

    async loadDashboardData() {
        await Promise.all([
            this.loadDashboardStats(),
            this.loadMatches(),
            this.loadPlayers(),
            this.loadRecentActivity()
        ]);
    }

    async loadDashboardStats() {
        try {
            const response = await fetch('/api/admin/dashboard');
            if (response.ok) {
                const data = await response.json();
                this.updateDashboardStats(data.stats);
            }
        } catch (error) {
            console.error('Error loading dashboard stats:', error);
        }
    }

    updateDashboardStats(stats) {
        document.getElementById('total-players').textContent = stats.totalPlayers;
        document.getElementById('upcoming-matches').textContent = stats.upcomingMatches;
        document.getElementById('avg-attendance').textContent = `${stats.averageAttendance}%`;
        document.getElementById('month-matches').textContent = stats.thisMonthMatches;
    }

    async loadMatches() {
        try {
            const response = await fetch('/api/matches/');
            if (response.ok) {
                const data = await response.json();
                this.matches = data.matches;
                this.displayMatches();
            }
        } catch (error) {
            console.error('Error loading matches:', error);
        }
    }

    async loadPlayers() {
        try {
            const response = await fetch('/api/admin/players');
            if (response.ok) {
                const data = await response.json();
                this.players = data.players;
                this.displayPlayers();
            }
        } catch (error) {
            console.error('Error loading players:', error);
        }
    }

    async loadRecentActivity() {
        try {
            const response = await fetch('/api/admin/dashboard');
            if (response.ok) {
                const data = await response.json();
                this.displayRecentActivity(data.recentActivity);
            }
        } catch (error) {
            console.error('Error loading recent activity:', error);
        }
    }

    displayMatches() {
        const container = document.getElementById('matches-list');
        
        if (this.matches.length === 0) {
            container.innerHTML = '<div class="empty-state"><h3>No matches found</h3><p>Create your first match to get started</p></div>';
            return;
        }

        container.innerHTML = this.matches.map(match => {
            const matchDate = new Date(match.match_date);
            const isUpcoming = matchDate > new Date();
            
            return `
                <div class="admin-item">
                    <div class="admin-item-header">
                        <h3 class="admin-item-title">${match.title}</h3>
                        <div class="admin-item-actions">
                            <button class="btn btn-sm btn-secondary" onclick="adminApp.editMatch(${match.id})">
                                Edit
                            </button>
                            <button class="btn btn-sm btn-danger" onclick="adminApp.deleteMatch(${match.id})">
                                Delete
                            </button>
                        </div>
                    </div>
                    
                    <div class="admin-item-info">
                        <div class="info-item">
                            <div class="info-label">Date & Time</div>
                            <div class="info-value">
                                ${matchDate.toLocaleDateString()} at ${matchDate.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                            </div>
                        </div>
                        <div class="info-item">
                            <div class="info-label">Location</div>
                            <div class="info-value">${match.location || 'Not specified'}</div>
                        </div>
                        <div class="info-item">
                            <div class="info-label">Status</div>
                            <div class="info-value">
                                <span class="status-badge ${isUpcoming ? 'scheduled' : 'completed'}">
                                    ${isUpcoming ? 'Scheduled' : 'Completed'}
                                </span>
                            </div>
                        </div>
                        <div class="info-item">
                            <div class="info-label">Attendance</div>
                            <div class="info-value">
                                <span style="color: var(--success-color);">${match.players_in || 0} In</span> / 
                                <span style="color: var(--danger-color);">${match.players_out || 0} Out</span>
                            </div>
                        </div>
                    </div>
                    
                    ${match.description ? `<p style="color: var(--text-light); margin-top: 10px;">${match.description}</p>` : ''}
                </div>
            `;
        }).join('');
    }

    displayPlayers() {
        const container = document.getElementById('players-list');
        
        if (this.players.length === 0) {
            container.innerHTML = '<div class="empty-state"><h3>No players found</h3><p>Players will appear here when they register</p></div>';
            return;
        }

        container.innerHTML = this.players.map(player => `
            <div class="admin-item" data-player-name="${player.name.toLowerCase()}">
                <div class="admin-item-header">
                    <h3 class="admin-item-title">
                        ${player.name}
                        ${player.jersey_number ? `#${player.jersey_number}` : ''}
                        ${player.is_admin ? '<span class="status-badge" style="background: var(--warning-color);">Admin</span>' : ''}
                    </h3>
                    <div class="admin-item-actions">
                        <button class="btn btn-sm ${player.is_admin ? 'btn-warning' : 'btn-secondary'}" 
                                onclick="adminApp.toggleAdmin(${player.id}, ${!player.is_admin})">
                            ${player.is_admin ? 'Remove Admin' : 'Make Admin'}
                        </button>
                        <button class="btn btn-sm btn-danger" onclick="adminApp.deletePlayer(${player.id})">
                            Delete
                        </button>
                    </div>
                </div>
                
                <div class="admin-item-info">
                    <div class="info-item">
                        <div class="info-label">Position</div>
                        <div class="info-value">${this.getPositionName(player.position)}</div>
                    </div>
                    <div class="info-item">
                        <div class="info-label">Username</div>
                        <div class="info-value">${player.username}</div>
                    </div>
                    <div class="info-item">
                        <div class="info-label">Matches Attended</div>
                        <div class="info-value">${player.matches_attended || 0}</div>
                    </div>
                    <div class="info-item">
                        <div class="info-label">Goals</div>
                        <div class="info-value">${player.total_goals || 0}</div>
                    </div>
                    <div class="info-item">
                        <div class="info-label">Attendance Rate</div>
                        <div class="info-value">${player.attendance_percentage || 0}%</div>
                    </div>
                </div>
            </div>
        `).join('');
    }

    displayRecentActivity(activities) {
        const container = document.getElementById('activity-list');
        
        if (!activities || activities.length === 0) {
            container.innerHTML = '<div class="empty-state"><h3>No recent activity</h3><p>Activity will appear here as players interact with matches</p></div>';
            return;
        }

        container.innerHTML = activities.map(activity => {
            const timestamp = new Date(activity.timestamp);
            return `
                <div class="activity-item ${activity.type}">
                    <div class="activity-header">
                        <div class="activity-title">
                            ${activity.player_name} marked ${activity.status} for "${activity.match_title}"
                        </div>
                        <div class="activity-time">
                            ${timestamp.toLocaleDateString()} ${timestamp.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }

    switchTab(tabName) {
        // Update active tab button
        document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
        document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
        
        // Update active tab content
        document.querySelectorAll('.tab-pane').forEach(pane => pane.classList.remove('active'));
        document.getElementById(`${tabName}-tab`).classList.add('active');
        
        this.activeTab = tabName;
    }

    showCreateMatchModal() {
        document.getElementById('match-modal-title').textContent = 'Schedule New Match';
        document.getElementById('match-form').reset();
        document.getElementById('match-id').value = '';
        document.getElementById('match-modal').style.display = 'block';
    }

    closeMatchModal() {
        document.getElementById('match-modal').style.display = 'none';
    }

    async handleMatchSubmit(e) {
        e.preventDefault();
        const formData = new FormData(e.target);
        const data = Object.fromEntries(formData);
        
        // Combine date and time
        const matchDateTime = `${data.date}T${data.time}:00`;
        
        const matchData = {
            title: data.title,
            description: data.description,
            match_date: matchDateTime,
            location: data.location
        };

        const matchId = document.getElementById('match-id').value;
        const isEdit = !!matchId;
        
        try {
            const response = await fetch(
                isEdit ? `/api/admin/matches/${matchId}` : '/api/admin/matches',
                {
                    method: isEdit ? 'PUT' : 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(matchData),
                }
            );

            const result = await response.json();

            if (response.ok) {
                this.showNotification(
                    isEdit ? 'Match Updated' : 'Match Created', 
                    result.message, 
                    'success'
                );
                this.closeMatchModal();
                await this.loadMatches();
                await this.loadDashboardStats();
            } else {
                this.showNotification('Error', result.error, 'error');
            }
        } catch (error) {
            console.error('Error saving match:', error);
            this.showNotification('Error', 'Failed to save match', 'error');
        }
    }

    async editMatch(matchId) {
        const match = this.matches.find(m => m.id === matchId);
        if (!match) return;

        const matchDate = new Date(match.match_date);
        
        document.getElementById('match-modal-title').textContent = 'Edit Match';
        document.getElementById('match-id').value = matchId;
        document.getElementById('match-title').value = match.title;
        document.getElementById('match-description').value = match.description || '';
        document.getElementById('match-date').value = matchDate.toISOString().split('T')[0];
        document.getElementById('match-time').value = matchDate.toTimeString().slice(0, 5);
        document.getElementById('match-location').value = match.location || '';
        
        document.getElementById('match-modal').style.display = 'block';
    }

    async deleteMatch(matchId) {
        if (!confirm('Are you sure you want to delete this match? This action cannot be undone.')) {
            return;
        }

        try {
            const response = await fetch(`/api/admin/matches/${matchId}`, {
                method: 'DELETE'
            });

            const result = await response.json();

            if (response.ok) {
                this.showNotification('Match Deleted', result.message, 'success');
                await this.loadMatches();
                await this.loadDashboardStats();
            } else {
                this.showNotification('Error', result.error, 'error');
            }
        } catch (error) {
            console.error('Error deleting match:', error);
            this.showNotification('Error', 'Failed to delete match', 'error');
        }
    }

    async toggleAdmin(playerId, makeAdmin) {
        try {
            const response = await fetch(`/api/admin/players/${playerId}/admin`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ is_admin: makeAdmin }),
            });

            const result = await response.json();

            if (response.ok) {
                this.showNotification(
                    'Player Updated', 
                    result.message, 
                    'success'
                );
                await this.loadPlayers();
            } else {
                this.showNotification('Error', result.error, 'error');
            }
        } catch (error) {
            console.error('Error updating player admin status:', error);
            this.showNotification('Error', 'Failed to update player', 'error');
        }
    }

    async deletePlayer(playerId) {
        if (!confirm('Are you sure you want to delete this player? This action cannot be undone and will remove all their data.')) {
            return;
        }

        try {
            const response = await fetch(`/api/admin/players/${playerId}`, {
                method: 'DELETE'
            });

            const result = await response.json();

            if (response.ok) {
                this.showNotification('Player Deleted', result.message, 'success');
                await this.loadPlayers();
                await this.loadDashboardStats();
            } else {
                this.showNotification('Error', result.error, 'error');
            }
        } catch (error) {
            console.error('Error deleting player:', error);
            this.showNotification('Error', 'Failed to delete player', 'error');
        }
    }

    filterPlayers(searchTerm) {
        const playerItems = document.querySelectorAll('#players-list .admin-item');
        const term = searchTerm.toLowerCase();

        playerItems.forEach(item => {
            const playerName = item.dataset.playerName;
            if (playerName.includes(term)) {
                item.style.display = 'block';
            } else {
                item.style.display = 'none';
            }
        });
    }

    handleAttendanceUpdate(data) {
        // Reload dashboard stats and recent activity
        this.loadDashboardStats();
        this.loadRecentActivity();
    }

    async handleLogout() {
        try {
            await fetch('/api/auth/logout', { method: 'POST' });
            window.location.href = '/';
        } catch (error) {
            console.error('Logout error:', error);
        }
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

// Initialize admin app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.adminApp = new AdminApp();
});
