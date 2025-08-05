import { Resolver, Mutation, Query, Arg, Ctx, UseMiddleware, ID } from 'type-graphql';
import { AppDataSource } from '../../database/connection';
import { RecurringBooking, RecurringBookingStatus, RecurrencePattern } from '../../entities/RecurringBooking';
import { User } from '../../entities/User';
import { Parking } from '../../entities/Parking';
import { Booking, BookingStatus } from '../../entities/Booking';
import { AuthMiddleware } from '../../middleware/graphqlAuth';
import { Context } from '../../type';
import NotificationService from '../../services/notification';
import WebSocketService from '../../services/websocket';
import { MoreThan, LessThan, In } from 'typeorm';
import { RecurringBookingType, BookingType } from '../types/shared';

@Resolver()
export class RecurringBookingResolver {
  private notificationService: NotificationService;
  private webSocketService?: WebSocketService;

  constructor() {
    this.notificationService = new NotificationService();
    // WebSocket service will be injected when available
  }

  setWebSocketService(webSocketService: WebSocketService): void {
    this.webSocketService = webSocketService;
  }

  @Mutation(() => RecurringBookingType)
  @UseMiddleware(AuthMiddleware)
  async createRecurringBooking(
    @Arg('parkingId', () => ID) parkingId: string,
    @Arg('recurrencePattern') recurrencePattern: RecurrencePattern,
    @Arg('startTime') startTime: string, // Format: "HH:MM"
    @Arg('endTime') endTime: string, // Format: "HH:MM"
    @Arg('duration') duration: number, // Duration in hours
    @Arg('startDate') startDate: Date,
    @Ctx() context: Context,
    @Arg('endDate', { nullable: true }) endDate?: Date,
    @Arg('maxOccurrences', { nullable: true }) maxOccurrences?: number,
    @Arg('vehicleInfo', { nullable: true }) vehicleInfo?: string,
    @Arg('specialRequests', { nullable: true }) specialRequests?: string,
    @Arg('autoPayment', { defaultValue: false }) autoPayment?: boolean,
    @Arg('paymentMethodId', { nullable: true }) paymentMethodId?: string
  ): Promise<RecurringBookingType> {
    const recurringBookingRepository = AppDataSource.getRepository(RecurringBooking);
    const parkingRepository = AppDataSource.getRepository(Parking);
    const userRepository = AppDataSource.getRepository(User);

    // Validate parking exists
    const parking = await parkingRepository.findOne({ where: { id: parkingId } });
    if (!parking) {
      throw new Error('Parking not found');
    }

    // Check authentication
    if (!context.user) {
      throw new Error('Authentication required');
    }

    // Validate user exists
    const user = await userRepository.findOne({ where: { id: context.user.id } });
    if (!user) {
      throw new Error('User not found');
    }

    // Validate time format
    const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
    if (!timeRegex.test(startTime) || !timeRegex.test(endTime)) {
      throw new Error('Invalid time format. Use HH:MM format.');
    }

    // Validate start date is in the future
    if (startDate <= new Date()) {
      throw new Error('Start date must be in the future');
    }

    // Validate end date if provided
    if (endDate && endDate <= startDate) {
      throw new Error('End date must be after start date');
    }

    // Validate max occurrences
    if (maxOccurrences && maxOccurrences <= 0) {
      throw new Error('Max occurrences must be greater than 0');
    }

    // Calculate base price
    const basePrice = duration * parking.pricing.hourly;

    // Create recurring booking
    const recurringBooking = new RecurringBooking();
    recurringBooking.userId = context.user.id;
    recurringBooking.parkingId = parkingId;
    recurringBooking.pattern = recurrencePattern;
    recurringBooking.startTime = startTime;
    recurringBooking.endTime = endTime;
    recurringBooking.duration = duration;
    recurringBooking.startDate = startDate;
    recurringBooking.endDate = endDate;
    recurringBooking.maxOccurrences = maxOccurrences;
    recurringBooking.vehicleInfo = vehicleInfo 
      ? (typeof vehicleInfo === 'string' 
          ? { licensePlate: vehicleInfo, vehicleType: 'car' }
          : vehicleInfo)
      : { licensePlate: '', vehicleType: 'car' };
    recurringBooking.specialRequests = specialRequests;
    recurringBooking.basePrice = basePrice;
    recurringBooking.currency = 'ZMW'; // Default currency
    recurringBooking.autoPayment = autoPayment || false;
    if (paymentMethodId) {
      recurringBooking.paymentMethod = {
        type: 'card',
        provider: paymentMethodId
      };
    }
    recurringBooking.status = RecurringBookingStatus.ACTIVE;
    recurringBooking.nextBookingDate = startDate;

    const savedRecurringBooking = await recurringBookingRepository.save(recurringBooking);

    // Send confirmation notification
    await this.notificationService.sendNotification(context.user.id, {
      title: 'Recurring Booking Created',
      body: `Your recurring booking at ${parking.name} has been set up successfully`,
      type: 'booking',
      data: {
        recurringBookingId: savedRecurringBooking.id,
        parkingName: parking.name,
        pattern: recurrencePattern
      }
    });

    return savedRecurringBooking;
  }

