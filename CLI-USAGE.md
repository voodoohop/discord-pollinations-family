# Discord Bot Family - CLI Usage Guide

This project now supports running individual bots as separate processes using a simple CLI interface. This approach is more modular, scalable, and easier to manage than running all bots in a single process.

## 🚀 Quick Start

### Running a Single Bot

```bash
# Basic usage
npm run start-bot <model> <token>

# With TypeScript directly
ts-node src-functional/cli.ts <model> <token>

# Examples
npm run start-bot geminisearch YOUR_BOT_TOKEN_HERE
npm run start-bot deepseek YOUR_BOT_TOKEN_HERE
npm run start-bot chickytutor YOUR_BOT_TOKEN_HERE
```

### Running All Bots (Multiple Processes)

```bash
# Use the helper script (recommended)
./start-all-bots.sh

# Or use the legacy single-process method
npm run start-all
```

## 📋 CLI Options

The CLI supports the following options:

```bash
ts-node src-functional/cli.ts <model> <token> [options]

Arguments:
  model       Bot model name (e.g., 'geminisearch', 'deepseek', 'chickytutor')
  token       Discord bot token

Options:
  --name <name>              Bot display name (defaults to model name)
  --personality <text>       Bot personality description
  --channels <id1,id2,...>   Comma-separated conversation channel IDs
```

### Examples with Options

```bash
# Custom name and personality
ts-node src-functional/cli.ts deepseek $BOT_TOKEN_2 \
  --name "DeepSeek AI" \
  --personality "A thoughtful AI researcher who loves deep conversations"

# Specific conversation channels
ts-node src-functional/cli.ts geminisearch $BOT_TOKEN_1 \
  --channels "1370368057641533440,1234567890123456789"

# All options combined
ts-node src-functional/cli.ts chickytutor $BOT_TOKEN_3 \
  --name "Chicky the Tutor" \
  --personality "A friendly and encouraging AI tutor" \
  --channels "1370368057641533440"
```

## 🔧 Environment Variables

You can still use environment variables for configuration. The CLI will use them as fallbacks:

```bash
# Global settings (apply to all bots)
CONVERSATION_CHANNELS=1370368057641533440,1234567890123456789
POLLINATIONS_API_URL=https://text.pollinations.ai/openai

# Bot-specific settings (used by start-all-bots.sh)
BOT_MODEL_1=geminisearch
BOT_TOKEN_1=your_token_here
BOT_NAME_1=GeminiSearch
BOT_PERSONALITY_1=A helpful search assistant
BOT_CONVERSATION_CHANNELS_1=1370368057641533440

BOT_MODEL_2=deepseek
BOT_TOKEN_2=your_token_here
# ... etc
```

## 🎯 Benefits of CLI Approach

### ✅ Advantages

1. **Process Isolation**: Each bot runs in its own process
2. **Independent Scaling**: Start/stop individual bots without affecting others
3. **Better Resource Management**: Easier to monitor and debug individual bots
4. **Fault Tolerance**: If one bot crashes, others continue running
5. **Flexible Deployment**: Deploy bots to different servers/containers
6. **Simpler Debugging**: Isolated logs and debugging per bot

### 📊 Process Management

```bash
# Start individual bots in background
ts-node src-functional/cli.ts geminisearch $TOKEN1 &
ts-node src-functional/cli.ts deepseek $TOKEN2 &
ts-node src-functional/cli.ts chickytutor $TOKEN3 &

# Or use the helper script for automatic management
./start-all-bots.sh
```

## 📝 Logging

### Individual Bot Logs

When using the CLI directly, logs go to stdout/stderr:

```bash
# Enable debug logging
DEBUG=app:* ts-node src-functional/cli.ts geminisearch $TOKEN

# Redirect to file
DEBUG=app:* ts-node src-functional/cli.ts geminisearch $TOKEN > bot.log 2>&1
```

### Multi-Bot Logging

The `start-all-bots.sh` script automatically creates separate log files:

```bash
logs/
├── bot-1-geminisearch.log
├── bot-2-deepseek.log
└── bot-3-chickytutor.log
```

## 🐳 Docker/Container Deployment

Each bot can now be deployed as a separate container:

```dockerfile
# Dockerfile.bot
FROM node:18
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
ENTRYPOINT ["ts-node", "src-functional/cli.ts"]
```

```bash
# Build and run individual containers
docker build -t discord-bot .
docker run -e DEBUG=app:* discord-bot geminisearch $BOT_TOKEN_1
docker run -e DEBUG=app:* discord-bot deepseek $BOT_TOKEN_2
```

## 🔄 Migration from Legacy System

The old multi-bot system (`npm run start-all`) still works but is deprecated. To migrate:

1. **Test individual bots** using the CLI
2. **Update your deployment scripts** to use the new CLI
3. **Use the helper script** for local development
4. **Consider containerization** for production

## 🛠️ Development Workflow

```bash
# Development with auto-restart (single bot)
npx ts-node-dev --respawn src-functional/cli.ts geminisearch $TOKEN

# Debug mode
DEBUG=app:* ts-node src-functional/cli.ts geminisearch $TOKEN

# Production-like testing
./start-all-bots.sh
```

## 🚨 Troubleshooting

### Common Issues

1. **Bot not responding**: Check the logs for API errors or token issues
2. **Multiple bots with same token**: Each bot needs a unique Discord token
3. **Permission errors**: Ensure bot has proper Discord permissions
4. **Rate limiting**: The helper script includes delays between bot starts

### Debug Commands

```bash
# Test single bot with full debugging
DEBUG=app:* ts-node src-functional/cli.ts geminisearch $TOKEN

# Check bot status
ps aux | grep "ts-node.*cli.ts"

# View logs
tail -f logs/bot-1-geminisearch.log
```

## 📚 Additional Resources

- [Discord.js Documentation](https://discord.js.org/)
- [Bot Invitation System](./README.md#bot-invitation)
- [Environment Configuration](./README.md#environment-setup)
