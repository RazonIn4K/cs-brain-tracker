// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.MONGODB_URI = 'mongodb://localhost:58745/cs_brain_tracker_test';
process.env.JWT_ISSUER = 'https://cs-brain-tracker.local/';
process.env.JWT_AUDIENCE = 'cs-brain-tracker-api';

// Increase Jest timeout for database operations
jest.setTimeout(10000);