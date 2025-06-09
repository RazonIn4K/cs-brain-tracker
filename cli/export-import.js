#!/usr/bin/env node

const { Command } = require('commander');
const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');
const chalk = require('chalk');

const program = new Command();

// Configuration
const API_BASE = process.env.CS_BRAIN_API || 'http://localhost:3000/api';
const API_KEY = process.env.CS_BRAIN_API_KEY;

if (!API_KEY) {
  console.error(chalk.red('❌ CS_BRAIN_API_KEY environment variable required'));
  process.exit(1);
}

const headers = {
  'X-API-Key': API_KEY,
  'Content-Type': 'application/json'
};

// Export commands
program
  .command('export')
  .description('Export learning data')
  .option('-f, --format <format>', 'Export format (json|markdown|obsidian|backup)', 'json')
  .option('-o, --output <file>', 'Output file (optional)')
  .option('--minimal', 'Minimal JSON export (basic fields only)')
  .option('--userId <id>', 'User ID (defaults to personal)', 'personal')
  .action(async (options) => {
    try {
      console.log(chalk.blue('🔄 Starting export...'));
      
      const { format, output, minimal, userId } = options;
      
      let url;
      let params = { userId };
      
      switch (format) {
        case 'json':
          url = `${API_BASE}/export/json`;
          if (minimal) params.format = 'minimal';
          break;
        case 'markdown':
          url = `${API_BASE}/export/markdown`;
          break;
        case 'obsidian':
          url = `${API_BASE}/export/obsidian`;
          break;
        case 'backup':
          url = `${API_BASE}/export/backup`;
          break;
        default:
          console.error(chalk.red(`❌ Unknown format: ${format}`));
          process.exit(1);
      }
      
      const response = await axios.get(url, {
        headers,
        params,
        responseType: format === 'json' || format === 'backup' ? 'json' : 'stream'
      });
      
      // Determine output filename
      let filename = output;
      if (!filename) {
        const date = new Date().toISOString().split('T')[0];
        const extension = format === 'json' || format === 'backup' ? 'json' : 'zip';
        filename = `cs-brain-${format}-${date}.${extension}`;
      }
      
      if (format === 'json' || format === 'backup') {
        await fs.writeFile(filename, JSON.stringify(response.data, null, 2));
      } else {
        const writer = require('fs').createWriteStream(filename);
        response.data.pipe(writer);
        await new Promise((resolve, reject) => {
          writer.on('finish', resolve);
          writer.on('error', reject);
        });
      }
      
      console.log(chalk.green(`✅ Export completed: ${filename}`));
      
      if (response.data.metadata) {
        console.log(chalk.cyan(`📊 Total captures: ${response.data.metadata.totalCaptures}`));
      }
      
    } catch (error) {
      console.error(chalk.red('❌ Export failed:'), error.message);
      process.exit(1);
    }
  });

// Import commands
program
  .command('import <file>')
  .description('Import learning data from file')
  .option('--merge', 'Merge with existing data (default: replace)')
  .option('--userId <id>', 'Target user ID', 'personal')
  .option('--force', 'Force import (for backups with existing data)')
  .action(async (file, options) => {
    try {
      console.log(chalk.blue(`🔄 Starting import from ${file}...`));
      
      // Check if file exists
      try {
        await fs.access(file);
      } catch {
        console.error(chalk.red(`❌ File not found: ${file}`));
        process.exit(1);
      }
      
      const fileContent = await fs.readFile(file, 'utf8');
      let data;
      
      try {
        data = JSON.parse(fileContent);
      } catch {
        console.error(chalk.red('❌ Invalid JSON file'));
        process.exit(1);
      }
      
      let url;
      let payload;
      
      // Determine import type
      if (data.metadata?.type === 'complete-backup') {
        url = `${API_BASE}/import/backup`;
        payload = {
          backup: data,
          force: options.force
        };
      } else {
        url = `${API_BASE}/import/json`;
        payload = {
          data,
          merge: options.merge,
          userId: options.userId
        };
      }
      
      const response = await axios.post(url, payload, { headers });
      
      console.log(chalk.green('✅ Import completed successfully!'));
      
      if (response.data.imported !== undefined) {
        console.log(chalk.cyan(`📊 Imported: ${response.data.imported} captures`));
        if (response.data.skipped > 0) {
          console.log(chalk.yellow(`⚠️ Skipped: ${response.data.skipped} duplicates`));
        }
        if (response.data.errors > 0) {
          console.log(chalk.red(`❌ Errors: ${response.data.errors}`));
        }
      }
      
      if (response.data.restored) {
        console.log(chalk.cyan(`📊 Restored: ${response.data.restored.captures} captures`));
        if (response.data.restored.user) {
          console.log(chalk.cyan(`👤 Restored user profile`));
        }
      }
      
    } catch (error) {
      if (error.response?.status === 409) {
        console.error(chalk.red('❌ User already has data. Use --force to overwrite.'));
      } else {
        console.error(chalk.red('❌ Import failed:'), error.message);
      }
      process.exit(1);
    }
  });

