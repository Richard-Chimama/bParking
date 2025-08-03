import { AppDataSource } from '@/database/connection';
import { User } from '@/entities/User';
import { Parking } from '@/entities/Parking';
import { Point } from 'geojson';
import bcrypt from 'bcryptjs';

// Sample users data
const usersData: Array<{
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string;
  password: string;
  role: 'user' | 'admin' | 'owner';
  isVerified: boolean;
  isActive: boolean;
}> = [
  {
    firstName: 'John',
    lastName: 'Doe',
    email: 'john.doe@example.com',
    phoneNumber: '+260977123456',
    password: 'password123',
    role: 'user',
    isVerified: true,
    isActive: true,
  },
  {
    firstName: 'Jane',
    lastName: 'Smith',
    email: 'jane.smith@example.com',
    phoneNumber: '+260977123457',
    password: 'password123',
    role: 'user',
    isVerified: true,
    isActive: true,
  },
  {
    firstName: 'Admin',
    lastName: 'User',
    email: 'admin@bparking.com',
    phoneNumber: '+260977123458',
    password: 'admin123',
    role: 'admin',
    isVerified: true,
    isActive: true,
  },
  {
    firstName: 'Parking',
    lastName: 'Owner',
    email: 'owner@bparking.com',
    phoneNumber: '+260977123459',
    password: 'owner123',
    role: 'owner',
    isVerified: true,
    isActive: true,
  },
];

