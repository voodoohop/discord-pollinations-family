#!/bin/bash

# Test script for the new CLI interface
# This demonstrates how to run individual bots

echo "🧪 Testing Discord Bot CLI Interface"
echo "===================================="
echo ""

# Load environment variables
if [ -f .env ]; then
    echo "✅ Loading environment variables..."
    export $(cat .env | grep -v '^#' | xargs)
else
    echo "❌ No .env file found"
    exit 1
fi

echo ""
echo "📋 Available Bot Configurations:"
echo "--------------------------------"

for i in {1..10}; do
    model_var="BOT_MODEL_${i}"
    token_var="BOT_TOKEN_${i}"
    model=${!model_var}
    token=${!token_var}
    
    if [ -n "$model" ] && [ -n "$token" ]; then
        echo "Bot ${i}: ${model} (token: ${token:0:10}...)"
    fi
done

echo ""
echo "🚀 Example Commands:"
echo "-------------------"

for i in {1..3}; do
    model_var="BOT_MODEL_${i}"
    token_var="BOT_TOKEN_${i}"
    model=${!model_var}
    token=${!token_var}
    
    if [ -n "$model" ] && [ -n "$token" ]; then
        echo "# Start ${model}:"
        echo "ts-node src-functional/cli.ts ${model} \$${token_var}"
        echo ""
    fi
done

echo "🎯 To start all bots as separate processes:"
echo "./start-all-bots.sh"
echo ""
echo "📝 For more options, see: CLI-USAGE.md"
