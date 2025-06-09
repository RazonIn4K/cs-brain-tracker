#!/usr/bin/env node

/**
 * Verify seed data
 */

require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../src/models/User');
const LearningCapture = require('../src/models/LearningCapture');

async function verify() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:58745/cs_brain_tracker');
    
    const userCount = await User.countDocuments();
    const captureCount = await LearningCapture.countDocuments();
    
    console.log('\n📊 Database Statistics:');
    console.log(`- Total users: ${userCount}`);
    console.log(`- Total captures: ${captureCount}`);
    
    if (userCount > 0) {
      const demoUser = await User.findOne({ email: 'demo@example.com' });
      if (demoUser) {
        console.log('\n✅ Demo user found:');
        console.log(`- Email: ${demoUser.email}`);
        console.log(`- Name: ${demoUser.name}`);
        console.log(`- Plan: ${demoUser.subscription.plan}`);
        console.log(`- Captures: ${demoUser.stats.totalCaptures}`);
      }
      
      // Sample captures
      const sampleCaptures = await LearningCapture.find().limit(3);
      console.log('\n📝 Sample captures:');
      sampleCaptures.forEach((cap, i) => {
        console.log(`\n${i + 1}. Type: ${cap.type}`);
        console.log(`   Tags: ${cap.tags.join(', ')}`);
        console.log(`   Cognitive Load: ${cap.cognitiveLoad}`);
        console.log(`   Content: ${cap.content.substring(0, 50)}...`);
      });
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.connection.close();
  }
}

verify();