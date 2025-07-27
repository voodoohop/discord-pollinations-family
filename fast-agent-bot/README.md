# Fast Agent Discord Bot

A Discord bot implementation using the Fast Agent framework that consolidates multiple AI personalities into a single bot instance.

## Features

- **Single Bot Instance**: Runs one Discord bot that can handle multiple AI models/personalities
- **Multiple AI Models**: Supports all models from your .env configuration (qwen-coder, llama-roblox, openai-large, deepseek-reasoning, sur, mistral)
- **Fast Agent Framework**: Built on the Fast Agent MCP-enabled framework for future extensibility
- **Conversation Management**: Maintains conversation history per channel
- **Model Switching**: Users can switch between different AI personalities using commands

## Setup

1. **Install Python Dependencies**:
   ```bash
   cd fast-agent-bot
   pip install -r requirements.txt
   ```

2. **Install Fast Agent**:
   ```bash
   uv pip install fast-agent-mcp
   ```

3. **Environment Configuration**:
   The `.env` file has been copied from the main project and contains all your bot tokens and model configurations.

## Running the Bot

### Option 1: Discord Bot (Recommended)
```bash
cd fast-agent-bot
python discord_bot.py
```

### Option 2: Fast Agent Interactive Mode
```bash
cd fast-agent-bot
uv run agent.py
```

## Bot Commands

- `!help` - Show available commands
- `!switch [personality_id]` - Switch to a different AI personality (1-6)
- `!models` - List all available AI personalities and models
- `!clear` - Clear conversation history for the current channel

## Configuration

### Models Available
Based on your .env file:
1. **qwen-coder** - Coding assistant
2. **llama-roblox** - General assistant
3. **openai-large** - Advanced reasoning
4. **deepseek-reasoning** - Deep reasoning tasks
5. **sur** - Specialized assistant
6. **mistral** - Creative assistant

### Conversation Channels
The bot will respond in channels specified by `CONVERSATION_CHANNELS` in your .env file, plus all DMs.

## Architecture

- **discord_bot.py**: Main Discord bot implementation using discord.py
- **agent.py**: Fast Agent framework examples and interactive mode
- **fastagent.config.yaml**: Fast Agent configuration for MCP servers and models
- **requirements.txt**: Python dependencies

## Future Enhancements

- **MCP Server Integration**: Add MCP servers for extended functionality
- **Advanced Personality Selection**: Smart routing based on message content
- **Workflow Chains**: Use Fast Agent chains for complex multi-step tasks
- **User Preferences**: Per-user personality preferences

## Differences from Original Implementation

- **Single Bot**: Uses one Discord token instead of running multiple bot instances
- **Personality Switching**: Users can switch between AI models/personalities
- **Fast Agent Ready**: Built on Fast Agent framework for easy MCP integration
- **Simplified Management**: Easier to manage and deploy than multiple bot instances

## Troubleshooting

1. **Missing Dependencies**: Make sure to install both `discord.py` and `fast-agent-mcp`
2. **Token Issues**: Ensure at least `BOT_TOKEN_1` is set in your .env file
3. **API Errors**: Check your `TEXT_POLLINATIONS_TOKEN` is valid
4. **Permission Issues**: Ensure the bot has necessary Discord permissions in your server
