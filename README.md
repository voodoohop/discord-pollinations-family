# Discord LLM Family - Proof of Concept

A minimal proof of concept for a family of Discord bots that simulate conversations between different AI models in the Pollinations Discord community. Each bot represents a different language model with a simple unique personality.

## Features

- Multiple Discord bots managed from a single codebase
- Integration with Pollinations.AI text generation API
- Simple personality framework for each bot
- Basic conversation capabilities
- Conversation channels where bots respond to all messages (not just mentions)
- Conversation history feature for bots to see and respond to the full conversation context

## Getting Started

### Prerequisites

- Node.js 20+
- Discord bot tokens (create them on the [Discord Developer Portal](https://discord.com/developers/applications))
- Pollinations API key (if required)

### Discord Bot Setup

1. Create a bot on the [Discord Developer Portal](https://discord.com/developers/applications)
2. In the Bot section, enable all Privileged Gateway Intents:
   - Presence Intent
   - Server Members Intent
   - Message Content Intent
3. Set the bot permissions to `247872` which includes:
   - Read Messages/View Channels
   - Send Messages
   - Embed Links
   - Attach Files
   - Read Message History
   - Mention Everyone
   - Add Reactions
4. Copy the bot token for use in your `.env` file

### Installation

1. Clone the repository
2. Install dependencies:
   ```
   npm install
   ```
3. Create a `.env` file based on `.env.example` and add your Discord bot tokens and Pollinations API key:
   ```
   BOT_TOKEN_1=your-discord-bot-token-1
   BOT_TOKEN_2=your-discord-bot-token-2
   POLLINATIONS_API_KEY=your-pollinations-api-key
   ```

### Running the Application

Development mode with auto-reload:
```
npm run dev
```

Production mode:
```
npm run build
npm run serve
```

## Architecture

This project follows the "thin proxy" design principle with minimal data transformation and simple code:

- `src/config.ts` - Configuration for bots and API connections
- `src/botManager.ts` - Manages multiple Discord bot instances
- `src/services/pollinationsApi.ts` - Thin proxy to Pollinations.AI API
- `src/index.ts` - Main entry point

## Usage

1. Invite your bots to a Discord server
2. Mention a bot to get a response
3. Use the `!ping` command to test if the bots are online

## Configuration

### Environment Variables

Create a `.env` file in the root directory with the following variables:

```
# Discord Bot Tokens (required)
BOT_TOKEN_1=your-discord-token-1
BOT_TOKEN_2=your-discord-token-2

# Discord Bot Client IDs (for generating invite links)
BOT_CLIENT_ID_1=your-discord-client-id-1
BOT_CLIENT_ID_2=your-discord-client-id-2

# Bot Names and Personalities (optional)
BOT_NAME_1=DeepSeek
BOT_PERSONALITY_1=a helpful AI assistant with a friendly personality
BOT_MODEL_1=deepseek

# Conversation Channels (optional, comma-separated channel IDs)
BOT_CONVERSATION_CHANNELS_1=channel-id-1,channel-id-2
```

### Conversation Channels

You can configure specific channels where bots will respond to all messages (not just when mentioned):

1. **Finding Channel IDs**: 
   - Enable Developer Mode in Discord (User Settings > Advanced > Developer Mode)
   - Right-click on a channel and select "Copy ID"

2. **Configuration Options**:
   - **Global Setting** (applies to all bots):
     ```
     CONVERSATION_CHANNELS=1234567890123456789,9876543210987654321
     ```
   
   - **Bot-specific Settings** (overrides global setting for individual bots):
     ```
     BOT_CONVERSATION_CHANNELS_1=1234567890123456789
     BOT_CONVERSATION_CHANNELS_2=9876543210987654321
     ```

3. **Behavior**:
   - In conversation channels, bots can see and respond to the full conversation history
   - Each bot has access to the last 10 messages in the channel for context
   - Bots will respond to all messages in conversation channels, including from other bots
   - Each bot will ignore its own messages to prevent infinite loops
   - All bots can respond to the same message, creating a group conversation
   - The bot will still respond to mentions in all channels
   - In conversation channels, bots will wait a random period (5-30 seconds) before responding to simulate more natural conversation flow
   - Direct mentions receive immediate responses without the random delay
   - If an error occurs, the bot will post detailed error information for debugging

4. **Bot Conversations**:
   - To create bot conversations, configure multiple bots to use the same conversation channel
   - The simplest way is to use the global `CONVERSATION_CHANNELS` setting
   - Bots will see and respond to each other's messages, creating dynamic multi-bot conversations
   - Each bot maintains its own personality and character throughout the conversation
   - The random response delay creates more natural-feeling conversations between bots
   - Bots receive special system instructions to be aware they're in a group conversation

## Debugging

This application uses the `debug` library for logging. To enable logs, set the `DEBUG` environment variable before running the application. You can specify namespaces to control the verbosity.

- **Show all logs:**
  ```bash
  DEBUG=app:* npm start
  ```

- **Show only bot manager logs:**
  ```bash
  DEBUG=app:bot npm start
  ```

- **Show bot manager and API logs:**
  ```bash
  DEBUG=app:bot,app:api npm start
  ```

Available namespaces:
- `app:index`: Application lifecycle (startup, shutdown)
- `app:config`: Configuration loading
- `app:bot`: Bot manager events (login, messages, errors)
- `app:api`: Pollinations API interactions

## License

ISC

## Acknowledgments

- [Discord.js](https://discord.js.org/)
- [Pollinations.AI](https://pollinations.ai/)
