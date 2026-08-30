import asyncio
import sys
import os

sys.path.append(os.getcwd())
from app.services.dispatcher import handle_discord
from app.config import settings

print(f"WEBHOOK URL IN SETTINGS: '{settings.DISCORD_WEBHOOK_URL}'")

event = {
    "id": "test-event",
    "event_type": "bug.created",
    "payload": {
        "title": "hi",
        "priority": "critical"
    }
}

async def run():
    print("Running handle_discord...")
    await handle_discord(event)
    print("Done")

asyncio.run(run())
