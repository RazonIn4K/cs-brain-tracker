#!/usr/bin/env node

/**
 * Database Seed Script
 * Populates the database with test data for development
 * 
 * Usage: npm run seed
 */

require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { faker } = require('@faker-js/faker');

// Models
const User = require('../src/models/User');
const LearningCapture = require('../src/models/LearningCapture');
const RefreshToken = require('../src/models/refreshToken');

// Configuration
const USERS_TO_CREATE = 5;
const CAPTURES_PER_USER = 50;
const DAYS_OF_DATA = 30;

// Capture types and their weights
const CAPTURE_TYPES = [
  { type: 'code', weight: 30 },
  { type: 'insight', weight: 25 },
  { type: 'error', weight: 15 },
  { type: 'debug', weight: 10 },
  { type: 'screenshot', weight: 10 },
  { type: 'voice', weight: 10 }
];

// Sample tags
const TAGS = [
  'javascript', 'typescript', 'react', 'nodejs', 'mongodb',
  'express', 'algorithm', 'data-structure', 'design-pattern',
  'performance', 'security', 'testing', 'debugging', 'api',
  'frontend', 'backend', 'fullstack', 'devops', 'cloud',
  'ai', 'machine-learning', 'web3', 'blockchain'
];

// Sample concepts
const CONCEPTS = [
  'async/await', 'promises', 'closures', 'event-loop', 'hoisting',
  'prototypes', 'this-binding', 'arrow-functions', 'destructuring',
  'spread-operator', 'rest-parameters', 'modules', 'webpack',
  'babel', 'eslint', 'prettier', 'jest', 'react-hooks',
  'context-api', 'redux', 'middleware', 'authentication',
  'authorization', 'jwt', 'oauth', 'encryption', 'hashing'
];

// Sample code snippets
const CODE_SNIPPETS = [
  `const fetchData = async () => {
  try {
    const response = await fetch('/api/data');
    return await response.json();
  } catch (error) {
    console.error('Error fetching data:', error);
  }
};`,
  `function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}`,
  `const memoize = (fn) => {
  const cache = new Map();
  return (...args) => {
    const key = JSON.stringify(args);
    if (cache.has(key)) return cache.get(key);
    const result = fn(...args);
    cache.set(key, result);
    return result;
  };
};`
];

// Generate weighted random type
function getRandomType() {
  const totalWeight = CAPTURE_TYPES.reduce((sum, t) => sum + t.weight, 0);
  let random = Math.random() * totalWeight;
  
  for (const typeConfig of CAPTURE_TYPES) {
    random -= typeConfig.weight;
    if (random <= 0) return typeConfig.type;
  }
  
  return CAPTURE_TYPES[0].type;
}

// Generate random tags
function getRandomTags(min = 1, max = 5) {
  const count = faker.number.int({ min, max });
  const selectedTags = faker.helpers.arrayElements(TAGS, count);
  return [...new Set(selectedTags)];
}

// Generate random concepts
function getRandomConcepts(min = 1, max = 3) {
  const count = faker.number.int({ min, max });
  return faker.helpers.arrayElements(CONCEPTS, count).map(concept => ({
    concept,
    relevance: faker.number.float({ min: 0.5, max: 1, precision: 0.1 }),
    category: faker.helpers.arrayElement(['fundamental', 'advanced', 'practical'])
  }));
}

// Generate capture content based on type
function generateContent(type) {
  switch (type) {
    case 'code':
      return faker.helpers.arrayElement(CODE_SNIPPETS);
    case 'insight':
      return faker.lorem.paragraph(faker.number.int({ min: 2, max: 4 }));
    case 'error':
      return `Error: ${faker.hacker.phrase()}\nStack trace:\n  at ${faker.system.filePath()}\n  at line ${faker.number.int({ min: 1, max: 200 })}`;
    case 'debug':
      return `Debug: ${faker.hacker.phrase()}\nVariables: ${JSON.stringify(faker.helpers.arrayElement([
        { userId: faker.string.uuid(), status: 'active' },
        { count: faker.number.int(100), items: [] },
        { error: null, data: { result: 'success' } }
      ]), null, 2)}`;
    case 'screenshot':
      return `Screenshot: ${faker.lorem.sentence()}\nURL: ${faker.internet.url()}`;
    case 'voice':
      return `Voice transcript: ${faker.lorem.paragraph(2)}`;
    default:
      return faker.lorem.paragraph();
  }
}

