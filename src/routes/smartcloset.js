/**
 * SmartCloset AI Routes
 *
 * POST /fashion-chat     → Fashion Styling Chat (AWS Bedrock — openai.gpt-oss-120b-1:0)
 * POST /virtual-tryon    → Virtual Try-On (gemini-2.5-flash-image)
 * POST /outfit-combo     → Outfit Combinations (gemini-2.5-flash-image)
 *
 * All endpoints return: { result, total_tokens }
 * Image endpoints: result = pure base64 string of generated image
 * Chat endpoint:   result = text response
 *
 * Gemini accuracy settings applied to image endpoints:
 *   - generationConfig: temperature 1.0, topP 0.95, topK 40, maxOutputTokens 2048
 *   - safetySettings:   BLOCK_NONE on all 4 harm categories
 */
const express = require('express');
const {
    callGeminiMultimodalAPI,
    SMARTCLOSET_GENERATION_CONFIG,
    SMARTCLOSET_SAFETY_SETTINGS
} = require('../utils/apiClient');
const { callBedrockChat } = require('../utils/bedrockClient');
const config = require('../config');

const router = express.Router();

// ─── Handlers ─────────────────────────────────────────────────────────────

async function handleFashionChat(req, res) {
    const { prompt } = req.body;

    if (!prompt) {
        return res.status(400).json({ error: 'prompt field is required', code: 'MISSING_FIELD' });
    }

    try {
        // Fashion chat now uses AWS Bedrock (openai.gpt-oss-120b-1:0)
        const { result, total_tokens } = await callBedrockChat(prompt);
        res.json({ result, total_tokens });
    } catch (error) {
        res.status(500).json({ error: error.message, code: 'SMARTCLOSET_CHAT_ERROR' });
    }
}

async function handleVirtualTryOn(req, res) {
    // image_base64   = person photo  (first part — order matters)
    // image_base64_2 = clothing item (second part)
    const { prompt, image_base64, mime_type, image_base64_2, mime_type_2 } = req.body;

    if (!prompt) {
        return res.status(400).json({ error: 'prompt field is required', code: 'MISSING_FIELD' });
    }

    try {
        const { result, total_tokens } = await callGeminiMultimodalAPI(
            config.smartcloset.models.vision,
            prompt,
            image_base64,
            mime_type,
            config.smartcloset.apiKey,
            image_base64_2,
            mime_type_2,
            {
                generationConfig: SMARTCLOSET_GENERATION_CONFIG,
                safetySettings: SMARTCLOSET_SAFETY_SETTINGS
            }
        );
        res.json({ result, total_tokens });
    } catch (error) {
        if (error.code === 'SAFETY_BLOCK') {
            return res.status(422).json({ error: 'Blocked by safety filters', code: 'SAFETY_BLOCK' });
        }
        res.status(500).json({ error: error.message, code: 'SMARTCLOSET_TRYON_ERROR' });
    }
}

async function handleOutfitCombo(req, res) {
    // image_base64   = shirt (first part — order matters)
    // image_base64_2 = pant  (second part)
    const { prompt, image_base64, mime_type, image_base64_2, mime_type_2 } = req.body;

    if (!prompt) {
        return res.status(400).json({ error: 'prompt field is required', code: 'MISSING_FIELD' });
    }

    try {
        const { result, total_tokens } = await callGeminiMultimodalAPI(
            config.smartcloset.models.vision,
            prompt,
            image_base64,
            mime_type,
            config.smartcloset.apiKey,
            image_base64_2,
            mime_type_2,
            {
                generationConfig: SMARTCLOSET_GENERATION_CONFIG,
                safetySettings: SMARTCLOSET_SAFETY_SETTINGS
            }
        );
        res.json({ result, total_tokens });
    } catch (error) {
        if (error.code === 'SAFETY_BLOCK') {
            return res.status(422).json({ error: 'Blocked by safety filters', code: 'SAFETY_BLOCK' });
        }
        res.status(500).json({ error: error.message, code: 'SMARTCLOSET_COMBO_ERROR' });
    }
}

// ─── Named routes (via /api/smartcloset/*) ────────────────────────────────
router.post('/fashion-chat', handleFashionChat);
router.post('/virtual-tryon', handleVirtualTryOn);
router.post('/outfit-combo', handleOutfitCombo);

// ─── Root routes (via direct mount e.g. app.use('/fashion-chat', router)) ─
router.post('/', (req, res) => {
    const url = req.originalUrl.split('?')[0];
    if (url.includes('virtual-tryon')) return handleVirtualTryOn(req, res);
    if (url.includes('outfit-combo')) return handleOutfitCombo(req, res);
    return handleFashionChat(req, res);
});

module.exports = router;
