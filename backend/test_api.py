import requests
import json

base_url = 'http://127.0.0.1:8000/api/v1'

# 1. Login
# We don't have the user's password. Let's just create a new user.
res = requests.post(f"{base_url}/auth/signup", json={
    "name": "Test User",
    "email": "test-discord@example.com",
    "password": "password123",
    "role": "reporter"
})
if res.status_code not in (200, 201):
    # Try login instead
    res = requests.post(f"{base_url}/auth/login", json={
        "email": "test-discord@example.com",
        "password": "password123"
    })

token = res.json()["data"]["token"]

# 2. Post bug
res2 = requests.post(f"{base_url}/bugs", json={
    "title": "hi",
    "description": "hi",
    "priority": "critical",
    "severity": "critical",
    "component": "frontend"
}, headers={"Authorization": f"Bearer {token}"})

print("Status:", res2.status_code)
print("Response:", res2.text)