  @Mutation(() => Boolean)
  @UseMiddleware(AuthMiddleware)
  async pauseRecurringBooking(
    @Arg('recurringBookingId', () => ID) recurringBookingId: string,
    @Ctx() context: Context
  ): Promise<boolean> {
    if (!context.user) {
      throw new Error('Authentication required');
    }

    const recurringBookingRepository = AppDataSource.getRepository(RecurringBooking);

    const recurringBooking = await recurringBookingRepository.findOne({
      where: {
        id: recurringBookingId,
        userId: context.user.id
      },
      relations: ['parking']
    });

    if (!recurringBooking) {
      throw new Error('Recurring booking not found');
    }

    if (recurringBooking.status !== RecurringBookingStatus.ACTIVE) {
      throw new Error('Can only pause active recurring bookings');
    }

    recurringBooking.pause();
    await recurringBookingRepository.save(recurringBooking);

    // Send notification
    await this.notificationService.sendNotification(context.user.id, {
      title: 'Recurring Booking Paused',
      body: `Your recurring booking at ${recurringBooking.parking.name} has been paused`,
      type: 'booking',
      data: {
        recurringBookingId: recurringBooking.id,
        parkingName: recurringBooking.parking.name
      }
    });

    return true;
  }

  @Mutation(() => Boolean)
  @UseMiddleware(AuthMiddleware)
  async resumeRecurringBooking(
    @Arg('recurringBookingId', () => ID) recurringBookingId: string,
    @Ctx() context: Context
  ): Promise<boolean> {
    if (!context.user) {
      throw new Error('Authentication required');
    }

    const recurringBookingRepository = AppDataSource.getRepository(RecurringBooking);

    const recurringBooking = await recurringBookingRepository.findOne({
      where: {
        id: recurringBookingId,
        userId: context.user.id
      },
      relations: ['parking']
    });

    if (!recurringBooking) {
      throw new Error('Recurring booking not found');
    }

    if (recurringBooking.status !== RecurringBookingStatus.PAUSED) {
      throw new Error('Can only resume paused recurring bookings');
    }

    recurringBooking.resume();
    // Update next booking date to ensure it's in the future
    recurringBooking.updateNextBookingDate();
    await recurringBookingRepository.save(recurringBooking);

    // Send notification
    await this.notificationService.sendNotification(context.user.id, {
      title: 'Recurring Booking Resumed',
      body: `Your recurring booking at ${recurringBooking.parking.name} has been resumed`,
      type: 'booking',
      data: {
        recurringBookingId: recurringBooking.id,
        parkingName: recurringBooking.parking.name
      }
    });

    return true;
  }

