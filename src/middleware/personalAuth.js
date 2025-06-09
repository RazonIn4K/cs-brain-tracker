/**
 * Simple API key authentication for personal use
 */
function authenticatePersonal(req, res, next) {
  const apiKey = req.headers['x-api-key'] || req.query.apiKey;
  
  if (!apiKey || apiKey !== process.env.PERSONAL_API_KEY) {
    return res.status(401).json({ 
      error: { message: 'Invalid API key' } 
    });
  }
  
  // Set a simple user context
  req.user = {
    id: 'personal',
    name: 'David Ortiz'
  };
  
  next();
}

module.exports = { authenticatePersonal };
