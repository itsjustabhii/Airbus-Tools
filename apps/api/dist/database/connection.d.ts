import mongoose from 'mongoose';
export interface DatabaseConfig {
    uri: string;
    maxPoolSize?: number;
    minPoolSize?: number;
    serverSelectionTimeoutMS?: number;
    socketTimeoutMS?: number;
    connectTimeoutMS?: number;
    maxRetries?: number;
    retryIntervalMS?: number;
}
export type ConnectionState = 'disconnected' | 'connected' | 'connecting' | 'disconnecting' | 'uninitialized';
export interface DatabaseHealthStatus {
    status: 'healthy' | 'unhealthy' | 'degraded';
    state: ConnectionState;
    host?: string;
    port?: number;
    name?: string;
    readyState: number;
    pingTimeMs?: number;
}
export declare class DatabaseService {
    private static instance;
    private isConnecting;
    private retryCount;
    private readonly defaultOptions;
    private constructor();
    static getInstance(): DatabaseService;
    private setupEventListeners;
    /**
     * Connect to MongoDB with retry-safe startup and exponential backoff
     */
    connect(config: DatabaseConfig): Promise<typeof mongoose>;
    /**
     * Graceful database disconnection
     */
    disconnect(): Promise<void>;
    /**
     * Check connection health status including ping test
     */
    getHealthStatus(): Promise<DatabaseHealthStatus>;
    getConnectionState(): ConnectionState;
    isConnected(): boolean;
}
export declare const database: DatabaseService;
//# sourceMappingURL=connection.d.ts.map