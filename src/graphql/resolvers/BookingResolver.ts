import { Resolver, Query, Mutation, Arg, Ctx, UseMiddleware, FieldResolver, Root } from 'type-graphql';
import { ObjectType, Field, InputType, Int } from 'type-graphql';
import { Booking, BookingStatus, PaymentStatus } from '@/entities/Booking';
import { Payment, PaymentMethod } from '@/entities/Payment';
import { Parking } from '@/entities/Parking';
import { User } from '@/entities/User';
import { AppDataSource } from '@/database/connection';
import { AuthMiddleware, VerifiedUserMiddleware } from '@/middleware/graphqlAuth';
import { logger } from '@/utils/logger';
import { Between, In, Not } from 'typeorm';
import { UserType, ParkingType, PaymentType, BookingType, VehicleInfoType } from '../types/shared';

// GraphQL Types

@ObjectType()
class AvailabilityType {
  @Field()
  isAvailable!: boolean;

  @Field(() => [String])
  availableSpaces!: string[];

  @Field()
  totalSpaces!: number;

  @Field()
  availableCount!: number;

  @Field({ nullable: true })
  message?: string;
}

@ObjectType()
class BookingResponse {
  @Field()
  success!: boolean;

  @Field({ nullable: true })
  message?: string;

  @Field(() => BookingType, { nullable: true })
  booking?: BookingType;
}

@ObjectType()
class PricingCalculation {
  @Field()
  baseAmount!: number;

  @Field()
  totalAmount!: number;

  @Field()
  duration!: number;

  @Field()
  currency!: string;

  @Field(() => [PricingBreakdown])
  breakdown!: PricingBreakdown[];
}

@ObjectType()
class PricingBreakdown {
  @Field()
  type!: string;

  @Field()
  amount!: number;

  @Field()
  description!: string;
}

// Input Types
@InputType()
class VehicleInfoInput {
  @Field()
  licensePlate!: string;

  @Field()
  vehicleType!: string;

  @Field({ nullable: true })
  color?: string;

  @Field({ nullable: true })
  make?: string;

  @Field({ nullable: true })
  model?: string;
}

@InputType()
class CreateBookingInput {
  @Field()
  parkingId!: string;

  @Field({ nullable: true })
  spaceId?: string; // If not provided, system will assign

  @Field()
  startTime!: Date;

  @Field()
  endTime!: Date;

  @Field(() => VehicleInfoInput)
  vehicleInfo!: VehicleInfoInput;

  @Field({ nullable: true })
  specialRequests?: string;

  @Field()
  paymentMethod!: PaymentMethod;
}

@InputType()
class ExtendBookingInput {
  @Field()
  bookingId!: string;

  @Field()
  newEndTime!: Date;
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

@Resolver(() => BookingType)
export class BookingResolver {
  // Field Resolvers
  @FieldResolver(() => UserType)
  async user(@Root() booking: Booking): Promise<UserType> {
    const userRepository = AppDataSource.getRepository(User);
    const user = await userRepository.findOneByOrFail({ id: booking.userId });
    return this.mapUserToType(user);
  }

  @FieldResolver(() => ParkingType)
  async parking(@Root() booking: Booking): Promise<ParkingType> {
    const parkingRepository = AppDataSource.getRepository(Parking);
    const parking = await parkingRepository.findOneByOrFail({ id: booking.parkingId });
    return this.mapParkingToType(parking);
  }

  @FieldResolver(() => PaymentType, { nullable: true })
  async payment(@Root() booking: Booking): Promise<PaymentType | null> {
    if (!booking.paymentId) return null;
    const paymentRepository = AppDataSource.getRepository(Payment);
    const payment = await paymentRepository.findOneBy({ id: booking.paymentId });
    return payment ? this.mapPaymentToType(payment) : null;
  }

  // Queries
  @Query(() => [BookingType])
  @UseMiddleware(AuthMiddleware)
  async myBookings(
    @Arg('status', () => String, { nullable: true }) status: BookingStatus | undefined,
    @Arg('limit', () => Int, { defaultValue: 20 }) limit: number,
    @Arg('offset', () => Int, { defaultValue: 0 }) offset: number,
    @Ctx() ctx: Context
  ): Promise<BookingType[]> {
    const bookingRepository = AppDataSource.getRepository(Booking);
    
    const whereCondition: any = { userId: ctx.user!.id };
    if (status) {
      whereCondition.status = status;
    }

    const bookings = await bookingRepository.find({
      where: whereCondition,
      order: { createdAt: 'DESC' },
      take: limit,
      skip: offset
    });

    return bookings;
  }

