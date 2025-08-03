import { Resolver, Query, Mutation, Arg, Ctx, UseMiddleware } from 'type-graphql';
import { ObjectType, Field, InputType } from 'type-graphql';
import { Parking } from '@/entities/Parking';
import { AppDataSource } from '@/database/connection';
import { AuthMiddleware, OptionalAuthMiddleware, VerifiedUserMiddleware } from '@/middleware/graphqlAuth';
import { logger } from '@/utils/logger';

// Placeholder types - will be expanded later
@ObjectType()
class ParkingResponse {
  @Field()
  success!: boolean;

  @Field({ nullable: true })
  message?: string;
}

@ObjectType()
class ParkingAddressType {
  @Field()
  street!: string;

  @Field()
  city!: string;

  @Field()
  state!: string;

  @Field()
  zipCode!: string;

  @Field()
  country!: string;
}

@ObjectType()
class ParkingType {
  @Field()
  id!: string;

  @Field()
  name!: string;

  @Field()
  description!: string;

  @Field()
  totalSpaces!: number;

  @Field()
  availableSpaces!: number;

  @Field(() => [Number])
  coordinates!: number[];

  @Field(() => ParkingAddressType)
  address!: ParkingAddressType;
}

@InputType()
class CreateParkingInput {
  @Field()
  name!: string;

  @Field()
  description!: string;

  @Field()
  totalSpaces!: number;
}

interface Context {
  user?: {
    id: string;
    email: string;
    phoneNumber: string;
    role: string;
    isVerified: boolean;
  };
}

@Resolver()
export class ParkingResolver {
  @Query(() => [ParkingType], { nullable: true })
  @UseMiddleware(OptionalAuthMiddleware)
  async parkings(@Ctx() ctx: Context): Promise<ParkingType[] | null> {
    console.log('🚀 [PARKINGS] Query started');
    
    try {
      // Check if database is connected
      if (!AppDataSource.isInitialized) {
        console.error('❌ [PARKINGS] Database not initialized');
        throw new Error('Database connection not available');
      }
      
      console.log('🔧 [PARKINGS] Getting repository...');
      const parkingRepository = AppDataSource.getRepository(Parking);
      console.log('✅ [PARKINGS] Repository obtained successfully');
      
      // First, let's check if there are any parkings at all
      console.log('🔍 [PARKINGS] Checking total parkings count...');
      const totalCount = await parkingRepository.count();
      console.log(`📊 [PARKINGS] Total parkings in database: ${totalCount}`);
      
      // Check active and verified parkings count
      const activeVerifiedCount = await parkingRepository.count({
        where: { isActive: true, isVerified: true }
      });
      console.log(`📊 [PARKINGS] Active and verified parkings: ${activeVerifiedCount}`);
      
      console.log('🔍 [PARKINGS] Executing database query...');
      const parkings = await parkingRepository.find({ 
        where: { isActive: true, isVerified: true },
        select: [
          'id', 'name', 'description', 'totalSpaces', 'availableSpaces',
          'location', 'address', 'pricing', 'amenities', 'rating',
          'totalReviews', 'createdAt', 'updatedAt'
        ],
        order: { createdAt: 'DESC' }
      });
      
      console.log('✅ [PARKINGS] Database query completed');
      console.log('📊 [PARKINGS] Raw result:', {
        type: typeof parkings,
        isArray: Array.isArray(parkings),
        length: parkings?.length,
        firstItem: parkings?.[0] ? 'exists' : 'null'
      });
      
      if (!parkings) {
        console.log('⚠️ [PARKINGS] parkings is null/undefined, returning empty array');
        return [];
      }
      
      if (!Array.isArray(parkings)) {
        console.log('⚠️ [PARKINGS] parkings is not an array, returning empty array');
        return [];
      }
      
      if (parkings.length === 0) {
        console.log('⚠️ [PARKINGS] No parkings found, returning empty array');
        return [];
      }
      
      console.log(`📊 [PARKINGS] Found ${parkings.length} parkings, starting mapping...`);
      
      const mappedParkings = parkings.map((parking, index) => {
        console.log(`🔄 [PARKINGS] Mapping parking ${index + 1}/${parkings.length}:`, {
          id: parking.id,
          name: parking.name,
          hasLocation: !!parking.location,
          hasAddress: !!parking.address
        });
        
        try {
          const mapped = this.mapParkingToType(parking);
          console.log(`✅ [PARKINGS] Successfully mapped parking ${index + 1}`);
          return mapped;
        } catch (mapError: any) {
          console.error(`❌ [PARKINGS] Error mapping parking ${index + 1}:`, mapError);
          throw mapError;
        }
      });
      
      console.log(`✅ [PARKINGS] Successfully mapped all ${mappedParkings.length} parkings`);
      return mappedParkings;
      
    } catch (error: any) {
      console.error('❌ [PARKINGS] Error in parkings query:', {
        message: error.message,
        stack: error.stack,
        name: error.name
      });
      logger.error('Error fetching parkings:', error);
      
      // Return empty array instead of throwing error to prevent GraphQL null return
      console.log('⚠️ [PARKINGS] Returning empty array due to error');
      return [];
    }
  }

