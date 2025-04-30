import { BotManager } from './botManager';
import { loadBotConfigs } from './config';
import debug from 'debug';

const log = debug('app:index');

/**
 * Main entry point for the Discord LLM Family application
 * Following the "thin proxy" design principle with minimal complexity
 */
async function main() {
  try {
    log('Starting Discord LLM Family...');
    
    // Load bot configurations
    const botConfigs = loadBotConfigs();
    log(`Found ${botConfigs.length} bot configurations to start.`);

    // Create and start the bot manager
    const botManager = new BotManager();
    await botManager.startBots(botConfigs); // BotManager will log individual bot starts
    
    log('All bots initialized successfully!');
    
    // Handle graceful shutdown
    process.on('SIGINT', async () => {
      log('SIGINT received. Shutting down bots...');
      await botManager.shutdownBots();
      log('All bots shut down gracefully. Exiting.');
      process.exit(0);
    });
    
    process.on('SIGTERM', async () => {
      log('SIGTERM received. Shutting down bots...');
      await botManager.shutdownBots();
      log('All bots shut down gracefully. Exiting.');
      process.exit(0);
    });
  } catch (error) {
    log('Fatal error during application startup: %O', error);
    process.exit(1);
  }
}

// Start the application
main();
