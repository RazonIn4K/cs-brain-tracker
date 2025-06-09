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

/**
 * POST /api/personal/capture/code
 * Capture code insight
 */
router.post('/capture/code', async (req, res, next) => {
  try {
    const personalCapture = require('../../services/personalCapture');
    const capture = await personalCapture.captureCodeInsight(req.body);
    res.json({ success: true, capture: capture._id });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/personal/capture/aha
 * Capture aha moment
 */
router.post('/capture/aha', async (req, res, next) => {
  try {
    const personalCapture = require('../../services/personalCapture');
    const capture = await personalCapture.captureAhaMoment(req.body);
    res.json({ success: true, capture: capture._id });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/personal/capture/debug
 * Capture debugging session
 */
router.post('/capture/debug', async (req, res, next) => {
  try {
    const personalCapture = require('../../services/personalCapture');
    const capture = await personalCapture.captureDebugSession(req.body);
    res.json({ success: true, capture: capture._id });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/personal/capture/reading
 * Capture from article/documentation
 */
router.post('/capture/reading', async (req, res, next) => {
  try {
    const personalCapture = require('../../services/personalCapture');
    const capture = await personalCapture.captureFromReading(req.body);
    res.json({ success: true, capture: capture._id });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/personal/patterns
 * Get your learning patterns
 */
router.get('/patterns', async (req, res, next) => {
  try {
    const personalCapture = require('../../services/personalCapture');
    const days = parseInt(req.query.days) || 30;
    const patterns = await personalCapture.getPersonalPatterns(days);
    res.json(patterns);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/personal/stats/summary
 * Get comprehensive learning stats
 */
router.get('/stats/summary', async (req, res, next) => {
  try {
    const { days = 30 } = req.query;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - parseInt(days));
    
    const captures = await LearningCapture.find({
      userId: 'personal',
      timestamp: { $gte: cutoffDate }
    }).sort({ timestamp: -1 });
    
    const stats = {
      totalCaptures: captures.length,
      timeRange: `Last ${days} days`,
      byType: captures.reduce((acc, c) => {
        acc[c.type] = (acc[c.type] || 0) + 1;
        return acc;
      }, {}),
      avgCognitiveLoad: captures.reduce((sum, c) => sum + c.cognitiveLoad, 0) / captures.length || 0,
      reviewStatus: {
        pending: captures.filter(c => c.learningMetrics?.nextReviewDate && c.learningMetrics.nextReviewDate <= new Date()).length,
        mastered: captures.filter(c => (c.learningMetrics?.masteryLevel || 0) >= 4).length
      },
      mostUsedTags: Object.entries(
        captures.flatMap(c => c.tags).reduce((acc, tag) => {
          acc[tag] = (acc[tag] || 0) + 1;
          return acc;
        }, {})
      ).sort(([,a], [,b]) => b - a).slice(0, 10),
      learningVelocity: {
        thisWeek: captures.filter(c => {
          const weekAgo = new Date();
          weekAgo.setDate(weekAgo.getDate() - 7);
          return c.timestamp >= weekAgo;
        }).length,
        lastWeek: captures.filter(c => {
          const twoWeeksAgo = new Date();
          twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
          const weekAgo = new Date();
          weekAgo.setDate(weekAgo.getDate() - 7);
          return c.timestamp >= twoWeeksAgo && c.timestamp < weekAgo;
        }).length
      }
    };
    
    res.json(stats);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/personal/dashboard/generate
 * Generate personalized dashboard data
 */
router.get('/dashboard/generate', async (req, res, next) => {
  try {
    const recent = await LearningCapture.find({ userId: 'personal' })
      .sort({ timestamp: -1 })
      .limit(100)
      .lean();
    
    const dashboard = {
      generatedAt: new Date().toISOString(),
      quickStats: {
        totalCaptures: recent.length,
        thisWeek: recent.filter(c => {
          const weekAgo = new Date();
          weekAgo.setDate(weekAgo.getDate() - 7);
          return new Date(c.timestamp) >= weekAgo;
        }).length,
        avgCognitiveLoad: recent.reduce((sum, c) => sum + c.cognitiveLoad, 0) / recent.length || 0
      },
      recentActivity: recent.slice(0, 10).map(c => ({
        id: c._id,
        type: c.type,
        content: c.content.substring(0, 100) + '...',
        timestamp: c.timestamp,
        tags: c.tags.slice(0, 3)
      })),
      insights: {
        topDomains: Object.entries(
          recent.reduce((acc, c) => {
            const domain = c.context?.domain || 'general';
            acc[domain] = (acc[domain] || 0) + 1;
            return acc;
          }, {})
        ).sort(([,a], [,b]) => b - a).slice(0, 5),
        learningPatterns: {
          peakHours: recent.reduce((acc, c) => {
            const hour = new Date(c.timestamp).getHours();
            acc[hour] = (acc[hour] || 0) + 1;
            return acc;
          }, {}),
          preferredTypes: Object.entries(
            recent.reduce((acc, c) => {
              acc[c.type] = (acc[c.type] || 0) + 1;
              return acc;
            }, {})
          ).sort(([,a], [,b]) => b - a)
        }
      },
      recommendations: [
        'Review pending items from spaced repetition',
        'Capture more insights in low-activity domains',
        'Connect related concepts through tagging'
      ]
    };
    
    res.json(dashboard);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/personal/graph/generate
 * Generate knowledge graph data
 */
router.get('/graph/generate', async (req, res, next) => {
  try {
    const captures = await LearningCapture.find({ userId: 'personal' })
      .select('_id type content tags insights.connections learningMetrics.masteryLevel')
      .lean();
    
    // Create nodes
    const nodes = captures.map(c => ({
      id: c._id.toString(),
      type: c.type,
      label: c.content.substring(0, 50) + '...',
      tags: c.tags,
      masteryLevel: c.learningMetrics?.masteryLevel || 0,
      size: 10 + (c.learningMetrics?.masteryLevel || 0) * 5
    }));
    
    // Create edges from connections
    const edges = [];
    captures.forEach(capture => {
      if (capture.insights?.connections?.length > 0) {
        capture.insights.connections.forEach(connId => {
          edges.push({
            from: capture._id.toString(),
            to: connId.toString(),
            type: 'connection'
          });
        });
      }
    });
    
    // Create tag-based edges
    const tagGroups = {};
    captures.forEach(capture => {
      capture.tags.forEach(tag => {
        if (!tagGroups[tag]) tagGroups[tag] = [];
        tagGroups[tag].push(capture._id.toString());
      });
    });
    
    Object.values(tagGroups).forEach(group => {
      if (group.length > 1) {
        for (let i = 0; i < group.length - 1; i++) {
          for (let j = i + 1; j < group.length; j++) {
            edges.push({
              from: group[i],
              to: group[j],
              type: 'tag-relation',
              weight: 0.5
            });
          }
        }
      }
    });
    
    const graph = {
      nodes,
      edges,
      stats: {
        totalNodes: nodes.length,
        totalEdges: edges.length,
        density: edges.length / (nodes.length * (nodes.length - 1) / 2),
        tagClusters: Object.keys(tagGroups).length
      }
    };
    
    res.json(graph);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
