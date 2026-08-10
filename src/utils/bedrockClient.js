/**
 * AWS Bedrock Client Utility
 * Used for SmartCloset fashion chat via openai.gpt-oss-120b-1:0
 * Used for SmartSole multimodal via google.gemma-3-27b-it
 */
const { BedrockRuntimeClient, ConverseCommand } = require('@aws-sdk/client-bedrock-runtime');
const config = require('../config');

// ─── Client setup ─────────────────────────────────────────────────────────
// AWS_BEARER_TOKEN_BEDROCK is picked up automatically by the SDK
// as a bearer token credential when set in the environment.
const _client = new BedrockRuntimeClient({
    region: config.bedrock.region
});

/**
 * Send a text prompt to AWS Bedrock and return the response.
 *
 * @param {string} prompt         - User message / query
 * @param {string} [systemPrompt] - Optional system instruction
 * @param {string} [modelId]      - Override model ID (default: config.bedrock.models.chat)
 * @returns {{ result: string, total_tokens: number }}
 */
async function callBedrockChat(prompt, systemPrompt = null, modelId = null) {
    if (!prompt) throw new Error('Prompt is required');

    const messages = [
        {
            role: 'user',
            content: [{ text: prompt }]
        }
    ];

    const params = {
        modelId: modelId || config.bedrock.models.chat,
        messages,
        inferenceConfig: {
            maxTokens: config.bedrock.maxTokens,
            temperature: config.bedrock.temperature
        }
    };

    if (systemPrompt) {
        params.system = [{ text: systemPrompt }];
    }

    const command = new ConverseCommand(params);
    const response = await _client.send(command);

    // Extract text from response
    let result = '';
    const parts = response?.output?.message?.content || [];
    for (const item of parts) {
        if (item?.text) result += item.text;
    }

    // Token usage
    const usage = response?.usage || {};
    const total_tokens = (usage.inputTokens || 0) + (usage.outputTokens || 0);

    return { result, total_tokens };
}

module.exports = { callBedrockChat };
