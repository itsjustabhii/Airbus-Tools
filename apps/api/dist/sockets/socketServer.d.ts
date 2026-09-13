import { type Server as HttpServer } from 'http';
import { Server } from 'socket.io';
/**
 * Initializes the Socket.io server, applies authentication middleware, and registers event handlers.
 * Also configures the Redis adapter if a REDIS_URL environment variable is present.
 */
export declare function initSocketServer(httpServer: HttpServer): Promise<Server>;
/**
 * Retrieves the active Socket.io server instance.
 */
export declare function getSocketServer(): Server;
/**
 * Returns the active Socket.io server instance, or `null` if it has not been
 * initialized yet. Safe to call from background worker processes.
 */
export declare function getIO(): Server | null;
/**
 * Resets the Socket.io server singleton instance.
 * Primarily used in test suites to allow re-initialization on dynamic ports.
 */
export declare function resetSocketServer(): void;
//# sourceMappingURL=socketServer.d.ts.map