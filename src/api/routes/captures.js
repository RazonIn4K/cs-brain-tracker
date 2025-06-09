const express = require('express');
const router = express.Router();
const LearningCapture = require('../../models/LearningCapture');
const mongoose = require('mongoose');
const { heavyLimiter } = require('../../middleware/rateLimiter');

/**
 * Middleware for async route handlers
 */
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

/**
 * Format response helper
 */
const formatResponse = (data, message = 'Success', metadata = {}) => ({
  success: true,
  message,
  data,
  metadata,
  timestamp: new Date().toISOString()
});

/**
 * GET /captures - List all captures with pagination and filtering
 * Query params:
 * - page (default: 1)
 * - limit (default: 20, max: 100)
 * - type (filter by capture type)
 * - tags (comma-separated list)
 * - startDate/endDate (date range)
 * - processed (boolean)
 * - search (text search in content)
 * - sortBy (default: timestamp)
 * - order (asc/desc, default: desc)
 */
router.get('/', asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 20,
    type,
    tags,
    startDate,
    endDate,
    processed,
    search,
    sortBy = 'timestamp',
    order = 'desc',
    userId
  } = req.query;

  // Build query
  const query = {};
  
  if (userId) query.userId = userId;
  if (type) query.type = type;
  if (processed !== undefined) query.processed = processed === 'true';
  
  // Tags filter
  if (tags) {
    const tagArray = tags.split(',').map(t => t.trim());
    query.tags = { $in: tagArray };
  }
  
  // Date range filter
  if (startDate || endDate) {
    query.timestamp = {};
    if (startDate) query.timestamp.$gte = new Date(startDate);
    if (endDate) query.timestamp.$lte = new Date(endDate);
  }
  
  // Text search
  if (search) {
    query.$text = { $search: search };
  }

  // Pagination
  const pageNum = Math.max(1, parseInt(page));
  const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
  const skip = (pageNum - 1) * limitNum;

  // Execute query
  const [captures, total] = await Promise.all([
    LearningCapture.find(query)
      .sort({ [sortBy]: order === 'asc' ? 1 : -1 })
      .skip(skip)
      .limit(limitNum)
      .populate('insights.connections', 'type content timestamp')
      .lean(),
    LearningCapture.countDocuments(query)
  ]);

  res.json(formatResponse(captures, 'Captures retrieved successfully', {
    pagination: {
      page: pageNum,
      limit: limitNum,
      total,
      pages: Math.ceil(total / limitNum),
      hasNext: pageNum < Math.ceil(total / limitNum),
      hasPrev: pageNum > 1
    }
  }));
}));

/**
 * GET /captures/stats - Get analytics and statistics
 * Rate limited due to heavy aggregation queries
 */
