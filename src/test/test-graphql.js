const fetch = require('node-fetch');

const GRAPHQL_ENDPOINT = 'http://localhost:4000/graphql';

async function testGraphQL() {
  console.log('🧪 Testing GraphQL endpoint...\n');

  // Test 1: Introspection query
  console.log('1. Testing introspection query...');
  try {
    const introspectionQuery = {
      query: `
        query IntrospectionQuery {
          __schema {
            queryType {
              name
              fields {
                name
                type {
                  name
                }
              }
            }
          }
        }
      `
    };

    const response = await fetch(GRAPHQL_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(introspectionQuery),
    });

    const data = await response.json();
    
    if (data.errors) {
      console.error('❌ Introspection failed:', data.errors);
    } else {
      console.log('✅ Introspection successful');
      console.log('Available queries:', data.data.__schema.queryType.fields.map(f => f.name).join(', '));
    }
  } catch (error) {
    console.error('❌ Introspection error:', error.message);
  }

  console.log('\n2. Testing empty query (should fail)...');
  try {
    const emptyQuery = {};

    const response = await fetch(GRAPHQL_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(emptyQuery),
    });

    const data = await response.json();
    
    if (data.errors) {
      console.log('✅ Empty query correctly rejected:', data.errors[0].message);
    } else {
      console.log('❌ Empty query should have failed');
    }
  } catch (error) {
    console.error('❌ Empty query test error:', error.message);
  }

  console.log('\n3. Testing health check...');
  try {
    const response = await fetch('http://localhost:4000/health');
    const data = await response.json();
    
    if (response.ok) {
      console.log('✅ Health check successful:', data);
    } else {
      console.log('❌ Health check failed:', data);
    }
  } catch (error) {
    console.error('❌ Health check error:', error.message);
  }

  console.log('\n4. Testing parking queries...');
  try {
    const parkingQuery = {
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

    const response = await fetch(GRAPHQL_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(parkingQuery),
    });

    const data = await response.json();
    
    if (data.errors) {
      console.log('⚠️ Parking query returned errors (expected if not authenticated):', data.errors[0].message);
    } else {
      console.log('✅ Parking query successful');
      console.log('Found', data.data.parkings.length, 'parking locations');
    }
  } catch (error) {
    console.error('❌ Parking query error:', error.message);
  }
}

// Run the test
testGraphQL().catch(console.error); 