"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authorize = authorize;
const errors_1 = require("../core/errors");
/**
 * Role-based authorization middleware factory.
 * Must be used AFTER authenticate().
 *
 * @param allowedRoles - one or more roles that may access the route
 */
function authorize(...allowedRoles) {
    return (req, _res, next) => {
        if (!req.user) {
            return next(new errors_1.UnauthorizedError('Authentication required'));
        }
        if (!allowedRoles.includes(req.user.role)) {
            return next(new errors_1.ForbiddenError('You do not have permission to access this resource'));
        }
        next();
    };
}
//# sourceMappingURL=authorize.js.map