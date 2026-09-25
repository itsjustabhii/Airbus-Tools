"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.signToken = signToken;
exports.verifyToken = verifyToken;
exports.tokenRemainingTtl = tokenRemainingTtl;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const uuid_1 = require("uuid");
const env_1 = require("../config/env");
function signToken(payload) {
    return jsonwebtoken_1.default.sign({ ...payload, jti: (0, uuid_1.v4)() }, env_1.config.JWT_SECRET, { expiresIn: (env_1.config.JWT_EXPIRY || '15m') });
}
function verifyToken(token) {
    return jsonwebtoken_1.default.verify(token, env_1.config.JWT_SECRET);
}
/**
 * Returns the number of seconds until the token expires.
 * Returns 0 if the token has already expired or has no exp claim.
 */
function tokenRemainingTtl(payload) {
    if (!payload.exp)
        return 0;
    return Math.max(0, payload.exp - Math.floor(Date.now() / 1000));
}
//# sourceMappingURL=jwt.js.map