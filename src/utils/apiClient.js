/**
 * API Client utility for Gemini and other AI services
 */
const axios = require('axios');

// ─── SmartCloset-specific Gemini settings ─────────────────────────────────

/**
 * generationConfig applied to all SmartCloset endpoints.
 * - temperature 1.0  → creative yet style-accurate suggestions
 * - topP / topK      → nucleus + top-k sampling for quality output
 * - maxOutputTokens  → minimum 2048 for high-res image data or long advice
 */
const SMARTCLOSET_GENERATION_CONFIG = {
    temperature: 1.0,
    topP: 0.95,
    topK: 40,
    maxOutputTokens: 2048
};

/**
 * safetySettings applied to SmartCloset image endpoints (try-on / combo).
 * Set to BLOCK_NONE to prevent false-positive blocks on valid fashion images.
 */
const SMARTCLOSET_SAFETY_SETTINGS = [
    { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
    { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
    { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
    { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' }
];

// ─── Gemini text API ───────────────────────────────────────────────────────

/**
 * Call Google Gemini API with text prompt.
 * @param {string}  model
 * @param {string}  prompt
 * @param {string}  apiKey
 * @param {object}  [options]
 * @param {object}  [options.generationConfig]  - override generation params
 * @param {Array}   [options.safetySettings]    - override safety settings
 */
async function callGeminiAPI(model, prompt, apiKey, options = {}) {
    if (!prompt) throw new Error('Prompt is required');
    if (!apiKey) throw new Error('API key is missing');

    const requestBody = {
        contents: [{ parts: [{ text: prompt }] }]
    };

    if (options.generationConfig) {
        requestBody.generationConfig = options.generationConfig;
    }

    if (options.safetySettings) {
        requestBody.safetySettings = options.safetySettings;
    }

    try {
        const baseUrl = options.baseUrl || 'https://generativelanguage.googleapis.com/v1beta/models';
        const useHeaderAuth = apiKey.startsWith('AQ.');
        const url = useHeaderAuth ? `${baseUrl}/${model}:generateContent` : `${baseUrl}/${model}:generateContent?key=${apiKey}`;
        const headers = { 'Content-Type': 'application/json' };
        if (useHeaderAuth) headers['x-goog-api-key'] = apiKey;

        const response = await axios.post(url, requestBody, { headers });

        const candidate = response.data.candidates?.[0];

        if (!candidate || candidate.finishReason === 'SAFETY') {
            const error = new Error('Blocked by safety filters');
            error.code = 'SAFETY_BLOCK';
            throw error;
        }

        const result = candidate.content.parts[0].text;
        const usage = response.data.usageMetadata || {};
        const total_tokens = (usage.promptTokenCount || 0) + (usage.candidatesTokenCount || 0);

        return { result, total_tokens };
    } catch (error) {
        if (error.code === 'SAFETY_BLOCK') throw error;
        throw new Error(error.response?.data?.error?.message || error.message);
    }
}

// ─── Gemini multimodal API ─────────────────────────────────────────────────

/**
 * Call Gemini Multimodal API — supports text + up to 2 images.
 * Image order is preserved: image_base64 → image_base64_2 → prompt text.
 * For image-generation models: requests IMAGE + TEXT modalities.
 *
 * @param {string}  model
 * @param {string}  prompt
 * @param {string}  imageBase64   - first image (person photo / shirt)
 * @param {string}  mimeType      - MIME type of first image
 * @param {string}  apiKey
 * @param {string}  [imageBase64_2] - second image (clothing item / pant)
 * @param {string}  [mimeType2]     - MIME type of second image
 * @param {object}  [options]
 * @param {object}  [options.generationConfig]  - override generation params
 * @param {Array}   [options.safetySettings]    - override safety settings
 */
async function callGeminiMultimodalAPI(
    model, prompt, imageBase64, mimeType, apiKey,
    imageBase64_2 = null, mimeType2 = null,
    options = {}
) {
    if (!prompt) throw new Error('Prompt is required');
    if (!apiKey) throw new Error('API key is missing');

    // Build parts — image order matters for try-on / combo logic
    const parts = [];

    if (imageBase64 && mimeType) {
        parts.push({ inline_data: { mime_type: mimeType, data: imageBase64 } });
    }

    if (imageBase64_2 && mimeType2) {
        parts.push({ inline_data: { mime_type: mimeType2, data: imageBase64_2 } });
    }

    parts.push({ text: prompt });

    const isImageModel = model.includes('image');

    // Base generationConfig — merge responseModalities for image models
    const generationConfig = {
        ...(options.generationConfig || {}),
        ...(isImageModel ? { responseModalities: ['IMAGE', 'TEXT'] } : {})
    };

    const requestBody = {
        contents: [{ parts }],
        generationConfig
    };

    if (options.safetySettings) {
        requestBody.safetySettings = options.safetySettings;
    }

    try {
        const baseUrl = options.baseUrl || 'https://generativelanguage.googleapis.com/v1beta/models';
        const useHeaderAuth = apiKey.startsWith('AQ.');
        const url = useHeaderAuth ? `${baseUrl}/${model}:generateContent` : `${baseUrl}/${model}:generateContent?key=${apiKey}`;
        const headers = { 'Content-Type': 'application/json' };
        if (useHeaderAuth) headers['x-goog-api-key'] = apiKey;

        const response = await axios.post(url, requestBody, { headers });

        const candidate = response.data.candidates?.[0];

        if (!candidate || candidate.finishReason === 'SAFETY') {
            const error = new Error('Blocked by safety filters');
            error.code = 'SAFETY_BLOCK';
            throw error;
        }

        const usage = response.data.usageMetadata || {};
        const total_tokens = (usage.promptTokenCount || 0) + (usage.candidatesTokenCount || 0);

        const responseParts = candidate.content?.parts || [];
        const imagePart = responseParts.find(p => p.inlineData?.data || p.inline_data?.data);
        const textPart = responseParts.find(p => p.text);

        let result = '';
        if (imagePart) {
            // Handle both camelCase (inlineData) and snake_case (inline_data)
            const inlineData = imagePart.inlineData || imagePart.inline_data;
            result = inlineData.data; // pure base64
        } else if (textPart) {
            result = textPart.text;
        }

        return { result, total_tokens };
    } catch (error) {
        if (error.code === 'SAFETY_BLOCK') throw error;
        throw new Error(error.response?.data?.error?.message || error.message);
    }
}

module.exports = {
    callGeminiAPI,
    callGeminiMultimodalAPI,
    SMARTCLOSET_GENERATION_CONFIG,
    SMARTCLOSET_SAFETY_SETTINGS
};
