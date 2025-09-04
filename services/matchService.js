const moment = require('moment');
const db = require('../database/db');

class MatchService {
    async checkUpcomingMatches(io) {
        try {
            const now = moment();
            const thirtyMinutesFromNow = moment().add(30, 'minutes');

            // Find matches starting in 30 minutes that haven't been notified
            const upcomingMatches = await db.all(`
                SELECT m.*, 
                       COUNT(ma.id) as total_responses,
                       COUNT(CASE WHEN ma.status = 'in' THEN 1 END) as players_in,
                       COUNT(CASE WHEN ma.status = 'out' THEN 1 END) as players_out
                FROM matches m
                LEFT JOIN match_attendance ma ON m.id = ma.match_id
                LEFT JOIN notifications n ON m.id = n.match_id AND n.type = 'pre_match_30min'
                WHERE datetime(m.match_date) BETWEEN datetime('${now.format('YYYY-MM-DD HH:mm:ss')}') 
                      AND datetime('${thirtyMinutesFromNow.format('YYYY-MM-DD HH:mm:ss')}')
                      AND n.id IS NULL
                GROUP BY m.id
            `);

            for (const match of upcomingMatches) {
                await this.sendPreMatchNotification(match, io);
            }

            // Check for matches starting in 24 hours
            const twentyFourHoursFromNow = moment().add(24, 'hours');
            const tomorrowMatches = await db.all(`
                SELECT m.*, 
                       COUNT(ma.id) as total_responses,
                       COUNT(CASE WHEN ma.status = 'in' THEN 1 END) as players_in
                FROM matches m
                LEFT JOIN match_attendance ma ON m.id = ma.match_id
                LEFT JOIN notifications n ON m.id = n.match_id AND n.type = 'pre_match_24h'
                WHERE datetime(m.match_date) BETWEEN datetime('${twentyFourHoursFromNow.add(-1, 'hour').format('YYYY-MM-DD HH:mm:ss')}') 
                      AND datetime('${twentyFourHoursFromNow.format('YYYY-MM-DD HH:mm:ss')}')
                      AND n.id IS NULL
                GROUP BY m.id
            `);

            for (const match of tomorrowMatches) {
                await this.sendReminderNotification(match, io);
            }

        } catch (error) {
            console.error('Error checking upcoming matches:', error);
        }
    }

    async sendPreMatchNotification(match, io) {
        try {
            const message = `⚽ Match "${match.title}" starts in 30 minutes! 
                           📊 Status: ${match.players_in} In, ${match.players_out} Out`;

            // Save notification
            await db.run(`
                INSERT INTO notifications (match_id, type, message)
                VALUES (?, 'pre_match_30min', ?)
            `, [match.id, message]);

            // Emit to all connected users
            io.emit('match-notification', {
                type: 'pre_match_30min',
                match,
                message,
                attendanceCount: {
                    in: match.players_in,
                    out: match.players_out,
                    total: match.total_responses
                }
            });

            console.log(`📢 Pre-match notification sent for: ${match.title}`);

        } catch (error) {
            console.error('Error sending pre-match notification:', error);
        }
    }

    async sendReminderNotification(match, io) {
        try {
            const message = `🔔 Reminder: Match "${match.title}" is tomorrow at ${moment(match.match_date).format('HH:mm')}. 
                           Please mark your attendance! Currently ${match.players_in} players confirmed.`;

            // Save notification
            await db.run(`
                INSERT INTO notifications (match_id, type, message)
                VALUES (?, 'pre_match_24h', ?)
            `, [match.id, message]);

            // Emit to all connected users
            io.emit('match-notification', {
                type: 'reminder',
                match,
                message,
                attendanceCount: {
                    in: match.players_in,
                    total: match.total_responses
                }
            });

            console.log(`📢 Reminder notification sent for: ${match.title}`);

        } catch (error) {
            console.error('Error sending reminder notification:', error);
        }
    }

    async getMatchAttendanceSummary(matchId) {
        try {
            const attendance = await db.all(`
                SELECT 
                    p.name,
                    p.jersey_number,
                    ma.status
                FROM match_attendance ma
                JOIN players p ON ma.player_id = p.id
                WHERE ma.match_id = ? AND ma.status = 'in'
                ORDER BY p.name
            `, [matchId]);

            return attendance;
        } catch (error) {
            console.error('Error getting match attendance summary:', error);
            return [];
        }
    }
}

module.exports = new MatchService();
