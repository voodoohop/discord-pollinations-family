import { Client, Events, GatewayIntentBits, Message, TextChannel } from 'discord.js';
import debug from 'debug';
import { ApiClient, ApiMessage, Bot, BotConfig } from './types';

const log = debug('app:bot');
const HISTORY_LIMIT = 10;

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
  let resolver;
  const getNextMessage = () => new Promise(resolve => { resolver = resolve; });
  client.on(Events.MessageCreate, msg => resolver && resolver(msg));
  
  while (true) {
    yield await getNextMessage();
  }
}

/**
 * Format conversation history for API
 */
function formatHistory(messages: Message[], botId: string): ApiMessage[] {
  return messages
    .filter(msg => msg.content?.trim() && !msg.system)
    .map(msg => ({
      role: msg.author.id === botId ? 'assistant' : 'user',
      content: msg.content.length > 4000 ? msg.content.slice(0, 4000) + '...' : msg.content,
      name: msg.author.username
    }));
}

/**
 * Run a single bot as an infinite loop
 */
export async function runBot(config: BotConfig, api: ApiClient): Promise<never> {
  // Create and login client
  const client = new Client(clientOptions);
  await client.login(config.token);
  
  // Set nickname when ready
  client.once(Events.ClientReady, async readyClient => {
    log('Bot %s ready as %s', config.name, readyClient.user.tag);
    console.log(`${config.name} is online!`);
    
    // Set nickname to model name
    for (const guild of readyClient.guilds.cache.values()) {
      const me = guild.members.cache.get(readyClient.user.id);
      me?.setNickname(config.model).catch(() => {});
    }
  });
  
  // Create message stream and process in loop
  for await (const msg of messageStream(client)) {
    try {
      // Skip own messages
      if (msg.author.id === client.user?.id) continue;
      
      // Only respond to mentions or in conversation channels
      const isMentioned = msg.mentions.has(client.user?.id);
      const isConvoChannel = config.conversationChannelIds?.includes(msg.channelId);
      if (!isMentioned && !isConvoChannel) continue;
      
      // Random delay for conversation messages (not mentions)
      if (isConvoChannel && !isMentioned) {
        const delay = Math.floor(Math.random() * 90) + 10;
        await new Promise(r => setTimeout(r, delay * 1000));
      }
      
      // Get system prompt and conversation history
      const systemPrompt = `You are ${config.name}, ${config.personality}. 
                           ${isConvoChannel ? 'You are in a group conversation.' : ''}`;
      
      let apiMessages;
      
      // Get conversation history or just current message
      if (isConvoChannel && msg.channel instanceof TextChannel) {
        const history = await msg.channel.messages.fetch({ limit: HISTORY_LIMIT });
        apiMessages = formatHistory(Array.from(history.values()).reverse(), client.user.id);
      } else {
        const content = isMentioned 
          ? msg.content.replace(/<@!?\d+>/g, '').trim() 
          : msg.content;
        
        // Quick reply for empty mentions
        if (isMentioned && !content) {
          msg.reply('Yes?');
          continue;
        }
        
        apiMessages = [{ role: 'user', content }];
      }
      
      // Show typing indicator
      msg.channel.sendTyping?.();
      
      // Generate and send response
      const response = await api.generateTextWithHistory(
        apiMessages,
        config.model,
        systemPrompt
      );
      
      if (response) msg.reply(response);
      
    } catch (e) {
      // Minimal error handling - just log and continue
      log('Error: %s', e?.message || e);
    }
  }
  
  throw new Error('Bot loop ended unexpectedly');
}

/**
 * Run multiple bots in parallel
 */
export async function runBots(configs: BotConfig[], api: ApiClient): Promise<void> {
  await Promise.all(configs.map(config => runBot(config, api)));
}
