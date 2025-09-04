// FootyCount - Profile Page JavaScript
class ProfileApp {
    constructor() {
        this.currentUser = null;
        this.socket = null;
        this.isEditing = false;
        this.init();
    }

    async init() {
        // Initialize Socket.IO
        this.socket = io();
        this.setupSocketListeners();
        
        // Check authentication
        await this.checkAuthStatus();
        
        // Setup event listeners
        this.setupEventListeners();
        
        // Load profile data
        await this.loadProfileData();
    }

    setupSocketListeners() {
        this.socket.on('connect', () => {
            console.log('Connected to server');
            this.socket.emit('join-room', 'football-team');
        });
    }

    setupEventListeners() {
        // Edit profile button
        const editBtn = document.getElementById('edit-profile-btn');
        if (editBtn) {
            editBtn.addEventListener('click', () => this.toggleEditMode());
        }

        // Cancel edit button
        const cancelBtn = document.getElementById('cancel-edit-btn');
        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => this.cancelEdit());
        }

        // Profile form submit
        const profileForm = document.getElementById('profile-form');
        if (profileForm) {
            profileForm.addEventListener('submit', (e) => this.handleProfileUpdate(e));
        }

        // Change password button
        const changePasswordBtn = document.getElementById('change-password-btn');
        if (changePasswordBtn) {
            changePasswordBtn.addEventListener('click', () => this.showPasswordModal());
        }

        // Password form submit
        const passwordForm = document.getElementById('password-form');
        if (passwordForm) {
            passwordForm.addEventListener('submit', (e) => this.handlePasswordChange(e));
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

        // Modal close
        const modal = document.getElementById('password-modal');
        const closeBtn = modal.querySelector('.close');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.closePasswordModal());
        }

        // Close modal when clicking outside
        window.addEventListener('click', (e) => {
            if (e.target === modal) {
                this.closePasswordModal();
            }
        });
    }

    async checkAuthStatus() {
        try {
            const response = await fetch('/api/auth/me', {
                credentials: 'include'
            });
            if (response.ok) {
                const data = await response.json();
                this.currentUser = data.player;
                this.updateUserInterface();
            } else {
                window.location.href = '/';
            }
        } catch (error) {
            console.error('Auth check failed:', error);
            window.location.href = '/';
        }
    }

    updateUserInterface() {
        if (!this.currentUser) return;

        // Show admin button if user is admin
        const adminBtn = document.getElementById('admin-btn');
        if (adminBtn && this.currentUser.is_admin) {
            adminBtn.style.display = 'block';
        }
    }

    async loadProfileData() {
        if (!this.currentUser) return;

        try {
            // Update profile header
            this.updateProfileHeader();

            // Load player statistics
            await this.loadPlayerStats();

            // Load recent activity
            await this.loadRecentActivity();

            // Update profile details
            this.updateProfileDetails();

        } catch (error) {
            console.error('Error loading profile data:', error);
            this.showNotification('Error', 'Failed to load profile data', 'error');
        }
    }

    updateProfileHeader() {
        const user = this.currentUser;
        
        // Set initials
        const initials = user.name.split(' ').map(n => n[0]).join('').toUpperCase();
        document.getElementById('profile-initials').textContent = initials;
        
        // Set name and position
        document.getElementById('profile-name').textContent = user.name;
        document.getElementById('profile-position').textContent = this.getPositionName(user.position);
        
        // Show jersey badge if user has jersey number
        if (user.jersey_number) {
            document.getElementById('jersey-badge').style.display = 'inline-flex';
            document.getElementById('jersey-number').textContent = user.jersey_number;
        }
        
        // Show admin badge if user is admin
        if (user.is_admin) {
            document.getElementById('admin-badge').style.display = 'inline-flex';
        }
    }

    async loadPlayerStats() {
        try {
            const response = await fetch('/api/players/stats', {
                credentials: 'include'
            });
            if (response.ok) {
                const stats = await response.json();
                
                document.getElementById('total-matches').textContent = stats.totalMatches || 0;
                document.getElementById('attended-matches').textContent = stats.attendedMatches || 0;
                document.getElementById('attendance-rate').textContent = `${stats.attendanceRate || 0}%`;
                document.getElementById('total-goals').textContent = stats.totalGoals || 0;
            }
        } catch (error) {
            console.error('Error loading player stats:', error);
        }
    }

    async loadRecentActivity() {
        try {
            const response = await fetch('/api/players/activity', {
                credentials: 'include'
            });
            if (response.ok) {
                const activities = await response.json();
                this.renderRecentActivity(activities);
            }
        } catch (error) {
            console.error('Error loading recent activity:', error);
        }
    }

    renderRecentActivity(activities) {
        const container = document.getElementById('recent-activity');
        
        if (!activities || activities.length === 0) {
            container.innerHTML = '<p style="text-align: center; color: var(--text-light); padding: 20px;">No recent activity</p>';
            return;
        }

        const html = activities.map(activity => `
            <div class="activity-item">
                <div class="activity-icon ${activity.type}">
                    ${this.getActivityIcon(activity.type)}
                </div>
                <div class="activity-info">
                    <div class="activity-text">${activity.description}</div>
                    <div class="activity-time">${this.formatActivityTime(activity.created_at)}</div>
                </div>
            </div>
        `).join('');

        container.innerHTML = html;
    }

    getActivityIcon(type) {
        const icons = {
            'attendance': '✅',
            'match': '⚽',
            'profile': '👤',
            'goal': '🥅'
        };
        return icons[type] || '📝';
    }

    formatActivityTime(timestamp) {
        const date = new Date(timestamp);
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMins / 60);
        const diffDays = Math.floor(diffHours / 24);

        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins} minutes ago`;
        if (diffHours < 24) return `${diffHours} hours ago`;
        if (diffDays < 7) return `${diffDays} days ago`;
        
        return date.toLocaleDateString();
    }

    updateProfileDetails() {
        const user = this.currentUser;
        
        document.getElementById('view-username').textContent = user.username;
        document.getElementById('view-name').textContent = user.name;
        document.getElementById('view-position').textContent = this.getPositionName(user.position);
        document.getElementById('view-jersey').textContent = user.jersey_number || 'Not assigned';
        
        // Format join date - handle SQLite datetime format
        let joinDate;
        if (user.created_at) {
            // SQLite returns datetime as string, try to parse it
            joinDate = new Date(user.created_at.replace(' ', 'T'));
            if (isNaN(joinDate.getTime())) {
                // If parsing fails, try without replacement
                joinDate = new Date(user.created_at);
            }
        }
        
        if (joinDate && !isNaN(joinDate.getTime())) {
            document.getElementById('view-joined').textContent = joinDate.toLocaleDateString();
        } else {
            document.getElementById('view-joined').textContent = 'Unknown';
        }
    }

    toggleEditMode() {
        this.isEditing = !this.isEditing;
        
        if (this.isEditing) {
            this.showEditMode();
        } else {
            this.showViewMode();
        }
    }

    showEditMode() {
        const user = this.currentUser;
        
        // Hide view mode, show edit mode
        document.getElementById('profile-view').style.display = 'none';
        document.getElementById('profile-edit').style.display = 'block';
        
        // Populate edit form
        document.getElementById('edit-name').value = user.name;
        document.getElementById('edit-position').value = user.position;
        document.getElementById('edit-jersey').value = user.jersey_number || '';
        
        // Update button text
        document.getElementById('edit-profile-btn').innerHTML = '✖️ Cancel Edit';
    }

    showViewMode() {
        // Show view mode, hide edit mode
        document.getElementById('profile-view').style.display = 'block';
        document.getElementById('profile-edit').style.display = 'none';
        
        // Update button text
        document.getElementById('edit-profile-btn').innerHTML = '✏️ Edit Profile';
    }

    cancelEdit() {
        this.isEditing = false;
        this.showViewMode();
    }

    async handleProfileUpdate(e) {
        e.preventDefault();
        const formData = new FormData(e.target);
        const data = Object.fromEntries(formData);

        console.log('Frontend profile update data:', data);

        try {
            const response = await fetch('/api/players/profile', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                credentials: 'include',
                body: JSON.stringify(data),
            });

            const result = await response.json();
            console.log('Profile update response:', result);

            if (response.ok) {
                console.log('Current user before update:', this.currentUser);
                this.currentUser = { ...this.currentUser, ...result.player };
                console.log('Current user after update:', this.currentUser);
                this.updateProfileHeader();
                this.updateProfileDetails();
                this.showViewMode();
                this.isEditing = false;
                this.showNotification('Success', 'Profile updated successfully', 'success');
            } else {
                this.showNotification('Error', result.error, 'error');
            }
        } catch (error) {
            console.error('Profile update error:', error);
            this.showNotification('Error', 'Failed to update profile', 'error');
        }
    }

    showPasswordModal() {
        document.getElementById('password-modal').style.display = 'block';
        document.getElementById('password-form').reset();
    }

    closePasswordModal() {
        document.getElementById('password-modal').style.display = 'none';
    }

    async handlePasswordChange(e) {
        e.preventDefault();
        const formData = new FormData(e.target);
        const data = Object.fromEntries(formData);

        // Validate passwords match
        if (data.newPassword !== data.confirmPassword) {
            this.showNotification('Error', 'New passwords do not match', 'error');
            return;
        }

        try {
            const response = await fetch('/api/auth/change-password', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    currentPassword: data.currentPassword,
                    newPassword: data.newPassword
                }),
            });

            const result = await response.json();

            if (response.ok) {
                this.closePasswordModal();
                this.showNotification('Success', 'Password changed successfully', 'success');
            } else {
                this.showNotification('Error', result.error, 'error');
            }
        } catch (error) {
            console.error('Password change error:', error);
            this.showNotification('Error', 'Failed to change password', 'error');
        }
    }

    async handleLogout() {
        try {
            await fetch('/api/auth/logout', { method: 'POST' });
            window.location.href = '/';
        } catch (error) {
            console.error('Logout error:', error);
            window.location.href = '/';
        }
    }

    getPositionName(position) {
        const positions = {
            'GK': 'Goalkeeper',
            'DEF': 'Defender',
            'MID': 'Midfielder',
            'FWD': 'Forward',
            'ADMIN': 'Administrator'
        };
        return positions[position] || position;
    }

    showNotification(title, message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.innerHTML = `
            <div class="notification-content">
                <strong>${title}</strong>
                <p>${message}</p>
            </div>
        `;

        const container = document.getElementById('notifications-container');
        container.appendChild(notification);

        setTimeout(() => {
            notification.classList.add('show');
        }, 100);

        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, 4000);
    }
}

// Global functions for modal control
function closePasswordModal() {
    if (window.profileApp) {
        window.profileApp.closePasswordModal();
    }
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.profileApp = new ProfileApp();
});
