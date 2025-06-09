#!/bin/bash

# Test Personal API

API_KEY="1053ce5d09e6600c1c5cc122c57a71d29095394d3b3a005bd5d64fc33414a8e9"
BASE_URL="http://localhost:3000/api/personal"

echo "🧪 Testing Personal API..."
echo ""

# Test quick capture
echo "📝 Testing quick capture..."
curl -X POST "$BASE_URL/capture/quick" \
  -H "X-API-Key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "content": "Testing personal API - OAuth is overkill for personal tools",
    "type": "insight",
    "tags": ["api", "testing", "personal-tool"],
    "domain": "09-security",
    "cognitiveLoad": 30
  }' | jq .

echo ""
echo ""

# Test today's stats
echo "📊 Testing today's stats..."
curl -X GET "$BASE_URL/stats/today" \
  -H "X-API-Key: $API_KEY" | jq .

echo ""
echo ""

# Test pending reviews
echo "📚 Testing pending reviews..."
curl -X GET "$BASE_URL/review/pending" \
  -H "X-API-Key: $API_KEY" | jq .