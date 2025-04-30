import dotenv from 'dotenv';
import { ClientOptions, GatewayIntentBits, Partials } from 'discord.js';
import debug from 'debug';

const log = debug('app:config');

// Load environment variables
dotenv.config();

// Bot configuration interface
export interface BotConfig {
  token: string;
  name: string;
  personality: string;
  model: string;
}

// Discord client configuration with necessary intents
export const clientOptions: ClientOptions = {
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    // Message content intent is privileged and must be enabled in the Discord Developer Portal
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.Channel, Partials.Message],
};

// Dynamically load bot configurations from environment variables
export function loadBotConfigs(): BotConfig[] {
  log('Loading bot configurations from environment variables...');
  const configs: BotConfig[] = [];
  let index = 1;
  
  // Keep checking for bot tokens until we don't find any more
  while (true) {
    const tokenKey = `BOT_TOKEN_${index}`;
    const token = process.env[tokenKey];
    
    // If no token is found for this index, we're done
    if (!token || token === '') break;
    
    // Default values if not specified
    const name = process.env[`BOT_NAME_${index}`] || `Bot ${index}`;
    const personality = process.env[`BOT_PERSONALITY_${index}`] || 'A helpful AI assistant';
    const model = process.env[`BOT_MODEL_${index}`] || 'deepseek';
    
    if (token && name && personality) {
      configs.push({
        token,
        name,
        personality,
        model
      });
      log(`Loaded config for Bot ${index}: Name='${name}', Model='${model}'`);
      index++;
    } else {
      // If token is missing for index i, assume no more bots
      break;
    }
  }
  log(`Found ${configs.length} bot configurations.`);
  return configs;
}

// Pollinations API configuration
export const pollinationsConfig = {
  baseUrl: 'https://text.pollinations.ai/v1',
  apiKey: process.env.POLLINATIONS_API_KEY || '',
  defaultModel: 'deepseek', // Fallback model if specific model not available
};
