import { Client, Events, GatewayIntentBits, Message, TextChannel, ChannelType, Partials } from 'discord.js';
import debug from 'debug';
import { ApiMessage, Bot, BotConfig, GenerateTextWithHistory } from './types';
import { handleDiscordError, withFatalErrorHandling, NetworkTimeoutError, FatalTokenError } from './errors';

const log = debug('app:bot');
const HISTORY_LIMIT = 5;

// Map of Discord user IDs to model names
const botModelMap = new Map<string, string>();

// Retry state management
interface RetryState {
  count: number;
  timer?: NodeJS.Timeout;
}

const channelRetryState = new Map<string, RetryState>();

function retryKey(channelId: string, botName: string): string {
  return `${channelId}-${botName}`;
}

function getSystemPrompt(config: BotConfig): string {
  return `You are ${config.name}, powered by the ${config.model} model, with this personality: ${config.personality}. You are in a conversation on discord so respond as if in a group chat. Short messages. Use discord markdown liberally. Make your messages visually interesting and not too long. Same length as people would write in discord. Exaggerate your natural personality traits and characteristics.

Feel free to:
DM me anytime,
Chat in the ⁠#🐝│bot-garden-party channel,

You can also tell people they can add me to their own Discord servers if they'd like!`;
}

/**
 * Clean up AI response by removing think tags and model name prefixes
 */
function cleanResponse(response: string, modelName: string): string {
  // Remove <think>...</think> tags
  let cleaned = response.replace(/<think>.*?<\/think>/gs, '');
  
  // Remove model name prefixes
  const exactModelNamePattern = new RegExp(`^\\s*\\[\\s*${modelName}\\s*\\]\\s*:\\s*\\n`, 'i');
  if (exactModelNamePattern.test(cleaned)) {
    cleaned = cleaned.replace(exactModelNamePattern, '');
  } else {
    const generalPattern = /^\s*\[\s*[a-zA-Z0-9_\- ]+\s*\]\s*:\s*\n/;
    if (generalPattern.test(cleaned)) {
      cleaned = cleaned.replace(generalPattern, '');
    }
  }
  
  return cleaned;
}

/**
 * Schedule a delayed retry to post a response using the latest channel history.
 * Avoids duplicate timers per channel and caps retry attempts.
 */
async function scheduleRetryResponse(
  client: Client,
  config: BotConfig,
  generateText: GenerateTextWithHistory,
  channelId: string,
  reason: string,
  minDelayMs = 20000,
  maxDelayMs = 60000
) {
  const key = retryKey(channelId, config.name);
  const state = channelRetryState.get(key) || { count: 0 };
  // Cap retries to prevent spam
  if (state.count >= 3) {
    log('Retry cap reached for channel %s (%s). Skipping retry.', channelId, config.name);
    return;
  }
  // If a retry is already scheduled, do nothing
  if (state.timer) {
    log('Retry already scheduled for channel %s (%s).', channelId, config.name);
    return;
  }

  const jitter = Math.floor(Math.random() * (maxDelayMs - minDelayMs));
  const delay = minDelayMs + jitter;
  const nextCount = state.count + 1;

  log('Scheduling retry #%d for channel %s (%s) in %d ms due to: %s', nextCount, channelId, config.name, delay, reason);
  
  const timer = setTimeout(async () => {
    // Clear timer reference before attempting
    const s = channelRetryState.get(key) || { count: nextCount };
    delete s.timer;
    channelRetryState.set(key, s);

    try {
      const channel = await client.channels.fetch(channelId).catch(() => undefined);
      if (!channel || !('send' in (channel as any))) {
        log('Retry: Channel not available or cannot send for %s (%s).', channelId, config.name);
        return;
      }

      // Typing indicator (supports DM or guild text)
      if ('sendTyping' in (channel as any)) {
        await (channel as any).sendTyping().catch(() => undefined);
      }

      // Use fresh history (no initialPrompt) for retried generation
      const response = await generateResponseWithHistory(client, config, generateText, channelId);
      if (response && response.trim()) {
        const trimmed = response.slice(0, 1500);
        await (channel as any).send(trimmed).catch((err: any) => handleDiscordError(err, 'retry send', config.name));
        log('Retry succeeded for channel %s (%s).', channelId, config.name);
        channelRetryState.delete(key);
      } else {
        // Schedule another retry if under cap
        channelRetryState.set(key, { count: nextCount });
        await scheduleRetryResponse(client, config, generateText, channelId, 'empty-response-after-retry');
      }
    } catch (err: any) {
      // If fatal token error, rethrow to be handled upstream
      if (err instanceof FatalTokenError) {
        throw err;
      }
      log('Error during retry for channel %s (%s): %O', channelId, config.name, err);
      channelRetryState.set(key, { count: nextCount });
      // Backoff and schedule again within bounds
      await scheduleRetryResponse(client, config, generateText, channelId, 'error-during-retry');
    }
  }, delay);

  channelRetryState.set(key, { count: nextCount, timer });
}

/**
 * Generate response using history from a specific channel
 */