  @Mutation(() => Boolean)
  @UseMiddleware(AuthMiddleware)
  async cancelRecurringBooking(
    @Arg('recurringBookingId', () => ID) recurringBookingId: string,
    @Ctx() context: Context
  ): Promise<boolean> {
    if (!context.user) {
      throw new Error('Authentication required');
    }

    const recurringBookingRepository = AppDataSource.getRepository(RecurringBooking);

    const recurringBooking = await recurringBookingRepository.findOne({
      where: {
        id: recurringBookingId,
        userId: context.user.id
      },
      relations: ['parking']
    });

    if (!recurringBooking) {
      throw new Error('Recurring booking not found');
    }

    if (recurringBooking.status === RecurringBookingStatus.CANCELLED) {
      throw new Error('Recurring booking is already cancelled');
    }

    recurringBooking.cancel();
    await recurringBookingRepository.save(recurringBooking);

    // Send notification
    await this.notificationService.sendNotification(context.user.id, {
      title: 'Recurring Booking Cancelled',
      body: `Your recurring booking at ${recurringBooking.parking.name} has been cancelled`,
      type: 'booking',
      data: {
        recurringBookingId: recurringBooking.id,
        parkingName: recurringBooking.parking.name
      }
    });

    return true;
  }

  @Mutation(() => RecurringBookingType)
  @UseMiddleware(AuthMiddleware)
  async updateRecurringBooking(
    @Arg('recurringBookingId', () => ID) recurringBookingId: string,
    @Ctx() context: Context,
    @Arg('startTime', { nullable: true }) startTime?: string,
    @Arg('endTime', { nullable: true }) endTime?: string,
    @Arg('duration', { nullable: true }) duration?: number,
    @Arg('endDate', { nullable: true }) endDate?: Date,
    @Arg('maxOccurrences', { nullable: true }) maxOccurrences?: number,
    @Arg('vehicleInfo', { nullable: true }) vehicleInfo?: string,
    @Arg('specialRequests', { nullable: true }) specialRequests?: string,
    @Arg('autoPayment', { nullable: true }) autoPayment?: boolean,
    @Arg('paymentMethodId', { nullable: true }) paymentMethodId?: string
  ): Promise<RecurringBookingType> {
    if (!context.user) {
      throw new Error('Authentication required');
    }

    const recurringBookingRepository = AppDataSource.getRepository(RecurringBooking);
    const parkingRepository = AppDataSource.getRepository(Parking);

    const recurringBooking = await recurringBookingRepository.findOne({
      where: {
        id: recurringBookingId,
        userId: context.user.id
      },
      relations: ['parking']
    });

    if (!recurringBooking) {
      throw new Error('Recurring booking not found');
    }

    if (recurringBooking.status === RecurringBookingStatus.CANCELLED) {
      throw new Error('Cannot update cancelled recurring booking');
    }

    // Validate time format if provided
    const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
    if (startTime && !timeRegex.test(startTime)) {
      throw new Error('Invalid start time format. Use HH:MM format.');
    }
    if (endTime && !timeRegex.test(endTime)) {
      throw new Error('Invalid end time format. Use HH:MM format.');
    }

    // Update fields
    if (startTime) recurringBooking.startTime = startTime;
    if (endTime) recurringBooking.endTime = endTime;
    if (duration) recurringBooking.duration = duration;
    if (endDate !== undefined) recurringBooking.endDate = endDate;
    if (maxOccurrences !== undefined) recurringBooking.maxOccurrences = maxOccurrences;
    if (vehicleInfo !== undefined) {
      recurringBooking.vehicleInfo = typeof vehicleInfo === 'string' 
        ? { licensePlate: vehicleInfo, vehicleType: 'car' }
        : vehicleInfo;
    }
    if (specialRequests !== undefined) recurringBooking.specialRequests = specialRequests;
    if (autoPayment !== undefined) recurringBooking.autoPayment = autoPayment;
    if (paymentMethodId !== undefined) {
      recurringBooking.paymentMethod = {
        type: 'card',
        provider: paymentMethodId
      };
    }

    // Recalculate base price if duration changed
    if (duration) {
      const parking = await parkingRepository.findOne({ where: { id: recurringBooking.parkingId } });
      if (parking) {
        recurringBooking.basePrice = duration * parking.pricing.hourly;
      }
    }

    const savedRecurringBooking = await recurringBookingRepository.save(recurringBooking);

    // Send notification
    await this.notificationService.sendNotification(context.user.id, {
      title: 'Recurring Booking Updated',
      body: `Your recurring booking at ${recurringBooking.parking.name} has been updated`,
      type: 'booking',
      data: {
        recurringBookingId: recurringBooking.id,
        parkingName: recurringBooking.parking.name
      }
    });

    return savedRecurringBooking;
  }

