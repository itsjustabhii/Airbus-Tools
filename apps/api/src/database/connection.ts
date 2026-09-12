import mongoose from 'mongoose';
import type { ConnectOptions } from 'mongoose';

import { logger } from '../core/logger';

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

export class DatabaseService {
  private static instance: DatabaseService | null = null;
  private isConnecting = false;
  private retryCount = 0;

  private readonly defaultOptions: ConnectOptions = {
    maxPoolSize: 50,
    minPoolSize: 10,
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
    connectTimeoutMS: 10000,
    autoIndex: process.env.NODE_ENV !== 'production',
  };

  private constructor() {
    this.setupEventListeners();
  }

  public static getInstance(): DatabaseService {
    if (!DatabaseService.instance) {
      DatabaseService.instance = new DatabaseService();
    }
    return DatabaseService.instance;
  }

  private setupEventListeners(): void {
    mongoose.connection.on('connected', () => {
      logger.info({
        event: 'mongodb_connected',
        host: mongoose.connection.host,
        port: mongoose.connection.port,
        name: mongoose.connection.name,
      }, 'MongoDB connection established successfully');
    });

    mongoose.connection.on('error', (err) => {
      logger.error({ err, event: 'mongodb_error' }, 'MongoDB connection error occurred');
    });

    mongoose.connection.on('disconnected', () => {
      logger.warn({ event: 'mongodb_disconnected' }, 'MongoDB disconnected');
    });

    mongoose.connection.on('reconnected', () => {
      logger.info({ event: 'mongodb_reconnected' }, 'MongoDB reconnected');
    });
  }

  /**
   * Connect to MongoDB with retry-safe startup and exponential backoff
   */
  public async connect(config: DatabaseConfig): Promise<typeof mongoose> {
    if (mongoose.connection.readyState === (1 as mongoose.ConnectionStates)) {
      logger.debug('MongoDB is already connected');
      return mongoose;
    }

    if (this.isConnecting) {
      logger.debug('MongoDB connection is already in progress');
      return mongoose;
    }

    this.isConnecting = true;
    const maxRetries = config.maxRetries ?? 5;
    const baseInterval = config.retryIntervalMS ?? 1000;

    const options: ConnectOptions = {
      ...this.defaultOptions,
    };

    if (config.maxPoolSize !== undefined) options.maxPoolSize = config.maxPoolSize;
    if (config.minPoolSize !== undefined) options.minPoolSize = config.minPoolSize;
    if (config.serverSelectionTimeoutMS !== undefined) options.serverSelectionTimeoutMS = config.serverSelectionTimeoutMS;
    if (config.socketTimeoutMS !== undefined) options.socketTimeoutMS = config.socketTimeoutMS;
    if (config.connectTimeoutMS !== undefined) options.connectTimeoutMS = config.connectTimeoutMS;

    while (this.retryCount <= maxRetries) {
      try {
        logger.info({
          attempt: this.retryCount + 1,
          maxRetries: maxRetries + 1,
          uri: config.uri.replace(/\/\/([^:]+):([^@]+)@/, '//$1:***@'),
        }, 'Attempting to connect to MongoDB...');

        const client = await mongoose.connect(config.uri, options);
        this.isConnecting = false;
        this.retryCount = 0;
        return client;
      } catch (error) {
        this.retryCount++;
        if (this.retryCount > maxRetries) {
          this.isConnecting = false;
          logger.error({
            err: error,
            attempts: this.retryCount,
          }, 'Exceeded maximum MongoDB connection retry attempts');
          throw error;
        }

        const delay = baseInterval * Math.pow(2, this.retryCount - 1);
        logger.warn({
          err: error,
          attempt: this.retryCount,
          nextRetryDelayMs: delay,
        }, `MongoDB connection failed. Retrying in ${delay}ms...`);

        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    this.isConnecting = false;
    throw new Error('Failed to connect to MongoDB after retries');
  }

  /**
   * Graceful database disconnection
   */
  public async disconnect(): Promise<void> {
    if (mongoose.connection.readyState === (0 as mongoose.ConnectionStates)) {
      return;
    }

    logger.info('Closing MongoDB connection gracefully...');
    try {
      await mongoose.disconnect();
      logger.info('MongoDB connection closed');
    } catch (error) {
      logger.error({ err: error }, 'Error while closing MongoDB connection');
      throw error;
    }
  }

  /**
   * Check connection health status including ping test
   */
  public async getHealthStatus(): Promise<DatabaseHealthStatus> {
    const readyState = mongoose.connection.readyState;
    const states: Record<number, ConnectionState> = {
      0: 'disconnected',
      1: 'connected',
      2: 'connecting',
      3: 'disconnecting',
    };
    const state = states[readyState] ?? 'uninitialized';

    if (readyState !== (1 as mongoose.ConnectionStates)) {
      return {
        status: 'unhealthy',
        state,
        readyState,
      };
    }

    try {
      const startTime = Date.now();
      if (mongoose.connection.db) {
        await mongoose.connection.db.admin().ping();
      }
      const pingTimeMs = Date.now() - startTime;

      return {
        status: pingTimeMs > 500 ? 'degraded' : 'healthy',
        state,
        readyState,
        host: mongoose.connection.host,
        port: mongoose.connection.port,
        name: mongoose.connection.name,
        pingTimeMs,
      };
    } catch (error) {
      logger.warn({ err: error }, 'MongoDB ping failed during health check');
      return {
        status: 'unhealthy',
        state,
        readyState,
        host: mongoose.connection.host,
        port: mongoose.connection.port,
        name: mongoose.connection.name,
      };
    }
  }

  public getConnectionState(): ConnectionState {
    const states: Record<number, ConnectionState> = {
      0: 'disconnected',
      1: 'connected',
      2: 'connecting',
      3: 'disconnecting',
    };
    return states[mongoose.connection.readyState] ?? 'uninitialized';
  }

  public isConnected(): boolean {
    return mongoose.connection.readyState === (1 as mongoose.ConnectionStates);
  }
}

export const database = DatabaseService.getInstance();
