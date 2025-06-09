const router = require('express').Router();
const fs = require('fs').promises;
const path = require('path');
const archiver = require('archiver');
const matter = require('gray-matter');
const LearningCapture = require('../../models/LearningCapture');
const User = require('../../models/User');

/**
 * GET /api/export/json
 * Export all learning data as JSON
 */
router.get('/json', async (req, res, next) => {
  try {
    const { userId = 'personal', format = 'detailed' } = req.query;
    
    const captures = await LearningCapture.find({ 
      userId: userId === 'personal' ? 'personal' : userId 
    })
    .sort({ timestamp: -1 })
    .lean();
    
    let exportData;
    
    if (format === 'minimal') {
      exportData = {
        metadata: {
          exportedAt: new Date().toISOString(),
          version: '1.0.0',
          totalCaptures: captures.length,
          format: 'minimal'
        },
        captures: captures.map(capture => ({
          id: capture._id,
          type: capture.type,
          content: capture.content,
          tags: capture.tags,
          timestamp: capture.timestamp,
          cognitiveLoad: capture.cognitiveLoad
        }))
      };
    } else {
      exportData = {
        metadata: {
          exportedAt: new Date().toISOString(),
          version: '1.0.0',
          totalCaptures: captures.length,
          format: 'detailed'
        },
        captures
      };
    }
    
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="cs-brain-export-${new Date().toISOString().split('T')[0]}.json"`);
    res.json(exportData);
    
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/export/markdown
 * Export all learning data as a markdown archive
 */
router.get('/markdown', async (req, res, next) => {
  try {
    const { userId = 'personal', includeMetadata = 'true' } = req.query;
    
    const captures = await LearningCapture.find({ 
      userId: userId === 'personal' ? 'personal' : userId 
    })
    .sort({ timestamp: -1 })
    .lean();
    
    // Create ZIP archive
    const archive = archiver('zip', { zlib: { level: 9 } });
    
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="cs-brain-markdown-${new Date().toISOString().split('T')[0]}.zip"`);
    
    archive.pipe(res);
    
    // Add README
    const readme = `# CS Brain Tracker Export\n\nExported on: ${new Date().toISOString()}\nTotal Captures: ${captures.length}\n\n## Structure\n\n- \`by-type/\` - Captures organized by type\n- \`by-date/\` - Captures organized by date\n- \`tags/\` - Tag-based organization\n- \`metadata.json\` - Export metadata\n\n## Import\n\nTo import this data back:\n\n\`\`\`bash\ncurl -X POST http://localhost:3000/api/import/zip \\\n  -F "file=@cs-brain-markdown-$(date +%Y-%m-%d).zip" \\\n  -H "X-API-Key: $KEY"\n\`\`\`\n`;
    
    archive.append(readme, { name: 'README.md' });
    
    // Add metadata
    const metadata = {
      exportedAt: new Date().toISOString(),
      version: '1.0.0',
      totalCaptures: captures.length,
      format: 'markdown-archive',
      structure: {
        'by-type': 'Captures organized by type',
        'by-date': 'Captures organized by date (YYYY/MM)',
        'tags': 'Tag-based organization'
      }
    };
    
    archive.append(JSON.stringify(metadata, null, 2), { name: 'metadata.json' });
    
    // Organize captures by type
    const byType = captures.reduce((acc, capture) => {
      if (!acc[capture.type]) acc[capture.type] = [];
      acc[capture.type].push(capture);
      return acc;
    }, {});
    
    for (const [type, typeCaptures] of Object.entries(byType)) {
      for (const capture of typeCaptures) {
        const frontmatter = includeMetadata === 'true' ? {
          id: capture._id,
          type: capture.type,
          tags: capture.tags,
          cognitiveLoad: capture.cognitiveLoad,
          timestamp: capture.timestamp,
          processed: capture.processed,
          ...(capture.learningMetrics && {
            masteryLevel: capture.learningMetrics.masteryLevel,
            retentionScore: capture.learningMetrics.retentionScore
          })
        } : {
          id: capture._id,
          type: capture.type,
          tags: capture.tags,
          timestamp: capture.timestamp
        };
        
        const markdown = matter.stringify(capture.content, frontmatter);
        const filename = `${capture.timestamp.toISOString().split('T')[0]}-${capture._id}.md`;
        archive.append(markdown, { name: `by-type/${type}/${filename}` });
      }
    }
    
    // Organize captures by date
    const byDate = captures.reduce((acc, capture) => {
      const date = new Date(capture.timestamp);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const key = `${year}/${month}`;
      
      if (!acc[key]) acc[key] = [];
      acc[key].push(capture);
      return acc;
    }, {});
    
    for (const [datePath, dateCaptures] of Object.entries(byDate)) {
      for (const capture of dateCaptures) {
        const frontmatter = {
          id: capture._id,
          type: capture.type,
          tags: capture.tags,
          timestamp: capture.timestamp
        };
        
        const markdown = matter.stringify(capture.content, frontmatter);
        const filename = `${capture.timestamp.toISOString().split('T')[0]}-${capture.type}-${capture._id.toString().slice(-6)}.md`;
        archive.append(markdown, { name: `by-date/${datePath}/${filename}` });
      }
    }
    
    // Organize by tags
    const allTags = [...new Set(captures.flatMap(c => c.tags))];
    for (const tag of allTags) {
      const tagCaptures = captures.filter(c => c.tags.includes(tag));
      const tagIndex = `# ${tag}\n\n${tagCaptures.map(c => 
        `- [${c.type}] ${c.content.substring(0, 100)}... (${c.timestamp.toISOString().split('T')[0]})`
      ).join('\n')}`;
      
      archive.append(tagIndex, { name: `tags/${tag}.md` });
    }
    
    await archive.finalize();
    
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/export/obsidian
 * Export for Obsidian vault import
 */
router.get('/obsidian', async (req, res, next) => {
  try {
    const { userId = 'personal', vaultStructure = 'date' } = req.query;
    
    const captures = await LearningCapture.find({ 
      userId: userId === 'personal' ? 'personal' : userId 
    })
    .sort({ timestamp: -1 })
    .lean();
    
    const archive = archiver('zip', { zlib: { level: 9 } });
    
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="cs-brain-obsidian-${new Date().toISOString().split('T')[0]}.zip"`);
    
    archive.pipe(res);
    
    // Create Obsidian-compatible structure
    for (const capture of captures) {
      const frontmatter = {
        id: capture._id,
        type: capture.type,
        tags: capture.tags.map(tag => `#${tag}`),
        created: capture.timestamp,
        cognitiveLoad: capture.cognitiveLoad,
        aliases: [capture._id.toString()]
      };
      
      // Add connections as links
      let content = capture.content;
      if (capture.insights?.connections?.length > 0) {
        content += '\n\n## Related Notes\n\n';
        content += capture.insights.connections.map(id => `[[${id}]]`).join(' ');
      }
      
      const markdown = matter.stringify(content, frontmatter);
      
      let filepath;
      if (vaultStructure === 'type') {
        filepath = `${capture.type}/${capture.timestamp.toISOString().split('T')[0]}-${capture._id}.md`;
      } else {
        const date = new Date(capture.timestamp);
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        filepath = `${year}/${month}/${capture.timestamp.toISOString().split('T')[0]}-${capture.type}-${capture._id}.md`;
      }
      
      archive.append(markdown, { name: filepath });
    }
    
    // Create MOCs (Maps of Content)
    const tagMOC = `# Tags MOC\n\n${[...new Set(captures.flatMap(c => c.tags))].
      map(tag => `- [[${tag}]]`).join('\n')}`;
    archive.append(tagMOC, { name: 'MOCs/Tags.md' });
    
    const typeMOC = `# Types MOC\n\n${[...new Set(captures.map(c => c.type))].
      map(type => `- [[${type}]]`).join('\n')}`;
    archive.append(typeMOC, { name: 'MOCs/Types.md' });
    
    await archive.finalize();
    
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/import/json
 * Import learning data from JSON
 */
router.post('/json', async (req, res, next) => {
  try {
    const { data, merge = false, userId = 'personal' } = req.body;
    
    if (!data || !data.captures) {
      return res.status(400).json({ 
        error: { message: 'Invalid import data format' } 
      });
    }
    
    let importedCount = 0;
    let skippedCount = 0;
    const errors = [];
    
    if (!merge) {
      // Clear existing data for this user
      await LearningCapture.deleteMany({ 
        userId: userId === 'personal' ? 'personal' : userId 
      });
    }
    
    for (const captureData of data.captures) {
      try {
        // Check if capture already exists (by content and timestamp)
        if (merge) {
          const existing = await LearningCapture.findOne({
            userId: userId === 'personal' ? 'personal' : userId,
            content: captureData.content,
            timestamp: new Date(captureData.timestamp)
          });
          
          if (existing) {
            skippedCount++;
            continue;
          }
        }
        
        // Clean the data - remove _id if present
        const cleanData = { ...captureData };
        delete cleanData._id;
        cleanData.userId = userId === 'personal' ? 'personal' : userId;
        
        await LearningCapture.create(cleanData);
        importedCount++;
        
      } catch (error) {
        errors.push({
          capture: captureData.content?.substring(0, 50) + '...',
          error: error.message
        });
      }
    }
    
    res.json({
      success: true,
      imported: importedCount,
      skipped: skippedCount,
      errors: errors.length,
      errorDetails: errors.slice(0, 10) // Limit error details
    });
    
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/export/backup
 * Create complete system backup
 */
router.get('/backup', async (req, res, next) => {
  try {
    const { userId = 'personal' } = req.query;
    
    // Get all data
    const captures = await LearningCapture.find({ 
      userId: userId === 'personal' ? 'personal' : userId 
    }).lean();
    
    const user = userId !== 'personal' ? await User.findById(userId).lean() : null;
    
    const backup = {
      metadata: {
        createdAt: new Date().toISOString(),
        version: '1.0.0',
        type: 'complete-backup',
        userId: userId,
        totalCaptures: captures.length
      },
      data: {
        captures,
        user
      },
      schema: {
        captures: 'LearningCapture model v1.0',
        user: 'User model v1.0'
      }
    };
    
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 
      `attachment; filename="cs-brain-backup-${userId}-${new Date().toISOString().split('T')[0]}.json"`);
    res.json(backup);
    
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/import/backup
 * Restore from complete system backup
 */
router.post('/backup', async (req, res, next) => {
  try {
    const { backup, force = false } = req.body;
    
    if (!backup || !backup.data) {
      return res.status(400).json({ 
        error: { message: 'Invalid backup format' } 
      });
    }
    
    const { captures, user } = backup.data;
    const targetUserId = backup.metadata.userId;
    
    // Safety check
    if (!force) {
      const existingCaptures = await LearningCapture.countDocuments({ 
        userId: targetUserId 
      });
      
      if (existingCaptures > 0) {
        return res.status(409).json({
          error: { 
            message: 'User already has data. Use force=true to overwrite.',
            existingCaptures
          }
        });
      }
    }
    
    // Clear existing data
    if (force) {
      await LearningCapture.deleteMany({ userId: targetUserId });
      if (user && targetUserId !== 'personal') {
        await User.findByIdAndDelete(targetUserId);
      }
    }
    
    // Restore user
    if (user && targetUserId !== 'personal') {
      await User.create(user);
    }
    
    // Restore captures
    let restored = 0;
    for (const capture of captures) {
      try {
        await LearningCapture.create(capture);
        restored++;
      } catch (error) {
        console.error('Failed to restore capture:', error.message);
      }
    }
    
    res.json({
      success: true,
      restored: {
        captures: restored,
        user: user ? 1 : 0
      },
      metadata: backup.metadata
    });
    
  } catch (err) {
    next(err);
  }
});

module.exports = router;

