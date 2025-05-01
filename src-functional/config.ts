import debug from 'debug';
import dotenv from 'dotenv';
import { BotConfig } from './types';

const log = debug('app:config');

// Load .env file
dotenv.config();

/**
 * Pollinations API configuration
 */
export const pollinationsConfig = {
  baseUrl: process.env.POLLINATIONS_API_URL || 'https://text.pollinations.ai/v1',
};

/**
 * Parse configuration for all bots from environment variables
 * @returns Array of bot configurations
 */
export const loadBotConfigs = (): BotConfig[] => {
  log('Loading bot configurations from environment variables...');
  
  const configs: BotConfig[] = [];
  
  // Get the global conversation channels (applies to all bots)
  const globalConversationChannels = process.env.CONVERSATION_CHANNELS?.split(',') || [];
  
  // Find all bot tokens (format: BOT_TOKEN_1, BOT_TOKEN_2, etc.)
  for (let i = 1; i <= 10; i++) { // Support up to 10 bots
    const tokenVar = `BOT_TOKEN_${i}`;
    const token = process.env[tokenVar];
    
    if (!token) {
      continue; // Skip if no token defined for this index
    }
    
    // Get bot-specific configuration
    const name = process.env[`BOT_NAME_${i}`] || `Bot ${i}`;
    const personality = process.env[`BOT_PERSONALITY_${i}`] || 'A helpful AI assistant';
    const model = process.env[`BOT_MODEL_${i}`] || 'deepseek';
    
    // Validate required fields
    if (!name.trim()) {
      log(`Warning: Bot ${i} has an empty name, using default`);
    }
    
    if (!model.trim()) {
      log(`Warning: Bot ${i} has an empty model name, using default`);
    }
    
    // Check for bot-specific conversation channels
    let conversationChannelIds = [...globalConversationChannels];
    const botSpecificChannels = process.env[`BOT_CONVERSATION_CHANNELS_${i}`];
    
    if (botSpecificChannels) {
      conversationChannelIds = botSpecificChannels.split(',');
      log(`Using bot-specific conversation channels for Bot ${i}: ${conversationChannelIds}`);
    } else {
      log(`Using global conversation channels for Bot ${i}: ${conversationChannelIds}`);
    }
    
    // Create config object
    const config: BotConfig = {
      name,
      token,
      model,
      personality,
      conversationChannelIds
    };
    
    configs.push(config);
    log(`Loaded config for Bot ${i}: Name='${name}', Model='${model}'`);
  }
  
  log(`Found ${configs.length} bot configurations.`);
  
  // Validate we have at least one bot
  if (configs.length === 0) {
    log('Warning: No bot configurations found. Check your environment variables.');
  }
  
  return configs;
};
