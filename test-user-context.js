const axios = require('axios');

const GRAPHQL_ENDPOINT = 'http://localhost:4000/graphql';

// Test 1: Try to access 'me' query without authentication
async function testMeQueryWithoutAuth() {
  console.log('\n🔍 Test 1: Testing "me" query without authentication...');
  
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
    const response = await axios.post(GRAPHQL_ENDPOINT, { query });
    console.log('❌ Expected authentication error, but got response:', response.data);
  } catch (error) {
    if (error.response?.data?.errors) {
      const errorMessage = error.response.data.errors[0].message;
      console.log('✅ Correctly received authentication error:', errorMessage);
    } else {
      console.log('❌ Unexpected error:', error.message);
    }
  }
}

// Test 2: Login with seeded user
async function testUserLogin() {
  console.log('\n🔍 Test 2: Logging in with seeded user...');
  
  const mutation = `
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
  `;

  try {
    const response = await axios.post(GRAPHQL_ENDPOINT, { query: mutation });
    console.log('✅ Login response:', JSON.stringify(response.data, null, 2));
    return response.data.data?.login?.token;
  } catch (error) {
    console.log('❌ Login error:', error.response?.data || error.message);
    return null;
  }
}

// Test 3: Test 'me' query with authentication
async function testMeQueryWithAuth(token) {
  console.log('\n🔍 Test 3: Testing "me" query with authentication...');
  
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
        isActive
        createdAt
        updatedAt
      }
    }
  `;

  try {
    const response = await axios.post(GRAPHQL_ENDPOINT, { 
      query 
    }, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('✅ Authenticated "me" query response:', JSON.stringify(response.data, null, 2));
    
    // Verify that the user data matches what we expect
    const userData = response.data.data?.me;
    if (userData) {
      console.log('✅ User context verification:');
      console.log(`   - User ID: ${userData.id}`);
      console.log(`   - Email: ${userData.email}`);
      console.log(`   - Phone: ${userData.phoneNumber}`);
      console.log(`   - Role: ${userData.role}`);
      console.log(`   - Verified: ${userData.isVerified}`);
      console.log(`   - Active: ${userData.isActive}`);
    }
    
    return userData;
  } catch (error) {
    console.log('❌ Authenticated "me" query error:', error.response?.data || error.message);
    return null;
  }
}

// Test 4: Test introspection query (should work without auth)
async function testIntrospectionQuery() {
  console.log('\n🔍 Test 4: Testing introspection query (should work without auth)...');
  
  const query = `
    query IntrospectionQuery {
      __schema {
        queryType {
          name
        }
        mutationType {
          name
        }
      }
    }
  `;

  try {
    const response = await axios.post(GRAPHQL_ENDPOINT, { query });
    console.log('✅ Introspection query response:', JSON.stringify(response.data, null, 2));
  } catch (error) {
    console.log('❌ Introspection query error:', error.response?.data || error.message);
  }
}

// Main test function
async function runTests() {
  console.log('🚀 Starting user context tests...\n');
  
  // Test 1: Me query without auth
  await testMeQueryWithoutAuth();
  
  // Test 4: Introspection query (should work without auth)
  await testIntrospectionQuery();
  
  // Test 2: Login with seeded user
  const token = await testUserLogin();
  
  if (token) {
    // Test 3: Me query with auth
    await testMeQueryWithAuth(token);
  }
  
  console.log('\n✅ All tests completed!');
}

// Run the tests
runTests().catch(console.error); 