"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.notificationIdParamSchema = exports.listNotificationsQuerySchema = void 0;
const zod_1 = require("zod");
exports.listNotificationsQuerySchema = zod_1.z.object({
    page: zod_1.z.coerce.number().int().positive().default(1),
    limit: zod_1.z.coerce.number().int().positive().max(100).default(20),
    isRead: zod_1.z
        .enum(['true', 'false'])
        .transform((val) => val === 'true')
        .optional(),
});
exports.notificationIdParamSchema = zod_1.z.object({
    id: zod_1.z.string().min(1, 'Notification ID is required'),
});
//# sourceMappingURL=notifications.schemas.js.map