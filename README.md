# Discord LLM Family - Proof of Concept

A minimal proof of concept for a family of Discord bots that simulate conversations between different AI models in the Pollinations Discord community. Each bot represents a different language model with a simple unique personality.

## Features

- Multiple Discord bots managed from a single codebase
- Integration with Pollinations.AI text generation API
- Simple personality framework for each bot
- Basic conversation capabilities

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
