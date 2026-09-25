"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.authRouter = void 0;
const express_1 = require("express");
const schemas_1 = require("../auth/schemas");
const service_1 = require("../auth/service");
const env_1 = require("../config/env");
const response_1 = require("../core/response");
const authenticate_1 = require("../middlewares/authenticate");
const csrf_1 = require("../middlewares/csrf");
const rateLimiter_1 = require("../middlewares/rateLimiter");
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
            (0, csrf_1.setCsrfCookie)(res, isProd);
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
            (0, csrf_1.setCsrfCookie)(res, isProd);
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
router.post('/logout', authenticate_1.authenticate, (req, res, next) => {
    void (async () => {
        try {
            // Revoke the current JWT so it cannot be reused even within its expiry window
            if (req.user?.jti) {
                const { revokeToken } = await Promise.resolve().then(() => __importStar(require('../auth/tokenRevocation')));
                const { tokenRemainingTtl } = await Promise.resolve().then(() => __importStar(require('../auth/jwt')));
                await revokeToken(req.user.jti, tokenRemainingTtl(req.user));
            }
            const isProd = env_1.config.NODE_ENV === 'production';
            res
                .clearCookie(service_1.AUTH_COOKIE_NAME, cookieOptions(isProd))
                .status(200)
                .json((0, response_1.successResponse)({ message: 'Logged out successfully' }));
        }
        catch (err) {
            next(err);
        }
    })();
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
            // Revoke the current token so sessions on other devices are invalidated
            if (req.user?.jti) {
                const { revokeToken } = await Promise.resolve().then(() => __importStar(require('../auth/tokenRevocation')));
                const { tokenRemainingTtl } = await Promise.resolve().then(() => __importStar(require('../auth/jwt')));
                await revokeToken(req.user.jti, tokenRemainingTtl(req.user));
            }
            res.status(200).json((0, response_1.successResponse)({ message: 'Password updated successfully' }));
        }
        catch (err) {
            next(err);
        }
    })();
});
//# sourceMappingURL=auth.js.map