"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.setupTestDB = setupTestDB;
exports.teardownTestDB = teardownTestDB;
exports.clearTestDB = clearTestDB;
const mongodb_memory_server_1 = require("mongodb-memory-server");
const mongoose_1 = __importDefault(require("mongoose"));
const connection_1 = require("./connection");
let mongod;
async function setupTestDB() {
    mongod = await mongodb_memory_server_1.MongoMemoryServer.create();
    const uri = mongod.getUri();
    await connection_1.database.connect({ uri, maxRetries: 1 });
}
async function teardownTestDB() {
    await connection_1.database.disconnect();
    if (mongod) {
        await mongod.stop();
    }
}
async function clearTestDB() {
    const collections = mongoose_1.default.connection.collections;
    for (const key in collections) {
        const collection = collections[key];
        if (collection) {
            await collection.deleteMany({});
        }
    }
}
//# sourceMappingURL=test-utils.js.map