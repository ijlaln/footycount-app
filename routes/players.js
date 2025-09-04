const express = require('express');
const jwt = require('jsonwebtoken');
const db = require('../database/db');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// Middleware to verify token
const verifyToken = (req, res, next) => {
    const token = req.cookies.token;
    
    if (!token) {
        return res.status(401).json({ error: 'Access denied' });
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        next();
    } catch (error) {
        res.status(400).json({ error: 'Invalid token' });
    }
};

// Get all players
router.get('/', verifyToken, async (req, res) => {
    try {
        const players = await db.all(`
            SELECT 
                p.*,
                COUNT(ma.id) as matches_attended,
                COALESCE(SUM(ps.goals), 0) as total_goals,
                COALESCE(SUM(ps.assists), 0) as total_assists
            FROM players p
            LEFT JOIN match_attendance ma ON p.id = ma.player_id AND ma.status = 'in'
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

// Get player profile with detailed stats
router.get('/:id', verifyToken, async (req, res) => {
    try {
        const playerId = req.params.id;
        
        // Get player info
        const player = await db.get('SELECT * FROM players WHERE id = ?', [playerId]);
        
        if (!player) {
            return res.status(404).json({ error: 'Player not found' });
        }

        // Get player statistics
        const stats = await db.get(`
            SELECT 
                COUNT(ma.id) as matches_attended,
                COUNT(CASE WHEN ma.status = 'in' THEN 1 END) as matches_played,
                COALESCE(SUM(ps.goals), 0) as total_goals,
                COALESCE(SUM(ps.assists), 0) as total_assists,
                COALESCE(SUM(ps.yellow_cards), 0) as total_yellow_cards,
                COALESCE(SUM(ps.red_cards), 0) as total_red_cards,
                COALESCE(SUM(ps.minutes_played), 0) as total_minutes
            FROM players p
            LEFT JOIN match_attendance ma ON p.id = ma.player_id
            LEFT JOIN player_stats ps ON p.id = ps.player_id
            WHERE p.id = ?
        `, [playerId]);

        // Get recent matches
        const recentMatches = await db.all(`
            SELECT 
                m.*,
                ma.status as attendance_status,
                ps.goals,
                ps.assists,
                ps.minutes_played
            FROM matches m
            LEFT JOIN match_attendance ma ON m.id = ma.match_id AND ma.player_id = ?
            LEFT JOIN player_stats ps ON m.id = ps.match_id AND ps.player_id = ?
            WHERE m.match_date <= datetime('now')
            ORDER BY m.match_date DESC
            LIMIT 10
        `, [playerId, playerId]);

        res.json({
            player,
            stats,
            recentMatches
        });

    } catch (error) {
        console.error('Error fetching player profile:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Update player profile
router.put('/:id', verifyToken, async (req, res) => {
    try {
        const playerId = req.params.id;
        const { name, position, jersey_number } = req.body;
        
        // Check if user can update this profile (own profile or admin)
        if (req.user.id != playerId && !req.user.is_admin) {
            return res.status(403).json({ error: 'Access denied' });
        }

        // Check if jersey number is taken by another player
        if (jersey_number) {
            const existingJersey = await db.get(
                'SELECT * FROM players WHERE jersey_number = ? AND id != ?',
                [jersey_number, playerId]
            );
            
            if (existingJersey) {
                return res.status(400).json({ error: 'Jersey number already taken' });
            }
        }

        await db.run(`
            UPDATE players 
            SET name = ?, position = ?, jersey_number = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `, [name, position, jersey_number, playerId]);

        const updatedPlayer = await db.get('SELECT * FROM players WHERE id = ?', [playerId]);
        
        res.json({
            success: true,
            message: 'Profile updated successfully',
            player: updatedPlayer
        });

    } catch (error) {
        console.error('Error updating player:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
