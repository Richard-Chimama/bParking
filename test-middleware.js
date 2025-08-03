const axios = require('axios');

const GRAPHQL_ENDPOINT = 'http://localhost:4000/graphql';

// Test the users query which also requires authentication
async function testUsersQuery() {
  console.log('\n🔍 Testing "users" query (requires authentication)...');
  
  const query = `
    query {
      users {
        id
        firstName
        lastName
        email
        role
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

// Test with a valid token
async function testUsersQueryWithAuth() {
  console.log('\n🔍 Testing "users" query with authentication...');
  
  // First get a token
  const loginMutation = `
    mutation {
      login(input: {
        phoneNumber: "+260977679991"
        password: "password123"
      }) {
        success
        token
      }
    }
  `;

  try {
    const loginResponse = await axios.post(GRAPHQL_ENDPOINT, { query: loginMutation });
    const token = loginResponse.data.data?.login?.token;
    
    if (!token) {
      console.log('❌ Failed to get token');
      return;
    }

    console.log('✅ Got token, testing users query...');
    
    const query = `
      query {
        users {
          id
          firstName
          lastName
          email
          role
        }
      }
    `;

    const response = await axios.post(GRAPHQL_ENDPOINT, { 
      query 
    }, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('✅ Users query response:', JSON.stringify(response.data, null, 2));
  } catch (error) {
    console.log('❌ Users query error:', error.response?.data || error.message);
  }
}

// Test introspection to see if middleware is applied
async function testIntrospection() {
  console.log('\n🔍 Testing introspection to check middleware...');
  
  const query = `
    query IntrospectionQuery {
      __schema {
        queryType {
          name
          fields {
            name
            description
          }
        }
      }
    }
  `;

  try {
    const response = await axios.post(GRAPHQL_ENDPOINT, { query });
    console.log('✅ Introspection successful');
    
    // Check if me query is in the schema
    const meField = response.data.data.__schema.queryType.fields.find(f => f.name === 'me');
    if (meField) {
      console.log('✅ "me" query found in schema');
    } else {
      console.log('❌ "me" query not found in schema');
    }
  } catch (error) {
    console.log('❌ Introspection error:', error.response?.data || error.message);
  }
}

async function runTests() {
  console.log('🚀 Starting middleware tests...\n');
  
  await testIntrospection();
  await testUsersQuery();
  await testUsersQueryWithAuth();
  
  console.log('\n✅ All middleware tests completed!');
}

runTests().catch(console.error); 