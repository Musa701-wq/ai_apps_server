/**
 * Application Configuration
 */
module.exports = {
    port: process.env.PORT || 3000,
    nodeEnv: process.env.NODE_ENV || 'development',

    // API Configuration
    apiLimits: {
        json: '50mb',
        urlencoded: '50mb'
    },

    // Gemini AI Configuration
    gemini: {
        baseUrl: 'https://generativelanguage.googleapis.com/v1beta/models',
        models: {
            standard: 'gemini-2.5-flash',
            multimodal: 'gemini-2.5-flash',
            lite: 'gemini-2.5-flash-lite'
        },
        apiKey: process.env.REVIVEPIX_API_KEY
    },

    // LabMate Configuration
    labmate: {
        baseUrl: 'https://generativelanguage.googleapis.com/v1beta/models',
        models: {
            mri: 'gemini-2.5-flash',
            reports: 'gemini-2.5-flash'
        },
        apiKey: process.env.LABMATE_API_KEY
    },

    // PlantAI Configuration
    plantai: {
        baseUrl: 'https://generativelanguage.googleapis.com/v1beta/models',
        model: 'gemini-2.5-flash-lite',
        apiKey: process.env.PLANTAI_API_KEY
    },

    // SmartCloset Configuration
    smartcloset: {
        baseUrl: 'https://generativelanguage.googleapis.com/v1beta/models',
        models: {
            // chat is now handled by AWS Bedrock — see bedrock config below
            vision: 'gemini-2.5-flash-image'
        },
        apiKey: process.env.SMARTCLOSET_API_KEY
    },

    // AWS Bedrock Configuration (SmartCloset chat + SmartSole multimodal)
    bedrock: {
        region: process.env.BEDROCK_REGION || 'ap-south-1',
        models: {
            chat: process.env.BEDROCK_MODEL_ID || 'openai.gpt-oss-120b-1:0',
            multimodal: process.env.BEDROCK_MULTIMODAL_MODEL || 'google.gemma-3-27b-it'
        },
        maxTokens: parseInt(process.env.BEDROCK_MAX_TOKENS || '1024'),
        temperature: parseFloat(process.env.BEDROCK_TEMPERATURE || '0.4')
    },

    // SmartSole Configuration
    // gemini-1.5-flash, gemini-2.5-flash-image, gemini-2.0-flash — all use same key
    textModel: {
        baseUrl: 'https://generativelanguage.googleapis.com/v1beta/models',
        model: 'gemini-1.5-flash',
        apiKey: process.env.SMARTSOLE_API_KEY
    },

    imageModel: {
        baseUrl: 'https://generativelanguage.googleapis.com/v1beta/models',
        model: 'gemini-2.5-flash-image',
        apiKey: process.env.SMARTSOLE_API_KEY
    },

    multimodalModel: {
        baseUrl: 'https://generativelanguage.googleapis.com/v1beta/models',
        model: 'gemini-2.0-flash',
        apiKey: process.env.SMARTSOLE_API_KEY
    },

    // MentorAI Configuration
    // - Text/Chat endpoints use AWS Bedrock (openai.gpt-oss-120b-1:0) — same as SmartCloset chat
    // - Image generation calls gemini-2.5-flash-image directly
    mentorai: {
        imageModel: 'gemini-2.5-flash-image',
        apiKey: process.env.MENTORAI_API_KEY
    },

    // Remodel Service Configuration
    // NOTE: RENOVATEAI_API_KEY is a Google AI Studio key (AQ. format) — must use
    // direct googleapis.com, NOT the mirdemy proxy (which rejects this key format).
    remodel: {
        baseUrl: 'https://generativelanguage.googleapis.com/v1beta/models',
        model: 'gemini-2.5-flash-image',
        geminiApiKey: process.env.RENOVATEAI_API_KEY,
        s3: {
            accessKey: process.env.S3_ACCESS_KEY,
            secretKey: process.env.S3_SECRET_KEY,
            region: process.env.S3_REGION || 'ap-south-1',
            bucket: process.env.S3_BUCKET,
            cloudfrontUrl: process.env.CLOUDFRONT_URL
        }
    },

    // Server Security
    serverAccessKey: process.env.SERVER_ACCESS_KEY
};