// Sample parking locations in Zambia (Lusaka, Kitwe, Ndola, etc.)
const parkingData = [
  {
    name: 'Lusaka Central Parking',
    description: 'Secure parking in the heart of Lusaka CBD with 24/7 security and CCTV monitoring.',
    address: {
      street: 'Cairo Road',
      city: 'Lusaka',
      state: 'Lusaka Province',
      zipCode: '10101',
      country: 'Zambia',
    },
    location: {
      type: 'Point',
      coordinates: [28.3228, -15.3875], // Lusaka coordinates
    } as Point,
    totalSpaces: 50,
    availableSpaces: 35,
    parkingSpaces: Array.from({ length: 50 }, (_, i) => ({
      id: `space-${i + 1}`,
      number: `A${String(i + 1).padStart(2, '0')}`,
      isAvailable: i < 35,
      isReserved: false,
      lastUpdated: new Date(),
    })),
    pricing: {
      hourly: 5,
      daily: 50,
      weekly: 250,
      monthly: 800,
      currency: 'ZMW',
    },
    amenities: ['Security', 'CCTV', 'Well Lit', 'Covered Parking', 'Wheelchair Access'],
    images: [
      'https://example.com/parking1-1.jpg',
      'https://example.com/parking1-2.jpg',
    ],
    isActive: true,
    isVerified: true,
    operatingHours: {
      monday: { open: '06:00', close: '22:00', isOpen: true },
      tuesday: { open: '06:00', close: '22:00', isOpen: true },
      wednesday: { open: '06:00', close: '22:00', isOpen: true },
      thursday: { open: '06:00', close: '22:00', isOpen: true },
      friday: { open: '06:00', close: '22:00', isOpen: true },
      saturday: { open: '08:00', close: '20:00', isOpen: true },
      sunday: { open: '08:00', close: '18:00', isOpen: true },
    },
    rules: [
      'No overnight parking without prior arrangement',
      'Maximum stay: 24 hours',
      'No commercial vehicles',
      'Pay before leaving',
    ],
    contactInfo: {
      phone: '+260977123460',
      email: 'lusaka@bparking.com',
    },
    rating: 4.5,
    totalReviews: 127,
  },
  {
    name: 'Manda Hill Shopping Centre Parking',
    description: 'Convenient parking at Manda Hill Shopping Centre with easy access to shops and restaurants.',
    address: {
      street: 'Great East Road',
      city: 'Lusaka',
      state: 'Lusaka Province',
      zipCode: '10102',
      country: 'Zambia',
    },
    location: {
      type: 'Point',
      coordinates: [28.3456, -15.3987], // Near Manda Hill
    } as Point,
    totalSpaces: 200,
    availableSpaces: 150,
    parkingSpaces: Array.from({ length: 200 }, (_, i) => ({
      id: `space-${i + 51}`,
      number: `B${String(i + 1).padStart(3, '0')}`,
      isAvailable: i < 150,
      isReserved: false,
      lastUpdated: new Date(),
    })),
    pricing: {
      hourly: 3,
      daily: 30,
      weekly: 150,
      monthly: 500,
      currency: 'ZMW',
    },
    amenities: ['Shopping Centre Access', 'Security', 'Well Lit', 'Family Friendly'],
    images: [
      'https://example.com/parking2-1.jpg',
      'https://example.com/parking2-2.jpg',
    ],
    isActive: true,
    isVerified: true,
    operatingHours: {
      monday: { open: '08:00', close: '21:00', isOpen: true },
      tuesday: { open: '08:00', close: '21:00', isOpen: true },
      wednesday: { open: '08:00', close: '21:00', isOpen: true },
      thursday: { open: '08:00', close: '21:00', isOpen: true },
      friday: { open: '08:00', close: '22:00', isOpen: true },
      saturday: { open: '08:00', close: '22:00', isOpen: true },
      sunday: { open: '09:00', close: '20:00', isOpen: true },
    },
    rules: [
      'Free parking for first 2 hours',
      'Maximum stay: 8 hours',
      'No overnight parking',
      'Follow shopping centre rules',
    ],
    contactInfo: {
      phone: '+260977123461',
      email: 'mandahill@bparking.com',
    },
    rating: 4.2,
    totalReviews: 89,
  },
  {
    name: 'Kitwe City Centre Parking',
    description: 'Central parking facility in Kitwe with easy access to banks and government offices.',
    address: {
      street: 'President Avenue',
      city: 'Kitwe',
      state: 'Copperbelt Province',
      zipCode: '20101',
      country: 'Zambia',
    },
    location: {
      type: 'Point',
      coordinates: [28.2345, -12.8234], // Kitwe coordinates
    } as Point,
    totalSpaces: 80,
    availableSpaces: 60,
    parkingSpaces: Array.from({ length: 80 }, (_, i) => ({
      id: `space-${i + 251}`,
      number: `C${String(i + 1).padStart(2, '0')}`,
      isAvailable: i < 60,
      isReserved: false,
      lastUpdated: new Date(),
    })),
    pricing: {
      hourly: 4,
      daily: 40,
      weekly: 200,
      monthly: 700,
      currency: 'ZMW',
    },
    amenities: ['Security', 'CCTV', 'Well Lit', 'Near Banks', 'Government Access'],
    images: [
      'https://example.com/parking3-1.jpg',
    ],
    isActive: true,
    isVerified: true,
    operatingHours: {
      monday: { open: '07:00', close: '19:00', isOpen: true },
      tuesday: { open: '07:00', close: '19:00', isOpen: true },
      wednesday: { open: '07:00', close: '19:00', isOpen: true },
      thursday: { open: '07:00', close: '19:00', isOpen: true },
      friday: { open: '07:00', close: '19:00', isOpen: true },
      saturday: { open: '08:00', close: '17:00', isOpen: true },
      sunday: { open: '09:00', close: '16:00', isOpen: true },
    },
    rules: [
      'Business hours only',
      'No overnight parking',
      'Pay at exit',
      'Follow traffic rules',
    ],
    contactInfo: {
      phone: '+260977123462',
      email: 'kitwe@bparking.com',
    },
    rating: 4.0,
    totalReviews: 45,
  },
  {
    name: 'Ndola Airport Parking',
    description: 'Secure parking at Simon Mwansa Kapwepwe International Airport with shuttle service.',
    address: {
      street: 'Airport Road',
      city: 'Ndola',
      state: 'Copperbelt Province',
      zipCode: '20102',
      country: 'Zambia',
    },
    location: {
      type: 'Point',
      coordinates: [28.6789, -12.9987], // Ndola Airport coordinates
    } as Point,
    totalSpaces: 120,
    availableSpaces: 90,
    parkingSpaces: Array.from({ length: 120 }, (_, i) => ({
      id: `space-${i + 331}`,
      number: `D${String(i + 1).padStart(3, '0')}`,
      isAvailable: i < 90,
      isReserved: false,
      lastUpdated: new Date(),
    })),
    pricing: {
      hourly: 8,
      daily: 80,
      weekly: 400,
      monthly: 1200,
      currency: 'ZMW',
    },
    amenities: ['Airport Shuttle', 'Security', 'CCTV', '24/7 Access', 'Covered Parking'],
    images: [
      'https://example.com/parking4-1.jpg',
      'https://example.com/parking4-2.jpg',
    ],
    isActive: true,
    isVerified: true,
    operatingHours: {
      monday: { open: '00:00', close: '23:59', isOpen: true },
      tuesday: { open: '00:00', close: '23:59', isOpen: true },
      wednesday: { open: '00:00', close: '23:59', isOpen: true },
      thursday: { open: '00:00', close: '23:59', isOpen: true },
      friday: { open: '00:00', close: '23:59', isOpen: true },
      saturday: { open: '00:00', close: '23:59', isOpen: true },
      sunday: { open: '00:00', close: '23:59', isOpen: true },
    },
    rules: [
      '24/7 access',
      'Airport shuttle available',
      'Long-term parking available',
      'Security provided',
    ],
    contactInfo: {
      phone: '+260977123463',
      email: 'ndola-airport@bparking.com',
    },
    rating: 4.7,
    totalReviews: 203,
  },
  {
    name: 'Livingstone Tourist Parking',
    description: 'Convenient parking near Victoria Falls for tourists and visitors.',
    address: {
      street: 'Mosi-oa-Tunya Road',
      city: 'Livingstone',
      state: 'Southern Province',
      zipCode: '60101',
      country: 'Zambia',
    },
    location: {
      type: 'Point',
      coordinates: [25.8567, -17.8577], // Livingstone coordinates
    } as Point,
    totalSpaces: 100,
    availableSpaces: 75,
    parkingSpaces: Array.from({ length: 100 }, (_, i) => ({
      id: `space-${i + 451}`,
      number: `E${String(i + 1).padStart(3, '0')}`,
      isAvailable: i < 75,
      isReserved: false,
      lastUpdated: new Date(),
    })),
    pricing: {
      hourly: 6,
      daily: 60,
      weekly: 300,
      monthly: 900,
      currency: 'ZMW',
    },
    amenities: ['Tourist Information', 'Security', 'Well Lit', 'Near Attractions', 'Tour Guide Access'],
    images: [
      'https://example.com/parking5-1.jpg',
      'https://example.com/parking5-2.jpg',
    ],
    isActive: true,
    isVerified: true,
    operatingHours: {
      monday: { open: '06:00', close: '20:00', isOpen: true },
      tuesday: { open: '06:00', close: '20:00', isOpen: true },
      wednesday: { open: '06:00', close: '20:00', isOpen: true },
      thursday: { open: '06:00', close: '20:00', isOpen: true },
      friday: { open: '06:00', close: '20:00', isOpen: true },
      saturday: { open: '06:00', close: '20:00', isOpen: true },
      sunday: { open: '06:00', close: '20:00', isOpen: true },
    },
    rules: [
      'Tourist-friendly',
      'Tour guide services available',
      'No overnight camping',
      'Follow park rules',
    ],
    contactInfo: {
      phone: '+260977123464',
      email: 'livingstone@bparking.com',
    },
    rating: 4.8,
    totalReviews: 156,
  },
];

