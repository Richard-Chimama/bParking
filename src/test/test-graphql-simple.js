const fetch = require('node-fetch');

const GRAPHQL_ENDPOINT = 'http://localhost:4000/graphql';

async function testParkingsQuery() {
  console.log('🧪 Testing parkings GraphQL query...\n');

  const query = {
    query: `
      query {
        parkings {
          id
          name
          description
          totalSpaces
          availableSpaces
          coordinates
          address {
            street
            city
            state
            zipCode
            country
          }
        }
      }
    `
  };

  try {
    console.log('📡 Sending GraphQL request...');
    const response = await fetch(GRAPHQL_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(query),
    });

    console.log(`📊 Response status: ${response.status}`);
    const data = await response.json();
    
    if (data.errors) {
      console.error('❌ GraphQL errors:', JSON.stringify(data.errors, null, 2));
    } else {
      console.log('✅ GraphQL query successful!');
      console.log('📋 Result:', JSON.stringify(data, null, 2));
    }
  } catch (error) {
    console.error('❌ Network error:', error.message);
  }
}

testParkingsQuery();
