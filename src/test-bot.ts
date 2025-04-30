import { Client } from 'discord.js';
import dotenv from 'dotenv';
import { clientOptions } from './config';

// Load environment variables
dotenv.config();

/**
 * Simple script to test if a Discord bot token is valid and can connect
 * Following the "thin proxy" design principle with minimal complexity
 */
async function testBot() {
  const token = process.env.BOT_TOKEN_1;
  
  if (!token) {
    console.error('No bot token found. Please set BOT_TOKEN_1 in your .env file.');
    process.exit(1);
  }
  
  const client = new Client(clientOptions);
  
  client.on('ready', () => {
    console.log(`✅ Bot successfully connected as ${client.user?.tag}`);
    console.log('Bot is in the following servers:');
    
    client.guilds.cache.forEach(guild => {
      console.log(`- ${guild.name} (${guild.id})`);
    });
    
    console.log('\nBot test successful! You can now run the full application with:');
    console.log('npm start');
    
    // Disconnect after successful test
    client.destroy();
    process.exit(0);
  });
  
  client.on('error', (error) => {
    console.error('❌ Error connecting to Discord:', error);
    
    if (error.message?.includes('disallowed intents')) {
      console.error('\n🔑 PERMISSION ERROR: You need to enable the required intents in the Discord Developer Portal:');
      console.error('1. Go to https://discord.com/developers/applications');
      console.error('2. Select your bot application');
      console.error('3. Go to the "Bot" section');
      console.error('4. Scroll down to "Privileged Gateway Intents"');
      console.error('5. Enable all three intents (Presence, Server Members, and Message Content)');
      console.error('6. Click "Save Changes" at the bottom');
      console.error('7. Try running this test again');
    }
    
    process.exit(1);
  });
  
  try {
    console.log('Attempting to connect to Discord...');
    await client.login(token);
  } catch (error) {
    console.error('❌ Failed to login:', error);
    process.exit(1);
  }
}

// Run the test
testBot();