  @Query(() => BookingType, { nullable: true })
  @UseMiddleware(AuthMiddleware)
  async booking(
    @Arg('id', () => String, { nullable: true }) id: string | undefined,
    @Arg('reference', () => String, { nullable: true }) reference: string | undefined,
    @Ctx() ctx: Context
  ): Promise<BookingType | null> {
    if (!id && !reference) {
      throw new Error('Either id or reference must be provided');
    }

    const bookingRepository = AppDataSource.getRepository(Booking);
    const whereCondition: any = { userId: ctx.user!.id };
    
    if (id) {
      whereCondition.id = id;
    } else {
      whereCondition.bookingReference = reference;
    }

    return await bookingRepository.findOneBy(whereCondition);
  }

  @Query(() => AvailabilityType)
  async checkAvailability(
    @Arg('parkingId') parkingId: string,
    @Arg('startTime') startTime: Date,
    @Arg('endTime') endTime: Date
  ): Promise<AvailabilityType> {
    const parkingRepository = AppDataSource.getRepository(Parking);
    const bookingRepository = AppDataSource.getRepository(Booking);

    // Get parking details
    const parking = await parkingRepository.findOneBy({ id: parkingId });
    if (!parking) {
      throw new Error('Parking not found');
    }

    if (!parking.isActive || !parking.isVerified) {
      return {
        isAvailable: false,
        availableSpaces: [],
        totalSpaces: parking.totalSpaces,
        availableCount: 0,
        message: 'Parking is not available for booking'
      };
    }

    // Check for conflicting bookings
    const conflictingBookings = await bookingRepository.find({
      where: {
        parkingId,
        status: In([BookingStatus.CONFIRMED, BookingStatus.ACTIVE]),
        startTime: Between(startTime, endTime)
      }
    });

    // Get occupied space IDs
    const occupiedSpaceIds = conflictingBookings.map(booking => booking.spaceId);
    
    // Get available spaces
    const availableSpaces = parking.parkingSpaces
      .filter(space => space.isAvailable && !occupiedSpaceIds.includes(space.id))
      .map(space => space.id);

    return {
      isAvailable: availableSpaces.length > 0,
      availableSpaces,
      totalSpaces: parking.totalSpaces,
      availableCount: availableSpaces.length,
      message: availableSpaces.length === 0 ? 'No spaces available for the selected time' : undefined
    };
  }

  @Query(() => PricingCalculation)
  async calculatePricing(
    @Arg('parkingId') parkingId: string,
    @Arg('startTime') startTime: Date,
    @Arg('endTime') endTime: Date
  ): Promise<PricingCalculation> {
    const parkingRepository = AppDataSource.getRepository(Parking);
    const parking = await parkingRepository.findOneBy({ id: parkingId });
    
    if (!parking) {
      throw new Error('Parking not found');
    }

    const duration = Math.ceil((endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60)); // hours
    let baseAmount = 0;
    const breakdown: PricingBreakdown[] = [];

    // Calculate base pricing
    if (duration <= 24) {
      baseAmount = duration * parking.pricing.hourly;
      breakdown.push({
        type: 'hourly',
        amount: baseAmount,
        description: `${duration} hours at ${parking.pricing.hourly} ${parking.pricing.currency}/hour`
      });
    } else {
      const days = Math.ceil(duration / 24);
      baseAmount = days * parking.pricing.daily;
      breakdown.push({
        type: 'daily',
        amount: baseAmount,
        description: `${days} days at ${parking.pricing.daily} ${parking.pricing.currency}/day`
      });
    }

    // Add peak hour surcharge (example: 20% during 7-9 AM and 5-7 PM)
    const startHour = startTime.getHours();
    const endHour = endTime.getHours();
    const isPeakTime = (startHour >= 7 && startHour <= 9) || (startHour >= 17 && startHour <= 19);
    
    let totalAmount = baseAmount;
    if (isPeakTime) {
      const surcharge = baseAmount * 0.2;
      totalAmount += surcharge;
      breakdown.push({
        type: 'peak_surcharge',
        amount: surcharge,
        description: 'Peak hour surcharge (20%)'
      });
    }

    return {
      baseAmount,
      totalAmount,
      duration,
      currency: parking.pricing.currency,
      breakdown
    };
  }

