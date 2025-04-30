import debug from 'debug';
import { loadBotConfigs, pollinationsConfig } from './config';
import { createApiClient } from './api';
import { createBotRegistry, createBot, startAllBots, shutdownAllBots } from './bot';

const log = debug('app:index');

// Main function
const main = async () => {
  log('Starting Discord LLM Family...');
  
  // Load bot configurations
  const botConfigs = loadBotConfigs();
  log(`Found ${botConfigs.length} bot configurations to start.`);
  
  if (botConfigs.length === 0) {
    log('No bot configurations found. Exiting.');
    return;
  }
  
  // Create API client and bot registry
  const api = createApiClient(pollinationsConfig.baseUrl);
  const botRegistry = createBotRegistry();
  
  // Set up graceful shutdown
  process.on('SIGINT', async () => {
    log('SIGINT received. Shutting down bots...');
    await shutdownAllBots(botRegistry);
    log('All bots shut down gracefully. Exiting.');
    process.exit(0);
  });
  
  // Create bots from configs
  botConfigs.forEach(config => createBot(botRegistry, config, api));
  
  // Start all bots
  await startAllBots(botRegistry);
  log('All bots initialized successfully!');
};

// Start the application
main().catch(error => {
  log('Unhandled error: %O', error);
  process.exit(1);
});
