import { Message } from 'discord.js';
import debug from 'debug';
import { ApiMessage, Bot, GenerateTextWithHistory } from './types';

const log = debug('app:messaging');

/**
 * Trim message content to fit Discord's limit
 */
export const trimMessage = (content: string, maxLength: number = 2000): string => {
  if (content.length <= maxLength) return content;
  
  // Try to find a good breaking point
  const breakPoint = content.lastIndexOf('.', maxLength - 3);
  if (breakPoint > maxLength * 0.75) {
    return content.substring(0, breakPoint + 1) + '...';
  }
  
  // Just truncate if no good breaking point
  return content.substring(0, maxLength - 3) + '...';
};

/**
 * Create a message handler for a bot
 */
export const createMessageHandler = (
  generateText: GenerateTextWithHistory,
  bot: Bot
) => {
  return async (msg: Message): Promise<void> => {
    try {
      // Skip own messages
      if (!bot.client.user || msg.author.id === bot.client.user.id) return;
      
      // Only respond to mentions or in conversation channels
      const isMentioned = msg.mentions.has(bot.client.user.id);
      const isConvoChannel = bot.config.conversationChannelIds?.includes(msg.channelId);
      if (!isMentioned && !isConvoChannel) {
        return;
      }
      
      log('Bot %s processing message: %s', bot.config.name, msg.content);
      
      // Format content
      const content = isMentioned 
        ? msg.content.replace(/<@!\d+>/g, '').trim() 
        : msg.content;
      
      // Quick reply for empty mentions
      if (isMentioned && !content) {
        msg.reply('Yes?');
        return;
      }
      
      // Send typing indicator
      if ('sendTyping' in msg.channel && typeof msg.channel.sendTyping === 'function') {
        msg.channel.sendTyping();
      }
      
      // Add a random delay for all messages (including mentions)
      const delay = Math.floor(Math.random() * 2) + 1; // 1-3 second delay
      await new Promise(r => setTimeout(r, delay * 1000));
      log('Applied random delay of %d seconds', delay);
      
      // Generate response
      const systemPrompt = `You are ${bot.config.name}.`;
      const apiMessage: ApiMessage = { role: 'user', content };
      
      const response = await generateText(
        [apiMessage],
        bot.config.model,
        systemPrompt
      );
      
      // Send response if generated
      if (response) {
        const trimmedResponse = trimMessage(response);
        msg.reply(trimmedResponse);
      }
      
    } catch (error) {
      log('Error handling message: %O', error);
    }
  };
};
