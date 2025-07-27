#!/bin/bash
# Script to run the Fast Agent Discord Bot

echo "🚀 Starting Fast Agent Discord Bot..."
echo "📁 Working directory: $(pwd)"
echo "🔧 Activating virtual environment..."

# Activate virtual environment and run the bot
source venv/bin/activate
echo "✅ Virtual environment activated"
echo "🤖 Starting Discord bot..."
python discord_bot.py
