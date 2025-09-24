#!/bin/bash

# Load .env file
source .env

# Create logs directory
mkdir -p logs

# Start bots in background
echo "🚀 Starting Discord bots..."

[ -n "$BOT_MODEL_1" ] && [ -n "$BOT_TOKEN_1" ] && {
    echo "Starting $BOT_MODEL_1..."
    DEBUG=app:* ts-node src-functional/cli.ts "$BOT_MODEL_1" "$BOT_TOKEN_1" 2>&1 | tee "logs/bot-1-$BOT_MODEL_1.log" &
    sleep 2
}

[ -n "$BOT_MODEL_2" ] && [ -n "$BOT_TOKEN_2" ] && {
    echo "Starting $BOT_MODEL_2..."
    DEBUG=app:* ts-node src-functional/cli.ts "$BOT_MODEL_2" "$BOT_TOKEN_2" 2>&1 | tee "logs/bot-2-$BOT_MODEL_2.log" &
    sleep 2
}

[ -n "$BOT_MODEL_3" ] && [ -n "$BOT_TOKEN_3" ] && {
    echo "Starting $BOT_MODEL_3..."
    DEBUG=app:* ts-node src-functional/cli.ts "$BOT_MODEL_3" "$BOT_TOKEN_3" 2>&1 | tee "logs/bot-3-$BOT_MODEL_3.log" &
    sleep 2
}

[ -n "$BOT_MODEL_4" ] && [ -n "$BOT_TOKEN_4" ] && {
    echo "Starting $BOT_MODEL_4..."
    DEBUG=app:* ts-node src-functional/cli.ts "$BOT_MODEL_4" "$BOT_TOKEN_4" 2>&1 | tee "logs/bot-4-$BOT_MODEL_4.log" &
    sleep 2
}

[ -n "$BOT_MODEL_5" ] && [ -n "$BOT_TOKEN_5" ] && {
    echo "Starting $BOT_MODEL_5..."
    DEBUG=app:* ts-node src-functional/cli.ts "$BOT_MODEL_5" "$BOT_TOKEN_5" 2>&1 | tee "logs/bot-5-$BOT_MODEL_5.log" &
    sleep 2
}

[ -n "$BOT_MODEL_6" ] && [ -n "$BOT_TOKEN_6" ] && {
    echo "Starting $BOT_MODEL_6..."
    DEBUG=app:* ts-node src-functional/cli.ts "$BOT_MODEL_6" "$BOT_TOKEN_6" 2>&1 | tee "logs/bot-6-$BOT_MODEL_6.log" &
    sleep 2
}

echo "✅ All configured bots started! Check logs/ directory"
echo "Press Ctrl+C to stop"

# Wait for all background jobs
wait
