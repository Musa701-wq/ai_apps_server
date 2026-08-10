/**
 * SmartSole AI Routes
 *
 * Migration map — legacy Google API → proxy:
 *
 * Feature            | Legacy Model           | Proxy Endpoint                 | Model at Proxy
 * -------------------|------------------------|--------------------------------|-----------------------------
 * Text Generation    | gemini-1.5-flash       | POST /api/smartsole/text       | openai.gpt-oss-120b-1:0 (AWS Bedrock)
 * Virtual Try-On     | gemini-2.5-flash-image | POST /api/smartsole/image      | gemini-2.5-flash-image
 * Multi-Angle Studio | gemini-2.5-flash-image | POST /api/smartsole/image      | gemini-2.5-flash-image
 * Outfit Matcher     | gemini-2.5-flash-image | POST /api/smartsole/image      | gemini-2.5-flash-image
 * Shoe Analysis      | gemini-2.0-flash       | POST /api/smartsole/multimodal | google.gemma-3-27b-it (AWS Bedrock)
 * Stylist Notes      | gemini-2.0-flash       | POST /api/smartsole/multimodal | google.gemma-3-27b-it (AWS Bedrock)
 *
 * Response shapes:
 *   /text        → { result: <text>,   total_tokens }
 *   /image       → { result: <base64>, total_tokens }
 *   /multimodal  → { result: <text>,   total_tokens }
 */
const express = require('express');
const axios   = require('axios');
const { BedrockRuntimeClient, ConverseCommand } = require('@aws-sdk/client-bedrock-runtime');
const config  = require('../config');

const router = express.Router();

// ─── Bedrock client (shared) ───────────────────────────────────────────────
const _bedrockClient = new BedrockRuntimeClient({ region: config.bedrock.region });

// ─── Gemini image model ────────────────────────────────────────────────────
const IMAGE_MODEL = 'gemini-2.5-flash-image';
const BASE        = 'https://generativelanguage.googleapis.com/v1beta/models';

