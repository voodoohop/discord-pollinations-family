#!/usr/bin/env python3
"""
Bot Profile Management - Minimal and Functional
Handles setting bot username and avatar using Pollinations API
"""

import logging
import aiohttp
from typing import Optional
import discord

logger = logging.getLogger(__name__)

class BotProfileManager:
    """Minimal bot profile management for username and avatar"""
    
    @staticmethod
    async def set_bot_profile(client: discord.Client, model_name: str) -> None:
        """
        Set bot username and avatar based on model name
        
        Args:
            client: Discord client instance
            model_name: Name of the AI model (used for username and avatar generation)
        """
        if not client.user:
            logger.warning("Bot user not available, skipping profile setup")
            return
            
        # Set username (rate limited: 2 changes per hour)
        await BotProfileManager._set_username(client, model_name)
        
        # Set avatar using Pollinations API
        await BotProfileManager._set_avatar(client, model_name)
    
    @staticmethod
    async def _set_username(client: discord.Client, model_name: str) -> None:
        """Set bot username to model name"""
        try:
            if client.user.name != model_name:
                await client.user.edit(username=model_name)
                logger.info(f"Successfully set username to {model_name}")
            else:
                logger.info(f"Username already set to {model_name}, skipping")
        except Exception as error:
            logger.error(f"Error setting username to {model_name}: {error}")
    
    @staticmethod
    async def _set_avatar(client: discord.Client, model_name: str) -> None:
        """Generate and set bot avatar using Pollinations API"""
        try:
            # Generate avatar prompt and URL
            prompt = f"portrait of {model_name}, digital art, minimal style, icon, avatar"
            avatar_url = (
                f"https://image.pollinations.ai/prompt/{aiohttp.helpers.quote(prompt, safe='')}"
                f"?width=512&height=512&model=gptimage&nologo=true&referrer=pollinations.github.io"
            )
            
            logger.info(f"Generated avatar URL for {model_name}: {avatar_url}")
            
            # Fetch and set avatar
            async with aiohttp.ClientSession() as session:
                async with session.get(avatar_url) as response:
                    if not response.ok:
                        raise Exception(f"Failed to fetch avatar image: {response.status} {response.reason}")
                    
                    avatar_data = await response.read()
                    await client.user.edit(avatar=avatar_data)
                    logger.info(f"Successfully set avatar for {model_name}")
                    
        except Exception as error:
            logger.error(f"Error setting avatar for {model_name}: {error}")
