require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const connectDB = require('./config/db');
const apiRoutes = require('./routes/api');

const app = express();
const PORT = process.env.PORT || 3001;
const isProduction = process.env.NODE_ENV === 'production';

// Middleware
app.use(cors());
app.use(express.json());

// Serve uploaded files (for legacy local files only)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// API routes
app.use('/api', apiRoutes);

// In production, serve the React build
if (isProduction) {
    const clientBuildPath = path.join(__dirname, '..', 'client', 'dist');
    
    // Serve static files from the React build
    app.use(express.static(clientBuildPath));
    
    // Handle React routing - serve index.html for all non-API routes
    app.get('*', (req, res) => {
        res.sendFile(path.join(clientBuildPath, 'index.html'));
    });
    
    console.log('🚀 Running in PRODUCTION mode - serving static files from client/dist');
}

// Connect to MongoDB and start server
const startServer = async () => {
    await connectDB();
    
    app.listen(PORT, () => {
        console.log(`
╔══════════════════════════════════════════════════════════════╗
║                                                              ║
║   🎬 Netflix Life Story API Server                           ║
║                                                              ║
║   API running at: http://localhost:${PORT}                     ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
        `);
    });
};

startServer();
