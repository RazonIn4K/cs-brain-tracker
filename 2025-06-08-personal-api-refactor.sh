#!/bin/bash

# Personal API Refactor Script
# Transforms cs-brain-tracker from multi-user SaaS to personal productivity tool

echo "🔄 Transforming CS Brain Tracker to Personal Tool..."
echo ""

# Backup current state
echo "📦 Creating backup..."
git add -A
git commit -m "Backup: Before personal tool refactor" || echo "No changes to commit"

# Generate personal API key
echo "🔑 Generating personal API key..."
PERSONAL_API_KEY=$(openssl rand -hex 32)
echo "" >> .env
echo "# Personal API Configuration" >> .env
echo "PERSONAL_API_KEY=$PERSONAL_API_KEY" >> .env
echo "✅ Personal API key added to .env"

# Add Obsidian vault path
echo "📁 Configuring Obsidian vault path..."
echo "OBSIDIAN_VAULT_PATH=$HOME/True-CS-Obsidian/CS-Brain" >> .env
echo "✅ Obsidian vault path configured"

# Create simplified auth middleware
echo "🔧 Creating personal auth middleware..."
cat > src/middleware/personalAuth.js << 'EOF'
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
EOF

echo "✅ Personal auth middleware created"

# Create personal routes
echo "📝 Creating personal routes..."
cat > src/api/routes/personal.js << 'EOF'
const router = require('express').Router();
const fs = require('fs').promises;
const path = require('path');
const matter = require('gray-matter');
const LearningCapture = require('../../models/LearningCapture');

/**
 * POST /api/personal/capture/quick
 * Quick capture to Obsidian vault
 */
router.post('/capture/quick', async (req, res, next) => {
  try {
    const { content, type = 'insight', tags = [], domain, cognitiveLoad = 50 } = req.body;
    
    if (!content) {
      return res.status(400).json({ 
        error: { message: 'Content is required' } 
      });
    }
    
    // Save to database
    const capture = await LearningCapture.create({
      userId: 'personal',
      type,
      content,
      tags,
      cognitiveLoad,
      context: { 
        domain,
        environment: 'api'
      }
    });
    
    // Also save to Obsidian if vault path exists
    if (process.env.OBSIDIAN_VAULT_PATH) {
      const date = new Date();
      const dateStr = date.toISOString().split('T')[0];
      const filename = `${dateStr}-${type}-${capture._id}.md`;
      const filepath = path.join(
        process.env.OBSIDIAN_VAULT_PATH,
        '000-Capture/api',
        filename
      );
      
      // Ensure directory exists
      await fs.mkdir(path.dirname(filepath), { recursive: true });
      
      // Create markdown with frontmatter
      const markdown = matter.stringify(content, {
        id: capture._id.toString(),
        title: content.substring(0, 60).replace(/\n/g, ' '),
        date: date,
        type,
        domain,
        tags,
        cognitiveLoad,
        source: 'cs-brain-api'
      });
      
      await fs.writeFile(filepath, markdown);
      
      res.json({ 
        success: true, 
        capture: capture._id,
        obsidianFile: filename 
      });
    } else {
      res.json({ 
        success: true, 
        capture: capture._id 
      });
    }
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/personal/stats/today
 * Get today's learning stats
 */
router.get('/stats/today', async (req, res, next) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const stats = await LearningCapture.aggregate([
      {
        $match: {
          userId: 'personal',
          timestamp: { $gte: today }
        }
      },
      {
        $group: {
          _id: null,
          totalCaptures: { $sum: 1 },
          avgCognitiveLoad: { $avg: '$cognitiveLoad' },
          byType: {
            $push: '$type'
          },
          tags: {
            $push: '$tags'
          }
        }
      }
    ]);
    
    const result = stats[0] || {
      totalCaptures: 0,
      avgCognitiveLoad: 0,
      byType: [],
      tags: []
    };
    
    // Count by type
    const typeCount = result.byType.reduce((acc, type) => {
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, {});
    
    // Flatten and count tags
    const tagCount = result.tags
      .flat()
      .reduce((acc, tag) => {
        acc[tag] = (acc[tag] || 0) + 1;
        return acc;
      }, {});
    
    res.json({
      date: today.toISOString().split('T')[0],
      totalCaptures: result.totalCaptures,
      avgCognitiveLoad: Math.round(result.avgCognitiveLoad || 0),
      byType: typeCount,
      topTags: Object.entries(tagCount)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 5)
        .map(([tag, count]) => ({ tag, count }))
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/personal/review/pending
 * Get captures that need review
 */
router.get('/review/pending', async (req, res, next) => {
  try {
    const pending = await LearningCapture.find({
      userId: 'personal',
      'learningMetrics.nextReviewDate': { $lte: new Date() }
    })
    .sort({ 'learningMetrics.nextReviewDate': 1 })
    .limit(10);
    
    res.json({
      count: pending.length,
      captures: pending
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
EOF

echo "✅ Personal routes created"

# Update app.js to use personal auth
echo "🔄 Updating app.js..."
cat > src/app-personal-update.js << 'EOF'
// Add these lines after other middleware setup
const { authenticatePersonal } = require('./middleware/personalAuth');

// Mount personal routes with simple auth
app.use('/api/personal', authenticatePersonal, require('./api/routes/personal'));

// Keep existing routes for now but protect them
app.use('/api/v1', authenticatePersonal);
EOF

echo ""
echo "📝 Manual steps required:"
echo "1. Add the personal routes to app.js (see src/app-personal-update.js)"
echo "2. Install gray-matter: npm install gray-matter"
echo "3. Test with: curl -X POST http://localhost:3000/api/personal/capture/quick \\"
echo "   -H \"X-API-Key: $PERSONAL_API_KEY\" \\"
echo "   -H \"Content-Type: application/json\" \\"
echo "   -d '{\"content\": \"Test capture\", \"type\": \"insight\", \"tags\": [\"test\"]}'"
echo ""
echo "🔑 Your personal API key: $PERSONAL_API_KEY"
echo ""
echo "✨ Refactor complete! Your personal productivity tool is ready."