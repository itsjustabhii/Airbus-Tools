"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authenticate = authenticate;
const jsonwebtoken_1 = require("jsonwebtoken");
const errors_1 = require("../core/errors");
const service_1 = require("../auth/service");
const jwt_1 = require("../auth/jwt");
/**
 * Reads the JWT from the HttpOnly cookie, verifies it, and attaches the
 * decoded payload to req.user. Throws UnauthorizedError for any failure.
 */
function authenticate(req, _res, next) {
    const token = req.cookies?.[service_1.AUTH_COOKIE_NAME];
    if (!token) {
        return next(new errors_1.UnauthorizedError('Authentication required'));
    }
    try {
        req.user = (0, jwt_1.verifyToken)(token);
        next();
    }
    catch (err) {
        if (err instanceof jsonwebtoken_1.TokenExpiredError) {
            return next(new errors_1.UnauthorizedError('Token has expired'));
        }
        if (err instanceof jsonwebtoken_1.JsonWebTokenError) {
            return next(new errors_1.UnauthorizedError('Invalid token'));
        }
        next(err);
    }
}
//# sourceMappingURL=authenticate.js.map