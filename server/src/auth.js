const jwt = require('jsonwebtoken');

function signToken(payload, config) {
    return jwt.sign(payload, config.jwtSecret, {
        expiresIn: config.tokenExpiresIn,
    });
}

function authMiddleware(config) {
    return (req, res, next) => {
        const authorization = req.headers.authorization || '';
        const token = authorization.startsWith('Bearer ')
            ? authorization.slice('Bearer '.length)
            : '';

        if (!token) {
            res.status(401).json({
                success: false,
                error: 'missing_token',
                message: 'Authorization token is required',
            });
            return;
        }

        try {
            req.auth = jwt.verify(token, config.jwtSecret);
            next();
        } catch (error) {
            res.status(401).json({
                success: false,
                error: 'invalid_token',
                message: 'Authorization token is invalid or expired',
            });
        }
    };
}

module.exports = {
    signToken,
    authMiddleware,
};
