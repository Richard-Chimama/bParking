const jwt = require('jsonwebtoken');

// The token from the latest test
const token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjZjMDJhNTg4LWMxOGEtNGUxMC1hYmIxLTFhYTY4YjRjMTE3YiIsImVtYWlsIjoiam9obi5kb2VAZXhhbXBsZS5jb20iLCJwaG9uZU51bWJlciI6IisyNjA5NzcxMjM0NTYiLCJyb2xlIjoidXNlciIsImlzVmVyaWZpZWQiOnRydWUsImlhdCI6MTc1NDIxNjgyNywiZXhwIjoxNzU0ODIxNjI3fQ.HdnSOcbjLd-o4-uSH0ISS5IZ-BEVtIyvpdsSXxOkxok";

// Use the same secret as in the config
const secret = 'your-super-secret-jwt-key-change-in-production';

try {
  const verified = jwt.verify(token, secret);
  console.log('✅ JWT verification successful:', JSON.stringify(verified, null, 2));
} catch (error) {
  console.log('❌ JWT verification failed:', error.message);
} 