const express = require('express');
const jwt = require('jsonwebtoken');
const moment = require('moment');
const db = require('../database/db');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// Middleware to verify token and admin status
const verifyAdmin = (req, res, next) => {
    const token = req.cookies.token;
    
    if (!token) {
        return res.status(401).json({ error: 'Access denied' });
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        
        if (!decoded.is_admin) {
            return res.status(403).json({ error: 'Admin access required' });
        }
        
        req.user = decoded;
        next();
    } catch (error) {
        res.status(400).json({ error: 'Invalid token' });
    }
};

// Create new match
router.post('/matches', verifyAdmin, async (req, res) => {
    try {
        const { title, description, match_date, location } = req.body;
        
        if (!title || !match_date) {
            return res.status(400).json({ error: 'Title and match date are required' });
        }

        const result = await db.run(`
            INSERT INTO matches (title, description, match_date, location, created_by)
            VALUES (?, ?, ?, ?, ?)
        `, [title, description, match_date, location, req.user.id]);

        const match = await db.get('SELECT * FROM matches WHERE id = ?', [result.id]);

        // Emit real-time notification to all users
        const io = req.app.get('io');
        io.emit('new-match', {
            match,
            message: `New match scheduled: ${title}`
        });

        res.json({
            success: true,
            message: 'Match created successfully',
            match
        });

    } catch (error) {
        console.error('Error creating match:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Update match
router.put('/matches/:id', verifyAdmin, async (req, res) => {
    try {
        const matchId = req.params.id;
        const { title, description, match_date, location, status } = req.body;

        await db.run(`
            UPDATE matches 
            SET title = ?, description = ?, match_date = ?, location = ?, status = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `, [title, description, match_date, location, status, matchId]);

        const match = await db.get('SELECT * FROM matches WHERE id = ?', [matchId]);

        // Emit real-time notification
        const io = req.app.get('io');
        io.emit('match-updated', {
            match,
            message: `Match updated: ${title}`
        });

        res.json({
            success: true,
            message: 'Match updated successfully',
            match
        });

    } catch (error) {
        console.error('Error updating match:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Delete match
router.delete('/matches/:id', verifyAdmin, async (req, res) => {
    try {
        const matchId = req.params.id;

        // Delete related records first
        await db.run('DELETE FROM match_attendance WHERE match_id = ?', [matchId]);
        await db.run('DELETE FROM player_stats WHERE match_id = ?', [matchId]);
        await db.run('DELETE FROM notifications WHERE match_id = ?', [matchId]);
        
        // Delete match
        await db.run('DELETE FROM matches WHERE id = ?', [matchId]);

        res.json({
            success: true,
            message: 'Match deleted successfully'
        });

    } catch (error) {
        console.error('Error deleting match:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get all players (admin view)
router.get('/players', verifyAdmin, async (req, res) => {
    try {
        const players = await db.all(`
            SELECT 
                p.*,
                COUNT(ma.id) as total_matches_responded,
                COUNT(CASE WHEN ma.status = 'in' THEN 1 END) as matches_attended,
                COALESCE(SUM(ps.goals), 0) as total_goals,
                COALESCE(SUM(ps.assists), 0) as total_assists,
                ROUND(
                    CASE 
                        WHEN COUNT(ma.id) > 0 
                        THEN (COUNT(CASE WHEN ma.status = 'in' THEN 1 END) * 100.0 / COUNT(ma.id))
                        ELSE 0 
                    END, 1
                ) as attendance_percentage
            FROM players p
            LEFT JOIN match_attendance ma ON p.id = ma.player_id
            LEFT JOIN player_stats ps ON p.id = ps.player_id
            GROUP BY p.id
            ORDER BY p.name
        `);

        res.json({ players });
    } catch (error) {
        console.error('Error fetching players:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Update player admin status
router.put('/players/:id/admin', verifyAdmin, async (req, res) => {
    try {
        const playerId = req.params.id;
        const { is_admin } = req.body;

        await db.run(`
            UPDATE players 
            SET is_admin = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `, [is_admin, playerId]);

        const player = await db.get('SELECT * FROM players WHERE id = ?', [playerId]);

        res.json({
            success: true,
            message: `Player ${is_admin ? 'promoted to' : 'removed from'} admin`,
            player
        });

    } catch (error) {
        console.error('Error updating player admin status:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Delete player
router.delete('/players/:id', verifyAdmin, async (req, res) => {
    try {
        const playerId = req.params.id;

        // Delete related records first
        await db.run('DELETE FROM match_attendance WHERE player_id = ?', [playerId]);
        await db.run('DELETE FROM player_stats WHERE player_id = ?', [playerId]);
        
        // Delete player
        await db.run('DELETE FROM players WHERE id = ?', [playerId]);

        res.json({
            success: true,
            message: 'Player deleted successfully'
        });

    } catch (error) {
        console.error('Error deleting player:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Add match statistics
router.post('/matches/:id/stats', verifyAdmin, async (req, res) => {
    try {
        const matchId = req.params.id;
        const { playerId, goals, assists, yellow_cards, red_cards, minutes_played } = req.body;

        await db.run(`
            INSERT OR REPLACE INTO player_stats 
            (player_id, match_id, goals, assists, yellow_cards, red_cards, minutes_played)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [playerId, matchId, goals || 0, assists || 0, yellow_cards || 0, red_cards || 0, minutes_played || 0]);

        res.json({
            success: true,
            message: 'Match statistics updated successfully'
        });

    } catch (error) {
        console.error('Error updating match statistics:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get dashboard statistics
router.get('/dashboard', verifyAdmin, async (req, res) => {
    try {
        // Total players
        const totalPlayers = await db.get('SELECT COUNT(*) as count FROM players');
        
        // Upcoming matches
        const upcomingMatches = await db.get(`
            SELECT COUNT(*) as count FROM matches 
            WHERE match_date > datetime('now')
        `);

        // This month's matches
        const thisMonthMatches = await db.get(`
            SELECT COUNT(*) as count FROM matches 
            WHERE strftime('%Y-%m', match_date) = strftime('%Y-%m', 'now')
        `);

        // Average attendance
        const avgAttendance = await db.get(`
            SELECT 
                ROUND(AVG(attendance_count), 1) as average
            FROM (
                SELECT 
                    COUNT(CASE WHEN ma.status = 'in' THEN 1 END) as attendance_count
                FROM matches m
                LEFT JOIN match_attendance ma ON m.id = ma.match_id
                WHERE m.match_date <= datetime('now')
                GROUP BY m.id
            )
        `);

        // Recent activity
        const recentActivity = await db.all(`
            SELECT 
                'attendance' as type,
                p.name as player_name,
                m.title as match_title,
                ma.status,
                ma.marked_at as timestamp
            FROM match_attendance ma
            JOIN players p ON ma.player_id = p.id
            JOIN matches m ON ma.match_id = m.id
            ORDER BY ma.marked_at DESC
            LIMIT 10
        `);

        res.json({
            stats: {
                totalPlayers: totalPlayers.count,
                upcomingMatches: upcomingMatches.count,
                thisMonthMatches: thisMonthMatches.count,
                averageAttendance: avgAttendance.average || 0
            },
            recentActivity
        });

    } catch (error) {
        console.error('Error fetching dashboard stats:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
