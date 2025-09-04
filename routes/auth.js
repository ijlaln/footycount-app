const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const db = require('../database/db');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// Register/Signup player
router.post('/register', async (req, res) => {
    try {
        const { username, password, name, position, jersey_number } = req.body;
        
        if (!username || !password || !name) {
            return res.status(400).json({ error: 'Username, password, and name are required' });
        }

        if (password.length < 4) {
            return res.status(400).json({ error: 'Password must be at least 4 characters long' });
        }

        // Check if username already exists
        const existingPlayer = await db.get(
            'SELECT * FROM players WHERE username = ?',
            [username]
        );

        if (existingPlayer) {
            return res.status(400).json({ error: 'Username already taken' });
        }

        // Check if jersey number is taken
        if (jersey_number) {
            const existingJersey = await db.get(
                'SELECT * FROM players WHERE jersey_number = ?',
                [jersey_number]
            );
            
            if (existingJersey) {
                return res.status(400).json({ error: 'Jersey number already taken' });
            }
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create new player
        const result = await db.run(
            'INSERT INTO players (username, password, name, position, jersey_number) VALUES (?, ?, ?, ?, ?)',
            [username, hashedPassword, name, position || 'MID', jersey_number]
        );

        const player = await db.get('SELECT * FROM players WHERE id = ?', [result.id]);
        
        // Generate token
        const token = jwt.sign(
            { id: player.id, username: player.username, name: player.name, is_admin: player.is_admin },
            JWT_SECRET,
            { expiresIn: '30d' }
        );

        res.cookie('token', token, { 
            httpOnly: true, 
            maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
        });

        res.json({
            success: true,
            message: 'Player registered successfully',
            player: {
                id: player.id,
                username: player.username,
                name: player.name,
                position: player.position,
                jersey_number: player.jersey_number,
                is_admin: player.is_admin
            }
        });

    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Register admin account (only if no admin exists)
router.post('/register-admin', async (req, res) => {
    try {
        const { username, password, name } = req.body;
        
        if (!username || !password || !name) {
            return res.status(400).json({ error: 'Username, password, and name are required' });
        }

        if (password.length < 4) {
            return res.status(400).json({ error: 'Password must be at least 4 characters long' });
        }

        // Check if any admin already exists
        const existingAdmin = await db.get(
            'SELECT * FROM players WHERE is_admin = 1 LIMIT 1'
        );

        if (existingAdmin) {
            return res.status(400).json({ error: 'Admin account already exists' });
        }

        // Check if username already exists
        const existingPlayer = await db.get(
            'SELECT * FROM players WHERE username = ?',
            [username]
        );

        if (existingPlayer) {
            return res.status(400).json({ error: 'Username already taken' });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create new admin
        const result = await db.run(
            'INSERT INTO players (username, password, name, position, is_admin) VALUES (?, ?, ?, ?, ?)',
            [username, hashedPassword, name, 'ADMIN', 1]
        );

        const admin = await db.get('SELECT * FROM players WHERE id = ?', [result.id]);
        
        // Generate token
        const token = jwt.sign(
            { id: admin.id, username: admin.username, name: admin.name, is_admin: admin.is_admin },
            JWT_SECRET,
            { expiresIn: '30d' }
        );

        res.cookie('token', token, { 
            httpOnly: true, 
            maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
        });

        res.json({
            success: true,
            message: 'Admin account created successfully',
            player: {
                id: admin.id,
                username: admin.username,
                name: admin.name,
                position: admin.position,
                is_admin: admin.is_admin
            }
        });

    } catch (error) {
        console.error('Admin registration error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Login player
router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        
        if (!username || !password) {
            return res.status(400).json({ error: 'Username and password are required' });
        }

        const player = await db.get(
            'SELECT * FROM players WHERE username = ?',
            [username]
        );

        if (!player) {
            return res.status(404).json({ error: 'Invalid username or password' });
        }

        // Check password
        const isValidPassword = await bcrypt.compare(password, player.password);
        if (!isValidPassword) {
            return res.status(404).json({ error: 'Invalid username or password' });
        }

        // Generate token
        const token = jwt.sign(
            { id: player.id, username: player.username, name: player.name, is_admin: player.is_admin },
            JWT_SECRET,
            { expiresIn: '30d' }
        );

        res.cookie('token', token, { 
            httpOnly: true, 
            maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
        });

        res.json({
            success: true,
            message: 'Login successful',
            player: {
                id: player.id,
                username: player.username,
                name: player.name,
                position: player.position,
                jersey_number: player.jersey_number,
                is_admin: player.is_admin
            }
        });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get current user
router.get('/me', async (req, res) => {
    try {
        const token = req.cookies.token;
        
        if (!token) {
            return res.status(401).json({ error: 'Not authenticated' });
        }

        const decoded = jwt.verify(token, JWT_SECRET);
        const player = await db.get('SELECT * FROM players WHERE id = ?', [decoded.id]);

        if (!player) {
            return res.status(404).json({ error: 'Player not found' });
        }

        res.json({
            player: {
                id: player.id,
                username: player.username,
                name: player.name,
                position: player.position,
                jersey_number: player.jersey_number,
                is_admin: player.is_admin
            }
        });

    } catch (error) {
        console.error('Auth error:', error);
        res.status(401).json({ error: 'Invalid token' });
    }
});

// Logout
router.post('/logout', (req, res) => {
    res.clearCookie('token');
    res.json({ success: true, message: 'Logged out successfully' });
});

// Change password
router.post('/change-password', async (req, res) => {
    try {
        const token = req.cookies.token;
        
        if (!token) {
            return res.status(401).json({ error: 'Not authenticated' });
        }

        const decoded = jwt.verify(token, JWT_SECRET);
        const { currentPassword, newPassword } = req.body;

        if (!currentPassword || !newPassword) {
            return res.status(400).json({ error: 'Current password and new password are required' });
        }

        if (newPassword.length < 4) {
            return res.status(400).json({ error: 'New password must be at least 4 characters long' });
        }

        // Get current user
        const user = await db.get('SELECT * FROM players WHERE id = ?', [decoded.id]);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Verify current password
        const isValidPassword = await bcrypt.compare(currentPassword, user.password);
        if (!isValidPassword) {
            return res.status(400).json({ error: 'Current password is incorrect' });
        }

        // Hash new password
        const hashedNewPassword = await bcrypt.hash(newPassword, 10);

        // Update password
        await db.run(`
            UPDATE players 
            SET password = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `, [hashedNewPassword, decoded.id]);

        res.json({
            success: true,
            message: 'Password changed successfully'
        });

    } catch (error) {
        console.error('Password change error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
