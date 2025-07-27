#!/usr/bin/env python3
"""
Simple Discord Bot with Fast Agent
Minimal implementation with one personality and hard-coded model
"""

import asyncio
import os
import logging
from typing import List, Dict
import discord
from discord.ext import commands
from dotenv import load_dotenv
import aiohttp
from bot_profile import BotProfileManager

# Load environment variables
load_dotenv()

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class SimpleDiscordBot(commands.Bot):
    """Minimal Discord bot with single AI personality"""
    
    def __init__(self):
        # Simple Discord bot setup
        intents = discord.Intents.default()
        intents.message_content = True
        
        super().__init__(command_prefix='!', intents=intents)
        
        # Hard-coded configuration
        self.model = "deepseek-reasoning"
        self.personality = "You are a helpful AI assistant. Be friendly and concise."
        self.api_base = "https://text.pollinations.ai/openai"
        self.api_token = os.getenv('TEXT_POLLINATIONS_TOKEN')
        
        # Conversation channels
        channels_str = os.getenv('CONVERSATION_CHANNELS', '')
        self.conversation_channels = [int(ch.strip()) for ch in channels_str.split(',') if ch.strip().isdigit()]
        
        # Configuration for conversation history
        self.history_limit = 5  # Number of recent messages to fetch from Discord
        
        logger.info(f"Bot initialized with model: {self.model}")
        logger.info(f"Conversation channels: {self.conversation_channels}")
    
    async def generate_response(self, messages: List[Dict]) -> str:
        """Generate AI response using Pollinations API"""
        url = f"{self.api_base}/chat/completions"
        
        # Add system prompt
        api_messages = [{"role": "system", "content": self.personality}]
        api_messages.extend(messages)
        
        payload = {
            "model": self.model,
            "messages": api_messages
        }
        
        headers = {
            "Content-Type": "application/json",
            "Referer": "roblox"
        }
        
        if self.api_token:
            headers["Authorization"] = f"Bearer {self.api_token}"
        
        # Log the request details
        logger.info(f"Making API request to: {url}")
        logger.info(f"Model: {self.model}")
        logger.info(f"Messages count: {len(api_messages)}")
        logger.info(f"Has auth token: {bool(self.api_token)}")
        
        try:
            async with aiohttp.ClientSession() as session:
                async with session.post(url, json=payload, headers=headers, timeout=50) as response:
                    logger.info(f"API response status: {response.status}")
                    
                    if response.status == 200:
                        data = await response.json()
                        logger.info(f"API response received successfully")
                        return data["choices"][0]["message"]["content"]
                    else:
                        response_text = await response.text()
                        logger.error(f"API error {response.status}: {response_text}")
                        return "Sorry, I'm having trouble right now."
        except asyncio.TimeoutError:
            logger.error("API request timed out after 50s")
            return "Sorry, my response timed out. Please try again."
        except Exception as e:
            logger.error(f"API error: {type(e).__name__}: {e}")
            return "Sorry, I encountered an error."
    
    async def get_conversation_history(self, channel) -> List[Dict]:
        """Fetch recent conversation history from Discord API (stateless)"""
        messages = []
        try:
            # Fetch recent messages from Discord API
            async for message in channel.history(limit=self.history_limit):
                # Skip system messages and commands
                if message.author.bot and message.author != self.user:
                    continue
                if message.content.startswith('!'):
                    continue
                    
                # Add message to history
                if message.author == self.user:
                    messages.append({"role": "assistant", "content": message.content})
                else:
                    messages.append({"role": "user", "content": message.content})
            
            # Return in chronological order (oldest first)
            return list(reversed(messages))
        except Exception as e:
            logger.error(f"Error fetching conversation history: {e}")
            return []
    
    async def on_ready(self):
        """Called when bot is ready"""
        try:
            logger.info(f'{self.user} has connected to Discord!')
            
            # Send startup message to conversation channels
            for channel_id in self.conversation_channels:
                try:
                    channel = self.get_channel(channel_id)
                    if channel:
                        logger.info(f"Sending startup message to channel {channel_id}")
                        await channel.send("🤖 Bot is online!")
                        logger.info(f"Startup message sent successfully to {channel_id}")
                    else:
                        logger.warning(f"Could not find channel {channel_id}")
                except Exception as e:
                    logger.error(f"Failed to send startup message to {channel_id}: {e}")
            
            # Set bot profile (username and avatar) based on model
            logger.info("Setting bot profile (username and avatar)...")
            await BotProfileManager.set_bot_profile(self, self.model)
            
            logger.info("Bot is fully ready and operational!")
        except Exception as e:
            logger.error(f"Error in on_ready: {e}")
    
    async def on_message(self, message):
        """Handle incoming messages"""
        logger.info(f"Received message from {message.author}: '{message.content}' in channel {message.channel.id}")
        
        # Ignore bot's own messages
        if message.author == self.user:
            logger.info("Ignoring bot's own message")
            return
        
        # Process commands first
        await self.process_commands(message)
        
        # Handle conversation in designated channels or DMs
        logger.info(f"Checking if channel {message.channel.id} is in conversation channels: {self.conversation_channels}")
        logger.info(f"Is DM channel: {isinstance(message.channel, discord.DMChannel)}")
        
        if (message.channel.id in self.conversation_channels or 
            isinstance(message.channel, discord.DMChannel)):
            
            logger.info("Processing message in conversation channel")
            
            # Show typing indicator
            logger.info("Starting typing indicator and generating response")
            async with message.channel.typing():
                # Fetch conversation history from Discord API (stateless)
                logger.info("Fetching conversation history from Discord API")
                history = await self.get_conversation_history(message.channel)
                
                # Add current user message to history for context
                history.append({"role": "user", "content": message.content})
                
                logger.info(f"Generating response with {len(history)} messages in history")
                response = await self.generate_response(history)
                
                logger.info(f"Generated response: '{response[:100]}...'")
                
                # Send response (no need to store it - Discord API will have it)
                logger.info("Attempting to send response to Discord")
                try:
                    await message.channel.send(response)
                    logger.info("Response sent successfully!")
                except Exception as e:
                    logger.error(f"Failed to send response: {type(e).__name__}: {e}")
        else:
            logger.info(f"Message not in conversation channel - ignoring")
    
    @commands.command(name='ping')
    async def ping(self, ctx):
        """Simple ping command"""
        await ctx.send('Pong! 🏓')
    
    @commands.command(name='clear')
    async def clear_history(self, ctx):
        """Clear conversation history (stateless - just acknowledges the request)"""
        await ctx.send('✨ Fresh start! The bot will only consider recent messages from this point forward. 🧹')

async def main():
    """Main function to run the bot"""
    # Get bot token
    bot_token = os.getenv('BOT_TOKEN_1')
    
    if not bot_token:
        logger.error("No BOT_TOKEN_1 found in .env file!")
        return
    
    logger.info("Starting bot...")
    
    # Create and run bot
    bot = SimpleDiscordBot()
    
    try:
        logger.info("Attempting to start bot with token")
        await bot.start(bot_token)
    except KeyboardInterrupt:
        logger.info("Bot shutdown requested by user (Ctrl+C)")
    except discord.LoginFailure as e:
        logger.error(f"Login failed - check your bot token: {e}")
    except discord.HTTPException as e:
        logger.error(f"HTTP error occurred: {e}")
    except Exception as e:
        logger.error(f"Unexpected bot error: {type(e).__name__}: {e}")
        import traceback
        logger.error(f"Traceback: {traceback.format_exc()}")
    finally:
        logger.info("Closing bot connection...")
        if not bot.is_closed():
            await bot.close()
        logger.info("Bot shutdown complete")

if __name__ == "__main__":
    asyncio.run(main())
