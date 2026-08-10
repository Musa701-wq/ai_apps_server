/**
 * MentorAI Routes
 *
 * Text / Chat endpoints — AWS Bedrock (openai.gpt-oss-120b-1:0):
 *   POST /api/mentorai/chat              → conversational chat
 *   POST /api/mentorai/summarize         → summarize content
 *   POST /api/mentorai/study-plan        → generate a study plan
 *
 * Image generation endpoint — calls gemini-2.5-flash-image directly:
 *   POST /api/mentorai/generate-image    → generate an educational image
 *
 * All endpoints return: { result, total_tokens }
 * Image endpoint: result = pure base64 string of generated image
 * Text endpoints: result = text response
 *
 * NOTE: MentorAI uses its own dedicated Bedrock client (not shared),
 * so changes here do not affect other routes (SmartCloset, Gemini).
 */
const express = require('express');
const { callGeminiMultimodalAPI } = require('../utils/apiClient');
const { BedrockRuntimeClient, ConverseCommand } = require('@aws-sdk/client-bedrock-runtime');
const config = require('../config');

// ─── MentorAI-dedicated Bedrock client ────────────────────────────────────
// Independent from shared bedrockClient.js — changes here only affect MentorAI
const _mentoraiBedrockClient = new BedrockRuntimeClient({
    region: config.bedrock.region
});

/**
 * Send a text prompt to Bedrock for MentorAI endpoints.
 * @param {string} prompt
 * @param {string} [systemPrompt]
 * @returns {{ result: string, total_tokens: number }}
 */
async function _callMentorAIBedrock(prompt, systemPrompt = null) {
    const messages = [
        { role: 'user', content: [{ text: prompt }] }
    ];

    const params = {
        modelId: config.bedrock.models.chat,
        messages,
        inferenceConfig: {
            maxTokens:   config.bedrock.maxTokens,
            temperature: config.bedrock.temperature
        }
    };

    if (systemPrompt) {
        params.system = [{ text: systemPrompt }];
    }

    const command  = new ConverseCommand(params);
    const response = await _mentoraiBedrockClient.send(command);

    // Extract text from response (skip non-text blocks like reasoningContent)
    let result = '';
    const parts = response?.output?.message?.content || [];
    for (const item of parts) {
        if (item?.text) result += item.text;
    }

    const usage = response?.usage || {};
    const total_tokens = (usage.inputTokens || 0) + (usage.outputTokens || 0);

    return { result, total_tokens };
}

const router = express.Router();

// ─── POST /api/mentorai/chat ───────────────────────────────────────────────
// Conversational AI tutor chat
// Model:    AWS Bedrock — openai.gpt-oss-120b-1:0
// Payload:  { prompt }
// Response: { result: <text>, total_tokens }
router.post('/chat', async (req, res) => {
    const { prompt } = req.body;

    if (!prompt) {
        return res.status(400).json({ error: 'prompt field is required', code: 'MISSING_FIELD' });
    }

    try {
        const { result, total_tokens } = await _callMentorAIBedrock(prompt);
        res.json({ result, total_tokens });
    } catch (error) {
        res.status(500).json({ error: error.message, code: 'MENTORAI_CHAT_ERROR' });
    }
});

// ─── POST /api/mentorai/summarize ─────────────────────────────────────────
// Summarize a topic, document excerpt, or lecture notes
// Model:    AWS Bedrock — openai.gpt-oss-120b-1:0
// Payload:  { prompt }  — include the content to summarize inside the prompt
// Response: { result: <text>, total_tokens }
router.post('/summarize', async (req, res) => {
    const { prompt } = req.body;

    if (!prompt) {
        return res.status(400).json({ error: 'prompt field is required', code: 'MISSING_FIELD' });
    }

    try {
        const { result, total_tokens } = await _callMentorAIBedrock(prompt);
        res.json({ result, total_tokens });
    } catch (error) {
        res.status(500).json({ error: error.message, code: 'MENTORAI_SUMMARIZE_ERROR' });
    }
});

// ─── POST /api/mentorai/study-plan ────────────────────────────────────────
// Generate a personalised study plan
// Model:    AWS Bedrock — openai.gpt-oss-120b-1:0
// Payload:  { prompt }  — include subject, duration, goals inside the prompt
// Response: { result: <text>, total_tokens }
router.post('/study-plan', async (req, res) => {
    const { prompt } = req.body;

    if (!prompt) {
        return res.status(400).json({ error: 'prompt field is required', code: 'MISSING_FIELD' });
    }

    try {
        const { result, total_tokens } = await _callMentorAIBedrock(prompt);
        res.json({ result, total_tokens });
    } catch (error) {
        res.status(500).json({ error: error.message, code: 'MENTORAI_STUDYPLAN_ERROR' });
    }
});

// ─── POST /api/mentorai/generate-image ────────────────────────────────────
// Generate an educational diagram / illustration using gemini-2.5-flash-image
// Payload:  { prompt, image_base64?, mime_type? }
//   image_base64 / mime_type are optional — pass them to guide the generation
//   with a reference image (e.g. a sketch or existing diagram)
// Response: { result: <base64 image string>, total_tokens }
router.post('/generate-image', async (req, res) => {
    const { prompt, image_base64, mime_type } = req.body;

    if (!prompt) {
        return res.status(400).json({ error: 'prompt field is required', code: 'MISSING_FIELD' });
    }

    try {
        const { result, total_tokens } = await callGeminiMultimodalAPI(
            config.mentorai.imageModel,   // gemini-2.5-flash-image
            prompt,
            image_base64 || null,
            mime_type    || null,
            config.mentorai.apiKey,
            null,
            null,
            {
                generationConfig: {
                    temperature: 1.0,
                    topP: 0.95,
                    topK: 40,
                    maxOutputTokens: 2048
                }
            }
        );
        res.json({ result, total_tokens });
    } catch (error) {
        if (error.code === 'SAFETY_BLOCK') {
            return res.status(422).json({ error: 'Blocked by safety filters', code: 'SAFETY_BLOCK' });
        }
        res.status(500).json({ error: error.message, code: 'MENTORAI_IMAGE_ERROR' });
    }
});

module.exports = router;
