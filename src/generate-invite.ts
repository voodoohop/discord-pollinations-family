import dotenv from 'dotenv';
import { printInviteInstructions } from './utils/inviteGenerator';

// Load environment variables
dotenv.config();

/**
 * Simple script to generate invite links for Discord bots
 * Following the "thin proxy" design principle with minimal complexity
 */

let botIndex = 1;
let botsFound = false;

console.log('\n=== Invite Links for Discord Bots ===');

while (true) {
  const clientId = process.env[`BOT_CLIENT_ID_${botIndex}`];
  const botName = process.env[`BOT_NAME_${botIndex}`] || `Bot ${botIndex}`;

  if (!clientId) {
    // Stop when no more client IDs are found
    break;
  }

  botsFound = true;
  console.log(`\n--- ${botName} ---`);
  printInviteInstructions(botName, clientId); // Correct order: name first, then ID

  botIndex++;
}

if (!botsFound) {
  console.error('\nError: No bot client IDs found in environment variables (e.g., BOT_CLIENT_ID_1).');
  console.error('Please set the client IDs in your .env file.');
  process.exit(1);
}

console.log('\n===================================');