  // Mutations
  @Mutation(() => BookingResponse)
  @UseMiddleware(VerifiedUserMiddleware)
  async createBooking(
    @Arg('input') input: CreateBookingInput,
    @Ctx() ctx: Context
  ): Promise<BookingResponse> {
    const bookingRepository = AppDataSource.getRepository(Booking);
    const parkingRepository = AppDataSource.getRepository(Parking);

    try {
      // Validate parking exists and is available
      const parking = await parkingRepository.findOneBy({ id: input.parkingId });
      if (!parking) {
        return { success: false, message: 'Parking not found' };
      }

      if (!parking.isActive || !parking.isVerified) {
        return { success: false, message: 'Parking is not available for booking' };
      }

      // Check availability
      const availability = await this.checkAvailability(input.parkingId, input.startTime, input.endTime);
      if (!availability.isAvailable) {
        return { success: false, message: availability.message || 'No spaces available' };
      }

      // Assign space if not provided
      const spaceId = input.spaceId || availability.availableSpaces[0];
      if (!spaceId || !availability.availableSpaces.includes(spaceId)) {
        return { success: false, message: 'Selected space is not available' };
      }

      // Calculate pricing
      const pricing = await this.calculatePricing(input.parkingId, input.startTime, input.endTime);

      // Create booking
      const booking = bookingRepository.create({
        userId: ctx.user!.id,
        parkingId: input.parkingId,
        spaceId,
        startTime: input.startTime,
        endTime: input.endTime,
        totalAmount: pricing.totalAmount,
        vehicleInfo: input.vehicleInfo,
        specialRequests: input.specialRequests
      });

      const savedBooking = await bookingRepository.save(booking);

      logger.info(`Booking created: ${savedBooking.bookingReference} for user ${ctx.user!.id}`);

      return {
        success: true,
        message: 'Booking created successfully',
        booking: savedBooking
      };
    } catch (error) {
      logger.error('Error creating booking:', error);
      return {
        success: false,
        message: 'Failed to create booking. Please try again.'
      };
    }
  }

  @Mutation(() => BookingResponse)
  @UseMiddleware(AuthMiddleware)
  async cancelBooking(
    @Arg('bookingId') bookingId: string,
    @Arg('reason', { nullable: true }) reason: string,
    @Ctx() ctx: Context
  ): Promise<BookingResponse> {
    const bookingRepository = AppDataSource.getRepository(Booking);

    try {
      const booking = await bookingRepository.findOneBy({
        id: bookingId,
        userId: ctx.user!.id
      });

      if (!booking) {
        return { success: false, message: 'Booking not found' };
      }

      if (!booking.canBeCancelled()) {
        return { success: false, message: 'Booking cannot be cancelled at this time' };
      }

      const refundAmount = booking.calculateRefundAmount();
      
      booking.status = BookingStatus.CANCELLED;
      booking.cancellationReason = {
        reason: reason || 'Cancelled by user',
        cancelledBy: 'user',
        refundAmount,
        cancelledAt: new Date()
      };

      await bookingRepository.save(booking);

      logger.info(`Booking cancelled: ${booking.bookingReference} by user ${ctx.user!.id}`);

      return {
        success: true,
        message: `Booking cancelled successfully. Refund amount: ${refundAmount}`,
        booking
      };
    } catch (error) {
      logger.error('Error cancelling booking:', error);
      return {
        success: false,
        message: 'Failed to cancel booking. Please try again.'
      };
    }
  }

  @Mutation(() => BookingResponse)
  @UseMiddleware(AuthMiddleware)
  async checkInBooking(
    @Arg('bookingId') bookingId: string,
    @Ctx() ctx: Context
  ): Promise<BookingResponse> {
    const bookingRepository = AppDataSource.getRepository(Booking);

    try {
      const booking = await bookingRepository.findOneBy({
        id: bookingId,
        userId: ctx.user!.id
      });

      if (!booking) {
        return { success: false, message: 'Booking not found' };
      }

      if (!booking.canCheckIn) {
        return { success: false, message: 'Check-in not available for this booking' };
      }

      booking.checkInTime = new Date();
      booking.status = BookingStatus.ACTIVE;

      await bookingRepository.save(booking);

      logger.info(`Check-in completed: ${booking.bookingReference} by user ${ctx.user!.id}`);

      return {
        success: true,
        message: 'Check-in successful',
        booking
      };
    } catch (error) {
      logger.error('Error checking in:', error);
      return {
        success: false,
        message: 'Failed to check in. Please try again.'
      };
    }
  }

