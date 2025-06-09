#!/usr/bin/env node

/**
 * CS Brain CLI - Quick capture from terminal
 * 
 * Usage:
 *   capture "Your insight here"
 *   capture -t code "const x = await fetch()" 
 *   capture -t aha "Finally understood closures!"
 *   capture --debug "Fixed memory leak" --time 45
 */

const axios = require('axios');
const chalk = require('chalk');
const { program } = require('commander');

// Load config
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

const API_KEY = process.env.PERSONAL_API_KEY;
const API_URL = process.env.API_URL || 'http://localhost:3000/api/personal';

if (!API_KEY) {
  console.error(chalk.red('❌ No API key found. Run the setup first.'));
  process.exit(1);
}

// Configure axios
const api = axios.create({
  baseURL: API_URL,
  headers: {
    'X-API-Key': API_KEY,
    'Content-Type': 'application/json'
  }
});

// Quick capture command
async function quickCapture(content, options) {
  try {
    const type = options.type || 'insight';
    const tags = options.tags ? options.tags.split(',') : [];
    
    console.log(chalk.blue(`📝 Capturing ${type}...`));
    
    const response = await api.post('/capture/quick', {
      content,
      type,
      tags,
      cognitiveLoad: options.load || 50
    });
    
    console.log(chalk.green('✅ Captured successfully!'));
    console.log(chalk.gray(`ID: ${response.data.capture}`));
    
    if (response.data.obsidianFile) {
      console.log(chalk.gray(`Obsidian: ${response.data.obsidianFile}`));
    }
  } catch (error) {
    console.error(chalk.red('❌ Capture failed:'), error.response?.data || error.message);
  }
}

// Code insight capture
async function captureCode(options) {
  try {
    const code = options.code || '';
    const insight = options.insight || options.args.join(' ');
    const tags = options.tags ? options.tags.split(',') : [];
    
    console.log(chalk.blue('💻 Capturing code insight...'));
    
    const response = await api.post('/capture/code', {
      code,
      insight,
      tags,
      project: options.project
    });
    
    console.log(chalk.green('✅ Code insight captured!'));
    console.log(chalk.gray(`ID: ${response.data.capture}`));
  } catch (error) {
    console.error(chalk.red('❌ Capture failed:'), error.response?.data || error.message);
  }
}

// Debug session capture
async function captureDebug(problem, options) {
  try {
    const steps = options.steps ? options.steps.split('|') : [];
    const solution = options.solution || 'See details in capture';
    const timeSpent = parseInt(options.time) || 30;
    const tags = options.tags ? options.tags.split(',') : [];
    
    console.log(chalk.blue('🐛 Capturing debug session...'));
    
    const response = await api.post('/capture/debug', {
      problem,
      steps,
      solution,
      timeSpent,
      tags
    });
    
    console.log(chalk.green('✅ Debug session captured!'));
    console.log(chalk.gray(`ID: ${response.data.capture}`));
    console.log(chalk.yellow(`Cognitive load: ${Math.min(90, 30 + timeSpent)}`));
  } catch (error) {
    console.error(chalk.red('❌ Capture failed:'), error.response?.data || error.message);
  }
}

// Aha moment capture
async function captureAha(realization, options) {
  try {
    const context = options.context || '';
    const related = options.related ? options.related.split(',') : [];
    const tags = options.tags ? options.tags.split(',') : ['aha-moment'];
    
    console.log(chalk.blue('💡 Capturing aha moment...'));
    
    const response = await api.post('/capture/aha', {
      realization,
      context,
      relatedConcepts: related,
      tags
    });
    
    console.log(chalk.green('✅ Aha moment captured!'));
    console.log(chalk.gray(`ID: ${response.data.capture}`));
  } catch (error) {
    console.error(chalk.red('❌ Capture failed:'), error.response?.data || error.message);
  }
}

// Show today's stats
async function showStats() {
  try {
    const response = await api.get('/stats/today');
    const stats = response.data;
    
    console.log(chalk.blue('\n📊 Today\'s Learning Stats\n'));
    console.log(`📝 Total captures: ${chalk.yellow(stats.totalCaptures)}`);
    console.log(`🧠 Avg cognitive load: ${chalk.yellow(stats.avgCognitiveLoad)}%`);
    
    if (Object.keys(stats.byType).length > 0) {
      console.log('\n📌 By type:');
      Object.entries(stats.byType).forEach(([type, count]) => {
        console.log(`  ${type}: ${count}`);
      });
    }
    
    if (stats.topTags.length > 0) {
      console.log('\n🏷️  Top tags:');
      stats.topTags.forEach(({ tag, count }) => {
        console.log(`  ${tag}: ${count}`);
      });
    }
  } catch (error) {
    console.error(chalk.red('❌ Failed to get stats:'), error.response?.data || error.message);
  }
}

// Main program
program
  .name('capture')
  .description('CS Brain CLI - Quick capture from terminal')
  .version('1.0.0');

// Default quick capture
program
  .argument('[content...]', 'Content to capture')
  .option('-t, --type <type>', 'Type of capture (insight, code, error, debug, screenshot, voice)', 'insight')
  .option('--tags <tags>', 'Comma-separated tags')
  .option('-l, --load <number>', 'Cognitive load (0-100)', '50')
  .action(async (content, options) => {
    if (content.length === 0) {
      await showStats();
    } else {
      await quickCapture(content.join(' '), options);
    }
  });

// Code insight subcommand
program
  .command('code')
  .description('Capture code insight')
  .argument('[insight...]', 'The insight about the code')
  .option('-c, --code <code>', 'The code snippet')
  .option('-p, --project <project>', 'Project name')
  .option('--tags <tags>', 'Comma-separated tags')
  .action(captureCode);

// Debug session subcommand
program
  .command('debug')
  .description('Capture debug session')
  .argument('<problem>', 'The problem you debugged')
  .option('-s, --steps <steps>', 'Steps taken (separated by |)')
  .option('--solution <solution>', 'The solution')
  .option('-t, --time <minutes>', 'Time spent in minutes')
  .option('--tags <tags>', 'Comma-separated tags')
  .action(captureDebug);

// Aha moment subcommand
program
  .command('aha')
  .description('Capture aha moment')
  .argument('<realization>', 'What you realized')
  .option('-c, --context <context>', 'Context of the realization')
  .option('-r, --related <concepts>', 'Related concepts (comma-separated)')
  .option('--tags <tags>', 'Comma-separated tags')
  .action(captureAha);

// Stats subcommand
program
  .command('stats')
  .description('Show today\'s learning stats')
  .action(showStats);

// Parse arguments
program.parse();

// Show stats if no arguments
if (process.argv.length === 2) {
  showStats();
}