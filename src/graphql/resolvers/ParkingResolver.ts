import { Resolver, Query, Mutation, Arg, Ctx, UseMiddleware, FieldResolver, Root, Int } from 'type-graphql';
import { ObjectType, Field, InputType } from 'type-graphql';
import { Parking } from '../../entities/Parking';
import { Booking } from '../../entities/Booking';
import { AppDataSource } from '../../database/connection';
import { AuthMiddleware, OptionalAuthMiddleware, VerifiedUserMiddleware } from '../../middleware/graphqlAuth';
import { logger } from '../../utils/logger';
import { Between, MoreThanOrEqual, LessThanOrEqual } from 'typeorm';
import { ParkingType, ParkingAddressType } from '../types/shared';

// GraphQL Types
@ObjectType()
class ParkingResponse {
  @Field()
  success!: boolean;

  @Field({ nullable: true })
  message?: string;
}

@ObjectType()
class SpaceAvailabilityType {
  @Field(() => String)
  spaceId!: string;

  @Field(() => Boolean)
  isAvailable!: boolean;

  @Field(() => String, { nullable: true })
  bookedUntil?: string;

  @Field(() => String, { nullable: true })
  nextAvailableTime?: string;
}

@ObjectType()
class ParkingAvailabilityType {
  @Field()
  parkingId!: string;

  @Field(() => Int)
  totalSpaces!: number;

  @Field(() => Int)
  availableSpaces!: number;

  @Field(() => [SpaceAvailabilityType])
  spaces!: SpaceAvailabilityType[];

  @Field(() => Boolean)
  hasAvailability!: boolean;
}

@InputType()
class CheckAvailabilityInput {
  @Field()
  parkingId!: string;

  @Field()
  startTime!: string;

  @Field()
  endTime!: string;

  @Field(() => Int, { nullable: true })
  requiredSpaces?: number;
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

@Resolver(() => ParkingType)
export class ParkingResolver {
  // Field Resolvers
  @FieldResolver(() => [String])
  async availableSpaceIds(@Root() parking: ParkingType): Promise<string[]> {
    const bookingRepository = AppDataSource.getRepository(Booking);
    const now = new Date();
    
    // Get all currently booked spaces
    const bookedSpaces = await bookingRepository
      .createQueryBuilder('booking')
      .select('booking.spaceId')
      .where('booking.parkingId = :parkingId', { parkingId: parking.id })
      .andWhere('booking.status IN (:...statuses)', { statuses: ['confirmed', 'checked_in'] })
      .andWhere('booking.startTime <= :now', { now })
      .andWhere('booking.endTime > :now', { now })
      .getRawMany();
    
    const bookedSpaceIds = bookedSpaces.map((space: any) => space.booking_spaceId);
    
    // Generate available space IDs (1 to totalSpaces minus booked ones)
    const allSpaceIds = Array.from({ length: parking.totalSpaces }, (_, i) => (i + 1).toString());
    return allSpaceIds.filter(spaceId => !bookedSpaceIds.includes(spaceId));
  }

  @FieldResolver(() => Number)
  async hourlyRate(@Root() parking: ParkingType): Promise<number> {
    const parkingRepository = AppDataSource.getRepository(Parking);
    const fullParking = await parkingRepository.findOneBy({ id: parking.id });
    return fullParking?.pricing?.hourly || 0;
  }

  @FieldResolver(() => Number)
  async dailyRate(@Root() parking: ParkingType): Promise<number> {
    const parkingRepository = AppDataSource.getRepository(Parking);
    const fullParking = await parkingRepository.findOneBy({ id: parking.id });
    return fullParking?.pricing?.daily || 0;
  }
  // Queries
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

