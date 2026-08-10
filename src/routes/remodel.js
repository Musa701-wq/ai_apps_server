/**
 * Remodel API Routes
 *
 * Supports mobile application remodeling features:
 * - S3 Pre-signed URL generation (real AWS S3 + CloudFront)
 * - Gemini AI Proxy for remodeling, inpainting, and style transfer
 * - User History & Global Gallery
 */
const express = require('express');
const { callGeminiMultimodalAPI } = require('../utils/apiClient');
const config = require('../config');
const crypto = require('crypto');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

const router = express.Router();

// ─── S3 CLIENT ────────────────────────────────────────────────────────────
const s3Client = new S3Client({
    region: config.remodel.s3.region,
    credentials: {
        accessKeyId: config.remodel.s3.accessKey,
        secretAccessKey: config.remodel.s3.secretKey
    }
});

// ─── IN-MEMORY STORAGE (MOCK DB) ──────────────────────────────────────────
let historyStore = [];

// ─── UTILS ────────────────────────────────────────────────────────────────
const getUserId = (req) => {
    return req.headers['x-user-id'] || 'default_user';
};

// ─── STORAGE ENDPOINTS ────────────────────────────────────────────────────

/**
 * GET /storage/upload-url
 * Generates a real AWS S3 pre-signed PUT URL for direct upload from Flutter
 * Query: filename, content_type (optional)
 *
 * Flutter uploads image directly to S3 using this URL (PUT request).
 * After upload, the public image URL is: CLOUDFRONT_URL/renovate-ai/<generated-key>
 */
router.get('/storage/upload-url', async (req, res) => {
    const { filename, content_type } = req.query;

    if (!filename) {
        return res.status(400).json({ error: 'filename query parameter is required', code: 'MISSING_PARAM' });
    }

    try {
        const mimeType = content_type || 'image/jpeg';
        const ext = filename.split('.').pop() || 'jpg';
        const s3Key = `renovate-ai/${Date.now()}-${crypto.randomUUID()}.${ext}`;

        const command = new PutObjectCommand({
            Bucket: config.remodel.s3.bucket,
            Key: s3Key,
            ContentType: mimeType
        });

        // Pre-signed URL valid for 5 minutes
        const presignedUrl = await getSignedUrl(s3Client, command, { expiresIn: 300 });

        // Public URL via CloudFront after upload completes
        const publicUrl = `${config.remodel.s3.cloudfrontUrl}/${s3Key}`;

        const responseBody = {
            upload_url: presignedUrl,
            method: 'PUT',
            headers: {
                'Content-Type': mimeType
            },
            s3_key: s3Key,
            public_url: publicUrl,
            expires_in: 300
        };

        console.log('─────────────────────────────────────────');
        console.log('📦 [/storage/upload-url] Pre-signed URL generated');
        console.log('   filename     :', filename);
        console.log('   s3_key       :', s3Key);
        console.log('   public_url   :', publicUrl);
        console.log('   upload_url   :', presignedUrl.split('?')[0], '...[signed params truncated]');
        console.log('─────────────────────────────────────────');

        res.json(responseBody);
    } catch (error) {
        console.error('❌ [/storage/upload-url] S3 error:', error.message);
        res.status(500).json({ error: 'Failed to generate upload URL', code: 'STORAGE_ERROR', details: error.message });
    }
});

// ─── AI PROCESSING ENDPOINTS (PROXY) ──────────────────────────────────────

/**
 * Helper to handle Gemini Proxy logic
 */
const handleGeminiProxy = async (req, res, promptPrefix = '') => {
    const { prompt, image_base64, mime_type } = req.body;

    if (!prompt || !image_base64) {
        return res.status(400).json({ error: 'prompt and image_base64 are required', code: 'MISSING_FIELDS' });
    }

    try {
        const fullPrompt = promptPrefix ? `${promptPrefix}\n${prompt}` : prompt;

        const { result, total_tokens } = await callGeminiMultimodalAPI(
            config.remodel.model,
            fullPrompt,
            image_base64,
            mime_type || 'image/jpeg',
            config.remodel.geminiApiKey,
            null,
            null,
            { baseUrl: config.remodel.baseUrl }
        );

        res.json({ result, total_tokens });
    } catch (error) {
        console.error('❌ AI Proxy Error:', error);
        res.status(500).json({ error: error.message, code: 'AI_PROXY_ERROR' });
    }
};

router.post('/process/remodel', (req, res) => {
    handleGeminiProxy(req, res, 'Act as an interior designer. Remodel the following room based on the user instruction:');
});

router.post('/process/inpaint', (req, res) => {
    handleGeminiProxy(req, res, 'Act as an image editor. Inpaint/modify the specific area in the image based on this instruction:');
});

router.post('/process/style-transfer', (req, res) => {
    handleGeminiProxy(req, res, 'Apply the following architectural style to this room:');
});

// ─── CHAT ENDPOINT ────────────────────────────────────────────────────────

/**
 * POST /process/chat
 * Interior design chatbot — text only
 * Body: { message: string }
 */
