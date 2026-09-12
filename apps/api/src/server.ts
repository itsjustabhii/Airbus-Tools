import type { Server } from 'http';

import { createApp } from './app';
import { config } from './config/env';
import { logger } from './core/logger';
import { database } from './database/connection';
import { closeRedisAdapter } from './sockets/redis';
import { initSocketServer } from './sockets/socketServer';

let server: Server;

async function bootstrap(): Promise<void> {
  try {
    // 1. Connect to Database with retry capability
    await database.connect({
      uri: config.MONGODB_URI,
    });

    // 2. Start HTTP server
    const app = createApp();
    const { PORT, HOST } = config;

    server = app.listen(PORT, HOST, () => {
      logger.info(`🚀 API server listening on http://${HOST}:${PORT}`);
      logger.info(`   Health: http://${HOST}:${PORT}/health`);
      logger.info(`   Ready:  http://${HOST}:${PORT}/ready`);
      logger.info(`   API:    http://${HOST}:${PORT}${config.API_PREFIX}`);

      // 3. Initialize Socket.io server
      void (async () => {
        try {
          await initSocketServer(server);
          logger.info('🔌 Socket.io server initialized and bound to HTTP server');
        } catch (err) {
          logger.error({ err }, 'Failed to initialize Socket.io server');
        }
      })();
    });
  } catch (error) {
    logger.fatal({ err: error }, 'Failed to start application');
    process.exit(1);
  }
}

async function shutdown(signal: string): Promise<void> {
  logger.info(`Received ${signal}, shutting down gracefully...`);

  const forceTimeout = setTimeout(() => {
    logger.error('Graceful shutdown timed out, forcing exit');
    process.exit(1);
  }, 10000);

  try {
    if (server) {
      await new Promise<void>((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      });
      logger.info('HTTP server closed');
    }

    // Close Redis adapter connections if initialized
    await closeRedisAdapter();

    await database.disconnect();
    clearTimeout(forceTimeout);
    logger.info('Graceful shutdown completed successfully');
    process.exit(0);
  } catch (error) {
    logger.error({ err: error }, 'Error during graceful shutdown');
    clearTimeout(forceTimeout);
    process.exit(1);
  }
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));

bootstrap().catch((err) => {
  logger.fatal({ err }, 'Unhandled bootstrap error');
  process.exit(1);
});
