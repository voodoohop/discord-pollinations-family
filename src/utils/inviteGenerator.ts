import { BOT_PERMISSIONS } from '../constants';

/**
 * Utility to generate Discord bot invite links
 * Following the "thin proxy" design principle with minimal complexity
 */

/**
 * Generate an invite URL for a Discord bot
 * @param clientId The client ID of the bot (from Discord Developer Portal)
 * @returns A URL that can be used to invite the bot to a server
 */
export function generateBotInviteUrl(clientId: string): string {
  return `https://discord.com/api/oauth2/authorize?client_id=${clientId}&permissions=${BOT_PERMISSIONS}&scope=bot`;
}

/**
 * Print invite instructions for a bot
 * @param botName The name of the bot
 * @param clientId The client ID of the bot
 */
export function printInviteInstructions(botName: string, clientId: string): void {
  const inviteUrl = generateBotInviteUrl(clientId);
  console.log(`\n=== Invite Link for ${botName} ===`);
  console.log(`To invite ${botName} to your server, use this URL:`);
  console.log(inviteUrl);
  console.log('=================================\n');
}
