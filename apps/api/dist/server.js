"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const app_1 = require("./app");
const env_1 = require("./config/env");
const logger_1 = require("./core/logger");
const connection_1 = require("./database/connection");
let server;
async function bootstrap() {
    try {
        // 1. Connect to Database with retry capability
        await connection_1.database.connect({
            uri: env_1.config.MONGODB_URI,
        });
        // 2. Start HTTP server
        const app = (0, app_1.createApp)();
        const { PORT, HOST } = env_1.config;
        server = app.listen(PORT, HOST, () => {
            logger_1.logger.info(`🚀 API server listening on http://${HOST}:${PORT}`);
            logger_1.logger.info(`   Health: http://${HOST}:${PORT}/health`);
            logger_1.logger.info(`   Ready:  http://${HOST}:${PORT}/ready`);
            logger_1.logger.info(`   API:    http://${HOST}:${PORT}${env_1.config.API_PREFIX}`);
        });
    }
    catch (error) {
        logger_1.logger.fatal({ err: error }, 'Failed to start application');
        process.exit(1);
    }
}
async function shutdown(signal) {
    logger_1.logger.info(`Received ${signal}, shutting down gracefully...`);
    const forceTimeout = setTimeout(() => {
        logger_1.logger.error('Graceful shutdown timed out, forcing exit');
        process.exit(1);
    }, 10000);
    try {
        if (server) {
            await new Promise((resolve, reject) => {
                server.close((err) => (err ? reject(err) : resolve()));
            });
            logger_1.logger.info('HTTP server closed');
        }
        await connection_1.database.disconnect();
        clearTimeout(forceTimeout);
        logger_1.logger.info('Graceful shutdown completed successfully');
        process.exit(0);
    }
    catch (error) {
        logger_1.logger.error({ err: error }, 'Error during graceful shutdown');
        clearTimeout(forceTimeout);
        process.exit(1);
    }
}
process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
bootstrap().catch((err) => {
    logger_1.logger.fatal({ err }, 'Unhandled bootstrap error');
    process.exit(1);
});
//# sourceMappingURL=server.js.map