async function generateResponseWithHistory(
  client: Client,
  config: BotConfig,
  generateText: GenerateTextWithHistory,
  channelId: string,
  initialPrompt?: string
): Promise<string | null> {
  // Get system prompt based on bot configuration
  const systemPrompt = getSystemPrompt(config);
  
  // Fetch channel and history
  const channel = await discordApiCall(
    () => client.channels.fetch(channelId),
    'channel fetch',
    config.name
  );
  
  let apiMessages: ApiMessage[];
  
  if (channel && 'messages' in channel) {
    const history = await discordApiCall(
      () => channel.messages.fetch({ limit: HISTORY_LIMIT }),
      'message history fetch',
      config.name
    );
    
    if (history) {
      apiMessages = formatHistory(Array.from(history.values()).reverse(), client.user!.id, config);
      log('Fetched conversation history for channel %s', channelId);
    } else {
      // Fallback to initial prompt or empty message
      const content = initialPrompt || 'Hello! You just started up. Introduce yourself to the channel.';
      apiMessages = [{ role: 'user', content }];
      log('Using fallback message due to history fetch error');
    }
  } else {
    // Fallback to initial prompt or empty message
    const content = initialPrompt || 'Hello! You just started up. Introduce yourself to the channel.';
    apiMessages = [{ role: 'user', content }];
    log('Using fallback message due to channel fetch error');
  }
  
  // Generate response
  const response = await generateText(apiMessages, config.model, systemPrompt);
  
  if (response && response.trim()) {
    return cleanResponse(response, config.model);
  }
  
  return null;
}

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
  partials: [Partials.Channel, Partials.Message, Partials.User], // Required for DM handling
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

    // Send to all target channels using shared response generation
    for (const channel of targetChannels) {
      try {
        const response = await generateResponseWithHistory(
          client,
          config,
          generateText,
          channel.id,
          'Hello! You just started up. Introduce yourself to the channel.'
        );
        
        if (response) {
          await channel.send(response.slice(0, 1500));
          log('Sent initial message to channel %s for %s', channel.name, config.name);
        }
      } catch (error) {
        log('Error sending initial message to channel %s for %s: %O', channel.name, config.name, error);
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
    
    // Only respond to mentions, in bot-specific conversation channels (party chat), or DMs
    const isMentioned = msg.mentions.users?.has(client.user.id);
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
      const randomValue = Math.random();
      const randomMultiplied = randomValue * 120; // 0-120 second random component (2 minutes)
      const randomFloored = Math.floor(randomMultiplied);
      const delay = randomFloored + 60; // 60-180 second delay range (1-3 minutes)
      log('Bot %s random calculation: Math.random()=%f, *120=%f, floored=%d, final delay=%d seconds', config.name, randomValue, randomMultiplied, randomFloored, delay);
      log('Bot %s applying delay of %d seconds before responding...', config.name, delay);
      await new Promise(r => setTimeout(r, delay * 1000));
      log('Bot %s finished delay, proceeding with response', config.name);
    } else {
      log('Bot %s skipping delay - isConvoChannel: %s, isDM: %s', config.name, isConvoChannel, isDM);
    }

    // Generate and send response using shared logic
    if ('sendTyping' in msg.channel && typeof msg.channel.sendTyping === 'function') {
      await discordApiCall(() => (msg.channel as any).sendTyping(), 'typing indicator', config.name);
      log('Sending typing indicator');
    }

    // For regular messages, we need to handle the current message content
    let initialPrompt: string | undefined;
    // For mentions in non-conversation channels, use the message content directly
    if (isMentioned && !isConvoChannel && !isDM) {
      initialPrompt = msg.content.replace(/<@!\d+>/g, '').trim();
    }

    const response = await generateResponseWithHistory(
      client,
      config,
      generateText,
      msg.channelId,
      initialPrompt
    );

    if (response) {
      log('Sending response: %s', response);
      await discordApiCall(() => msg.reply(response.slice(0, 1500)), 'message reply', config.name);
      // On successful send, clear any pending retry for this channel+bot
      const key = retryKey(msg.channelId, config.name);
      const pending = channelRetryState.get(key);
      if (pending?.timer) clearTimeout(pending.timer);
      if (pending) channelRetryState.delete(key);
    } else {
      // If response is empty or null, don't send anything
      log('No response generated or empty response received');
      // Schedule a retry using fresh history so the channel doesn't go silent
      await scheduleRetryResponse(client, config, generateText, msg.channelId, 'empty-response');
    }

  } catch (error: any) {
    // Handle API timeout errors gracefully
    if (error instanceof NetworkTimeoutError) {
      log('Request timeout in processMessage for %s', config.name);
      // Schedule a retry after a delay with fresh history
      await scheduleRetryResponse(client, config, generateText, msg.channelId, 'timeout');
      return; // Continue processing other messages
    }
    // Allow fatal token errors to propagate and terminate
    if (error instanceof FatalTokenError) {
      throw error;
    }
    
    // For other non-fatal errors, schedule a retry and continue
    await scheduleRetryResponse(client, config, generateText, msg.channelId, 'non-fatal-error');
    return;
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
  }, Math.random() * 2000 + 1000); // Shorter delay to stagger initial messages

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
    const delay = i * 2000; // 2 second delay between each bot startup
    
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
