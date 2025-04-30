import { Client, Events, GatewayIntentBits, Message } from 'discord.js';
import { BotConfig, clientOptions, pollinationsConfig } from './config';
import { PollinationsApiService } from './services/pollinationsApi';
import debug from 'debug';

const log = debug('app:bot');

/**
 * Manager for handling multiple Discord bot instances
 * Following the "thin proxy" design principle with minimal complexity
 */
export class BotManager {
  private bots: Map<string, Client> = new Map();
  private apiService: PollinationsApiService;

  constructor() {
    this.apiService = new PollinationsApiService();
    log('BotManager initialized');
  }

  /**
   * Initialize and start all configured bots
   * @param botConfigs Array of bot configurations
   */
  async startBots(botConfigs: BotConfig[]): Promise<void> {
    if (botConfigs.length === 0) {
      log('Warning: No bot configurations found. No bots will be started.');
      return;
    }
    log(`Attempting to start ${botConfigs.length} bot(s)...`);

    const promises = botConfigs.map(async (config) => {
      const client = new Client(clientOptions);

      // Set up basic message handling
      client.once(Events.ClientReady, readyClient => {
        log(`Bot ${config.name} is ready as ${readyClient.user.tag}`);
        console.log(`Bot ${config.name} is online!`); // Keep console log for user visibility
      });

      client.on(Events.MessageCreate, async (message) => {
        await this.handleMessage(message, client, config);
      });

      try {
        log(`Logging in bot: ${config.name}`);
        await client.login(config.token);
        this.bots.set(config.name, client);
        log(`Bot ${config.name} logged in successfully.`);
      } catch (error) {
        log(`Error logging in bot ${config.name}: %O`, error);
        // Optionally remove the bot from the map if login fails
        // this.bots.delete(config.name);
      }
    });

    await Promise.all(promises);
    log(`${this.bots.size} of ${botConfigs.length} bot(s) started successfully.`);

    if (this.bots.size === 0 && botConfigs.length > 0) {
      log('Error: No bots could be started. Please check tokens and configurations.');
      throw new Error('No bots could be started.');
    }
  }

  /**
   * Handles incoming messages for a specific bot
   * @param message The received message object
   * @param client The Discord client instance for the bot
   * @param config The configuration for the bot
   */
  private async handleMessage(message: Message, client: Client, config: BotConfig): Promise<void> {
    if (message.author.bot) return; // Ignore messages from bots

    log(`Received message in channel ${message.channelId} from ${message.author.tag}: "${message.content}"`);

    // Check if the bot is mentioned or if it's a direct message
    const isMentioned = message.mentions.has(client.user!.id);
    // TODO: Add DM channel handling if needed

    if (isMentioned) {
      log(`Bot ${config.name} was mentioned by ${message.author.tag}`);
      // Extract the message content without the mention
      const contentWithoutMention = message.content.replace(/<@!?\d+>/, '').trim();
      log(`Content after removing mention: "${contentWithoutMention}"`);

      if (!contentWithoutMention) {
        log('Mention received but no content after mention.');
        message.reply('Yes?'); // Simple reply if mentioned without a prompt
        return;
      }

      try {
        log(`Sending prompt to Pollinations API for bot ${config.name} (Model: ${config.model}): "${contentWithoutMention}"`);
        // Check if channel supports sendTyping before calling it
        if ('sendTyping' in message.channel && typeof message.channel.sendTyping === 'function') {
          message.channel.sendTyping(); // Indicate the bot is 'thinking'
        } else {
          log(`Channel ${message.channelId} does not support sendTyping.`);
        }
        const response = await this.apiService.generateText(
          contentWithoutMention,
          config.model,
          `You are ${config.name}, ${config.personality}. Keep responses concise and engaging.`,
        );
        log(`Received response from Pollinations API for bot ${config.name}: "${response}"`);
        message.reply(response);
      } catch (error) {
        log(`Error processing message for bot ${config.name}: %O`, error);
        message.reply('Sorry, I encountered an error trying to respond.');
      }
    }
  }

  /**
   * Shutdown all bot instances
   */
  async shutdownBots(): Promise<void> {
    log(`Shutting down ${this.bots.size} bot(s)...`);
    for (const [name, client] of this.bots.entries()) {
      try {
        log(`Destroying client for bot: ${name}`);
        client.destroy();
        log(`Bot ${name} has been shut down.`);
        this.bots.delete(name);
      } catch (error) {
        log(`Error shutting down bot with name: ${name}: %O`, error);
      }
    }
    log('All managed bot clients destroyed.');
  }
}
