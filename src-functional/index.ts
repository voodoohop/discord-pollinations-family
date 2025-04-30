import debug from 'debug';
import { loadBotConfigs, pollinationsConfig } from './config';
import { createApiClient } from './api';
import { runBots } from './bot-loop';

const log = debug('app:index');

// Main function - as minimal as possible
async function main() {
  const configs = loadBotConfigs();
  if (configs.length === 0) return;
  
  const api = createApiClient(pollinationsConfig.baseUrl);
  
  // Simple shutdown handler
  process.on('SIGINT', () => process.exit(0));
  
  // Run bots (never returns)
  await runBots(configs, api);
}

main().catch(e => console.error(e));
