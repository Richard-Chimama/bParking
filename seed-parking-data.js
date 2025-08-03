const { AppDataSource } = require('./dist/database/connection');
const { Parking } = require('./dist/entities/Parking');

async function seedParkingData() {
  console.log('🌱 Seeding parking data...');
  
  try {
    // Initialize database connection
    console.log('🔧 Initializing database connection...');
    await AppDataSource.initialize();
    console.log('✅ Database connected successfully');
    
    // Create sample parking data
    const parkingRepository = AppDataSource.getRepository(Parking);
    
    const sampleParkings = [
      {
        name: 'Central Mall Parking',
        description: 'Spacious parking facility in the heart of Lusaka with easy access to shopping center',
        address: {
          street: '123 Cairo Road',
          city: 'Lusaka',
          state: 'Lusaka Province',
          zipCode: '10101',
          country: 'Zambia'
        },
        location: {
          type: 'Point',
          coordinates: [28.2871, -15.3875] // Lusaka coordinates
        },
        totalSpaces: 200,
        availableSpaces: 150,
        parkingSpaces: Array.from({ length: 200 }, (_, i) => ({
          id: `space-${i + 1}`,
          number: `${i + 1}`,
          isAvailable: i < 150, // First 150 are available
          isReserved: false,
          lastUpdated: new Date()
        })),
        pricing: {
          hourly: 5.00,
          daily: 30.00,
          weekly: 150.00,
          monthly: 500.00,
          currency: 'ZMW'
        },
        amenities: ['24/7 Security', 'CCTV Monitoring', 'Covered Parking', 'Shopping Mall Access'],
        images: [],
        isActive: true,
        isVerified: true,
        ownerId: '00000000-0000-0000-0000-000000000001', // Placeholder owner ID
        operatingHours: {
          monday: { open: '06:00', close: '22:00', isOpen: true },
          tuesday: { open: '06:00', close: '22:00', isOpen: true },
          wednesday: { open: '06:00', close: '22:00', isOpen: true },
          thursday: { open: '06:00', close: '22:00', isOpen: true },
          friday: { open: '06:00', close: '22:00', isOpen: true },
          saturday: { open: '08:00', close: '20:00', isOpen: true },
          sunday: { open: '08:00', close: '18:00', isOpen: true }
        },
        rules: ['No overnight parking', 'Keep tickets visible', 'Park within designated lines'],
        contactInfo: {
          phone: '+260-977-123456',
          email: 'info@centralmallparking.zm'
        },
        rating: 4.5,
        totalReviews: 45
      },
      {
        name: 'Airport Express Parking',
        description: 'Long-term and short-term parking near Kenneth Kaunda International Airport',
        address: {
          street: 'Airport Road',
          city: 'Lusaka',
          state: 'Lusaka Province',
          zipCode: '10102',
          country: 'Zambia'
        },
        location: {
          type: 'Point',
          coordinates: [28.4530, -15.3308] // Near Lusaka Airport
        },
        totalSpaces: 500,
        availableSpaces: 320,
        parkingSpaces: Array.from({ length: 500 }, (_, i) => ({
          id: `airport-space-${i + 1}`,
          number: `A${i + 1}`,
          isAvailable: i < 320,
          isReserved: false,
          lastUpdated: new Date()
        })),
        pricing: {
          hourly: 8.00,
          daily: 50.00,
          weekly: 300.00,
          monthly: 1000.00,
          currency: 'ZMW'
        },
        amenities: ['Shuttle Service', '24/7 Security', 'Online Booking', 'Covered Areas'],
        images: [],
        isActive: true,
        isVerified: true,
        ownerId: '00000000-0000-0000-0000-000000000001',
        operatingHours: {
          monday: { open: '00:00', close: '23:59', isOpen: true },
          tuesday: { open: '00:00', close: '23:59', isOpen: true },
          wednesday: { open: '00:00', close: '23:59', isOpen: true },
          thursday: { open: '00:00', close: '23:59', isOpen: true },
          friday: { open: '00:00', close: '23:59', isOpen: true },
          saturday: { open: '00:00', close: '23:59', isOpen: true },
          sunday: { open: '00:00', close: '23:59', isOpen: true }
        },
        rules: ['Maximum 30 days parking', 'Payment required in advance', 'Shuttle available every 15 minutes'],
        contactInfo: {
          phone: '+260-977-789012',
          email: 'reservations@airportparking.zm'
        },
        rating: 4.2,
        totalReviews: 128
      }
    ];

    // Save the sample parkings
    for (let i = 0; i < sampleParkings.length; i++) {
      const parkingData = sampleParkings[i];
      console.log(`💾 Creating parking ${i + 1}: ${parkingData.name}`);
      
      const parking = new Parking();
      Object.assign(parking, parkingData);
      
      await parkingRepository.save(parking);
      console.log(`✅ Created parking: ${parkingData.name}`);
    }
    
    console.log('🎉 Successfully seeded parking data!');
    
  } catch (error) {
    console.error('❌ Error seeding parking data:', error);
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

seedParkingData();
