const jwt = require('jsonwebtoken');

// The token from the previous test
const token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjBjOGE5ZDAyLTRhNDktNGRjMS1hNDM2LWMxZTZjMzlmMWIwOCIsImVtYWlsIjoidGVzdHVzZXIxNzU0MjE2NTgwNjk1QGV4YW1wbGUuY29tIiwicGhvbmVOdW1iZXIiOiIrMjYwOTc3NTgwNjk1Iiwicm9sZSI6InVzZXIiLCJpc1ZlcmlmaWVkIjpmYWxzZSwiaWF0IjoxNzU0MjE2NTgxLCJleHAiOjE3NTQ4MjEzODF9.OyZY0cxmyz2WZvAcoMZX41X_UAvNvJSrenbPtVhY8FM";

// Decode without verification first
const decoded = jwt.decode(token);
console.log('Decoded JWT payload:', JSON.stringify(decoded, null, 2));

// Try to verify with a dummy secret to see if the structure is correct
try {
  const verified = jwt.verify(token, 'dummy-secret');
  console.log('Verification result:', verified);
} catch (error) {
  console.log('Verification error (expected):', error.message);
} 