#!/usr/bin/env python3
import requests
import json
import os

# Railway API configuration
RAILWAY_API_URL = "https://backboard.railway.com/graphql/v2"
RAILWAY_API_TOKEN = "027dd3d8-22a9-4db8-be2a-6c6a652e4b33"
PROJECT_ID = "264f9650-d262-40db-8a3a-75df2cef5a50"
ENVIRONMENT_ID = "cdd5d946-aaae-4203-941d-c01bbb397b81"

headers = {
    "Authorization": f"Bearer {RAILWAY_API_TOKEN}",
    "Content-Type": "application/json"
}

# Query to get project details
query = """
query {
  project(id: "%s") {
    id
    name
    description
    services {
      edges {
        node {
          id
          name
          serviceInstances {
            edges {
              node {
                id
                environmentId
                latestDeployment {
                  id
                  status
                  createdAt
                  staticUrl
                  buildLogs
                  deployLogs
                }
              }
            }
          }
        }
      }
    }
  }
}
""" % PROJECT_ID

try:
    response = requests.post(
        RAILWAY_API_URL,
        headers=headers,
        json={"query": query}
    )
    
    print("Status Code:", response.status_code)
    print("\nResponse:")
    print(json.dumps(response.json(), indent=2))
    
except Exception as e:
    print(f"Error: {e}")

