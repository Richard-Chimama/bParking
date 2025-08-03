const axios = require('axios');

const GRAPHQL_ENDPOINT = 'http://localhost:4000/graphql';

// Test to see if we can get any debug information
async function testMiddlewareDebug() {
  console.log('🔍 Testing middleware debug...');
  
  // First, let's try to get the server logs by making a request
  const token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjZjMDJhNTg4LWMxOGEtNGUxMC1hYmIxLTFhYTY4YjRjMTE3YiIsImVtYWlsIjoiam9obi5kb2VAZXhhbXBsZS5jb20iLCJwaG9uZU51bWJlciI6IisyNjA5NzcxMjM0NTYiLCJyb2xlIjoidXNlciIsImlzVmVyaWZpZWQiOnRydWUsImlhdCI6MTc1NDIxNjgyNywiZXhwIjoxNzU0ODIxNjI3fQ.HdnSOcbjLd-o4-uSH0ISS5IZ-BEVtIyvpdsSXxOkxok";

  const query = `
    query {
      me {
        id
        firstName
        lastName
        email
        phoneNumber
        role
        isVerified
      }
    }
  `;

  try {
    console.log('Making request with token...');
    const response = await axios.post(GRAPHQL_ENDPOINT, { 
      query 
    }, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('Response:', JSON.stringify(response.data, null, 2));
  } catch (error) {
    console.log('Error:', error.response?.data || error.message);
  }
}

testMiddlewareDebug(); 