"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.database = exports.DatabaseService = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const logger_1 = require("../core/logger");
class DatabaseService {
    static instance = null;
    isConnecting = false;
    retryCount = 0;
    defaultOptions = {
        maxPoolSize: 50,
        minPoolSize: 10,
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
        connectTimeoutMS: 10000,
        autoIndex: process.env.NODE_ENV !== 'production',
    };
    constructor() {
        this.setupEventListeners();
    }
    static getInstance() {
        if (!DatabaseService.instance) {
            DatabaseService.instance = new DatabaseService();
        }
        return DatabaseService.instance;
    }
    setupEventListeners() {
        mongoose_1.default.connection.on('connected', () => {
            logger_1.logger.info({
                event: 'mongodb_connected',
                host: mongoose_1.default.connection.host,
                port: mongoose_1.default.connection.port,
                name: mongoose_1.default.connection.name,
            }, 'MongoDB connection established successfully');
        });
        mongoose_1.default.connection.on('error', (err) => {
            logger_1.logger.error({ err, event: 'mongodb_error' }, 'MongoDB connection error occurred');
        });
        mongoose_1.default.connection.on('disconnected', () => {
            logger_1.logger.warn({ event: 'mongodb_disconnected' }, 'MongoDB disconnected');
        });
        mongoose_1.default.connection.on('reconnected', () => {
            logger_1.logger.info({ event: 'mongodb_reconnected' }, 'MongoDB reconnected');
        });
    }
    /**
     * Connect to MongoDB with retry-safe startup and exponential backoff
     */
    async connect(config) {
        if (mongoose_1.default.connection.readyState === 1) {
            logger_1.logger.debug('MongoDB is already connected');
            return mongoose_1.default;
        }
        if (this.isConnecting) {
            logger_1.logger.debug('MongoDB connection is already in progress');
            return mongoose_1.default;
        }
        this.isConnecting = true;
        const maxRetries = config.maxRetries ?? 5;
        const baseInterval = config.retryIntervalMS ?? 1000;
        const options = {
            ...this.defaultOptions,
        };
        if (config.maxPoolSize !== undefined)
            options.maxPoolSize = config.maxPoolSize;
        if (config.minPoolSize !== undefined)
            options.minPoolSize = config.minPoolSize;
        if (config.serverSelectionTimeoutMS !== undefined)
            options.serverSelectionTimeoutMS = config.serverSelectionTimeoutMS;
        if (config.socketTimeoutMS !== undefined)
            options.socketTimeoutMS = config.socketTimeoutMS;
        if (config.connectTimeoutMS !== undefined)
            options.connectTimeoutMS = config.connectTimeoutMS;
        while (this.retryCount <= maxRetries) {
            try {
                logger_1.logger.info({
                    attempt: this.retryCount + 1,
                    maxRetries: maxRetries + 1,
                    uri: config.uri.replace(/\/\/([^:]+):([^@]+)@/, '//$1:***@'),
                }, 'Attempting to connect to MongoDB...');
                const client = await mongoose_1.default.connect(config.uri, options);
                this.isConnecting = false;
                this.retryCount = 0;
                return client;
            }
            catch (error) {
                this.retryCount++;
                if (this.retryCount > maxRetries) {
                    this.isConnecting = false;
                    logger_1.logger.error({
                        err: error,
                        attempts: this.retryCount,
                    }, 'Exceeded maximum MongoDB connection retry attempts');
                    throw error;
                }
                const delay = baseInterval * Math.pow(2, this.retryCount - 1);
                logger_1.logger.warn({
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
    async disconnect() {
        if (mongoose_1.default.connection.readyState === 0) {
            return;
        }
        logger_1.logger.info('Closing MongoDB connection gracefully...');
        try {
            await mongoose_1.default.disconnect();
            logger_1.logger.info('MongoDB connection closed');
        }
        catch (error) {
            logger_1.logger.error({ err: error }, 'Error while closing MongoDB connection');
            throw error;
        }
    }
    /**
     * Check connection health status including ping test
     */
    async getHealthStatus() {
        const readyState = mongoose_1.default.connection.readyState;
        const states = {
            0: 'disconnected',
            1: 'connected',
            2: 'connecting',
            3: 'disconnecting',
        };
        const state = states[readyState] ?? 'uninitialized';
        if (readyState !== 1) {
            return {
                status: 'unhealthy',
                state,
                readyState,
            };
        }
        try {
            const startTime = Date.now();
            if (mongoose_1.default.connection.db) {
                await mongoose_1.default.connection.db.admin().ping();
            }
            const pingTimeMs = Date.now() - startTime;
            return {
                status: pingTimeMs > 500 ? 'degraded' : 'healthy',
                state,
                readyState,
                host: mongoose_1.default.connection.host,
                port: mongoose_1.default.connection.port,
                name: mongoose_1.default.connection.name,
                pingTimeMs,
            };
        }
        catch (error) {
            logger_1.logger.warn({ err: error }, 'MongoDB ping failed during health check');
            return {
                status: 'unhealthy',
                state,
                readyState,
                host: mongoose_1.default.connection.host,
                port: mongoose_1.default.connection.port,
                name: mongoose_1.default.connection.name,
            };
        }
    }
    getConnectionState() {
        const states = {
            0: 'disconnected',
            1: 'connected',
            2: 'connecting',
            3: 'disconnecting',
        };
        return states[mongoose_1.default.connection.readyState] ?? 'uninitialized';
    }
    isConnected() {
        return mongoose_1.default.connection.readyState === 1;
    }
}
exports.DatabaseService = DatabaseService;
exports.database = DatabaseService.getInstance();
//# sourceMappingURL=connection.js.map