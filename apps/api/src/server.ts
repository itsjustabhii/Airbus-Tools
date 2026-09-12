import { createApp } from './app';
import { config } from './config/env';
import { logger } from './core/logger';

const app = createApp();
const { PORT, HOST } = config;

const server = app.listen(PORT, HOST, () => {
  logger.info(`🚀 API server listening on http://${HOST}:${PORT}`);
  logger.info(`   Health: http://${HOST}:${PORT}/health`);
  logger.info(`   API:    http://${HOST}:${PORT}${config.API_PREFIX}`);
});

function shutdown(signal: string): void {
  logger.info(`Received ${signal}, shutting down gracefully...`);
  server.close(() => {
    logger.info('HTTP server closed');
    process.exit(0);
  });
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
