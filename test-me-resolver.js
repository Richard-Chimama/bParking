const fetch = require('node-fetch');
const jwt = require('jsonwebtoken');

// Test the me query with actual GraphQL request including token
async function testMeWithToken() {
  console.log('🔍 Testing me query with JWT token...');
  
  try {
    // First, login to get a token
    console.log('🔐 Logging in to get token...');
    const loginResponse = await fetch('http://localhost:4000/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: `
          mutation {
            login(input: {
              phoneNumber: "+260977123456"
              password: "password123"
            }) {
              success
              message
              token
              user {
                id
                firstName
                lastName
                email
                phoneNumber
                role
                isVerified
              }
            }
          }
        `
      })
    });
    
    const loginData = await loginResponse.json();
    console.log('✅ Login response:', JSON.stringify(loginData, null, 2));
    
    if (!loginData.data?.login?.token) {
      console.error('❌ No token received from login');
      return;
    }
    
    const token = loginData.data.login.token;
    console.log('🎫 Token received:', token);
    
    // Verify the token
    const decoded = jwt.decode(token);
    console.log('🔍 Decoded token:', JSON.stringify(decoded, null, 2));
    
    // Now test the me query with the token
    console.log('\n🔍 Testing me query with authentication token...');
    const meResponse = await fetch('http://localhost:4000/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        query: `
          query {
            me {
              id
              firstName
              lastName
              email
              phoneNumber
              role
              isVerified
              isActive
              createdAt
              updatedAt
            }
          }
        `
      })
    });
    
    const meData = await meResponse.json();
    console.log('✅ Me query response:', JSON.stringify(meData, null, 2));
    
  } catch (error) {
    console.error('❌ Test error:', error);
  }
}

testMeWithToken();