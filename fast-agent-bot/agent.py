#!/usr/bin/env python3
"""
Fast Agent implementation for Discord Bot
This file demonstrates how to use Fast Agent framework with Discord integration
"""

import asyncio
import os
from mcp_agent.core.fastagent import FastAgent
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Create the Fast Agent application
fast = FastAgent("Discord Bot Agent")

@fast.agent(
    name="discord_assistant",
    instruction="""You are a helpful Discord bot assistant. You should:
    - Be friendly and conversational
    - Help users with questions and tasks
    - Respond appropriately to the Discord chat context
    - Keep responses concise but informative
    """,
    # servers=["fetch"],  # Add MCP servers here when ready
)
async def discord_agent():
    """Main Discord agent using Fast Agent framework"""
    pass

@fast.agent(
    name="qwen_coder",
    instruction="""You are a coding assistant specialized in programming help. You should:
    - Help with code questions and debugging
    - Provide code examples and explanations
    - Focus on practical, working solutions
    - Be precise and technical when needed
    """,
    model="qwen-coder"
)
async def qwen_coder_agent():
    """Coding specialist agent"""
    pass

@fast.agent(
    name="creative_assistant", 
    instruction="""You are a creative writing and brainstorming assistant. You should:
    - Help with creative projects and ideas
    - Provide inspiration and suggestions
    - Be imaginative and engaging
    - Support artistic and creative endeavors
    """,
    model="mistral"
)
async def creative_agent():
    """Creative assistant agent"""
    pass

# Chain example for future use
@fast.chain(
    name="research_and_summarize",
    sequence=["discord_assistant", "creative_assistant"]
)
async def research_chain():
    """Example chain for research and creative summarization"""
    pass

async def main():
    """Main function to run Fast Agent interactively"""
    async with fast.run() as agent:
        # Start interactive session
        await agent.interactive()

if __name__ == "__main__":
    asyncio.run(main())