  @Query(() => [RecurringBookingType])
  @UseMiddleware(AuthMiddleware)
  async myRecurringBookings(
    @Ctx() context: Context
  ): Promise<RecurringBookingType[]> {
    if (!context.user) {
      throw new Error('Authentication required');
    }

    const recurringBookingRepository = AppDataSource.getRepository(RecurringBooking);

    return await recurringBookingRepository.find({
      where: {
        userId: context.user.id,
        status: In([RecurringBookingStatus.ACTIVE, RecurringBookingStatus.PAUSED])
      },
      relations: ['parking'],
      order: {
        createdAt: 'DESC'
      }
    });
  }

  @Query(() => [RecurringBookingType])
  @UseMiddleware(AuthMiddleware)
  async recurringBookingHistory(
    @Ctx() context: Context
  ): Promise<RecurringBookingType[]> {
    if (!context.user) {
      throw new Error('Authentication required');
    }

    const recurringBookingRepository = AppDataSource.getRepository(RecurringBooking);

    return await recurringBookingRepository.find({
      where: {
        userId: context.user.id
      },
      relations: ['parking'],
      order: {
        createdAt: 'DESC'
      },
      take: 50 // Limit to last 50 entries
    });
  }

  @Query(() => RecurringBookingType)
  @UseMiddleware(AuthMiddleware)
  async getRecurringBooking(
    @Arg('recurringBookingId', () => ID) recurringBookingId: string,
    @Ctx() context: Context
  ): Promise<RecurringBookingType> {
    if (!context.user) {
      throw new Error('Authentication required');
    }

    const recurringBookingRepository = AppDataSource.getRepository(RecurringBooking);

    const recurringBooking = await recurringBookingRepository.findOne({
      where: {
        id: recurringBookingId,
        userId: context.user.id
      },
      relations: ['parking']
    });

    if (!recurringBooking) {
      throw new Error('Recurring booking not found');
    }

    return recurringBooking;
  }

  @Query(() => [BookingType])
  @UseMiddleware(AuthMiddleware)
  async getRecurringBookingHistory(
    @Arg('recurringBookingId', () => ID) recurringBookingId: string,
    @Ctx() context: Context
  ): Promise<BookingType[]> {
    if (!context.user) {
      throw new Error('Authentication required');
    }

    const recurringBookingRepository = AppDataSource.getRepository(RecurringBooking);
    const bookingRepository = AppDataSource.getRepository(Booking);

    const recurringBooking = await recurringBookingRepository.findOne({
      where: {
        id: recurringBookingId,
        userId: context.user.id
      }
    });

    if (!recurringBooking) {
      throw new Error('Recurring booking not found');
    }

    // Get booking IDs from history
    const bookingIds = recurringBooking.bookingHistory?.map(entry => entry.bookingId) || [];

    if (bookingIds.length === 0) {
      return [];
    }

    return await bookingRepository.find({
      where: {
        id: In(bookingIds)
      },
      relations: ['parking'],
      order: {
        startTime: 'DESC'
      }
    });
  }

  @Query(() => Date)
  @UseMiddleware(AuthMiddleware)
  async getNextBookingDate(
    @Arg('recurringBookingId', () => ID) recurringBookingId: string,
    @Ctx() context: Context
  ): Promise<Date> {
    if (!context.user) {
      throw new Error('Authentication required');
    }

    const recurringBookingRepository = AppDataSource.getRepository(RecurringBooking);

    const recurringBooking = await recurringBookingRepository.findOne({
      where: {
        id: recurringBookingId,
        userId: context.user.id
      }
    });

    if (!recurringBooking) {
      throw new Error('Recurring booking not found');
    }

    return recurringBooking.nextBookingDate;
  }
}