  @Query(() => ParkingType, { nullable: true })
  @UseMiddleware(AuthMiddleware)
  async parking(@Arg('id') id: string): Promise<ParkingType | null> {
    try {
      const parkingRepository = AppDataSource.getRepository(Parking);
      const parking = await parkingRepository.findOne({ 
        where: { id, isActive: true },
        select: [
          'id', 'name', 'description', 'totalSpaces', 'availableSpaces',
          'location', 'address', 'pricing', 'amenities', 'rating',
          'totalReviews', 'createdAt', 'updatedAt'
        ]
      });
      
      if (!parking) {
        logger.warn('Parking not found:', { parkingId: id });
        return null;
      }
      
      return this.mapParkingToType(parking);
    } catch (error: any) {
      logger.error('Error fetching parking:', error);
      throw error;
    }
  }

  @Query(() => [ParkingType])
  @UseMiddleware(AuthMiddleware)
  async nearbyParkings(
    @Arg('latitude') latitude: number,
    @Arg('longitude') longitude: number,
    @Arg('maxDistance', { defaultValue: 10000 }) maxDistance: number
  ): Promise<ParkingType[]> {
    try {
      // Validate input parameters
      if (latitude < -90 || latitude > 90) {
        throw new Error('Invalid latitude: must be between -90 and 90');
      }
      if (longitude < -180 || longitude > 180) {
        throw new Error('Invalid longitude: must be between -180 and 180');
      }
      if (maxDistance <= 0 || maxDistance > 50000) {
        throw new Error('Invalid maxDistance: must be between 0 and 50000 meters');
      }

      const parkings = await Parking.findNearby([longitude, latitude], maxDistance);
      logger.info(`Found ${parkings.length} nearby parkings within ${maxDistance}m of [${longitude}, ${latitude}]`);
      return parkings.map(parking => this.mapParkingToType(parking));
    } catch (error: any) {
      logger.error('Error fetching nearby parkings:', error);
      throw error;
    }
  }

  @Query(() => [ParkingType])
  @UseMiddleware(AuthMiddleware)
  async parkingsByCity(@Arg('city') city: string): Promise<ParkingType[]> {
    try {
      // Validate input
      if (!city || city.trim().length === 0) {
        throw new Error('City parameter is required');
      }
      
      const sanitizedCity = city.trim().toLowerCase();
      const parkings = await Parking.findByCity(sanitizedCity);
      logger.info(`Found ${parkings.length} parkings in city: ${sanitizedCity}`);
      return parkings.map(parking => this.mapParkingToType(parking));
    } catch (error: any) {
      logger.error('Error fetching parkings by city:', error);
      throw error;
    }
  }

  @Mutation(() => ParkingResponse)
  @UseMiddleware(VerifiedUserMiddleware)
  async createParking(@Arg('input') input: CreateParkingInput, @Ctx() ctx: Context): Promise<ParkingResponse> {
    try {
      const parkingRepository = AppDataSource.getRepository(Parking);
      const parking = new Parking();
      Object.assign(parking, {
        ...input,
        ownerId: ctx.user!.id,
        availableSpaces: input.totalSpaces,
        // Add other required fields with defaults
        address: {
          street: '',
          city: '',
          state: '',
          zipCode: '',
          country: 'Zambia',
        },
        location: {
          type: 'Point',
          coordinates: [0, 0], // Default coordinates
        },
        pricing: {
          hourly: 0,
          daily: 0,
          weekly: 0,
          monthly: 0,
          currency: 'ZMW',
        },
        contactInfo: {
          phone: ctx.user!.phoneNumber,
          email: ctx.user!.email,
        },
      });

      await parkingRepository.save(parking);

      return {
        success: true,
        message: 'Parking created successfully',
      };
    } catch (error: any) {
      logger.error('Error creating parking:', error);
      return {
        success: false,
        message: 'Failed to create parking',
      };
    }
  }

  private mapParkingToType(parking: Parking): ParkingType {
    // Add safety checks for location and coordinates
    let coordinates: number[] = [0, 0]; // Default coordinates
    
    if (parking.location && parking.location.coordinates && Array.isArray(parking.location.coordinates)) {
      coordinates = parking.location.coordinates;
    } else {
      console.warn(`⚠️ [PARKINGS] Parking ${parking.id} has invalid location data:`, {
        hasLocation: !!parking.location,
        locationType: typeof parking.location,
        hasCoordinates: !!(parking.location && parking.location.coordinates),
        coordinatesType: parking.location ? typeof parking.location.coordinates : 'undefined'
      });
    }
    
    return {
      id: parking.id,
      name: parking.name,
      description: parking.description,
      totalSpaces: parking.totalSpaces,
      availableSpaces: parking.availableSpaces,
      coordinates: coordinates,
      address: parking.address,
    };
  }
} 