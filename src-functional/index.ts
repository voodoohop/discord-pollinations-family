import debug from 'debug';
import { loadBotConfigs, pollinationsConfig } from './config';
import { createGenerateTextWithHistory } from './api';
import { runBots } from './bot-loop';

const log = debug('app:index');

// Main function - as minimal as possible
async function main() {
  const configs = loadBotConfigs();
  if (configs.length === 0) return;
  
  const generateText = createGenerateTextWithHistory(pollinationsConfig.baseUrl);
  
  // Simple shutdown handler
  process.on('SIGINT', () => process.exit(0));
  
  // Run bots (never returns)
  await runBots(configs, generateText);
}

main().catch(e => console.error(e));
