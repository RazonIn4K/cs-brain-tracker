const fs = require('fs').promises;
const path = require('path');
const matter = require('gray-matter');
const LearningCapture = require('../models/LearningCapture');

/**
 * Personal Capture Service
 * Handles your specific learning capture workflow
 */
class PersonalCaptureService {
  constructor() {
    this.vaultPath = process.env.OBSIDIAN_VAULT_PATH;
    this.captureDir = '000-Capture/api';
  }

  /**
   * Quick capture for coding insights
   */
  async captureCodeInsight({ code, insight, error, tags = [], project }) {
    const content = `## Code
\`\`\`javascript
${code}
\`\`\`

## Insight
${insight}

${error ? `## Error\n${error}` : ''}`;

    const capture = await this.createCapture({
      type: 'code',
      content,
      tags: [...tags, 'code-insight', project].filter(Boolean),
      cognitiveLoad: error ? 70 : 50,
      context: { project, environment: 'vscode' }
    });

    return capture;
  }

  /**
   * Capture learning from documentation/articles
   */
  async captureFromReading({ url, title, keyPoints, myNotes, tags = [] }) {
    const content = `# ${title}

Source: ${url}

## Key Points
${keyPoints.map(point => `- ${point}`).join('\n')}

## My Notes
${myNotes}`;

    const capture = await this.createCapture({
      type: 'insight',
      content,
      tags: [...tags, 'reading'],
      metadata: { url, title },
      cognitiveLoad: 40
    });

    return capture;
  }

  /**
   * Capture debugging session
   */
  async captureDebugSession({ problem, steps, solution, timeSpent, tags = [] }) {
    const content = `## Problem
${problem}

## Debugging Steps
${steps.map((step, i) => `${i + 1}. ${step}`).join('\n')}

## Solution
${solution}

⏱️ Time spent: ${timeSpent} minutes`;

    const capture = await this.createCapture({
      type: 'debug',
      content,
      tags: [...tags, 'debugging'],
      cognitiveLoad: Math.min(90, 30 + timeSpent),
      learningMetrics: { timeSpent: timeSpent * 60 }
    });

    return capture;
  }

  /**
   * Capture "aha!" moments
   */
  async captureAhaMoment({ realization, context, relatedConcepts = [], tags = [] }) {
    const content = `💡 **AHA MOMENT**

## Realization
${realization}

## Context
${context}

${relatedConcepts.length > 0 ? `## Related Concepts\n${relatedConcepts.map(c => `- [[${c}]]`).join('\n')}` : ''}`;

    const capture = await this.createCapture({
      type: 'insight',
      content,
      tags: [...tags, 'aha-moment'],
      cognitiveLoad: 20,
      insights: {
        keyConcepts: relatedConcepts.map(c => ({ concept: c, relevance: 0.9 })),
        difficulty: 'easy'
      }
    });

    return capture;
  }

  /**
   * Core capture creation with Obsidian sync
   */
  async createCapture(captureData) {
    // Add personal user ID
    captureData.userId = 'personal';
    
    // Create database entry
    const capture = await LearningCapture.create(captureData);
    
    // Sync to Obsidian if configured
    if (this.vaultPath) {
      await this.syncToObsidian(capture);
    }
    
    // Update your learning metrics
    await this.updatePersonalMetrics(capture);
    
    return capture;
  }

  /**
   * Sync capture to Obsidian vault
   */
  async syncToObsidian(capture) {
    const date = new Date(capture.timestamp);
    const dateStr = date.toISOString().split('T')[0];
    const timeStr = date.toTimeString().split(' ')[0].replace(/:/g, '-');
    
    // Create filename with readable format
    const filename = `${dateStr}_${timeStr}_${capture.type}_${capture._id.toString().slice(-6)}.md`;
    const filepath = path.join(this.vaultPath, this.captureDir, filename);
    
    // Ensure directory exists
    await fs.mkdir(path.dirname(filepath), { recursive: true });
    
    // Create markdown with rich frontmatter
    const frontmatter = {
      id: capture._id.toString(),
      created: capture.timestamp,
      type: capture.type,
      tags: capture.tags,
      cognitiveLoad: capture.cognitiveLoad,
      processed: capture.processed,
      source: 'cs-brain-api',
      ...(capture.context || {}),
      ...(capture.metadata || {})
    };
    
    // Add cross-references
    if (capture.insights?.connections?.length > 0) {
      frontmatter.connections = capture.insights.connections;
    }
    
    const markdown = matter.stringify(capture.content, frontmatter);
    await fs.writeFile(filepath, markdown);
    
    return { filepath, filename };
  }

  /**
   * Update your personal learning metrics
   */
  async updatePersonalMetrics(capture) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Check if this is your first capture today
    const todayCount = await LearningCapture.countDocuments({
      userId: 'personal',
      timestamp: { $gte: today }
    });
    
    if (todayCount === 1) {
      console.log('🔥 First capture of the day! Keep the streak going!');
    }
    
    // Track your most productive hours
    const hour = new Date().getHours();
    if (hour >= 22 || hour <= 2) {
      console.log('🦉 Late night learning session recorded');
    }
    
    return { todayCount, hour };
  }

  /**
   * Get your learning patterns
   */
  async getPersonalPatterns(days = 30) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    
    const patterns = await LearningCapture.aggregate([
      {
        $match: {
          userId: 'personal',
          timestamp: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: {
            hour: { $hour: '$timestamp' },
            dayOfWeek: { $dayOfWeek: '$timestamp' }
          },
          count: { $sum: 1 },
          avgCognitiveLoad: { $avg: '$cognitiveLoad' }
        }
      },
      { $sort: { count: -1 } }
    ]);
    
    return {
      mostProductiveHours: patterns.slice(0, 3).map(p => ({
        hour: p._id.hour,
        captures: p.count,
        avgLoad: Math.round(p.avgCognitiveLoad)
      })),
      patterns
    };
  }
}

module.exports = new PersonalCaptureService();