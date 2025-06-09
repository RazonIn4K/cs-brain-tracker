// Add these lines after other middleware setup
const { authenticatePersonal } = require('./middleware/personalAuth');

// Mount personal routes with simple auth
app.use('/api/personal', authenticatePersonal, require('./api/routes/personal'));

// Keep existing routes for now but protect them
app.use('/api/v1', authenticatePersonal);
