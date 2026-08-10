/**
 * Authentication middleware for API key verification
 */
const authenticate = (req, res, next) => {
    const apiKey = req.headers['x-api-key'];

    if (!apiKey || apiKey !== process.env.SERVER_ACCESS_KEY) {
        return res.status(401).json({ 
            error: 'Unauthorized: Invalid or missing API key',
            code: 'AUTH_FAILED'
        });
    }

    next();
};

module.exports = authenticate;
