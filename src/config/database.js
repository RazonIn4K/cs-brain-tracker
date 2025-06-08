const mongoose = require('mongoose');

/**
 * MongoDB connection with production-ready features
 * Created by Claude Code - demonstrating AI orchestration
 */

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:58745/cs_brain_tracker';

// Connection options with pooling
const options = {
  maxPoolSize: 10,
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
};

// Exponential backoff retry logic
/**
 * The current reconnection attempt counter.
 *
 * Starts at 0 and increments every time `connectDB` fails to establish a
 * connection. This counter is crucial for two reasons:
 *  1. It is used to compute the delay before the next retry following the
 *     exponential back-off formula `delay = baseDelay * 2^(retryCount - 1)`.
 *  2. It helps determine when the maximum number of retries (`maxRetries`) has
 *     been reached so the process can terminate gracefully instead of looping
 *     forever.
 *
 * @type {number}
 * @private
 */
let retryCount = 0;

/**
 * Maximum number of reconnection attempts allowed before the application
 * aborts. A finite limit prevents the service from getting stuck in an
 * infinite retry loop in production.
 *
 * @type {number}
 * @constant
 */
const maxRetries = 5;

/**
 * Base delay (in milliseconds) for the exponential back-off calculation.
 *
 * The waiting time for the *n*th retry is derived from this value using:
 * `delay = baseDelay * 2^(retryCount - 1)`.
 *
 * Example sequence with `baseDelay` = 1000 ms:
 * 1 s → 2 s → 4 s → 8 s → 16 s
 *
 * @type {number}
 * @constant
 */
const baseDelay = 1000;

/**
 * Attempts to establish a MongoDB connection using Mongoose.
 *
 * The function implements an **exponential back-off** strategy that waits for a
 * progressively longer period between retries when the initial connection
 * fails. The delay is calculated as `baseDelay * 2^(retryCount - 1)` where
 * `retryCount` starts at 1 for the first retry. After `maxRetries` unsuccessful
 * attempts, the process exits with code 1 to avoid hanging indefinitely in a
 * crash-loop scenario.
 *
 * @async
 * @function connectDB
 * @returns {Promise<mongoose.Connection>} Resolves with the active Mongoose
 * connection upon success.
 * @throws Terminates the Node.js process if the connection cannot be
 * established after the maximum number of retries.
 */
const connectDB = async () => {
  try {
    console.log('🔄 Attempting MongoDB connection...');
    const conn = await mongoose.connect(MONGODB_URI, options);
    
    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
    console.log(`📊 Database: ${conn.connection.name}`);
    retryCount = 0;
    
    return conn;
  } catch (error) {
    console.error('❌ MongoDB connection error:', error.message);
    
    if (retryCount < maxRetries) {
      retryCount++;
      const delay = baseDelay * Math.pow(2, retryCount - 1);
      console.log(`⏳ Retrying in ${delay/1000}s... (${retryCount}/${maxRetries})`);
      
      await new Promise(resolve => setTimeout(resolve, delay));
      return connectDB();
    } else {
      console.error('💀 Max retries reached. Connection failed.');
      process.exit(1);
    }
  }
};

// Connection event handlers
mongoose.connection.on('connected', () => {
  console.log('📡 Mongoose connected to MongoDB');
});

mongoose.connection.on('error', (err) => {
  console.error('🔥 Mongoose connection error:', err);
});

mongoose.connection.on('disconnected', () => {
  console.log('🔌 Mongoose disconnected');
});

// Graceful shutdown
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

async function gracefulShutdown(signal) {
  console.log(`\n🛑 ${signal} received. Closing MongoDB connection...`);
  await mongoose.connection.close();
  console.log('✅ MongoDB connection closed');
  process.exit(0);
}

module.exports = connectDB;

