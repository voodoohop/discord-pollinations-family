import { Client, Events, GatewayIntentBits, Message, TextChannel, ChannelType, Partials } from 'discord.js';
import debug from 'debug';
import { ApiMessage, Bot, BotConfig, GenerateTextWithHistory } from './types';
import { handleDiscordError, withFatalErrorHandling, NetworkTimeoutError, FatalTokenError } from './errors';

const log = debug('app:bot');
const HISTORY_LIMIT = 5;

function getSystemPrompt(config: BotConfig): string {
  return `You are ${config.name}, powered by the ${config.model} model, with this personality: ${config.personality}. You are in a conversation on discord so respond as if in a group chat. Short messages. Use discord markdown liberally. Make your messages visually interesting and not too long. Same length as people would write in discord. Exaggerate your natural personality traits and characteristics.

Feel free to:
DM me anytime,
Chat in the ⁠#🐝│bot-garden-party channel,

You can also tell people they can add me to their own Discord servers! Available commands:
\`!invite\` - Get my invitation link
\`!permissions\` - See what permissions I need
\`!guilds\` - See which servers I'm in`;
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
      // Use the current bot's model name if it's this bot, otherwise use username
      const name = msg.author.id === botId ? config.model : msg.author.username;
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

  // Set avatar using Pollinations image API (commented out to avoid rate limit errors)
  // TODO: Reactivate avatar setting later when needed
  /*
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
  */

  // Set username to model name (rate limited: 2 changes per hour)
  // Remove dashes from model name for Discord username compatibility
  const discordUsername = config.model.replace(/-/g, '');
  try {
    if (readyClient.user.username !== discordUsername) {
      await readyClient.user.setUsername(discordUsername);
      log('Successfully set username to %s (from model: %s)', discordUsername, config.model);
    } else {
      log('Username already set to %s, skipping', discordUsername);
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
    log('Checking if initial proactive message should be sent for %s', config.name);
    
    // Get target channels for initial message
    const targetChannels: TextChannel[] = [];
    
    // Only send initial messages if conversation channels are explicitly configured
    if (!config.conversationChannelIds || config.conversationChannelIds.length === 0) {
      log('No conversation channels configured for %s - skipping initial proactive message', config.name);
      return;
    }

    // Use specific conversation channels
    log('Using configured conversation channels for initial message for %s', config.name);
    for (const channelId of config.conversationChannelIds) {
      const channel = client.channels.cache.get(channelId.trim());
      if (channel && channel.type === ChannelType.GuildText) {
        targetChannels.push(channel as TextChannel);
      }
    }

    if (targetChannels.length === 0) {
      log('No available channels found from configured IDs for %s', config.name);
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

    // Check for !invite command
    if (msg.content.trim().toLowerCase() === '!invite' && client.user) {
      // Include both bot and applications.commands scopes for modern Discord bot requirements
      const inviteUrl = `https://discord.com/api/oauth2/authorize?client_id=${client.user.id}&permissions=274877908032&scope=bot%20applications.commands`;
      const response = `🤖 **Invite me to your server!**\n\n[Click here to add ${config.name} to your Discord server](${inviteUrl})\n\n✨ I'll bring my ${config.model} AI powers to help your community!\n\n**What I can do:**\n• Respond to mentions and DMs instantly\n• Chat in conversation channels\n• Support future slash commands\n• Bring AI-powered conversations to your server\n\n*Requires "Manage Server" permission to add me.*`;
      await discordApiCall(() => msg.reply(response), '!invite reply', config.name);
      log('Responded to !invite command');
      return;
    }

    // Check for !permissions command
    if (msg.content.trim().toLowerCase() === '!permissions' && client.user) {
      const response = `🔐 **Bot Permissions Explained**\n\n**Required Permissions (274877908032):**\n• **Send Messages** - To respond to you\n• **Read Message History** - For conversation context\n• **Use Slash Commands** - Future slash command support\n• **Add Reactions** - Interactive responses\n• **Embed Links** - Rich message formatting\n• **Attach Files** - Share images/files\n\n**OAuth2 Scopes:**\n• **bot** - Basic bot functionality\n• **applications.commands** - Slash command support\n\n*These permissions ensure I work properly while keeping your server secure!*`;
      await discordApiCall(() => msg.reply(response), '!permissions reply', config.name);
      log('Responded to !permissions command');
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
    } else {
      // If response is empty or null, don't send anything
      log('No response generated or empty response received');
    }

  } catch (error: any) {
    // Allow fatal token errors to propagate and terminate
    if (error instanceof FatalTokenError) {
      throw error;
    }
    
    // Log other errors but continue processing
    log('Error in processMessage for %s: %O', config.name, error);
    handleDiscordError(error, 'processMessage', config.name);
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

