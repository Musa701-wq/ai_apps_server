/**
 * LabMate AI Routes for medical analysis
 * All endpoints return: { result, total_tokens }
 *
 * Mounted at:
 *   /api/labmate/*        → uses full path  e.g. /api/labmate/analyze-report
 *   /analyze-report       → mounted directly, Express strips prefix → hits '/'
 */
const express = require('express');
const { callGeminiMultimodalAPI, callGeminiAPI } = require('../utils/apiClient');
const config = require('../config');

const router = express.Router();

// ─── Helper ───────────────────────────────────────────────────────────────
async function runAnalysis(req, res, errorCode) {
    const { prompt, image_base64, mime_type } = req.body;

    if (!prompt) {
        return res.status(400).json({
            error: 'prompt field is required',
            code: 'MISSING_FIELD'
        });
    }

    try {
        const { result, total_tokens } = await callGeminiMultimodalAPI(
            config.labmate.models.reports,
            prompt,
            image_base64,
            mime_type,
            config.labmate.apiKey
        );

        res.json({ result, total_tokens });
    } catch (error) {
        res.status(500).json({
            error: error.message,
            code: errorCode
        });
    }
}

async function runMriAnalysis(req, res) {
    const { prompt, image_base64, mime_type } = req.body;

    if (!prompt) {
        return res.status(400).json({
            error: 'prompt field is required',
            code: 'MISSING_FIELD'
        });
    }

    try {
        const { result, total_tokens } = await callGeminiMultimodalAPI(
            config.labmate.models.mri,
            prompt,
            image_base64,
            mime_type,
            config.labmate.apiKey
        );

        res.json({ result, total_tokens });
    } catch (error) {
        res.status(500).json({
            error: error.message,
            code: 'LABMATE_MRI_ERROR'
        });
    }
}

async function runAsk(req, res) {
    const { prompt } = req.body;

    if (!prompt) {
        return res.status(400).json({
            error: 'prompt field is required',
            code: 'MISSING_FIELD'
        });
    }

    try {
        const { result, total_tokens } = await callGeminiAPI(
            config.labmate.models.reports,
            prompt,
            config.labmate.apiKey
        );

        res.json({ result, total_tokens });
    } catch (error) {
        res.status(500).json({
            error: error.message,
            code: 'LABMATE_ASK_ERROR'
        });
    }
}

// ─── Named routes (used via /api/labmate/*) ───────────────────────────────
router.post('/analyze-report', (req, res) => runAnalysis(req, res, 'LABMATE_REPORT_ERROR'));
router.post('/analyze-xray', (req, res) => runAnalysis(req, res, 'LABMATE_XRAY_ERROR'));
router.post('/analyze-ecg', (req, res) => runAnalysis(req, res, 'LABMATE_ECG_ERROR'));
router.post('/analyze-mri', (req, res) => runMriAnalysis(req, res));
router.post('/ask', (req, res) => runAsk(req, res));

// ─── Root routes (used when mounted directly e.g. app.use('/analyze-report', router)) ───
router.post('/', (req, res) => {
    // Determine which handler to use based on original URL
    const url = req.originalUrl.split('?')[0];
    if (url.includes('analyze-mri') || url.includes('mri')) return runMriAnalysis(req, res);
    if (url.includes('ask')) return runAsk(req, res);
    // report, xray, ecg all use same model
    const code = url.includes('xray') ? 'LABMATE_XRAY_ERROR'
        : url.includes('ecg') ? 'LABMATE_ECG_ERROR'
            : 'LABMATE_REPORT_ERROR';
    return runAnalysis(req, res, code);
});

// ─── Legacy endpoints (backward compatibility) ────────────────────────────
router.post('/mri', (req, res) => runMriAnalysis(req, res));
router.post('/report', (req, res) => runAnalysis(req, res, 'LABMATE_REPORT_ERROR'));

module.exports = router;
