const { ParkingResolver } = require('../../dist/graphql/resolvers/ParkingResolver');
const { AppDataSource } = require('../../dist/database/connection');

async function testParkingsQuery() {
  console.log('🧪 Testing parkings GraphQL query with mock user...');
  
  try {
    // Initialize database connection
    console.log('🔧 Initializing database connection...');
    await AppDataSource.initialize();
    console.log('✅ Database connected successfully');
    
    // Create resolver instance
    const resolver = new ParkingResolver();
    
    // Create mock context with a user (bypassing authentication)
    const mockContext = {
      user: {
        id: 'test-user-id',
        email: 'test@example.com',
        phoneNumber: '+260977123456',
        role: 'user',
        isVerified: true
      }
    };
    
    console.log('🔍 Executing parkings query with mock user...');
    
    // Call the parkings method directly
    const result = await resolver.parkings();
    
    console.log('✅ Query executed successfully!');
    console.log('📊 Result:', {
      type: typeof result,
      isArray: Array.isArray(result),
      length: result?.length,
      firstItem: result?.[0] ? 'exists' : 'null'
    });
    
    if (result && result.length > 0) {
      console.log('🎉 SUCCESS: Query returned parking data!');
      console.log('📋 First parking:', {
        id: result[0].id,
        name: result[0].name,
        city: result[0].address?.city,
        totalSpaces: result[0].totalSpaces,
        availableSpaces: result[0].availableSpaces
      });
      console.log(`📊 Total parkings returned: ${result.length}`);
    } else {
      console.log('⚠️ Query returned empty array - this means no active/verified parkings found');
    }
    
  } catch (error) {
    console.error('❌ Error testing parkings query:', error);
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
  } finally {
    // Close database connection
    if (AppDataSource.isInitialized) {
      await AppDataSource.destroy();
      console.log('🔌 Database connection closed');
    }
  }
}

testParkingsQuery(); 