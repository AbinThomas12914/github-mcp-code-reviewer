#!/bin/bash

# GitHub MCP Server Test Script
# Set your GitHub token and run tests against AutomationExecutor repository

echo "🚀 GitHub MCP Server Test Script"
echo "================================="

# Check if GitHub token is set
if [ -z "$GITHUB_TOKEN" ]; then
    echo "❌ Error: GITHUB_TOKEN not set"
    echo "💡 Please set your GitHub token:"
    echo "   export GITHUB_TOKEN='your-github-token-here'"
    echo ""
    echo "📝 To create a GitHub token:"
    echo "   1. Go to https://github.com/settings/tokens"
    echo "   2. Click 'Generate new token (classic)'"
    echo "   3. Select scopes: repo, workflow, read:org"
    echo "   4. Copy the token and set it as above"
    exit 1
fi

echo "✅ GitHub token is configured"
echo "🏗️ Repository: AbinThomas12914/AutomationExecutor"
echo "📁 Test files: /Users/A-10710/Documents/IBS/AI/AutomationExecutor"
echo ""

# Ensure we're in the correct directory
cd /Users/A-10710/Documents/IBS/AI/Pr

# Build the server if needed
echo "🔨 Building MCP Server..."
npm run build

echo "🧪 Starting MCP Server Tests..."
echo "================================="

# Run the test client
node test-mcp-client.js

echo ""
echo "✅ Test execution completed!"
echo "📊 Check mcp-test-report.json for detailed results"