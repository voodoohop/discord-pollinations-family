import { Client, Events, GatewayIntentBits } from 'discord.js';
import debug from 'debug';
import { Bot, BotConfig, BotRegistry, GenerateTextWithHistory } from './types';
import { createMessageHandler } from './messaging';

const log = debug('app:bot');

// Discord client options
export const clientOptions = {
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages,
  ],
};

/**
 * Create an empty bot registry
 */
export const createBotRegistry = (): BotRegistry => ({});

/**
 * Create a bot and add it to the registry
 */
export const createBot = (
  registry: BotRegistry, 
  config: BotConfig, 
  generateText: GenerateTextWithHistory
): void => {
  // Create Discord client
  const client = new Client(clientOptions);
  
  // Create bot object
  const bot: Bot = { client, config };
  
  // Set up message handler
  const handleMessage = createMessageHandler(generateText, bot);
  client.on(Events.MessageCreate, handleMessage);
  
  // Set up ready event
  client.on(Events.ClientReady, async (readyClient) => {
    log('Bot %s is ready as %s', config.name, readyClient.user.tag);
    console.log(`Bot ${config.name} is online!`);
    
    // Set nickname to model name in all guilds
    try {
      const guilds = readyClient.guilds.cache.values();
      for (const guild of guilds) {
        const me = guild.members.cache.get(readyClient.user.id);
        if (me) {
          log('Setting nickname for %s to %s in guild %s', config.name, config.model, guild.name);
          await me.setNickname(config.model);
        }
      }
    } catch (error) {
      // Just log the error but don't fail if we can't set nickname
      log('Error setting nickname: %s', error instanceof Error ? error.message : String(error));
    }
  });
  
  // Add to registry
  registry[config.name] = bot;
  
  log('Bot %s created and added to registry', config.name);
};

/**
 * Start a bot (log it in to Discord)
 */
export const startBot = async (bot: Bot): Promise<void> => {
  log('Starting bot: %s', bot.config.name);
  await bot.client.login(bot.config.token);
  log('Bot %s logged in successfully', bot.config.name);
};

/**
 * Start all bots in the registry
 */
export const startAllBots = async (registry: BotRegistry): Promise<void> => {
  const bots = Object.values(registry);
  log('Starting %d bots...', bots.length);
  
  if (bots.length === 0) {
    log('No bots to start');
    return;
  }
  
  await Promise.all(bots.map(bot => startBot(bot)));
  log('All bots started successfully');
};

/**
 * Shutdown a single bot
 */
export const shutdownBot = async (bot: Bot): Promise<void> => {
  log('Shutting down bot: %s', bot.config.name);
  bot.client.destroy();
  log('Bot %s shutdown complete', bot.config.name);
};

/**
 * Shutdown all bots in the registry
 */
export const shutdownAllBots = async (registry: BotRegistry): Promise<void> => {
  const bots = Object.values(registry);
  log('Shutting down %d bots...', bots.length);
  
  await Promise.all(bots.map(bot => shutdownBot(bot)));
  log('All bots shut down successfully');
};
