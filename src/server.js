// Load environment variables
require('dotenv').config();

// Import the Express app
const app = require('./app');

// Configuration
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';
const NODE_ENV = process.env.NODE_ENV || 'development';

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('UNCAUGHT EXCEPTION! 💥 Shutting down...');
  console.error(error);
  process.exit(1);
});

// Start the server
const server = app.listen(PORT, HOST, () => {
  console.log(`
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║   🚀 CS Brain Tracker API                                 ║
║                                                           ║
║   Environment: ${NODE_ENV.padEnd(42)} ║
║   Server running at: http://${HOST}:${PORT}                  ║
║   Health check: http://${HOST}:${PORT}/health               ║
║   API Base: http://${HOST}:${PORT}/api/v1                   ║
║                                                           ║
║   Built with Triple AI Development:                       ║
║   - Claude Code: Core implementation                      ║
║   - o3: Documentation & reasoning                         ║
║   - Copilot: Suggestions & completion                     ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
  `);
});

// Pass server instance to app for graceful shutdown
app.set('server', server);

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('UNHANDLED REJECTION! 💥 Shutting down...');
  console.error('Reason:', reason);
  server.close(() => {
    process.exit(1);
  });
});

// Log server configuration
console.log('🔧 Server Configuration:');
console.log(`   - MongoDB: ${process.env.MONGODB_URI || 'mongodb://localhost:58745/cs_brain_tracker'}`);
console.log(`   - Sentry: ${process.env.SENTRY_DSN ? 'Enabled' : 'Disabled'}`);
console.log(`   - CORS Origins: ${process.env.ALLOWED_ORIGINS || 'localhost:3000,localhost:5173'}`);

module.exports = server;

