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
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.processedJobIds = exports.emailService = exports.EmailService = exports.MockEmailAdapter = exports.SesEmailAdapter = exports.LocalEmailAdapter = void 0;
var LocalEmailAdapter_1 = require("./LocalEmailAdapter");
Object.defineProperty(exports, "LocalEmailAdapter", { enumerable: true, get: function () { return LocalEmailAdapter_1.LocalEmailAdapter; } });
var SesEmailAdapter_1 = require("./SesEmailAdapter");
Object.defineProperty(exports, "SesEmailAdapter", { enumerable: true, get: function () { return SesEmailAdapter_1.SesEmailAdapter; } });
var MockEmailAdapter_1 = require("./MockEmailAdapter");
Object.defineProperty(exports, "MockEmailAdapter", { enumerable: true, get: function () { return MockEmailAdapter_1.MockEmailAdapter; } });
var EmailService_1 = require("./EmailService");
Object.defineProperty(exports, "EmailService", { enumerable: true, get: function () { return EmailService_1.EmailService; } });
Object.defineProperty(exports, "emailService", { enumerable: true, get: function () { return EmailService_1.emailService; } });
Object.defineProperty(exports, "processedJobIds", { enumerable: true, get: function () { return EmailService_1.processedJobIds; } });
__exportStar(require("./templates"), exports);
//# sourceMappingURL=index.js.map