  @Query(() => ParkingAvailabilityType)
  @UseMiddleware(AuthMiddleware)
  async checkParkingAvailability(@Arg('input') input: CheckAvailabilityInput): Promise<ParkingAvailabilityType> {
    const bookingRepository = AppDataSource.getRepository(Booking);
    const parkingRepository = AppDataSource.getRepository(Parking);

    try {
      // Validate parking exists
      const parking = await parkingRepository.findOneBy({ id: input.parkingId });
      if (!parking) {
        throw new Error('Parking not found');
      }

      const startTime = new Date(input.startTime);
      const endTime = new Date(input.endTime);

      // Get all bookings that overlap with the requested time range
      const overlappingBookings = await bookingRepository
        .createQueryBuilder('booking')
        .where('booking.parkingId = :parkingId', { parkingId: input.parkingId })
        .andWhere('booking.status IN (:...statuses)', { statuses: ['confirmed', 'checked_in'] })
        .andWhere(
          '(booking.startTime < :endTime AND booking.endTime > :startTime)',
          { startTime, endTime }
        )
        .getMany();

      const bookedSpaceIds = overlappingBookings.map((booking: Booking) => booking.spaceId);
      const allSpaceIds = Array.from({ length: parking.totalSpaces }, (_, i) => (i + 1).toString());
      const availableSpaceIds = allSpaceIds.filter(spaceId => !bookedSpaceIds.includes(spaceId));

      // Generate space availability details
      const spaces: SpaceAvailabilityType[] = allSpaceIds.map(spaceId => {
        const isAvailable = !bookedSpaceIds.includes(spaceId);
        let bookedUntil: string | undefined;
        let nextAvailableTime: string | undefined;

        if (!isAvailable) {
          const booking = overlappingBookings.find((b: Booking) => b.spaceId === spaceId);
          if (booking) {
            bookedUntil = booking.endTime.toISOString();
            nextAvailableTime = booking.endTime.toISOString();
          }
        }

        return {
          spaceId,
          isAvailable,
          bookedUntil,
          nextAvailableTime
        };
      });

      const requiredSpaces = input.requiredSpaces || 1;
      const hasAvailability = availableSpaceIds.length >= requiredSpaces;

      return {
        parkingId: input.parkingId,
        totalSpaces: parking.totalSpaces,
        availableSpaces: availableSpaceIds.length,
        spaces,
        hasAvailability
      };
    } catch (error) {
      logger.error('Error checking parking availability:', error);
      throw error;
    }
  }

  @Query(() => [ParkingType])
  @UseMiddleware(AuthMiddleware)
  async availableParkings(
    @Arg('startTime') startTime: string,
    @Arg('endTime') endTime: string,
    @Arg('latitude', { nullable: true }) latitude?: number,
    @Arg('longitude', { nullable: true }) longitude?: number,
    @Arg('maxDistance', { defaultValue: 10000 }) maxDistance: number = 10000
  ): Promise<ParkingType[]> {
    const parkingRepository = AppDataSource.getRepository(Parking);
    const bookingRepository = AppDataSource.getRepository(Booking);

    try {
      const start = new Date(startTime);
      const end = new Date(endTime);

      // Get all active parkings
      let parkingsQuery = parkingRepository
        .createQueryBuilder('parking')
        .where('parking.isActive = :isActive', { isActive: true })
        .andWhere('parking.isVerified = :isVerified', { isVerified: true });

      // Add location filter if coordinates provided
      if (latitude && longitude) {
        parkingsQuery = parkingsQuery
          .andWhere(
            'ST_DWithin(parking.location, ST_SetSRID(ST_MakePoint(:longitude, :latitude), 4326), :maxDistance)',
            { latitude, longitude, maxDistance }
          );
      }

      const parkings = await parkingsQuery.getMany();

      // Filter parkings that have availability
      const availableParkings: Parking[] = [];

      for (const parking of parkings) {
        const overlappingBookings = await bookingRepository
          .createQueryBuilder('booking')
          .where('booking.parkingId = :parkingId', { parkingId: parking.id })
          .andWhere('booking.status IN (:...statuses)', { statuses: ['confirmed', 'checked_in'] })
          .andWhere(
            '(booking.startTime < :endTime AND booking.endTime > :startTime)',
            { startTime: start, endTime: end }
          )
          .getCount();

        if (overlappingBookings < parking.totalSpaces) {
          availableParkings.push(parking);
        }
      }

      return availableParkings.map(parking => this.mapParkingToType(parking));
    } catch (error) {
      logger.error('Error fetching available parkings:', error);
      throw error;
    }
  }

  // Mutations
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
      fullAddress: parking.fullAddress,
      totalSpaces: parking.totalSpaces,
      availableSpaces: parking.availableSpaces,
      coordinates: coordinates,
      address: parking.address,
      hourlyRate: parking.pricing?.hourly || 0,
      dailyRate: parking.pricing?.daily || 0,
      currency: parking.pricing?.currency || 'USD',
      isActive: parking.isActive,
      isVerified: parking.isVerified,
      rating: parking.rating || 0,
      totalReviews: parking.totalReviews || 0,
      createdAt: parking.createdAt,
      updatedAt: parking.updatedAt
    };
  }
}