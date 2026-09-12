"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authRouter = void 0;
const express_1 = require("express");
const env_1 = require("../config/env");
const response_1 = require("../core/response");
const authenticate_1 = require("../middlewares/authenticate");
const rateLimiter_1 = require("../middlewares/rateLimiter");
const service_1 = require("../auth/service");
const schemas_1 = require("../auth/schemas");
const router = (0, express_1.Router)();
exports.authRouter = router;
// Cookie options shared by login/register (sets cookie) and logout (clears cookie)
function cookieOptions(isProduction) {
    return {
        httpOnly: true,
        secure: isProduction,
        sameSite: (isProduction ? 'none' : 'lax'),
        path: '/',
    };
}
/**
 * POST /api/auth/register
 * Creates a new user (AIRLINE or SUPPLIER only) and returns a session cookie.
 */
router.post('/register', rateLimiter_1.authRateLimiter, (req, res, next) => {
    void (async () => {
        try {
            const input = schemas_1.registerSchema.parse(req.body);
            const { token, user } = await (0, service_1.registerUser)(input);
            const isProd = env_1.config.NODE_ENV === 'production';
            res
                .cookie(service_1.AUTH_COOKIE_NAME, token, cookieOptions(isProd))
                .status(201)
                .json((0, response_1.successResponse)({ user }));
        }
        catch (err) {
            next(err);
        }
    })();
});
/**
 * POST /api/auth/login
 * Authenticates credentials and sets a session cookie.
 */
router.post('/login', rateLimiter_1.authRateLimiter, (req, res, next) => {
    void (async () => {
        try {
            const input = schemas_1.loginSchema.parse(req.body);
            const { token, user } = await (0, service_1.loginUser)(input);
            const isProd = env_1.config.NODE_ENV === 'production';
            res
                .cookie(service_1.AUTH_COOKIE_NAME, token, cookieOptions(isProd))
                .status(200)
                .json((0, response_1.successResponse)({ user }));
        }
        catch (err) {
            next(err);
        }
    })();
});
/**
 * POST /api/auth/logout
 * Clears the session cookie.
 */
router.post('/logout', authenticate_1.authenticate, (req, res) => {
    const isProd = env_1.config.NODE_ENV === 'production';
    res
        .clearCookie(service_1.AUTH_COOKIE_NAME, cookieOptions(isProd))
        .status(200)
        .json((0, response_1.successResponse)({ message: 'Logged out successfully' }));
});
/**
 * GET /api/auth/me
 * Returns the authenticated user's profile (no passwordHash).
 */
router.get('/me', authenticate_1.authenticate, (req, res, next) => {
    void (async () => {
        try {
            const user = await (0, service_1.getMe)(req.user.sub);
            res.status(200).json((0, response_1.successResponse)({ user }));
        }
        catch (err) {
            next(err);
        }
    })();
});
/**
 * PATCH /api/auth/password
 * Changes the authenticated user's password.
 */
router.patch('/password', authenticate_1.authenticate, (req, res, next) => {
    void (async () => {
        try {
            const input = schemas_1.changePasswordSchema.parse(req.body);
            await (0, service_1.changePassword)(req.user.sub, input);
            res.status(200).json((0, response_1.successResponse)({ message: 'Password updated successfully' }));
        }
        catch (err) {
            next(err);
        }
    })();
});
//# sourceMappingURL=auth.js.map