// ─── Safety settings — BLOCK_NONE (for /image endpoint) ───────────────────
const SAFETY_SETTINGS = [
    { category: 'HARM_CATEGORY_HARASSMENT',        threshold: 'BLOCK_NONE' },
    { category: 'HARM_CATEGORY_HATE_SPEECH',       threshold: 'BLOCK_NONE' },
    { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
    { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' }
];

// ─── Helpers ───────────────────────────────────────────────────────────────
function geminiHeaders(apiKey) {
    return { 'x-goog-api-key': apiKey, 'Content-Type': 'application/json' };
}

function getTokens(data) {
    const u = data.usageMetadata || {};
    return (u.promptTokenCount || 0) + (u.candidatesTokenCount || 0);
}

function extractImage(parts) {
    for (const part of parts) {
        const d = part.inlineData?.data || part.inline_data?.data;
        if (d) return d;
    }
    return null;
}

function extractText(parts) {
    for (const part of parts) {
        if (part.text) return part.text;
    }
    return '';
}

// ─── Bedrock helper ────────────────────────────────────────────────────────
async function callBedrock(modelId, messages) {
    const command = new ConverseCommand({
        modelId,
        messages,
        inferenceConfig: {
            maxTokens:   config.bedrock.maxTokens,
            temperature: config.bedrock.temperature
        }
    });
    const response = await _bedrockClient.send(command);

    let result = '';
    for (const item of response?.output?.message?.content || []) {
        if (item?.text) result += item.text;
    }

    const usage = response?.usage || {};
    return {
        result,
        total_tokens: (usage.inputTokens || 0) + (usage.outputTokens || 0)
    };
}

// ==========================================================================
// POST /api/smartsole/text
// Features: Text Generation, Shoe Search Query Generation
// Model:    openai.gpt-oss-120b-1:0 (AWS Bedrock)
//
// Request:  { prompt }
// Response: { result: <text>, total_tokens }
// ==========================================================================
router.post('/text', async (req, res) => {
    const { prompt } = req.body;
    if (!prompt) return res.status(400).json({ error: 'prompt field is required', code: 'MISSING_FIELD' });

    try {
        const { result, total_tokens } = await callBedrock(
            config.bedrock.models.chat,
            [{ role: 'user', content: [{ text: prompt }] }]
        );
        res.json({ result, total_tokens });
    } catch (err) {
        res.status(500).json({ error: err.message, code: 'TEXT_MODEL_ERROR' });
    }
});

// ==========================================================================
// POST /api/smartsole/image
// Features: Virtual Try-On | Multi-Angle Studio | Outfit Matcher
// Model:    gemini-2.5-flash-image (Google Gemini)
// Parts order: [prompt text] → [image_base64] → [image_base64_2]
//
// Request:  { prompt, image_base64, mime_type, image_base64_2?, mime_type_2? }
// Response: { result: <base64 image>, total_tokens }
// ==========================================================================
router.post('/image', async (req, res) => {
    const { prompt, image_base64, mime_type, image_base64_2, mime_type_2 } = req.body;
    if (!prompt) return res.status(400).json({ error: 'prompt field is required', code: 'MISSING_FIELD' });

    try {
        const parts = [{ text: prompt }];
        if (image_base64 && mime_type) {
            parts.push({ inline_data: { mime_type, data: image_base64 } });
        }
        if (image_base64_2 && mime_type_2) {
            parts.push({ inline_data: { mime_type: mime_type_2, data: image_base64_2 } });
        }

        const response = await axios.post(
            `${BASE}/${IMAGE_MODEL}:generateContent`,
            { contents: [{ role: 'user', parts }], safetySettings: SAFETY_SETTINGS },
            { headers: geminiHeaders(config.imageModel.apiKey) }
        );

        const candidate = response.data.candidates?.[0];
        if (!candidate || candidate.finishReason === 'SAFETY') {
            return res.status(422).json({ error: 'Blocked by safety filters', code: 'SAFETY_BLOCK' });
        }

        const responseParts = candidate.content?.parts || [];
        const result        = extractImage(responseParts);

        if (!result) {
            return res.status(500).json({
                error:   'No image generated',
                code:    'NO_IMAGE',
                details: extractText(responseParts)
            });
        }

        res.json({ result, total_tokens: getTokens(response.data) });
    } catch (err) {
        if (err.response?.data?.error?.message?.toLowerCase().includes('safety')) {
            return res.status(422).json({ error: 'Blocked by safety filters', code: 'SAFETY_BLOCK' });
        }
        res.status(500).json({
            error: err.response?.data?.error?.message || err.message,
            code:  'IMAGE_MODEL_ERROR'
        });
    }
});

// ==========================================================================
// POST /api/smartsole/multimodal
// Features: Shoe Analysis (Outfit Suggestions) | Stylist Notes
// Model:    google.gemma-3-27b-it (AWS Bedrock)
// Supports: text-only prompt OR text + image (multimodal via Bedrock Converse)
//
// Request:  { prompt, image_base64?, mime_type? }
// Response: { result: <text>, total_tokens }
// ==========================================================================
router.post('/multimodal', async (req, res) => {
    const { prompt, image_base64, mime_type } = req.body;
    if (!prompt) return res.status(400).json({ error: 'prompt field is required', code: 'MISSING_FIELD' });

    try {
        // Build Bedrock Converse message — image block first (if provided), then text
        const content = [];

        if (image_base64 && mime_type) {
            content.push({
                image: {
                    format: mime_type.split('/')[1] || 'jpeg',
                    source: { bytes: Buffer.from(image_base64, 'base64') }
                }
            });
        }

        content.push({ text: prompt });

        const { result, total_tokens } = await callBedrock(
            config.bedrock.models.multimodal,
            [{ role: 'user', content }]
        );

        res.json({ result, total_tokens });
    } catch (err) {
        res.status(500).json({ error: err.message, code: 'MULTIMODAL_MODEL_ERROR' });
    }
});

module.exports = router;