export async function seedDatabase() {
  try {
    console.log('🌱 Starting database seeding...');

    // Initialize database connection if not already initialized
    if (!AppDataSource.isInitialized) {
      await AppDataSource.initialize();
    }

    // Get repositories
    const userRepository = AppDataSource.getRepository(User);
    const parkingRepository = AppDataSource.getRepository(Parking);

    // Clear existing data (optional - comment out if you want to keep existing data)
    console.log('🧹 Clearing existing data...');
    // Use query runner to clear all tables with CASCADE
    const queryRunner = AppDataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      await queryRunner.query('TRUNCATE TABLE parkings, users CASCADE');
      await queryRunner.commitTransaction();
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }

    // Create users
    console.log('👥 Creating users...');
    const createdUsers: User[] = [];
    
    for (const userData of usersData) {
      const hashedPassword = await bcrypt.hash(userData.password, 10);
      const user = userRepository.create({
        firstName: userData.firstName,
        lastName: userData.lastName,
        email: userData.email,
        phoneNumber: userData.phoneNumber,
        password: hashedPassword,
        role: userData.role,
        isVerified: userData.isVerified,
        isActive: userData.isActive,
      });
      const savedUser = await userRepository.save(user);
      createdUsers.push(savedUser);
      console.log(`✅ Created user: ${savedUser.firstName} ${savedUser.lastName}`);
    }

    // Create parking locations
    console.log('🚗 Creating parking locations...');
    
    for (let i = 0; i < parkingData.length; i++) {
      const parkingDataItem = parkingData[i];
      const owner = createdUsers.find(user => user.role === 'owner') || createdUsers[0];
      
      if (!owner) {
        throw new Error('No owner user found for parking creation');
      }
      
      const parking = parkingRepository.create({
        ...parkingDataItem,
        ownerId: owner.id,
      });
      
      const savedParking = await parkingRepository.save(parking);
      console.log(`✅ Created parking: ${savedParking.name} in ${savedParking.address.city}`);
    }

    console.log('🎉 Database seeding completed successfully!');
    console.log(`📊 Created ${createdUsers.length} users and ${parkingData.length} parking locations`);
    
    // Display sample queries
    console.log('\n🔍 Sample GraphQL queries to test:');
    console.log(`
# Get all parking locations
query {
  parkings {
    id
    name
    coordinates
    address { city }
    availableSpaces
  }
}

# Find nearby parking in Lusaka
query {
  nearbyParkings(
    latitude: -15.3875
    longitude: 28.3228
    maxDistance: 10000
  ) {
    id
    name
    coordinates
    address { city }
  }
}

# Find parking by city
query {
  parkingsByCity(city: "Lusaka") {
    id
    name
    coordinates
    address { city }
  }
}
    `);

  } catch (error) {
    console.error('❌ Error seeding database:', error);
    throw error;
  }
}

// Run seeding if this file is executed directly
if (require.main === module) {
  seedDatabase()
    .then(() => {
      console.log('✅ Seeding completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Seeding failed:', error);
      process.exit(1);
    });
} 