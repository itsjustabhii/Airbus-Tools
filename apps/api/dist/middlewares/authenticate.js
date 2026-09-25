"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authenticate = authenticate;
const jsonwebtoken_1 = require("jsonwebtoken");
const jwt_1 = require("../auth/jwt");
const service_1 = require("../auth/service");
const tokenRevocation_1 = require("../auth/tokenRevocation");
const errors_1 = require("../core/errors");
/**
 * Reads the JWT from the HttpOnly cookie, verifies it, and attaches the
 * decoded payload to req.user. Throws UnauthorizedError for any failure.
 */
function authenticate(req, _res, next) {
    const token = req.cookies?.[service_1.AUTH_COOKIE_NAME];
    if (!token) {
        return next(new errors_1.UnauthorizedError('Authentication required'));
    }
    let payload;
    try {
        payload = (0, jwt_1.verifyToken)(token);
    }
    catch (err) {
        if (err instanceof jsonwebtoken_1.TokenExpiredError) {
            return next(new errors_1.UnauthorizedError('Token has expired'));
        }
        if (err instanceof jsonwebtoken_1.JsonWebTokenError) {
            return next(new errors_1.UnauthorizedError('Invalid token'));
        }
        return next(err);
    }
    // Check revocation list (async — wraps in void to satisfy Express sync signature)
    void (async () => {
        try {
            const revoked = await (0, tokenRevocation_1.isTokenRevoked)(payload.jti);
            if (revoked) {
                return next(new errors_1.UnauthorizedError('Token has been revoked'));
            }
            req.user = payload;
            next();
        }
        catch (err) {
            next(err);
        }
    })();
}
//# sourceMappingURL=authenticate.js.map