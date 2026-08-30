import sys
import os
from app.db.database import db

events = db.client.table('events').select('*').order('created_at', desc=True).limit(5).execute()
for e in events.data:
    print(f"ID: {e['id']}, Type: {e['event_type']}, Processed: {e['processed']}, Payload: {e['payload_json']}")
