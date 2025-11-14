#!/usr/bin/env python3
"""
Direct test of Ozon warehouse API to check response format
"""

import httpx
import json
import gzip

CLIENT_ID = "3152566"
API_KEY = "a3acc5e5-45d8-4667-9fab-9f6d0e3bfb3c"

async def test_ozon_warehouse():
    url = "https://api-seller.ozon.ru/v1/warehouse/list"
    
    headers = {
        "Client-Id": CLIENT_ID,
        "Api-Key": API_KEY,
        "Content-Type": "application/json",
        "Accept": "application/json",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
    }
    
    payload = {}
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(url, headers=headers, json=payload)
        
        print(f"Status Code: {response.status_code}")
        print(f"Content-Type: {response.headers.get('content-type')}")
        print(f"Content-Encoding: {response.headers.get('content-encoding')}")
        print(f"Content-Length: {response.headers.get('content-length')}")
        print(f"\nRaw content (first 100 bytes): {response.content[:100]}")
        print(f"\nFirst 2 bytes (hex): {response.content[:2].hex()}")
        print(f"Is gzip magic bytes? {response.content[:2] == b'\\x1f\\x8b'}")
        
        # Try to parse as JSON
        try:
            data = response.json()
            print(f"\n✅ Successfully parsed as JSON:")
            print(json.dumps(data, indent=2, ensure_ascii=False))
        except Exception as e:
            print(f"\n❌ Failed to parse as JSON: {e}")
            
            # Try gzip decompression
            try:
                if response.content[:2] == b'\x1f\x8b':
                    print("\nAttempting gzip decompression...")
                    decompressed = gzip.decompress(response.content)
                    decoded = decompressed.decode('utf-8')
                    data = json.loads(decoded)
                    print(f"✅ Successfully decompressed and parsed:")
                    print(json.dumps(data, indent=2, ensure_ascii=False))
                else:
                    print("\nNot gzip-compressed (no magic bytes)")
                    print(f"Text content: {response.text[:200]}")
            except Exception as e2:
                print(f"❌ Failed to decompress: {e2}")

if __name__ == "__main__":
    import asyncio
    asyncio.run(test_ozon_warehouse())
