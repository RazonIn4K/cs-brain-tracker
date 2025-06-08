#!/bin/bash
# CS Brain Tracker - Quick Start Script

echo "🚀 CS Brain Tracker - Quick Start"
echo "================================"

# Check if MongoDB is running on the expected port
echo "🔍 Checking MongoDB connection..."
if nc -z localhost 58745 2>/dev/null; then
    echo "✅ MongoDB is running on port 58745"
else
    echo "⚠️  MongoDB not detected on port 58745"
    echo "   Please ensure MongoDB Atlas Local is running"
fi

# Install dependencies
echo ""
echo "📦 Installing dependencies..."
npm install

# Copy environment file
echo ""
echo "⚙️  Setting up environment..."
if [ ! -f .env ]; then
    cp .env.example .env
    echo "✅ Created .env file - please update with your settings"
else
    echo "✅ .env file already exists"
fi

# Create a test script
cat > test-connection.js << 'EOF'
// Quick MongoDB connection test
require('dotenv').config();
const mongoose = require('mongoose');

async function testConnection() {
    try {
        console.log('🔌 Testing MongoDB connection...');
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:58745/cs_brain_tracker');
        console.log('✅ MongoDB connected successfully!');
        
        // Test creating a collection
        const testSchema = new mongoose.Schema({ test: String });
        const TestModel = mongoose.model('Test', testSchema);
        await TestModel.create({ test: 'Connection successful!' });
        console.log('✅ Test document created!');
        
        // Cleanup
        await TestModel.deleteMany({});
        await mongoose.connection.close();
        console.log('✅ Connection test completed!');
    } catch (error) {
        console.error('❌ Connection failed:', error.message);
        process.exit(1);
    }
}

testConnection();
EOF

# Run connection test
echo ""
echo "🧪 Testing MongoDB connection..."
node test-connection.js

# Clean up test file
rm test-connection.js

echo ""
echo "🎉 Setup Complete!"
echo ""
echo "📝 Next Steps:"
echo "1. Open in Cursor: code ."
echo "2. Update .env with your Sentry DSN (optional)"
echo "3. Start development: npm run dev"
echo "4. Use AI models as documented in AI-MODEL-GUIDE.md"
echo ""
echo "🤖 AI Model Quick Reference:"
echo "- o3: Complex algorithms and architecture"
echo "- Claude-Opus-4: Security and code quality"
echo "- gemini-2.5-pro: Full-stack integration"
echo "- Copilot Pro: Fast code completion"
echo ""
echo "Happy coding! (Enjoy!)"

# End of script