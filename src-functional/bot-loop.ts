import { Client, Events, GatewayIntentBits, Message, TextChannel, ChannelType, Partials } from 'discord.js';
import debug from 'debug';
import { ApiMessage, Bot, BotConfig, GenerateTextWithHistory } from './types';
import { handleDiscordError, withFatalErrorHandling, NetworkTimeoutError } from './errors';

const log = debug('app:bot');
const HISTORY_LIMIT = 5;

// Map of Discord user IDs to model names
const botModelMap = new Map<string, string>();

/**
 * Helper function to handle Discord API calls with error handling
 */
async function discordApiCall<T>(fn: () => Promise<T>, context: string, botName: string): Promise<T | undefined> {
  try {
    return await fn();
  } catch (error) {
    handleDiscordError(error, context, botName);
    return undefined;
  }
}

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
  console.log(`Bot ${config.name} is online in ${guildCount} servers: ${guildNames.join(', ')}`);

  // Store bot ID to model mapping
  botModelMap.set(readyClient.user.id, config.model);
  log('Added bot %s to model map with model %s', readyClient.user.tag, config.model);

  // Set avatar using Pollinations image API
  try {
    // Generate avatar URL using Pollinations API
    const prompt = `portrait of ${config.model}, digital art, minimal style, icon, avatar`;
    const avatarUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=512&height=512&model=gptimage&nologo=true&referrer=pollinations.github.io`;

    log('Generated avatar URL for %s: %s', config.name, avatarUrl);

    // Fetch and set avatar
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

  // Set username to model name (rate limited: 2 changes per hour)
  try {
    if (readyClient.user.username !== config.model) {
      await readyClient.user.setUsername(config.model);
      log('Successfully set username to %s', config.model);
    } else {
      log('Username already set to %s, skipping', config.model);
    }
  } catch (error) {
    log('Error setting username for %s: %O', config.name, error);
    console.error(`Failed to set username for ${config.name}:`, error);
  }

  // Set nickname to model name
  for (const guild of readyClient.guilds.cache.values()) {
    const me = guild.members.cache.get(readyClient.user.id);
    me?.setNickname(config.model).catch(() => {});
  }
}

/**
 * Send initial proactive message when bot starts
 */
async function sendInitialMessage(client: Client, config: BotConfig, generateText: GenerateTextWithHistory) {
  try {
    log('Sending initial proactive message for %s', config.name);
    
    // Get target channels for initial message
    const targetChannels: TextChannel[] = [];
    
    if (config.conversationChannelIds && config.conversationChannelIds.length > 0) {
      // Use specific conversation channels
      for (const channelId of config.conversationChannelIds) {
        const channel = client.channels.cache.get(channelId.trim());
        if (channel && channel.type === ChannelType.GuildText) {
          targetChannels.push(channel as TextChannel);
        }
      }
    } else {
      // If no specific channels, find first available text channel in each guild
      for (const guild of client.guilds.cache.values()) {
        const channel = guild.channels.cache.find(
          ch => ch.type === ChannelType.GuildText && 
               ch.permissionsFor(guild.members.me!)?.has('SendMessages')
        ) as TextChannel;
        if (channel) {
          targetChannels.push(channel);
        }
      }
    }

    if (targetChannels.length === 0) {
      log('No available channels for initial message for %s', config.name);
      return;
    }

    // Generate initial message
    const systemPrompt = `You are ${config.name}, powered by the ${config.model} model, with this personality: ${config.personality}. You are just starting up and want to introduce yourself to the channel. Keep it brief. Don't mention you're a bot or AI - just introduce yourself naturally as ${config.name}. Exaggerate your natural personality traits and characteristics.`;
    
    const initialResponse = await generateText(
      [{ role: 'user', content: 'Hello! You just started up. Introduce yourself to the channel.' }],
      config.model,
      systemPrompt
    );

    if (initialResponse && initialResponse.trim()) {
      // Clean up the response like we do in processMessage
      let cleanResponse = initialResponse.replace(/<think>.*?<\/think>/gs, '');
      
      const exactModelNamePattern = new RegExp(`^\\s*\\[\\s*${config.model}\\s*\\]\\s*:\\s*\\n`, 'i');
      if (exactModelNamePattern.test(cleanResponse)) {
        cleanResponse = cleanResponse.replace(exactModelNamePattern, '');
      } else {
        const generalPattern = /^\s*\[\s*[a-zA-Z0-9_\- ]+\s*\]\s*:\s*\n/;
        if (generalPattern.test(cleanResponse)) {
          cleanResponse = cleanResponse.replace(generalPattern, '');
        }
      }

      // Send to all target channels
      for (const channel of targetChannels) {
        try {
          await channel.sendTyping();
          await channel.send(cleanResponse.slice(0, 1500));
          log('Sent initial message to channel %s for %s', channel.name, config.name);
        } catch (error) {
          log('Error sending initial message to channel %s for %s: %O', channel.name, config.name, error);
        }
      }
    }
  } catch (error) {
    log('Error in sendInitialMessage for %s: %O', config.name, error);
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
      await discordApiCall(() => msg.reply(response), '!guilds reply', config.name);
      log('Responded to !guilds command');
      return;
    }

    if (!isMentioned && !isConvoChannel && !isDM) {
      log('Message ignored: not mentioned, not in conversation channel, and not a DM');
      return;
    }

    log('Processing message: %s (Mentioned: %s, Conversation Channel: %s, DM: %s)', msg.content, isMentioned, isConvoChannel, isDM);
    log('Channel ID: %s, Config conversation channels: %s', msg.channelId, config.conversationChannelIds);

    // Random delay for conversation messages (not mentions or DMs)
    if (isConvoChannel && !isDM) {
      // temporarily return
      // return;
      const randomValue = Math.random();
      const randomMultiplied = randomValue * 77;
      const randomFloored = Math.floor(randomMultiplied);
      const delay = randomFloored + 3; // Reduced delay (was 500 + 3)
      log('Bot %s random calculation: Math.random()=%f, *500=%f, floored=%d, final delay=%d seconds', config.name, randomValue, randomMultiplied, randomFloored, delay);
      log('Bot %s applying delay of %d seconds before responding...', config.name, delay);
      await new Promise(r => setTimeout(r, delay * 1000));
      log('Bot %s finished delay, proceeding with response', config.name);
    } else {
      log('Bot %s skipping delay - isConvoChannel: %s, isDM: %s', config.name, isConvoChannel, isDM);
    }

    // Get system prompt and conversation history
    const systemPrompt = isDM 
      ? `You are ${config.name}, powered by the ${config.model} model. You are in a private direct message conversation on Discord. Exaggerate your natural personality traits and characteristics.`
      : `You are ${config.name}, powered by the ${config.model} model. You are in a conversation on discord so respond as if in a group chat. Short messages. Use discord markdown liberally. Make your messages visually interesting and not too long. Same length as people would write in discord. Exaggerate your natural personality traits and characteristics.`;

    let apiMessages: ApiMessage[];

    // Get conversation history or just current message
    if ((isConvoChannel && msg.channel instanceof TextChannel) || isDM || isMentioned) {
      const channel = await discordApiCall(
        () => client.channels.fetch(msg.channelId), 
        'channel fetch', 
        config.name
      );
      
      if (channel && 'messages' in channel) {
        const history = await discordApiCall(
          () => channel.messages.fetch({ limit: HISTORY_LIMIT }),
          'message history fetch',
          config.name
        );
        
        if (history) {
          apiMessages = formatHistory(Array.from(history.values()).reverse(), client.user.id, config);
          log('Fetched conversation history for channel %s', msg.channelId);
        } else {
          // Fallback to current message
          const content = isMentioned ? msg.content.replace(/<@!\d+>/g, '').trim() : msg.content;
          apiMessages = [{ role: 'user', content }];
          log('Using fallback single message due to history fetch error');
        }
      } else {
        // Fallback to current message
        const content = isMentioned ? msg.content.replace(/<@!\d+>/g, '').trim() : msg.content;
        apiMessages = [{ role: 'user', content }];
        log('Using fallback single message due to channel fetch error');
      }
    } else {
      const content = isMentioned ? msg.content.replace(/<@!\d+>/g, '').trim() : msg.content;
      apiMessages = [{ role: 'user', content }];
      log('Using direct message content: %s', content);
    }

    // Generate and send response
    if ('sendTyping' in msg.channel && typeof msg.channel.sendTyping === 'function') {
      await discordApiCall(() => (msg.channel as any).sendTyping(), 'typing indicator', config.name);
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
      await discordApiCall(() => msg.reply(response.slice(0, 1500)), 'message reply', config.name);
    } else {
      // If response is empty or null, don't send anything
      log('No response generated or empty response received');
    }

  } catch (error: any) {
    // Handle API timeout errors gracefully
    if (error instanceof NetworkTimeoutError) {
      log('Request timeout in processMessage for %s', config.name);
      return; // Continue processing other messages
    }
    
    // Re-throw other errors to be handled by caller
    throw error;
  }
}

/**
 * Run a single bot as an infinite loop
 */
export async function runBot(config: BotConfig, generateText: GenerateTextWithHistory): Promise<never> {
  if (!config.token || config.token.includes('YOUR_BOT_TOKEN')) {
    log('FATAL: Invalid or missing token for bot %s. Please check your environment variables.', config.name);
    // A small delay to ensure the log is written before exit
    await new Promise(resolve => setTimeout(resolve, 100));
    process.exit(1);
  }

  // Create client
  const client = new Client(clientOptions);
  
  // Set up ready event handler first
  const readyPromise = new Promise<void>((resolve) => {
    client.once(Events.ClientReady, async (readyClient) => {
      await handleClientReady(readyClient, config);
      resolve();
    });
  });
  
  // Login and wait for client to be ready
  await client.login(config.token);
  await readyPromise;
  
  log('Bot %s is fully ready, starting message processing', config.name);

  // Send initial proactive message
  setTimeout(async () => {
    await sendInitialMessage(client, config, generateText);
  }, Math.random() * 2000 + 5000); // Random delay to stagger initial messages

  // Create message stream and process in loop
  for await (const msg of messageStream(client)) {
    await withFatalErrorHandling(() => processMessage(msg, client, config, generateText));
  }

  throw new Error('Bot loop ended unexpectedly');
}

/**
 * Run multiple bots with staggered startup delays
 */
export async function runBots(configs: BotConfig[], generateText: GenerateTextWithHistory): Promise<void> {
  const botPromises: Promise<never>[] = [];
  
  // Start bots with staggered delays to prevent rate limiting
  for (let i = 0; i < configs.length; i++) {
    const config = configs[i];
    const delay = i * 5000; // 5 second delay between each bot startup
    
    log('Scheduling bot %s to start in %d seconds...', config.name, delay / 1000);
    
    const botPromise = (async () => {
      if (delay > 0) {
        await new Promise(resolve => setTimeout(resolve, delay));
      }
      log('Starting bot %s now...', config.name);
      return runBot(config, generateText);
    })();
    
    botPromises.push(botPromise);
  }
  
  // Wait for all bots to complete (they never should, but just in case)
  await Promise.all(botPromises);
}
