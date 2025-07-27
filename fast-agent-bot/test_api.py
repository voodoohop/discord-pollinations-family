#!/usr/bin/env python3
"""
Test script to debug Pollinations API directly
"""

import asyncio
import os
import aiohttp
import json
from dotenv import load_dotenv

load_dotenv()

async def test_api():
    """Test the Pollinations API directly"""
    
    api_base = "https://text.pollinations.ai/openai"
    model = "deepseek-reasoning"
    api_token = os.getenv('TEXT_POLLINATIONS_TOKEN')
    
    url = f"{api_base}/chat/completions"
    
    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": "You are a helpful AI assistant. Be friendly and concise."},
            {"role": "user", "content": "Hello, can you hear me?"}
        ]
    }
    
    headers = {
        "Content-Type": "application/json",
        "Referer": "roblox"
    }
    
    if api_token:
        headers["Authorization"] = f"Bearer {api_token}"
    
    print(f"🔗 Testing API: {url}")
    print(f"🤖 Model: {model}")
    print(f"🔑 Has token: {bool(api_token)}")
    print(f"📦 Payload: {json.dumps(payload, indent=2)}")
    print(f"📋 Headers: {json.dumps(headers, indent=2)}")
    print("\n" + "="*50)
    
    try:
        async with aiohttp.ClientSession() as session:
            async with session.post(url, json=payload, headers=headers, timeout=30) as response:
                print(f"📊 Response Status: {response.status}")
                print(f"📋 Response Headers: {dict(response.headers)}")
                
                response_text = await response.text()
                print(f"📄 Response Body: {response_text}")
                
                if response.status == 200:
                    try:
                        data = json.loads(response_text)
                        if "choices" in data and len(data["choices"]) > 0:
                            content = data["choices"][0]["message"]["content"]
                            print(f"✅ Success! Response: {content}")
                        else:
                            print(f"❌ Unexpected response structure: {data}")
                    except json.JSONDecodeError as e:
                        print(f"❌ JSON decode error: {e}")
                else:
                    print(f"❌ API Error: {response.status}")
                    
    except Exception as e:
        print(f"❌ Exception: {type(e).__name__}: {e}")

if __name__ == "__main__":
    asyncio.run(test_api())
