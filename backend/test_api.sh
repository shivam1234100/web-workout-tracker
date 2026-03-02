#!/bin/bash

BASE_URL="http://localhost:3000"

echo "1. Registering User..."
REGISTER_RES=$(curl -s -X POST $BASE_URL/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email": "test@test.com", "password": "password123", "name": "Test User"}')
echo $REGISTER_RES

TOKEN=$(echo $REGISTER_RES | python3 -c "import sys, json; print(json.load(sys.stdin).get('token', ''))")

if [ -z "$TOKEN" ]; then
  echo "Registration failed or Login needed (User might exist)"
  echo "2. Logging in..."
  LOGIN_RES=$(curl -s -X POST $BASE_URL/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email": "test@test.com", "password": "password123"}')
  echo $LOGIN_RES
  TOKEN=$(echo $LOGIN_RES | python3 -c "import sys, json; print(json.load(sys.stdin).get('token', ''))")
fi

echo "Token: $TOKEN"

echo "3. Creating Workout..."
WORKOUT_RES=$(curl -s -X POST $BASE_URL/workouts \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "name": "Leg Day",
    "startTime": "2023-10-27T10:00:00Z",
    "endTime": "2023-10-27T11:00:00Z",
    "exercises": [
      {
        "name": "Squat",
        "sets": [{"reps": 10, "weight": 100, "completed": true}]
      }
    ]
  }')
echo $WORKOUT_RES

echo "4. Fetching Workouts..."
curl -s -X GET $BASE_URL/workouts \
  -H "Authorization: Bearer $TOKEN"
