"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const app_1 = require("./app");
const env_1 = require("./config/env");
const logger_1 = require("./core/logger");
const app = (0, app_1.createApp)();
const { PORT, HOST } = env_1.config;
const server = app.listen(PORT, HOST, () => {
    logger_1.logger.info(`🚀 API server listening on http://${HOST}:${PORT}`);
    logger_1.logger.info(`   Health: http://${HOST}:${PORT}/health`);
    logger_1.logger.info(`   API:    http://${HOST}:${PORT}${env_1.config.API_PREFIX}`);
});
function shutdown(signal) {
    logger_1.logger.info(`Received ${signal}, shutting down gracefully...`);
    server.close(() => {
        logger_1.logger.info('HTTP server closed');
        process.exit(0);
    });
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
//# sourceMappingURL=server.js.map