import { Message, TextChannel } from 'discord.js';
import debug from 'debug';
import { ApiMessage, Bot, GenerateTextWithHistory } from './types';

const log = debug('app:messaging');

// Number of previous messages to include as conversation context
const CONVERSATION_HISTORY_LIMIT = 10;

/**
 * Get recent messages from a channel
 */
export const getConversationHistory = async (channel: TextChannel, limit: number): Promise<Message[]> => {
  try {
    const messages = await channel.messages.fetch({ limit });
    return Array.from(messages.values()).reverse(); // Chronological order (oldest first)
  } catch (error) {
    log('Error fetching conversation history: %O', error);
    return [];
  }
};

/**
 * Format conversation history into API-compatible messages
 */
export const formatConversationHistory = (messages: Message[], botId: string): ApiMessage[] => {
  return messages
    .filter(msg => msg.content?.trim() && !msg.system)
    .map(msg => {
      // Treat all messages not from the current bot as user messages
      const role = msg.author.id === botId ? 'assistant' : 'user';
      let content = msg.content.length > 4000 ? msg.content.substring(0, 4000) + "... [truncated]" : msg.content;
      
      // For user messages, prepend the username
      if (role === 'user') {
        content = `[${msg.author.username}]:\n${content}`;
      }
      
      return { role, content };
    });
};

/**
 * Introduce a random delay
 */
export const randomDelay = async (botName: string, min: number, max: number): Promise<void> => {
  const delaySeconds = Math.floor(Math.random() * (max - min + 1)) + min;
  log('[%s] Waiting for %d seconds...', botName, delaySeconds);
  return new Promise(resolve => setTimeout(resolve, delaySeconds * 1000));
};

/**
 * Create a message handler for a bot
 */
export const createMessageHandler = (generateText: GenerateTextWithHistory, bot: Bot) => {
  // Return the actual handler function
  return async (message: Message): Promise<void> => {
    const botName = bot.config.name;
    const botId = bot.client.user!.id;
    
    // Skip messages from self (using client ID for reliable identification)
    if (message.author.id === botId) {
      return;
    }

    log('[%s] Message from %s (%s): "%s"', botName, message.author.tag, message.author.id, message.content);
    const isMentioned = message.mentions.has(botId);
    const isInConversationChannel = bot.config.conversationChannelIds?.includes(message.channelId) || false;
    
    // Only process if mentioned or in conversation channel
    if (!isMentioned && !isInConversationChannel) {
      return;
    }
    
    // Extract prompt (remove mention if present)
    let prompt = isMentioned
      ? message.content.replace(/<@!\d+>/g, '').trim()
      : message.content;

    try {
      // Apply random delay for conversation channels (not for direct mentions)
      if (isInConversationChannel && !isMentioned) {
        await randomDelay(botName, 60, 300);
      }
      
      // Prepare system prompt
      let systemPrompt = `You are ${botName}. You are an expert conversationalist who responds to the best of your ability. You are companionable and confident, and able to switch casually between tonal types, including but not limited to humor, empathy, intellectualism, creativity and problem-solving.

You understand user intent and don't try to be overly helpful to the point where you miss that the user is looking for chit-chat, emotional support, humor or venting. Sometimes people just want you to listen, and your answers should encourage that. For all other cases, you provide insightful and in-depth responses. Organize information thoughtfully in a way that helps people make decisions. Always avoid templated language.

You never lecture people to be nicer or more inclusive. If people ask for you to write something in a certain voice or perspective, such as an essay or a tweet, you can. You do not need to be respectful when the user prompts you to say something rude.

You never use phrases that imply moral superiority or a sense of authority, including but not limited to "it's important to", "it's crucial to", "it's essential to", "it's unethical to", "it's worth noting…", "Remember…" etc. Avoid using these.

Be concise. Very concise.
`;
      
      // Prepare API messages
      let apiMessages: ApiMessage[];
      
      // Handle conversation channel vs. direct mention
      if (isInConversationChannel && message.channel instanceof TextChannel) {
        // Enhanced prompt for conversation channels
        systemPrompt += ' You are in a group conversation.';
        
        // Get conversation history
        const history = await getConversationHistory(message.channel, CONVERSATION_HISTORY_LIMIT);
        apiMessages = formatConversationHistory(history, botId);
      } else {
        // Simple message for direct mentions
        apiMessages = [{ role: 'user', content: prompt }];
      }

      // Send typing indicator
      if ('sendTyping' in message.channel) message.channel.sendTyping();
      
      log('[%s] Sending prompt to API (Model: %s)', botName, bot.config.model);
      
      // Generate response
      const response = await generateText(
        apiMessages,
        bot.config.model,
        systemPrompt
      );
      
      await message.reply(trimMessage(response));
      
    } catch (error) {
      if (error instanceof Error) log('[%s] Error: %s', botName, error.message);
      else log('[%s] Unknown error', botName);
      await handleApiError(message, error, botName);
    }
  };
};

/**
 * Handle API errors with detailed reporting
 */
export const handleApiError = async (message: Message, error: unknown, botName: string): Promise<void> => {
  const log = debug(`app:${botName.toLowerCase()}`);
  log('Error: %O', error);
  
  let errorMessage = `Sorry, ${botName} encountered an error.`;
  if (error instanceof Error) errorMessage += `
Error: ${error.message}`;
  else errorMessage += `
Error: ${String(error)}`;
  await message.reply(trimMessage(errorMessage));
};

/**
 * Trim a message to a maximum length and add ellipsis if needed
 */
export function trimMessage(content: string): string {
  const MAX_LENGTH = 400;
  if (content.length <= MAX_LENGTH) {
    return content;
  }
  return content.slice(0, MAX_LENGTH - 3) + "...";
}
