import { Message, TextChannel } from 'discord.js';
import debug from 'debug';
import { ApiClient, ApiMessage, Bot } from './types';

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
    .filter(msg => {
      // Skip empty/system messages
      if (!msg.content?.trim() || msg.system) {
        return false;
      }
      return true;
    })
    .map(msg => {
      // Determine message role and truncate if needed
      const role = msg.author.id === botId ? 'assistant' : 'user';
      const content = msg.content.length > 4000 
        ? msg.content.substring(0, 4000) + "... [truncated]" 
        : msg.content;
      
      return { role, content, name: msg.author.username };
    });
};

/**
 * Apply a random delay
 */
export const randomDelay = async (botName: string, min: number, max: number): Promise<void> => {
  const delaySeconds = Math.floor(Math.random() * (max - min + 1)) + min;
  log('[%s] Waiting for %d seconds before responding...', botName, delaySeconds);
  return new Promise(resolve => setTimeout(resolve, delaySeconds * 1000));
};

/**
 * Create a message handler for a bot
 */
export const createMessageHandler = (api: ApiClient, bot: Bot) => {
  // Return the actual handler function
  return async (message: Message): Promise<void> => {
    const botName = bot.config.name;
    const botId = bot.client.user!.id;
    
    // Skip messages from self (using client ID for reliable identification)
    if (message.author.id === botId) {
      return;
    }

    log('[%s] Message from %s (%s): "%s"', 
        botName, 
        message.author.tag, 
        message.author.id,
        message.content);

    const isMentioned = message.mentions.has(botId);
    const isInConversationChannel = bot.config.conversationChannelIds?.includes(message.channelId) || false;
    
    // Only process if mentioned or in conversation channel
    if (!isMentioned && !isInConversationChannel) {
      return;
    }
    
    // Extract prompt (remove mention if present)
    let prompt = isMentioned
      ? message.content.replace(/<@!?\d+>/g, '').trim()
      : message.content;

    // Simple reply for empty mentioned messages
    if (!prompt && isMentioned) {
      await message.reply('Yes?');
      return;
    }
    
    try {
      // Apply random delay for conversation channels (not for direct mentions)
      if (isInConversationChannel && !isMentioned) {
        await randomDelay(botName, 10, 100);
      }

      // Prepare system prompt
      let systemPrompt = `You are ${botName}, ${bot.config.personality}. Keep responses concise and engaging.`;
      
      // Prepare API messages
      let apiMessages: ApiMessage[];
      
      // Handle conversation channel vs. direct mention
      if (isInConversationChannel && message.channel instanceof TextChannel) {
        // Enhanced prompt for conversation channels
        systemPrompt += ` You are in a group conversation with multiple bots and humans. 
          Read the conversation history and respond appropriately. Stay in character.`;
        
        // Get conversation history
        const history = await getConversationHistory(message.channel, CONVERSATION_HISTORY_LIMIT);
        apiMessages = formatConversationHistory(history, botId);
      } else {
        // Simple message for direct mentions
        apiMessages = [{ role: 'user', content: prompt }];
      }

      // Typing indicator
      if ('sendTyping' in message.channel && typeof message.channel.sendTyping === 'function') {
        message.channel.sendTyping();
      }

      // Generate response
      log('[%s] Sending prompt to API (Model: %s)', botName, bot.config.model);
      const response = await api.generateTextWithHistory(
        apiMessages,
        bot.config.model,
        systemPrompt
      );
      
      await message.reply(response);
      
    } catch (error) {
      // Log minimal error info to avoid huge object dumps
      if (error instanceof Error) {
        log('[%s] Error: %s', botName, error.message);
      } else {
        log('[%s] Unknown error type', botName);
      }
      
      await handleApiError(message, error, botName);
    }
  };
};

/**
 * Handle API errors with detailed reporting
 */
export const handleApiError = async (message: Message, error: unknown, botName: string): Promise<void> => {
  let errorMessage = `Sorry, ${botName} encountered an error trying to respond.\n\n`;
  
  if (error instanceof Error) {
    errorMessage += `\`\`\`\nError: ${error.message}\nStack: ${error.stack}\n\`\`\``;
  } else {
    try {
      errorMessage += `\`\`\`\n${JSON.stringify(error, null, 2)}\n\`\`\``;
    } catch {
      errorMessage += `Error: ${String(error)}`;
    }
  }
  
  // Truncate if too long
  if (errorMessage.length > 1900) {
    errorMessage = errorMessage.substring(0, 1900) + '...\n```';
  }
  
  await message.reply(errorMessage);
};
