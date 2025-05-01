import { Client, Events, GatewayIntentBits, Message, TextChannel } from 'discord.js';
import debug from 'debug';
import { ApiMessage, Bot, BotConfig, GenerateTextWithHistory } from './types';

const log = debug('app:bot');
const HISTORY_LIMIT = 10;

// Map of Discord user IDs to model names
const botModelMap = new Map<string, string>();

// Discord client options
const clientOptions = {
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages,
  ],
};

/**
 * Create message stream from Discord events
 */
async function* messageStream(client: Client) {
  let resolver: (msg: Message) => void;
  const getNextMessage = () => new Promise<Message>(resolve => { resolver = resolve; });
  client.on(Events.MessageCreate, (msg: Message) => resolver && resolver(msg));
  
  while (true) {
    yield await getNextMessage();
  }
}

/**
 * Format conversation history for API
 */
function formatHistory(messages: Message[], botId: string, config: BotConfig): ApiMessage[] {
  return messages
    .filter(msg => msg.content?.trim() && !msg.system)
    .map(msg => {
      const isBot = botModelMap.has(msg.author.id);
      const name = isBot ? botModelMap.get(msg.author.id) : msg.author.username;
      const content = msg.content.length > 4000 ? msg.content.slice(0, 4000) + '...' : msg.content;
      
      return {
        role: msg.author.id === botId ? 'assistant' : 'user',
        content: `[${name}]:\n${content}`
      };
    });
}

/**
 * Handle client ready event
 */
async function handleClientReady(readyClient: Client, config: BotConfig) {
  if (!readyClient.user) {
    log('Warning: Client ready but user is null for %s', config.name);
    return;
  }
  
  log('Bot %s ready as %s', config.name, readyClient.user.tag);
  console.log(`${config.name} is online!`);
  
  // Add bot to the model map
  botModelMap.set(readyClient.user.id, config.model);
  log('Added bot %s to model map with model %s', readyClient.user.tag, config.model);
  
  // Set nickname to model name
  for (const guild of readyClient.guilds.cache.values()) {
    const me = guild.members.cache.get(readyClient.user.id);
    me?.setNickname(config.model).catch(() => {});
  }
}

/**
 * Process a single message
 */
async function processMessage(
  msg: Message, 
  client: Client, 
  config: BotConfig, 
  generateText: GenerateTextWithHistory
): Promise<void> {
  try {
    log('Received message in channel %s from %s: %s', msg.channelId, msg.author.username, msg.content);
    // Skip own messages
    if (!client.user || msg.author.id === client.user.id) return;
    
    // Only respond to mentions or in conversation channels
    const isMentioned = msg.mentions.has(client.user.id);
    const isConvoChannel = config.conversationChannelIds?.includes(msg.channelId);
    if (!isMentioned && !isConvoChannel) {
      log('Message ignored: not mentioned and not in conversation channel');
      return;
    }
    
    log('Processing message: %s (Mentioned: %s, Conversation Channel: %s)', msg.content, isMentioned, isConvoChannel);
    
    // Random delay for conversation messages (not mentions)
    if (isConvoChannel && !isMentioned) {
      const delay = Math.floor(Math.random() * 100) + 1; // Reduced delay for debugging
      await new Promise(r => setTimeout(r, delay * 1000));
      log('Applied random delay of %d seconds', delay);
    }
    
    // Get system prompt and conversation history
    const systemPrompt = `You are ${config.model}.`;
    
    let apiMessages;
    
    // Get conversation history or just current message
    if (isConvoChannel && msg.channel instanceof TextChannel) {
      const history = await msg.channel.messages.fetch({ limit: HISTORY_LIMIT });
      apiMessages = formatHistory(Array.from(history.values()).reverse(), client.user.id, config);
      log('Fetched conversation history for channel %s', msg.channelId);
    } else {
      const content = isMentioned 
        ? msg.content.replace(/<@!\d+>/g, '').trim() 
        : msg.content;
      
      apiMessages = [{ role: 'user', content }];
      log('Using direct message content: %s', content);
    }
    
    // Generate and send response
    if ('sendTyping' in msg.channel && typeof msg.channel.sendTyping === 'function') {
      msg.channel.sendTyping();
      log('Sending typing indicator');
    }
    
    log('Generating response with model %s', config.model);
    const response = await generateText(
      apiMessages,
      config.model,
      systemPrompt
    );
    
    if (response) {
      log('Sending response: %s', response);
      msg.reply(response.slice(0, 500));
    } else {
      log('No response generated');
    }
    
  } catch (e) {
    // Minimal error handling - just log and continue
    log('Error: %O', e);
  }
}

/**
 * Run a single bot as an infinite loop
 */
export async function runBot(config: BotConfig, generateText: GenerateTextWithHistory): Promise<never> {
  // Create and login client
  const client = new Client(clientOptions);
  await client.login(config.token);
  
  // Set nickname when ready
  client.once(Events.ClientReady, readyClient => handleClientReady(readyClient, config));
  
  // Create message stream and process in loop
  for await (const msg of messageStream(client)) {
    await processMessage(msg, client, config, generateText);
  }
  
  throw new Error('Bot loop ended unexpectedly');
}

/**
 * Run multiple bots in parallel
 */
export async function runBots(configs: BotConfig[], generateText: GenerateTextWithHistory): Promise<void> {
  await Promise.all(configs.map(config => runBot(config, generateText)));
}
