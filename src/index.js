/**
 * Main Application Entry Point
 * Multi-service AI API Server
 * - Gemini API Integration
 * - LabMate (Medical AI)
 * - PlantAI (Plant Intelligence)
 */
require('dotenv').config();

const express = require('express');
const config = require('./config');
const authenticate = require('./middleware/authenticate');
 
// Import route handlers
const geminiRoutes = require('./routes/gemini');
const labmateRoutes = require('./routes/labmate');
const plantaiRoutes = require('./routes/plantai');
const smartclosetRoutes = require('./routes/smartcloset');
const smartsoleRoutes = require('./routes/smartsole');
const mentoraiRoutes = require('./routes/mentorai');
const remodelRoutes = require('./routes/remodel');

const app = express();

// ─── MIDDLEWARE ───────────────────────────────────────────────────────────
app.use(express.json({ limit: config.apiLimits.json }));
app.use(express.urlencoded({
    limit: config.apiLimits.urlencoded,
    extended: true
}));

// ─── ROUTES ───────────────────────────────────────────────────────────────

// Health check (no auth required)
app.get('/', (req, res) => {
    res.json({
        status: 'Server is running ✅',
        version: '1.0.0',
        environment: config.nodeEnv
    });
});

// Protected routes with authentication
app.use('/api/gemini', authenticate, geminiRoutes);
app.use('/api/plantai', authenticate, plantaiRoutes);
app.use('/api/smartcloset', authenticate, smartclosetRoutes);
app.use('/api/smartsole', authenticate, smartsoleRoutes);
app.use('/api/mentorai', authenticate, mentoraiRoutes);

// Remodel (Modernization) Endpoints
app.use('/api/v1', authenticate, remodelRoutes);

// LabMate direct endpoints
app.use('/ask', authenticate, labmateRoutes);
app.use('/analyze-report', authenticate, labmateRoutes);
app.use('/analyze-xray', authenticate, labmateRoutes);
app.use('/analyze-ecg', authenticate, labmateRoutes);
app.use('/analyze-mri', authenticate, labmateRoutes);

// SmartCloset direct endpoints
app.use('/fashion-chat', authenticate, smartclosetRoutes);
app.use('/virtual-tryon', authenticate, smartclosetRoutes);
app.use('/outfit-combo', authenticate, smartclosetRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Error:', err);
    res.status(500).json({
        error: 'Internal server error',
        code: 'INTERNAL_ERROR',
        message: config.nodeEnv === 'development' ? err.message : undefined
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        error: 'Endpoint not found',
        code: 'NOT_FOUND'
    });
});

// ─── SERVER START ─────────────────────────────────────────────────────────
const PORT = config.port || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📝 Environment: ${config.nodeEnv}`);
    console.log(`📍 Base URL: http://localhost:${PORT}`);
});
 
module.exports = app;
