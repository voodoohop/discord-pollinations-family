/**
 * Constants for the Discord LLM Family application
 */

/**
 * Discord bot permissions integer: 247872
 * 
 * This permissions integer includes:
 * - Read Messages/View Channels
 * - Send Messages
 * - Embed Links
 * - Attach Files
 * - Read Message History
 * - Mention Everyone
 * - Add Reactions
 * 
 * Used when generating invite links for bots
 */
export const BOT_PERMISSIONS = 247872;

/**
 * Generate a Discord bot invite URL
 * @param clientId The client ID of the bot
 * @returns A URL that can be used to invite the bot to a server
 */
export function generateBotInviteUrl(clientId: string): string {
  return `https://discord.com/api/oauth2/authorize?client_id=${clientId}&permissions=${BOT_PERMISSIONS}&scope=bot`;
}
