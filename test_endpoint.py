import requests
import json

# Тест запрос к endpoint
url = "http://localhost:8000/api/inventory/fbs"
headers = {
    "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI2OTc0MDk5MTk4ODc0ZDVlODI0MTc4MjIiLCJyb2xlIjoic2VsbGVyIiwiZXhwIjoxNzcwOTI3OTI4fQ.JEN1HvAqBYtXFLneeN3MrdArUKeKhtjs2_tafwG-jtU",
    "Content-Type": "application/json"
}

try:
    response = requests.get(url, headers=headers)
    print(f"Status: {response.status_code}")
    print(f"Response: {response.text}")
except Exception as e:
    print(f"Error: {e}")