  @Mutation(() => BookingResponse)
  @UseMiddleware(AuthMiddleware)
  async checkOutBooking(
    @Arg('bookingId') bookingId: string,
    @Ctx() ctx: Context
  ): Promise<BookingResponse> {
    const bookingRepository = AppDataSource.getRepository(Booking);

    try {
      const booking = await bookingRepository.findOneBy({
        id: bookingId,
        userId: ctx.user!.id
      });

      if (!booking) {
        return { success: false, message: 'Booking not found' };
      }

      if (!booking.canCheckOut) {
        return { success: false, message: 'Check-out not available for this booking' };
      }

      booking.checkOutTime = new Date();
      booking.status = BookingStatus.COMPLETED;

      await bookingRepository.save(booking);

      logger.info(`Check-out completed: ${booking.bookingReference} by user ${ctx.user!.id}`);

      return {
        success: true,
        message: 'Check-out successful',
        booking
      };
    } catch (error) {
      logger.error('Error checking out:', error);
      return {
        success: false,
        message: 'Failed to check out. Please try again.'
      };
    }
  }

  @Mutation(() => BookingResponse)
  @UseMiddleware(AuthMiddleware)
  async extendBooking(
    @Arg('input') input: ExtendBookingInput,
    @Ctx() ctx: Context
  ): Promise<BookingResponse> {
    const bookingRepository = AppDataSource.getRepository(Booking);

    try {
      const booking = await bookingRepository.findOneBy({
        id: input.bookingId,
        userId: ctx.user!.id
      });

      if (!booking) {
        return { success: false, message: 'Booking not found' };
      }

      if (!booking.canBeExtended()) {
        return { success: false, message: 'Booking cannot be extended' };
      }

      if (input.newEndTime <= booking.endTime) {
        return { success: false, message: 'New end time must be after current end time' };
      }

      // Check availability for extension period
      const availability = await this.checkAvailability(
        booking.parkingId,
        booking.endTime,
        input.newEndTime
      );

      if (!availability.isAvailable) {
        return { success: false, message: 'Extension not available due to conflicting bookings' };
      }

      // Calculate additional cost
      const additionalPricing = await this.calculatePricing(
        booking.parkingId,
        booking.endTime,
        input.newEndTime
      );

      // Update booking
      const originalEndTime = booking.endTime;
      booking.endTime = input.newEndTime;
      booking.totalAmount += additionalPricing.totalAmount;
      
      // Add to extension history
      if (!booking.extensionHistory) {
        booking.extensionHistory = [];
      }
      booking.extensionHistory.push({
        originalEndTime,
        newEndTime: input.newEndTime,
        additionalAmount: additionalPricing.totalAmount,
        extendedAt: new Date()
      });

      await bookingRepository.save(booking);

      logger.info(`Booking extended: ${booking.bookingReference} by user ${ctx.user!.id}`);

      return {
        success: true,
        message: `Booking extended successfully. Additional cost: ${additionalPricing.totalAmount}`,
        booking
      };
    } catch (error) {
      logger.error('Error extending booking:', error);
      return {
        success: false,
        message: 'Failed to extend booking. Please try again.'
      };
    }
  }

  private mapUserToType(user: User): UserType {
    return {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      phoneNumber: user.phoneNumber,
      role: user.role,
      isVerified: user.isVerified,
      isActive: user.isActive,
      profilePicture: user.profilePicture,
      dateOfBirth: user.dateOfBirth,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt
    };
  }

  private mapParkingToType(parking: Parking): ParkingType {
    return {
      id: parking.id,
      name: parking.name,
      description: parking.description,
      fullAddress: parking.fullAddress,
      totalSpaces: parking.totalSpaces,
      availableSpaces: parking.availableSpaces,
      coordinates: parking.location?.coordinates || [],
      address: parking.address,
      hourlyRate: parking.pricing.hourly,
      dailyRate: parking.pricing.daily,
      currency: parking.pricing.currency,
      isActive: parking.isActive,
      isVerified: parking.isVerified,
      rating: parking.rating,
      totalReviews: parking.totalReviews,
      createdAt: parking.createdAt,
      updatedAt: parking.updatedAt
    };
  }

  private mapPaymentToType(payment: Payment): PaymentType {
    return {
      id: payment.id,
      bookingId: payment.bookingId,
      userId: payment.userId,
      amount: payment.amount,
      currency: payment.currency,
      transactionId: payment.transactionId,
      providerTransactionId: payment.providerTransactionId,
      status: payment.status,
      paidAt: payment.paidAt,
      createdAt: payment.createdAt,
      updatedAt: payment.updatedAt
    };
  }
}