router.get('/stats', heavyLimiter, asyncHandler(async (req, res) => {
  const { userId, startDate, endDate } = req.query;
  
  const matchStage = {};
  if (userId) matchStage.userId = mongoose.Types.ObjectId(userId);
  
  if (startDate || endDate) {
    matchStage.timestamp = {};
    if (startDate) matchStage.timestamp.$gte = new Date(startDate);
    if (endDate) matchStage.timestamp.$lte = new Date(endDate);
  }

  const stats = await LearningCapture.aggregate([
    { $match: matchStage },
    {
      $facet: {
        overview: [
          {
            $group: {
              _id: null,
              totalCaptures: { $sum: 1 },
              avgCognitiveLoad: { $avg: '$cognitiveLoad' },
              totalTimeSpent: { $sum: '$learningMetrics.timeSpent' },
              avgRetentionScore: { $avg: '$learningMetrics.retentionScore' },
              processedCount: {
                $sum: { $cond: ['$processed', 1, 0] }
              }
            }
          }
        ],
        byType: [
          {
            $group: {
              _id: '$type',
              count: { $sum: 1 },
              avgCognitiveLoad: { $avg: '$cognitiveLoad' }
            }
          }
        ],
        byDifficulty: [
          {
            $group: {
              _id: '$insights.difficulty',
              count: { $sum: 1 },
              avgRetentionScore: { $avg: '$learningMetrics.retentionScore' }
            }
          }
        ],
        topTags: [
          { $unwind: '$tags' },
          {
            $group: {
              _id: '$tags',
              count: { $sum: 1 }
            }
          },
          { $sort: { count: -1 } },
          { $limit: 10 }
        ],
        learningVelocity: [
          {
            $group: {
              _id: {
                $dateToString: {
                  format: '%Y-%m-%d',
                  date: '$timestamp'
                }
              },
              dailyCaptures: { $sum: 1 },
              dailyCognitiveLoad: { $avg: '$cognitiveLoad' }
            }
          },
          { $sort: { _id: 1 } },
          { $limit: 30 }
        ],
        upcomingReviews: [
          {
            $match: {
              'learningMetrics.nextReviewDate': {
                $gte: new Date(),
                $lte: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
              }
            }
          },
          {
            $group: {
              _id: {
                $dateToString: {
                  format: '%Y-%m-%d',
                  date: '$learningMetrics.nextReviewDate'
                }
              },
              count: { $sum: 1 }
            }
          },
          { $sort: { _id: 1 } }
        ]
      }
    }
  ]);

  const result = stats[0];
  
  res.json(formatResponse({
    overview: result.overview[0] || {
      totalCaptures: 0,
      avgCognitiveLoad: 0,
      totalTimeSpent: 0,
      avgRetentionScore: 0,
      processedCount: 0
    },
    byType: result.byType,
    byDifficulty: result.byDifficulty,
    topTags: result.topTags,
    learningVelocity: result.learningVelocity,
    upcomingReviews: result.upcomingReviews
  }, 'Analytics retrieved successfully'));
}));

/**
 * GET /captures/search - Advanced search with aggregation
 */
router.get('/search', asyncHandler(async (req, res) => {
  const {
    q,
    concepts,
    minCognitiveLoad,
    maxCognitiveLoad,
    masteryLevel
  } = req.query;

  const pipeline = [];

  // Text search
  if (q) {
    pipeline.push({
      $match: { $text: { $search: q } }
    });
  }

  // Concept search
  if (concepts) {
    const conceptArray = concepts.split(',').map(c => c.trim());
    pipeline.push({
      $match: {
        'insights.keyConcepts.concept': { $in: conceptArray }
      }
    });
  }

  // Cognitive load range
  if (minCognitiveLoad || maxCognitiveLoad) {
    const loadMatch = {};
    if (minCognitiveLoad) loadMatch.$gte = parseInt(minCognitiveLoad);
    if (maxCognitiveLoad) loadMatch.$lte = parseInt(maxCognitiveLoad);
    pipeline.push({ $match: { cognitiveLoad: loadMatch } });
  }

  // Mastery level filter
  if (masteryLevel) {
    pipeline.push({
      $match: {
        'learningMetrics.masteryLevel': { $gte: parseInt(masteryLevel) }
      }
    });
  }

  pipeline.push({ $limit: 50 });

  const results = await LearningCapture.aggregate(pipeline);
  
  res.json(formatResponse(results, 'Search completed'));
}));

/**
 * GET /captures/:id - Get single capture by ID
 */
router.get('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid capture ID format'
    });
  }

  const capture = await LearningCapture.findById(id)
    .populate('insights.connections', 'type content timestamp')
    .populate('userId', 'name email');

  if (!capture) {
    return res.status(404).json({
      success: false,
      message: 'Capture not found'
    });
  }

  // Increment view count
  capture.analytics.viewCount += 1;
  await capture.save();

  res.json(formatResponse(capture, 'Capture retrieved successfully'));
}));

/**
 * POST /captures - Create new capture
 */
