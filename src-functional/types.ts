import { Client, Message, TextChannel } from 'discord.js';

/**
 * Bot configuration type
 */
export type BotConfig = {
  name: string;
  token: string;
  model: string;
  personality: string;
  conversationChannelIds?: string[];
};

/**
 * Bot type - represents a Discord bot with its configuration
 */
export type Bot = {
  client: Client;
  config: BotConfig;
};

/**
 * Registry of active bots
 */
export type BotRegistry = {
  [name: string]: Bot;
};

/**
 * API Message format for the Pollinations API
 */
export type ApiMessage = {
  role: string;
  content: string;
  name?: string;
};

/**
 * API Client type
 */
export type ApiClient = {
  generateText: (prompt: string, model: string, systemPrompt?: string) => Promise<string>;
  generateTextWithHistory: (messages: ApiMessage[], model: string, systemPrompt?: string) => Promise<string>;
};
