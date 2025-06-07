import { Client, Events, GatewayIntentBits, Message, TextChannel, ChannelType, Partials } from 'discord.js';
import debug from 'debug';
import { ApiMessage, Bot, BotConfig, GenerateTextWithHistory } from './types';

const log = debug('app:bot');
const HISTORY_LIMIT = 5;

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
  partials: [Partials.Channel, Partials.Message], // Required for DM handling
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

  // Count the number of guilds the bot is in
  const guildCount = readyClient.guilds.cache.size;
  const guildNames = Array.from(readyClient.guilds.cache.values()).map(guild => guild.name);

  log('Bot %s ready as %s', config.name, readyClient.user.tag);
  console.log(`${config.name} is online in ${guildCount} servers: ${guildNames.join(', ')}`);

  // Add bot to the model map
  botModelMap.set(readyClient.user.id, config.model);
  log('Added bot %s to model map with model %s', readyClient.user.tag, config.model);

  // Set avatar using Pollinations image API
  try {
    // Generate avatar URL using Pollinations API
    const prompt = `Large Vibrant Pixel Art Icon for AI chatbot: "${config.model}"`;
    const encodedPrompt = encodeURIComponent(prompt);
    const avatarUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=512&height=512`;
    log('Generated avatar URL for %s: %s', config.name, avatarUrl);

    log('Setting avatar for %s', config.name);
    const response = await fetch(avatarUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch avatar image: ${response.status} ${response.statusText}`);
    }

    const buffer = await response.arrayBuffer();
    await readyClient.user.setAvatar(Buffer.from(buffer));
    log('Successfully set avatar for %s', config.name);
  } catch (error) {
    log('Error setting avatar for %s: %O', config.name, error);
    console.error(`Failed to set avatar for ${config.name}:`, error);
  }

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

    // Check if it's a DM
    const isDM = msg.channel.type === ChannelType.DM;
    
    // Only respond to mentions, in conversation channels, or DMs
    const isMentioned = msg.mentions.has(client.user.id);
    const isConvoChannel = config.conversationChannelIds?.includes(msg.channelId);

    // Check for !guilds command
    if (msg.content.trim().toLowerCase() === '!guilds' && client.user) {
      const guildCount = client.guilds.cache.size;
      const guildList = Array.from(client.guilds.cache.values())
        .map(guild => `${guild.name} (${guild.memberCount} members)`)
        .join('\n- ');

      const response = `I am in ${guildCount} servers:\n- ${guildList}`;
      msg.reply(response);
      log('Responded to !guilds command');
      return;
    }

    if (!isMentioned && !isConvoChannel && !isDM) {
      log('Message ignored: not mentioned, not in conversation channel, and not a DM');
      return;
    }

    log('Processing message: %s (Mentioned: %s, Conversation Channel: %s, DM: %s)', msg.content, isMentioned, isConvoChannel, isDM);

    // Random delay for conversation messages (not mentions or DMs)
    if (isConvoChannel && !isDM) {
      const delay = Math.floor(Math.random() * 500) + 3; // Tripled delay (was 100 + 1)
      await new Promise(r => setTimeout(r, delay * 1000));
      log('Applied random delay of %d seconds', delay);
    }

    // Get system prompt and conversation history
    const systemPrompt = isDM 
      ? `You are ${config.model}. You are in a private direct message conversation on Discord. Be helpful, friendly, and conversational.`
      : `You are ${config.model}. You are in a conversation on discord so respond as if in a group chat. Short messages. Use discord markdown liberally. Make your messages visually interesting and not too long. Same length as people would write in discord.`;

    let apiMessages: ApiMessage[];

    // Get conversation history or just current message
    if ((isConvoChannel && msg.channel instanceof TextChannel) || isDM) {
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
    let response = await generateText(
      apiMessages,
      config.model,
      systemPrompt
    );

    // Remove <think>...</think> tags from the AI response
    if (typeof response === 'string') {
      const responseBeforeStripping = response;
      response = response.replace(/<think>.*?<\/think>/gs, '');
      if (response.length < responseBeforeStripping.length) {
        log('Stripped <think> tags from response.');
      }
    }

    if (response && response.trim()) {
      // First, try to strip out the exact model name prefix
      const exactModelNamePattern = new RegExp(`^\\s*\\[\\s*${config.model}\\s*\\]\\s*:\\s*\\n`, 'i');
      if (exactModelNamePattern.test(response)) {
        response = response.replace(exactModelNamePattern, '');
        log('Stripped exact model name prefix from response');
      } else {
        // If exact match not found, try a more general pattern to match any [name]: format at the beginning
        const generalPattern = /^\s*\[\s*[a-zA-Z0-9_\- ]+\s*\]\s*:\s*\n/;
        if (generalPattern.test(response)) {
          response = response.replace(generalPattern, '');
          log('Stripped general name prefix from response');
        }
      }

      log('Sending response: %s', response);
      msg.reply(response.slice(0, 1500));
    } else {
      // If response is empty or null, don't send anything
      log('No response generated or empty response received');
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