router.post('/process/chat', async (req, res) => {
    const { message } = req.body;

    if (!message) {
        return res.status(400).json({ error: 'message is required', code: 'MISSING_FIELDS' });
    }

    try {
        const systemPrompt = `You are a professional interior design assistant. Help users with room design, furniture placement, color schemes, and renovation ideas.\n\nUser: ${message}`;

        const { callGeminiAPI } = require('../utils/apiClient');
        const { result, total_tokens } = await callGeminiAPI(
            'gemini-2.5-flash',
            systemPrompt,
            config.remodel.geminiApiKey,
            { baseUrl: config.remodel.baseUrl }
        );

        res.json({ result, total_tokens });
    } catch (error) {
        console.error('❌ Chat Error:', error);
        res.status(500).json({ error: error.message, code: 'AI_PROXY_ERROR' });
    }
});

// ─── OBJECT DETECTION ENDPOINT ───────────────────────────────────────────

/**
 * POST /process/detect-objects
 * Detects furniture and room objects with bounding boxes
 * Body: { image_base64: string, mime_type: string }
 */
router.post('/process/detect-objects', async (req, res) => {
    const { image_base64, mime_type } = req.body;

    if (!image_base64) {
        return res.status(400).json({ error: 'image_base64 is required', code: 'MISSING_FIELDS' });
    }

    try {
        const detectionPrompt = `Detect all prominent objects for remodeling (furniture, windows, doors, floor, walls, ceiling) and return a JSON list of objects with their normalized coordinates [ymin, xmin, ymax, xmax] in the format: {"objects": [{"label": "sofa", "box_2d": [ymin, xmin, ymax, xmax]}]}. Return ONLY the JSON, no extra text.`;

        const { result, total_tokens } = await callGeminiMultimodalAPI(
            'gemini-2.5-flash',
            detectionPrompt,
            image_base64,
            mime_type || 'image/jpeg',
            config.remodel.geminiApiKey,
            null,
            null,
            { baseUrl: config.remodel.baseUrl }
        );

        // Parse JSON from Gemini response
        let objects = [];
        try {
            const cleaned = result.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
            const parsed = JSON.parse(cleaned);
            objects = parsed.objects || [];
        } catch (parseErr) {
            console.error('❌ JSON parse error from Gemini:', parseErr.message);
            return res.status(500).json({ error: 'Failed to parse object detection response', code: 'PARSE_ERROR' });
        }

        res.json({ objects, total_tokens });
    } catch (error) {
        console.error('❌ Object Detection Error:', error);
        res.status(500).json({ error: error.message, code: 'AI_PROXY_ERROR' });
    }
});

// ─── HISTORY & GALLERY ENDPOINTS ──────────────────────────────────────────

/**
 * GET /history
 */
router.get('/history', (req, res) => {
    const userId = getUserId(req);
    const userHistory = historyStore.filter(item => item.userId === userId);
    res.json(userHistory.sort((a, b) => b.createdAt - a.createdAt));
});

/**
 * POST /history
 */
router.post('/history', (req, res) => {
    const { beforeImageUrl, afterImageUrl, prompt, category, isPublic } = req.body;
    const userId = getUserId(req);

    if (!beforeImageUrl || !afterImageUrl || !prompt) {
        return res.status(400).json({ error: 'Missing required fields', code: 'MISSING_FIELDS' });
    }

    const newRecord = {
        id: crypto.randomUUID(),
        userId,
        beforeImageUrl,
        afterImageUrl,
        prompt,
        category: category || 'general',
        isPublic: isPublic === true,
        createdAt: new Date()
    };

    historyStore.push(newRecord);
    res.status(201).json(newRecord);
});

/**
 * DELETE /history/:id
 */
router.delete('/history/:id', (req, res) => {
    const { id } = req.params;
    const userId = getUserId(req);
    const initialLength = historyStore.length;
    
    historyStore = historyStore.filter(item => !(item.id === id && item.userId === userId));
    
    if (historyStore.length < initialLength) {
        console.log(`🗑️ Deleted record: ${id} for user: ${userId}`);
        res.status(204).send();
    } else {
        res.status(404).json({ error: 'Record not found or unauthorized', code: 'NOT_FOUND' });
    }
});

/**
 * POST /history/:id/share
 * Toggles an image to public for the community gallery
 */
router.post('/history/:id/share', (req, res) => {
    const { id } = req.params;
    const userId = getUserId(req);
    const record = historyStore.find(item => item.id === id && item.userId === userId);

    if (!record) {
        return res.status(404).json({ error: 'Record not found or unauthorized', code: 'NOT_FOUND' });
    }

    record.isPublic = true;
    console.log(`🌍 Shared record to community: ${id}`);
    res.json(record);
});

/**
 * GET /gallery/public
 */
router.get('/gallery/public', (req, res) => {
    const publicGallery = historyStore.filter(item => item.isPublic);
    res.json(publicGallery.sort((a, b) => b.createdAt - a.createdAt));
});

module.exports = router;