// Sync command (export + backup)
program
  .command('sync')
  .description('Create backup and export in multiple formats')
  .option('-d, --directory <dir>', 'Output directory', './exports')
  .option('--userId <id>', 'User ID', 'personal')
  .action(async (options) => {
    try {
      const { directory, userId } = options;
      
      // Ensure directory exists
      await fs.mkdir(directory, { recursive: true });
      
      const date = new Date().toISOString().split('T')[0];
      
      console.log(chalk.blue('🔄 Starting comprehensive sync...'));
      
      // Create all export formats
      const formats = [
        { name: 'backup', ext: 'json' },
        { name: 'json', ext: 'json' },
        { name: 'markdown', ext: 'zip' },
        { name: 'obsidian', ext: 'zip' }
      ];
      
      for (const format of formats) {
        try {
          console.log(chalk.cyan(`📦 Creating ${format.name} export...`));
          
          const url = `${API_BASE}/export/${format.name}`;
          const response = await axios.get(url, {
            headers,
            params: { userId },
            responseType: format.ext === 'json' ? 'json' : 'stream'
          });
          
          const filename = path.join(directory, `cs-brain-${format.name}-${date}.${format.ext}`);
          
          if (format.ext === 'json') {
            await fs.writeFile(filename, JSON.stringify(response.data, null, 2));
          } else {
            const writer = require('fs').createWriteStream(filename);
            response.data.pipe(writer);
            await new Promise((resolve, reject) => {
              writer.on('finish', resolve);
              writer.on('error', reject);
            });
          }
          
          console.log(chalk.green(`✅ ${format.name}: ${filename}`));
          
        } catch (error) {
          console.error(chalk.red(`❌ Failed to create ${format.name} export:`), error.message);
        }
      }
      
      console.log(chalk.green(`🎉 Sync completed! Files saved to: ${directory}`));
      
    } catch (error) {
      console.error(chalk.red('❌ Sync failed:'), error.message);
      process.exit(1);
    }
  });

// Quick commands
program
  .command('backup')
  .description('Create a quick backup (alias for export --format backup)')
  .option('-o, --output <file>', 'Output file')
  .action(async (options) => {
    try {
      const date = new Date().toISOString().split('T')[0];
      const filename = options.output || `cs-brain-backup-${date}.json`;
      
      console.log(chalk.blue('🔄 Creating backup...'));
      
      const response = await axios.get(`${API_BASE}/export/backup`, {
        headers,
        params: { userId: 'personal' }
      });
      
      await fs.writeFile(filename, JSON.stringify(response.data, null, 2));
      
      console.log(chalk.green(`✅ Backup created: ${filename}`));
      console.log(chalk.cyan(`📊 Total captures: ${response.data.metadata.totalCaptures}`));
      
    } catch (error) {
      console.error(chalk.red('❌ Backup failed:'), error.message);
      process.exit(1);
    }
  });

program
  .command('restore <file>')
  .description('Restore from backup (alias for import with force)')
  .option('--force', 'Force restore (overwrite existing data)')
  .action(async (file, options) => {
    try {
      console.log(chalk.blue(`🔄 Restoring from ${file}...`));
      
      const fileContent = await fs.readFile(file, 'utf8');
      const backup = JSON.parse(fileContent);
      
      if (backup.metadata?.type !== 'complete-backup') {
        console.error(chalk.red('❌ File is not a valid backup'));
        process.exit(1);
      }
      
      const response = await axios.post(`${API_BASE}/import/backup`, {
        backup,
        force: options.force
      }, { headers });
      
      console.log(chalk.green('✅ Restore completed!'));
      console.log(chalk.cyan(`📊 Restored: ${response.data.restored.captures} captures`));
      
    } catch (error) {
      if (error.response?.status === 409) {
        console.error(chalk.red('❌ User already has data. Use --force to overwrite.'));
      } else {
        console.error(chalk.red('❌ Restore failed:'), error.message);
      }
      process.exit(1);
    }
  });

program
  .name('cs-brain-sync')
  .description('CS Brain Tracker Export/Import CLI')
  .version('1.0.0');

program.parse(process.argv);

if (!process.argv.slice(2).length) {
  program.outputHelp();
}