router.post('/', asyncHandler(async (req, res) => {
  const {
    type,
    content,
    tags,
    cognitiveLoad,
    insights,
    obsidianIntegration,
    context,
    metadata
  } = req.body;

  // Validation
  if (!type || !content || cognitiveLoad === undefined) {
    return res.status(400).json({
      success: false,
      message: 'Missing required fields: type, content, and cognitiveLoad are required'
    });
  }

  // Create capture
  const capture = new LearningCapture({
    type,
    content,
    tags: tags || [],
    cognitiveLoad,
    insights: insights || {},
    obsidianIntegration: obsidianIntegration || {},
    context: context || {},
    metadata: metadata || {},
    userId: req.body.userId // In production, get from auth middleware
  });

  await capture.save();

  res.status(201).json(formatResponse(capture, 'Capture created successfully'));
}));

/**
 * PUT /captures/:id - Update existing capture
 */
router.put('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid capture ID format'
    });
  }

  // Fields that can be updated
  const updateableFields = [
    'content', 'tags', 'cognitiveLoad', 'processed',
    'insights', 'obsidianIntegration', 'learningMetrics',
    'context', 'metadata'
  ];

  const updates = {};
  updateableFields.forEach(field => {
    if (req.body[field] !== undefined) {
      updates[field] = req.body[field];
    }
  });

  const capture = await LearningCapture.findByIdAndUpdate(
    id,
    updates,
    { new: true, runValidators: true }
  );

  if (!capture) {
    return res.status(404).json({
      success: false,
      message: 'Capture not found'
    });
  }

  res.json(formatResponse(capture, 'Capture updated successfully'));
}));

/**
 * DELETE /captures/:id - Soft delete capture
 */
router.delete('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid capture ID format'
    });
  }

  // Soft delete by adding deletedAt timestamp
  const capture = await LearningCapture.findByIdAndUpdate(
    id,
    { 
      deletedAt: new Date(),
      processed: true 
    },
    { new: true }
  );

  if (!capture) {
    return res.status(404).json({
      success: false,
      message: 'Capture not found'
    });
  }

  res.json(formatResponse(null, 'Capture deleted successfully'));
}));

/**
 * POST /captures/bulk - Bulk import captures
 * Rate limited due to potential for large data processing
 */
router.post('/bulk', heavyLimiter, asyncHandler(async (req, res) => {
  const { captures } = req.body;

  if (!Array.isArray(captures) || captures.length === 0) {
    return res.status(400).json({
      success: false,
      message: 'Invalid input: captures must be a non-empty array'
    });
  }

  // Validate each capture
  const validCaptures = [];
  const errors = [];

  captures.forEach((capture, index) => {
    if (!capture.type || !capture.content || capture.cognitiveLoad === undefined) {
      errors.push({
        index,
        message: 'Missing required fields: type, content, cognitiveLoad'
      });
    } else {
      validCaptures.push(capture);
    }
  });

  if (validCaptures.length === 0) {
    return res.status(400).json({
      success: false,
      message: 'No valid captures to import',
      errors
    });
  }

  // Bulk insert
  const inserted = await LearningCapture.insertMany(validCaptures, {
    ordered: false
  });

  res.status(201).json(formatResponse({
    inserted: inserted.length,
    errors: errors.length,
    errorDetails: errors
  }, `Bulk import completed: ${inserted.length} captures created`));
}));

/**
 * POST /captures/:id/review - Record a review session
 */
router.post('/:id/review', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { retentionScore } = req.body;

  if (!retentionScore || retentionScore < 0 || retentionScore > 100) {
    return res.status(400).json({
      success: false,
      message: 'Invalid retention score: must be between 0 and 100'
    });
  }

  const capture = await LearningCapture.findById(id);
  
  if (!capture) {
    return res.status(404).json({
      success: false,
      message: 'Capture not found'
    });
  }

  // Use the model's review recording method
  capture.recordReview(retentionScore);
  await capture.save();

  res.json(formatResponse(capture, 'Review recorded successfully'));
}));

/**
 * GET /captures/:id/related - Get related captures
 */
router.get('/:id/related', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { limit = 10 } = req.query;

  const related = await LearningCapture.findRelated(id, parseInt(limit));
  
  res.json(formatResponse(related, 'Related captures retrieved'));
}));

/**
 * Error handling middleware
 */
router.use((err, req, res, next) => {
  console.error('Route error:', err);
  
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

module.exports = router;

