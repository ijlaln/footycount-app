const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const cron = require('node-cron');

// Import routes
const authRoutes = require('./routes/auth');
const playerRoutes = require('./routes/players');
const matchRoutes = require('./routes/matches');
const adminRoutes = require('./routes/admin');

// Import database
const db = require('./database/db');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// Set view engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/players', playerRoutes);
app.use('/api/matches', matchRoutes);
app.use('/api/admin', adminRoutes);

// Main page route
app.get('/', (req, res) => {
    res.render('index');
});

// Player dashboard
app.get('/dashboard', (req, res) => {
    res.render('dashboard');
});

// Profile page
app.get('/profile', (req, res) => {
    res.render('profile');
});

// Admin panel
app.get('/admin', (req, res) => {
    res.render('admin');
});

// Socket.IO for real-time notifications
io.on('connection', (socket) => {
    console.log('User connected:', socket.id);
    
    socket.on('join-room', (room) => {
        socket.join(room);
        console.log(`User ${socket.id} joined room: ${room}`);
    });
    
    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
    });
});

// Make io available globally
app.set('io', io);

// Cron job for match notifications (runs every minute to check for matches)
cron.schedule('* * * * *', () => {
    const matchService = require('./services/matchService');
    matchService.checkUpcomingMatches(io);
});

// Initialize database
db.init();

server.listen(PORT, () => {
    console.log(`🚀 Football WebApp running on http://localhost:${PORT}`);
    console.log(`📱 Share this link with your team!`);
});

module.exports = app;
