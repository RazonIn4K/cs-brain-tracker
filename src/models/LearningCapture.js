const mongoose = require('mongoose');

const learningCaptureSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['voice', 'screenshot', 'code', 'insight', 'error', 'debug'],
    required: true,
    index: true
  },
  
  content: {
    type: String,
    required: true,
    maxlength: 5000,
    trim: true
  },
  
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  },
  
  tags: {
    type: [String],
    default: [],
    index: true,
    validate: {
      validator: function(tags) {
        return tags.length <= 20;
      },
      message: 'Too many tags (maximum 20)'
    }
  },
  
  cognitiveLoad: {
    type: Number,
    min: 0,
    max: 100,
    required: true,
    validate: {
      validator: Number.isInteger,
      message: 'Cognitive load must be an integer'
    }
  },
  
  processed: {
    type: Boolean,
    default: false,
    index: true
  },
  
  insights: {
    keyConcepts: {
      type: [{
        concept: { type: String, required: true },
        relevance: { type: Number, min: 0, max: 1 },
        category: String
      }],
      default: []
    },
    connections: {
      type: [mongoose.Schema.Types.ObjectId],
      ref: 'LearningCapture',
      default: []
    },
    difficulty: {
      type: String,
      enum: ['easy', 'medium', 'hard'],
      default: 'medium'
    },
    summary: {
      type: String,
      maxlength: 500
    },
    actionItems: {
      type: [String],
      default: []
    }
  },
  
  obsidianIntegration: {
    noteId: {
      type: String,
      sparse: true,
      index: true
    },
    notePath: String,
    vaultName: String,
    lastSyncedAt: Date,
    linkedNotes: [{
      noteId: String,
      title: String,
      relationship: String
    }]
  },
  
  learningMetrics: {
    retentionScore: {
      type: Number,
      min: 0,
      max: 100
    },
    reviewCount: {
      type: Number,
      default: 0
    },
    lastReviewedAt: Date,
    nextReviewDate: Date,
    masteryLevel: {
      type: Number,
      min: 0,
      max: 5,
      default: 0
    },
    timeSpent: {
      type: Number,
      default: 0,
      min: 0
    }
  },
  
  context: {
    project: String,
    topic: String,
    subtopic: String,
    learningPath: String,
    sessionId: {
      type: mongoose.Schema.Types.ObjectId,
      index: true
    },
    environment: {
      type: String,
      enum: ['vscode', 'obsidian', 'browser', 'terminal', 'other']
    }
  },
  
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  
  analytics: {
    viewCount: {
      type: Number,
      default: 0
    },
    helpfulCount: {
      type: Number,
      default: 0
    },
    flagged: {
      type: Boolean,
      default: false
    },
    flagReason: String
  },
  
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    index: true
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

learningCaptureSchema.index({ userId: 1, timestamp: -1 });
learningCaptureSchema.index({ tags: 1, type: 1 });
learningCaptureSchema.index({ 'context.project': 1, timestamp: -1 });
learningCaptureSchema.index({ 'learningMetrics.nextReviewDate': 1 });
learningCaptureSchema.index({ processed: 1, timestamp: -1 });
learningCaptureSchema.index({ 'insights.keyConcepts.concept': 'text' });

learningCaptureSchema.virtual('isOverdue').get(function() {
  return this.learningMetrics.nextReviewDate && 
         this.learningMetrics.nextReviewDate < new Date();
});

learningCaptureSchema.virtual('retentionStatus').get(function() {
  const score = this.learningMetrics.retentionScore;
  if (score >= 80) return 'excellent';
  if (score >= 60) return 'good';
  if (score >= 40) return 'fair';
  return 'needs-review';
});

learningCaptureSchema.methods.calculateNextReviewDate = function() {
  const intervals = [1, 3, 7, 14, 30, 90];
  const reviewCount = Math.min(this.learningMetrics.reviewCount, intervals.length - 1);
  const daysUntilReview = intervals[reviewCount];
  
  const nextDate = new Date();
  nextDate.setDate(nextDate.getDate() + daysUntilReview);
  
  this.learningMetrics.nextReviewDate = nextDate;
  return nextDate;
};

learningCaptureSchema.methods.recordReview = function(retentionScore) {
  this.learningMetrics.reviewCount += 1;
  this.learningMetrics.lastReviewedAt = new Date();
  this.learningMetrics.retentionScore = retentionScore;
  
  if (retentionScore >= 80) {
    this.learningMetrics.masteryLevel = Math.min(5, this.learningMetrics.masteryLevel + 0.5);
  } else if (retentionScore < 50) {
    this.learningMetrics.masteryLevel = Math.max(0, this.learningMetrics.masteryLevel - 0.5);
  }
  
  this.calculateNextReviewDate();
};

learningCaptureSchema.methods.addConnection = function(captureId) {
  if (!this.insights.connections.includes(captureId)) {
    this.insights.connections.push(captureId);
  }
};

learningCaptureSchema.statics.findRelated = function(captureId, limit = 10) {
  return this.aggregate([
    { $match: { _id: { $ne: mongoose.Types.ObjectId(captureId) } } },
    {
      $lookup: {
        from: 'learningcaptures',
        localField: '_id',
        foreignField: 'insights.connections',
        as: 'connectedTo'
      }
    },
    {
      $match: {
        $or: [
          { 'insights.connections': mongoose.Types.ObjectId(captureId) },
          { 'connectedTo._id': mongoose.Types.ObjectId(captureId) }
        ]
      }
    },
    { $limit: limit }
  ]);
};

learningCaptureSchema.statics.findByTags = function(tags, options = {}) {
  const query = this.find({ tags: { $in: tags } });
  
  if (options.type) {
    query.where('type', options.type);
  }
  
  if (options.userId) {
    query.where('userId', options.userId);
  }
  
  return query
    .sort({ timestamp: -1 })
    .limit(options.limit || 50);
};

learningCaptureSchema.statics.getAnalytics = function(userId, dateRange = {}) {
  const match = { userId: mongoose.Types.ObjectId(userId) };
  
  if (dateRange.start || dateRange.end) {
    match.timestamp = {};
    if (dateRange.start) match.timestamp.$gte = dateRange.start;
    if (dateRange.end) match.timestamp.$lte = dateRange.end;
  }
  
  return this.aggregate([
    { $match: match },
    {
      $group: {
        _id: {
          type: '$type',
          difficulty: '$insights.difficulty'
        },
        count: { $sum: 1 },
        avgCognitiveLoad: { $avg: '$cognitiveLoad' },
        avgRetentionScore: { $avg: '$learningMetrics.retentionScore' },
        totalTimeSpent: { $sum: '$learningMetrics.timeSpent' }
      }
    },
    {
      $group: {
        _id: null,
        byType: {
          $push: {
            type: '$_id.type',
            difficulty: '$_id.difficulty',
            count: '$count',
            avgCognitiveLoad: '$avgCognitiveLoad',
            avgRetentionScore: '$avgRetentionScore',
            totalTimeSpent: '$totalTimeSpent'
          }
        },
        totalCaptures: { $sum: '$count' },
        overallAvgCognitiveLoad: { $avg: '$avgCognitiveLoad' },
        overallAvgRetention: { $avg: '$avgRetentionScore' }
      }
    }
  ]);
};

learningCaptureSchema.pre('save', function(next) {
  if (this.isNew && !this.learningMetrics.nextReviewDate) {
    this.calculateNextReviewDate();
  }
  next();
});

const LearningCapture = mongoose.model('LearningCapture', learningCaptureSchema);

module.exports = LearningCapture;

