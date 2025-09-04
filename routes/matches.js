const express = require('express');
const jwt = require('jsonwebtoken');
const moment = require('moment');
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

// Get all matches (upcoming and past)
router.get('/', verifyToken, async (req, res) => {
    try {
        const matches = await db.all(`
            SELECT 
                m.*,
                COUNT(ma.id) as total_responses,
                COUNT(CASE WHEN ma.status = 'in' THEN 1 END) as players_in,
                COUNT(CASE WHEN ma.status = 'out' THEN 1 END) as players_out,
                p.name as created_by_name
            FROM matches m
            LEFT JOIN match_attendance ma ON m.id = ma.match_id
            LEFT JOIN players p ON m.created_by = p.id
            GROUP BY m.id
            ORDER BY m.match_date DESC
        `);

        res.json({ matches });
    } catch (error) {
        console.error('Error fetching matches:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get upcoming matches
router.get('/upcoming', verifyToken, async (req, res) => {
    try {
        const matches = await db.all(`
            SELECT 
                m.*,
                COUNT(ma.id) as total_responses,
                COUNT(CASE WHEN ma.status = 'in' THEN 1 END) as players_in,
                COUNT(CASE WHEN ma.status = 'out' THEN 1 END) as players_out,
                p.name as created_by_name,
                ma_user.status as user_status
            FROM matches m
            LEFT JOIN match_attendance ma ON m.id = ma.match_id
            LEFT JOIN players p ON m.created_by = p.id
            LEFT JOIN match_attendance ma_user ON m.id = ma_user.match_id AND ma_user.player_id = ?
            WHERE m.match_date > datetime('now')
            GROUP BY m.id
            ORDER BY m.match_date ASC
        `, [req.user.id]);

        res.json({ matches });
    } catch (error) {
        console.error('Error fetching upcoming matches:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get single match with detailed attendance
router.get('/:id', verifyToken, async (req, res) => {
    try {
        const matchId = req.params.id;

        // Get match details
        const match = await db.get(`
            SELECT m.*, p.name as created_by_name
            FROM matches m
            LEFT JOIN players p ON m.created_by = p.id
            WHERE m.id = ?
        `, [matchId]);

        if (!match) {
            return res.status(404).json({ error: 'Match not found' });
        }

        // Get attendance details
        const attendance = await db.all(`
            SELECT 
                p.id,
                p.name,
                p.position,
                p.jersey_number,
                COALESCE(ma.status, 'out') as status,
                ma.marked_at
            FROM players p
            LEFT JOIN match_attendance ma ON p.id = ma.player_id AND ma.match_id = ?
            ORDER BY 
                CASE WHEN ma.status = 'in' THEN 1
                     ELSE 2 END,
                p.name
        `, [matchId]);

        // Get match statistics if it's a past match
        let matchStats = null;
        if (moment(match.match_date).isBefore(moment())) {
            matchStats = await db.all(`
                SELECT 
                    p.name,
                    p.jersey_number,
                    ps.goals,
                    ps.assists,
                    ps.yellow_cards,
                    ps.red_cards,
                    ps.minutes_played
                FROM player_stats ps
                JOIN players p ON ps.player_id = p.id
                WHERE ps.match_id = ?
                ORDER BY ps.goals DESC, ps.assists DESC
            `, [matchId]);
        }

        res.json({
            match,
            attendance,
            matchStats
        });

    } catch (error) {
        console.error('Error fetching match details:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Mark attendance for a match
router.post('/:id/attendance', verifyToken, async (req, res) => {
    try {
        const matchId = req.params.id;
        const playerId = req.user.id;
        const { status } = req.body; // 'in' or 'out'

        if (!['in', 'out'].includes(status)) {
            return res.status(400).json({ error: 'Invalid status. Must be "in" or "out"' });
        }

        // Check if match exists
        const match = await db.get('SELECT * FROM matches WHERE id = ?', [matchId]);
        if (!match) {
            return res.status(404).json({ error: 'Match not found' });
        }

        // Insert or update attendance
        await db.run(`
            INSERT OR REPLACE INTO match_attendance (match_id, player_id, status, marked_at)
            VALUES (?, ?, ?, CURRENT_TIMESTAMP)
        `, [matchId, playerId, status]);

        // Get updated attendance count
        const attendanceCount = await db.get(`
            SELECT 
                COUNT(CASE WHEN status = 'in' THEN 1 END) as players_in,
                COUNT(CASE WHEN status = 'out' THEN 1 END) as players_out
            FROM match_attendance
            WHERE match_id = ?
        `, [matchId]);

        // Get player name for notification
        const player = await db.get('SELECT name FROM players WHERE id = ?', [playerId]);

        // Emit real-time notification
        const io = req.app.get('io');
        io.emit('attendance-update', {
            matchId,
            playerName: player.name,
            status,
            attendanceCount
        });

        res.json({
            success: true,
            message: `Attendance marked as ${status}`,
            attendanceCount
        });

    } catch (error) {
        console.error('Error marking attendance:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get match attendance with player names
router.get('/:id/players', verifyToken, async (req, res) => {
    try {
        const matchId = req.params.id;

        const playersIn = await db.all(`
            SELECT p.name, p.jersey_number
            FROM players p
            JOIN match_attendance ma ON p.id = ma.player_id
            WHERE ma.match_id = ? AND ma.status = 'in'
            ORDER BY p.name
        `, [matchId]);

        const playersOut = await db.all(`
            SELECT p.name, p.jersey_number
            FROM players p
            JOIN match_attendance ma ON p.id = ma.player_id
            WHERE ma.match_id = ? AND ma.status = 'out'
            ORDER BY p.name
        `, [matchId]);

        // Also get players who haven't responded (default to 'out')
        const playersNotResponded = await db.all(`
            SELECT p.name, p.jersey_number
            FROM players p
            WHERE p.id NOT IN (
                SELECT player_id FROM match_attendance WHERE match_id = ?
            )
            ORDER BY p.name
        `, [matchId]);

        res.json({
            playersIn,
            playersOut: [...playersOut, ...playersNotResponded]
        });

    } catch (error) {
        console.error('Error fetching match players:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