// Generate learning captures for a user
async function generateCaptures(userId, startDate = new Date()) {
  const captures = [];
  const captureIds = [];
  
  for (let i = 0; i < CAPTURES_PER_USER; i++) {
    const daysAgo = faker.number.int({ min: 0, max: DAYS_OF_DATA });
    const hoursAgo = faker.number.int({ min: 0, max: 23 });
    const minutesAgo = faker.number.int({ min: 0, max: 59 });
    
    const timestamp = new Date(startDate);
    timestamp.setDate(timestamp.getDate() - daysAgo);
    timestamp.setHours(timestamp.getHours() - hoursAgo);
    timestamp.setMinutes(timestamp.getMinutes() - minutesAgo);
    
    const type = getRandomType();
    const cognitiveLoad = faker.number.int({ min: 10, max: 90 });
    
    const capture = {
      userId,
      type,
      content: generateContent(type),
      timestamp,
      tags: getRandomTags(),
      cognitiveLoad,
      processed: faker.datatype.boolean(0.7),
      insights: {
        keyConcepts: getRandomConcepts(),
        difficulty: faker.helpers.arrayElement(['easy', 'medium', 'hard']),
        summary: faker.lorem.sentence(),
        actionItems: faker.datatype.boolean(0.3) ? [faker.lorem.sentence()] : []
      },
      obsidianIntegration: faker.datatype.boolean(0.5) ? {
        noteId: faker.string.uuid(),
        notePath: `/${faker.helpers.arrayElement(['Learning', 'Projects', 'Archive'])}/${faker.word.noun()}.md`,
        vaultName: 'CS-Brain',
        lastSyncedAt: timestamp
      } : {},
      learningMetrics: {
        retentionScore: faker.number.int({ min: 40, max: 95 }),
        reviewCount: faker.number.int({ min: 0, max: 5 }),
        masteryLevel: faker.number.float({ min: 0, max: 5, precision: 0.5 }),
        timeSpent: faker.number.int({ min: 30, max: 3600 })
      },
      context: {
        project: faker.helpers.arrayElement(['cs-brain-tracker', 'personal-website', 'mobile-app', 'api-service', null]),
        topic: faker.helpers.arrayElement(['web-development', 'algorithms', 'system-design', 'databases', 'security']),
        environment: faker.helpers.arrayElement(['vscode', 'browser', 'terminal', 'obsidian'])
      },
      analytics: {
        viewCount: faker.number.int({ min: 0, max: 20 }),
        helpfulCount: faker.number.int({ min: 0, max: 10 })
      }
    };
    
    captures.push(capture);
  }
  
  // Save captures and get their IDs
  const savedCaptures = await LearningCapture.insertMany(captures);
  const captureIds = savedCaptures.map(c => c._id);
  
  // Create connections between some captures
  for (let i = 0; i < Math.floor(CAPTURES_PER_USER * 0.2); i++) {
    const capture1 = faker.helpers.arrayElement(savedCaptures);
    const capture2 = faker.helpers.arrayElement(savedCaptures);
    
    if (capture1._id !== capture2._id) {
      capture1.insights.connections.push(capture2._id);
      await capture1.save();
    }
  }
  
  return savedCaptures;
}

