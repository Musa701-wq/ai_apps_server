/**
 * PlantAI Routes for plant identification and care
 */
const express = require('express');
const { callGeminiMultimodalAPI } = require('../utils/apiClient');
const config = require('../config');

const router = express.Router();

/**
 * POST /api/plantai
 * Analyze plant images for identification, pest detection, care advice
 * Supports: identify plants/pests, chat, details, watering plans
 */
router.post('/', async (req, res) => {
    try {
        const { prompt, image_base64, mime_type } = req.body;

        if (!prompt) {
            return res.status(400).json({
                error: 'prompt field is required',
                code: 'MISSING_FIELD'
            });
        }

        const { result, total_tokens } = await callGeminiMultimodalAPI(
            config.plantai.model,
            prompt,
            image_base64,
            mime_type,
            config.plantai.apiKey
        );

        res.json({ result, total_tokens });
    } catch (error) {
        res.status(500).json({
            error: error.message,
            code: 'PLANTAI_ERROR'
        });
    }
});

module.exports = router;
