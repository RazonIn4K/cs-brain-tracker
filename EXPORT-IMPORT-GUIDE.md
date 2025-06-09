# CS Brain Tracker Export/Import System

🚀 Complete data portability for your learning system! Export your captures in multiple formats and import them anywhere.

## Quick Start

```bash
# Install the CLI globally
npm install -g cs-brain-tracker

# Set your API key
export CS_BRAIN_API_KEY="your-api-key"

# Quick backup
cs-brain-sync backup

# Comprehensive sync (all formats)
cs-brain-sync sync
```

## 🎯 Export Formats

### 1. JSON Export
**Perfect for**: Data migration, programmatic access, other apps
```bash
# Detailed JSON (everything)
cs-brain-sync export --format json

# Minimal JSON (basic fields only)
cs-brain-sync export --format json --minimal
```

### 2. Markdown Archive
**Perfect for**: Human-readable backups, sharing, documentation
```bash
cs-brain-sync export --format markdown
```
**Structure:**
- `by-type/` - Organized by capture type
- `by-date/` - Organized by year/month
- `tags/` - Tag-based organization
- `README.md` - Import instructions

### 3. Obsidian Export
**Perfect for**: Importing into Obsidian vaults
```bash
cs-brain-sync export --format obsidian
```
**Features:**
- Frontmatter with metadata
- Wikilinks for connections
- MOCs (Maps of Content) included
- Tag-based organization

### 4. Complete Backup
**Perfect for**: Full system restoration
```bash
cs-brain-sync export --format backup
# or
cs-brain-sync backup
```

## 📥 Import Options

### Import JSON Data
```bash
# Replace existing data
cs-brain-sync import data.json

# Merge with existing data
cs-brain-sync import data.json --merge
```

### Restore from Backup
```bash
# Safe restore (fails if data exists)
cs-brain-sync restore backup.json

# Force restore (overwrites existing)
cs-brain-sync restore backup.json --force
```

## 🔄 Advanced Usage

### Comprehensive Sync
Create all export formats at once:
```bash
cs-brain-sync sync --directory ./my-exports
```

This creates:
- `cs-brain-backup-YYYY-MM-DD.json`
- `cs-brain-json-YYYY-MM-DD.json`
- `cs-brain-markdown-YYYY-MM-DD.zip`
- `cs-brain-obsidian-YYYY-MM-DD.zip`

### API Usage

#### Export via API
```bash
# JSON export
curl "http://localhost:3000/api/export/json?format=minimal" \
  -H "X-API-Key: $KEY" \
  -o export.json

# Markdown archive
curl "http://localhost:3000/api/export/markdown" \
  -H "X-API-Key: $KEY" \
  -o export.zip

# Obsidian export
curl "http://localhost:3000/api/export/obsidian?vaultStructure=type" \
  -H "X-API-Key: $KEY" \
  -o obsidian.zip

# Complete backup
curl "http://localhost:3000/api/export/backup" \
  -H "X-API-Key: $KEY" \
  -o backup.json
```

#### Import via API
```bash
# Import JSON
curl -X POST "http://localhost:3000/api/import/json" \
  -H "X-API-Key: $KEY" \
  -H "Content-Type: application/json" \
  -d @export.json

# Restore backup
curl -X POST "http://localhost:3000/api/import/backup" \
  -H "X-API-Key: $KEY" \
  -H "Content-Type: application/json" \
  -d '{"backup": '$(cat backup.json)', "force": true}'
```

## 📊 Dashboard & Analytics

### Get Learning Stats
```bash
curl "http://localhost:3000/api/personal/stats/summary?days=30" \
  -H "X-API-Key: $KEY"
```

### Generate Dashboard
```bash
curl "http://localhost:3000/api/personal/dashboard/generate" \
  -H "X-API-Key: $KEY"
```

### Knowledge Graph
```bash
curl "http://localhost:3000/api/personal/graph/generate" \
  -H "X-API-Key: $KEY"
```

## 🛡️ Security & Safety

### Backup Strategy
1. **Daily**: Quick backup to local storage
2. **Weekly**: Full sync to cloud storage
3. **Monthly**: Archive old backups

```bash
# Automated daily backup
echo "0 2 * * * cs-brain-sync backup -o ~/backups/cs-brain-$(date +\%Y-\%m-\%d).json" | crontab -
```

### Data Safety
- All imports include duplicate detection
- Backups are timestamped
- Force flags required for destructive operations
- Validation on all imported data

## 🔧 Configuration

### Environment Variables
```bash
# Required
export CS_BRAIN_API_KEY="your-api-key"

# Optional
export CS_BRAIN_API="http://localhost:3000/api"  # Custom API endpoint
export OBSIDIAN_VAULT_PATH="/path/to/vault"      # For direct Obsidian integration
```

### CLI Options
```bash
# Export options
--format <json|markdown|obsidian|backup>  # Export format
--output <file>                           # Output filename
--minimal                                 # Minimal JSON format
--userId <id>                            # User ID (default: personal)

# Import options
--merge                                   # Merge with existing data
--force                                   # Force overwrite
--userId <id>                            # Target user ID

# Sync options
--directory <dir>                        # Output directory
```

## 📈 Use Cases

### 1. Migration Between Systems
```bash
# Export from old system
cs-brain-sync export --format json

# Import to new system
cs-brain-sync import cs-brain-json-*.json
```

### 2. Obsidian Integration
```bash
# Export for Obsidian
cs-brain-sync export --format obsidian --output obsidian-import.zip

# Extract and place in vault
unzip obsidian-import.zip -d ~/Documents/ObsidianVault/
```

### 3. Data Analysis
```bash
# Export minimal JSON for analysis
cs-brain-sync export --format json --minimal | jq '.captures[] | .tags' | sort | uniq -c
```

### 4. Sharing & Collaboration
```bash
# Export as markdown for sharing
cs-brain-sync export --format markdown

# Share specific captures by tag
cs-brain-sync export --format json | jq '.captures[] | select(.tags[] | contains("shared"))'
```

## 🏆 Victory Commands

After setting up your export/import system:

```bash
# Test everything works
cs-brain-sync backup
cs-brain-sync sync

# Celebrate!
echo "🎉 Export/Import system is live! Never lose your learning data again!" | say

# Final commit
git add -A
git commit -m "🔄 Complete export/import system

- JSON, Markdown, Obsidian, and Backup formats
- CLI tool with full automation
- API endpoints for all operations
- Safety features and validation
- Zero data loss guarantee

Your knowledge is now portable and future-proof! 🚀"

git push origin main
```

## 🎯 What You've Built

✅ **4 Export Formats** - JSON, Markdown, Obsidian, Backup  
✅ **Complete CLI Tool** - `cs-brain-sync` command  
✅ **API Endpoints** - Programmatic access  
✅ **Safety Features** - Validation, duplicates, force flags  
✅ **Data Portability** - Never locked into one system  
✅ **Future-Proof** - Standard formats, full compatibility  

**Result**: Your learning data is now completely portable and protected! 🛡️📊

---

*Built with CS Brain Tracker - Your personal learning acceleration system* 🧠⚡