// Main seed function
async function seed() {
  try {
    console.log('🌱 Starting database seed...\n');
    
    // Connect to database
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:58745/cs_brain_tracker');
    console.log('✅ Connected to MongoDB');
    
    // Clear existing data
    console.log('\n🗑️  Clearing existing data...');
    await Promise.all([
      User.deleteMany({}),
      LearningCapture.deleteMany({}),
      RefreshToken.deleteMany({})
    ]);
    console.log('✅ Database cleared');
    
    // Create users
    console.log('\n👥 Creating users...');
    const users = [];
    
    // Create a demo user with known credentials
    const demoPassword = await bcrypt.hash('Demo123!', 10);
    const demoUser = await User.create({
      email: 'demo@example.com',
      passwordHash: demoPassword,
      name: 'Demo User',
      profile: {
        bio: 'Demo account for testing CS Brain Tracker',
        timezone: 'America/New_York',
        learningGoals: [
          { goal: 'Master React Hooks', targetDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) },
          { goal: 'Complete System Design Course', targetDate: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000) }
        ]
      },
      preferences: {
        theme: 'dark',
        emailNotifications: true,
        reviewReminders: true,
        dailyReviewTime: '09:00'
      },
      subscription: { plan: 'pro', captureLimit: 1000 },
      stats: {
        totalCaptures: CAPTURES_PER_USER,
        totalReviews: faker.number.int({ min: 20, max: 100 }),
        streak: {
          current: faker.number.int({ min: 0, max: 30 }),
          longest: faker.number.int({ min: 5, max: 45 })
        }
      }
    });
    users.push(demoUser);
    console.log(`✅ Created demo user: demo@example.com / Demo123!`);
    
    // Create random users
    for (let i = 0; i < USERS_TO_CREATE - 1; i++) {
      const password = await bcrypt.hash('Password123!', 10);
      const user = await User.create({
        email: faker.internet.email().toLowerCase(),
        passwordHash: password,
        name: faker.person.fullName(),
        profile: {
          bio: faker.person.bio(),
          timezone: faker.location.timeZone(),
          learningGoals: faker.helpers.multiple(() => ({
            goal: faker.company.catchPhrase(),
            targetDate: faker.date.future(),
            completed: faker.datatype.boolean(0.3)
          }), { count: faker.number.int({ min: 0, max: 3 }) })
        },
        preferences: {
          theme: faker.helpers.arrayElement(['light', 'dark', 'auto']),
          emailNotifications: faker.datatype.boolean(0.8),
          reviewReminders: faker.datatype.boolean(0.7),
          language: faker.helpers.arrayElement(['en', 'es', 'fr', 'de'])
        },
        subscription: {
          plan: faker.helpers.arrayElement(['free', 'free', 'pro', 'team']),
          captureLimit: faker.helpers.arrayElement([100, 100, 1000, 5000])
        },
        stats: {
          totalCaptures: CAPTURES_PER_USER,
          totalReviews: faker.number.int({ min: 0, max: 200 }),
          streak: {
            current: faker.number.int({ min: 0, max: 30 }),
            longest: faker.number.int({ min: 0, max: 100 })
          }
        }
      });
      users.push(user);
      console.log(`✅ Created user: ${user.email}`);
    }
    
    // Generate captures for each user
    console.log('\n📚 Generating learning captures...');
    for (const user of users) {
      const captures = await generateCaptures(user._id);
      console.log(`✅ Created ${captures.length} captures for ${user.email}`);
      
      // Update user's capture count
      user.stats.totalCaptures = captures.length;
      await user.save();
    }
    
    // Summary
    console.log('\n📊 Seed Summary:');
    console.log(`- Users created: ${users.length}`);
    console.log(`- Total captures: ${users.length * CAPTURES_PER_USER}`);
    console.log(`- Date range: Last ${DAYS_OF_DATA} days`);
    console.log('\n✨ Database seeded successfully!');
    console.log('\n🔑 Demo credentials:');
    console.log('   Email: demo@example.com');
    console.log('   Password: Demo123!');
    
  } catch (error) {
    console.error('❌ Seed error:', error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    process.exit(0);
  }
}

// Run seed if called directly
if (require.main === module) {
  seed();
}

module.exports = seed;